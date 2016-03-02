/**
 * PostCSS Sassy Import
 * Implements imports like Sass, plus:
 * - Import only one time by default
 * - Import Sass, CSS, and JSON files
 */

"use strict";

// Our plugin!
let plugin;

const path = require("path");
const glob = require("glob");

const fsUtil = require("./lib/fs-util");
const toSCSS = require("./lib/to-scss");

const postcss = require("postcss");
const syntaxSCSS = require("postcss-scss");

/**
 * Takes a resolved file path and returns the correct loader for it, if one is found.
 */
function getLoader(loaders, filePath) {
	for (const loader of loaders) {
		if (loader.test(filePath)) {
			return loader.method;
		}
	}
}

/**
 * A promiseified version of glob
 */
function globPromise(dir) {
	return new Promise((resolve, reject) => {
		glob(dir, (err, matches) => {
			if (err) {
				return reject(err);
			}

			resolve(matches);
		});
	});
}

plugin = postcss.plugin("postcss-sassy-import", function(opts) {
	opts = Object.assign({}, opts) || {};

	// Files that have already been loaded
	const loaded = opts.loaded || new Set();
	opts.loaded = loaded;

	const dedup = opts.dedup != null ? opts.dedup : true;

	// File formats we accept
	const formats = opts.formats || [
		"%", // full file path
		"%.scss", // SCSS
		"_%.scss", // SCSS partial
		"%.css", // CSS
		"%.json", // JSON data (Sass variables)
		"%/style.scss" // Folder containing SCSS
	];

	opts.formats = formats;

	// Loaders based on file
	// For these loaders, the only plugin PostCSS needs is this import plugin.
	// All other plugins will run over the source afterwards.
	const loaders = opts.loaders || [
		{
			test: (file) => /\.scss$/.test(file),
			method: (wrapped, opts) => {
				opts = opts || {};

				return postcss([ plugin(opts) ])
					.process(wrapped.contents, {
						from: wrapped.path,
						syntax: syntaxSCSS
					});
			}
		},
		{
			test: (file) => /\.css$/.test(file),
			method: (wrapped, opts) => {
				opts = opts || {};

				return postcss([ plugin(opts) ])
					.process(wrapped.contents, {
						from: wrapped.path
					});
			}
		},
		{
			test: (file) => /\.json$/.test(file),
			method: (wrapped, opts) => {
				const data = JSON.parse(wrapped.contents);

				const scss = toSCSS.fromRootObject(data);

				return postcss([ plugin(opts) ])
					.process(scss, {
						from: wrapped.path,
						syntax: syntaxSCSS
					});
			}
		}
	];

	opts.loaders = loaders;

	if (opts.plugins) {
		opts.plugins.forEach(plugin => {
			plugin(opts);
		});

		delete opts.plugins;
	}

	return (css, result) => {
		// Returns Promise<PostCSSNode>
		const processNormal = (unresolved, options) => {
			const dedup = options.dedup;

			let mergedOpts = Object.assign({}, opts, options);

			return Promise.resolve()
				.then(() => {
					const possible = fsUtil.resolvePath(formats, unresolved);

					return fsUtil.getFileOneOf(possible);
				})
				.then((file) => {
					// TODO: better error handler
					if (file instanceof Error) {
						throw file;
					}

					if (dedup && loaded.has(file.path)) {
						return;
					}

					loaded.add(file.path);

					const loader = getLoader(loaders, file.path);

					return loader(file, mergedOpts)
						.then(r => r.root);
				});
		};

		// Returns Promise<PostCSSNode[]>
		const processGlob = (unresolved, options) => {
			const dedup = options.dedup;

			let mergedOpts = Object.assign({}, opts, options);

			return Promise.resolve()
				.then(() => globPromise(unresolved))
				.then(matches => {
					// Early-out for globbed files
					if (dedup) {
						matches = matches.filter(file => !loaded.has(file));
					}

					return fsUtil.getFilesAllOf(matches);
				}).then(matches => {
					// Progressively build up a PostCSSNode[]
					let prom = Promise.resolve([]);

					for (const match of matches) {
						const loader = getLoader(loaders, match.path);

						// TODO: add config option for this
						if (!loader) {
							console.warn("Couldn't find loader for ", match.path, " -- skipping...");
							continue;
						}

						prom = prom.then((result) => {
							// This file could've been loaded as a dep earlier in the glob
							if (dedup && loaded.has(match.path)) {
								return result;
							}

							loaded.add(match.path);

							return loader(match, mergedOpts)
								.then(res => {
									result.push(res);

									return result;
								});
						});
					}

					return prom
						.then(results => results.map(r => r.root));
				});
		};

		// Our workhorse!
		return new Promise((resolve, reject) => {
			let prom = Promise.resolve();

			css.walkAtRules("import", (node) => {
				// Strip off quotes, single and double
				const matches = node.params.trim().match(/^['"](.+?)['"](.*)/);

				if (matches == null) {
					return;
				}

				const modes = matches[2].trim().split(" ");
				const fragment = matches[1];

				let dedupThis = dedup;

				if (modes.indexOf("!once") > -1) {
					dedupThis = true;
				} else if (modes.indexOf("!multiple") > -1) {
					dedupThis = false;
				}

				const origin = node.source.input.file;

				const unresolved = path.normalize(path.join(path.dirname(origin), fragment));

				if (glob.hasMagic(fragment)) {
					prom = prom.then(() => {
						return processGlob(unresolved, {
							dedup: dedupThis
						});
					}).then(newNodes => {
						if (newNodes.length > 0) {
							node.replaceWith(...newNodes);
						} else {
							node.remove();
						}
					});
				} else {
					prom = prom.then(() => {
						return processNormal(unresolved, {
							dedup: dedupThis
						});
					}).then(newNode => {
						if (newNode) {
							node.replaceWith(newNode);
						} else {
							node.remove();
						}
					});
				}
			});

			resolve(prom);
		});
	};
});

module.exports = plugin;