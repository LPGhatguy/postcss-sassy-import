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

const glob = require("./lib/glob");
const fsUtil = require("./lib/fs-util");
const toSCSS = require("./lib/to-scss");

const postcss = require("postcss");
const syntaxSCSS = require("postcss-scss");

/**
 * Takes a resolved file path and returns the correct loader for it, if one is found.
 */
function getLoader(loaders, filePath) {
	for (let loader of loaders) {
		if (loader.test(filePath)) {
			return loader.method;
		}
	}
}

function applyDefaultOptions(opts) {
	// Files that have already been loaded
	opts.loaded = opts.loaded || new Set();

	opts.dedupe = opts.dedupe != null ? !!opts.dedupe : true;

	// File formats we accept
	const defaultFormats = [
		"%", // full file path
		"%.scss", // SCSS
		"_%.scss", // SCSS partial
		"%.css", // CSS
		"%.json", // JSON data (Sass variables)
		"%/style.scss" // Folder containing SCSS
	];

	if (opts.formats) {
		let forms = opts.formats;

		opts.formats = [...defaultFormats, ...forms];
	} else {
		opts.formats = defaultFormats.slice();
	}

	const defaultLoadPaths = [
		(origin) => path.dirname(origin)
	];

	if (opts.loadPaths) {
		let paths = opts.loadPaths;

		opts.loadPaths = [...defaultLoadPaths, ...paths];
	} else {
		opts.loadPaths = defaultLoadPaths.slice();
	}

	// Loaders based on file
	// For these loaders, the only plugin PostCSS needs is this import plugin.
	// All other plugins will run over the source afterwards.
	const defaultLoaders = [
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

	if (opts.loaders) {
		let loaders = opts.loaders;

		opts.loaders = [...defaultLoaders, opts.loaders];
	} else {
		opts.loaders = defaultLoaders.slice();
	}

	opts.resolver = opts.resolver || ((unresolved) => fsUtil.resolvePath(opts.formats, unresolved));
}

plugin = postcss.plugin("postcss-sassy-import", function(opts) {
	opts = Object.assign({}, opts) || {};

	applyDefaultOptions(opts);

	if (opts.plugins) {
		opts.plugins.forEach(plugin => {
			plugin(opts);
		});

		delete opts.plugins;
	}

	const loaded = opts.loaded;
	const dedupe = opts.dedupe;
	const loaders = opts.loaders;
	const resolver = opts.resolver;

	return (css, result) => {
		// Returns Promise<PostCSSNode>
		const processNormal = (unresolved, fragment, options) => {
			const dedupe = options.dedupe;

			let mergedOpts = Object.assign({}, opts, options);

			return Promise.resolve()
				.then(() => {
					const possible = resolver(unresolved);

					return fsUtil.getFileOneOf(possible);
				})
				.then((file) => {
					if (file instanceof Error) {
						throw new Error(`Couldn't find import "${fragment}".\n${file.message}`);
					}

					if (dedupe && loaded.has(file.path)) {
						return;
					}

					loaded.add(file.path);

					const loader = getLoader(loaders, file.path);

					if (!loader) {
						throw new Error(`Couldn't find loader for import "${fragment}"\n  File path: ${file.path}`);
					}

					return loader(file, mergedOpts)
						.then(r => r.root);
				});
		};

		// Returns Promise<PostCSSNode[]>
		const processGlob = (unresolved, fragment, options) => {
			const dedupe = options.dedupe;

			let mergedOpts = Object.assign({}, opts, options);

			return Promise.resolve()
				.then(() => glob(unresolved))
				.then(matches => {
					// Early-out for globbed files
					if (dedupe) {
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
							if (dedupe && loaded.has(match.path)) {
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

				let dedupeThis = dedupe;

				if (modes.indexOf("!once") > -1) {
					dedupeThis = true;
				} else if (modes.indexOf("!multiple") > -1) {
					dedupeThis = false;
				}

				const origin = node.source.input.file;

				const unresolved = path.normalize(path.join(path.dirname(origin), fragment));

				if (glob.hasMagic(fragment)) {
					prom = prom.then(() => {
						return processGlob(unresolved, fragment, {
							dedupe: dedupeThis
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
						return processNormal(unresolved, fragment, {
							dedupe: dedupeThis
						});
					}).then(newNode => {
						if (newNode) {
							node.replaceWith(newNode);
						} else {
							node.remove();
						}
					}).catch(err => {
						node.warn(result, err && err.message || err);
					});
				}
			});

			resolve(prom);
		});
	};
});

module.exports = plugin;