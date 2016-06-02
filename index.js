/**
 * PostCSS Sassy Import
 * Implements imports like Sass, plus:
 * - Globbing support
 * - Import only one time by default
 * - Import Sass, CSS, and JSON files
 */

"use strict";

// Our plugin!
let plugin;

const path = require("path");
const minimatch = require("minimatch");

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

/**
 * Fills in missing options in an option object with defaults
 */
function applyDefaultOptions(opts) {
	// Files that have already been loaded
	opts.loaded = opts.loaded || new Set();

	opts.dedupe = opts.dedupe != null ? !!opts.dedupe : true;

	// File formats we accept
	// % is replaced with the path leaf
	// The dirname of the file is prepended
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

	// A list of functions that return a path to load relative to
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
		// Sass (SCSS syntax)
		{
			test: (file) => /\.scss$/.test(file),
			method: (wrapped, opts) => {
				opts = opts || {};

				return postcss([ plugin(opts, true), ...opts.postPlugins ])
					.process(wrapped.contents, {
						from: wrapped.path,
						syntax: syntaxSCSS
					});
			}
		},
		// CSS
		{
			test: (file) => /\.css$/.test(file),
			method: (wrapped, opts) => {
				opts = opts || {};

				return postcss([ plugin(opts, true), ...opts.postPlugins ])
					.process(wrapped.contents, {
						from: wrapped.path
					});
			}
		},
		// JSON (as SCSS variables)
		{
			test: (file) => /\.json$/.test(file),
			method: (wrapped, opts) => {
				const data = JSON.parse(wrapped.contents);

				const unquoteStrings = opts.modes.indexOf("!unquote-strings") > -1;

				const scss = toSCSS.fromRootObject(data, {
					unquoteStrings: unquoteStrings
				});

				return postcss([ plugin(opts, true), ...opts.postPlugins ])
					.process(scss, {
						from: wrapped.path,
						syntax: syntaxSCSS
					});
			}
		}
	];

	if (opts.loaders) {
		let loaders = opts.loaders;

		opts.loaders = [...defaultLoaders, ...opts.loaders];
	} else {
		opts.loaders = defaultLoaders.slice();
	}

	// A function to take a list of origins, the fragment, and options
	// It returns a list of possible paths
	if (!opts.resolver) {
		opts.resolver = (origin, fragment, opts) => {
			return fsUtil.resolvePath(opts.formats, opts.loadPaths, origin, fragment);
		};
	}

	// PostCSS plugins to apply to imported files, but not the root one
	if (!opts.postPlugins) {
		opts.postPlugins = [];
	}

	// A list of functions to apply to the options table
	if (opts.plugins) {
		opts.plugins.forEach(plugin => {
			plugin(opts);
		});
	}
}

plugin = postcss.plugin("postcss-sassy-import", function(opts, child) {
	opts = Object.assign({}, opts) || {};

	if (!child) {
		applyDefaultOptions(opts);
	}

	const loaded = opts.loaded;
	const dedupe = opts.dedupe;
	const loaders = opts.loaders;
	const resolver = opts.resolver;
	const vfs = opts.vfs;

	return (css, result) => {
		// Returns Promise<PostCSSNode>
		const processNormal = (origin, fragment, options) => {
			const dedupe = options.dedupe;

			let mergedOpts = Object.assign({}, opts, options);

			return Promise.resolve()
				.then(() => {
					const possible = resolver(origin, fragment, opts);

					return fsUtil.getFileOneOf(possible, vfs)
						.catch(() => {
							return new Error("Couldn't find any of the given files:\n- " + possible.join("\n- "));
						});
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
						throw new Error(`Couldn't find loader for import "${fragment}"\n  Found file at path: ${file.path}`);
					}

					return loader(file, mergedOpts)
						.then(r => r.root);
				});
		};

		// Returns Promise<PostCSSNode[]>
		const processGlob = (origin, fragment, options) => {
			const dedupe = options.dedupe;

			let mergedOpts = Object.assign({}, opts, options);

			const paths = resolver(origin, fragment, opts);

			return Promise.resolve()
				.then(() => {
					const proms = [];

					paths.forEach(filePath => {
						proms.push(glob(filePath));

						for (const key in vfs) {
							if (!vfs.hasOwnProperty(key)) {
								continue;
							}

							if (minimatch(key, filePath)) {
								proms.push(Promise.resolve([key]));
							}
						}
					});

					return Promise.all(proms)
						.then(results => {
							const set = new Set();

							for (const result of results) {
								for (const item of result) {
									set.add(path.normalize(item));
								}
							}

							const out = Array.from(set);

							return out;
						});
				})
				.then(matches => {
					// Early-out for duplicate globbed files
					if (dedupe) {
						matches = matches.filter(file => !loaded.has(file));
					}

					return fsUtil.getFilesAllOf(matches, vfs);
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

				// Imports that don't have quotes aren't important to us
				if (matches == null) {
					return;
				}

				const modes = matches[2].trim().split(" ");
				const fragment = matches[1];

				let isOptional = false;
				let dedupeThis = dedupe;

				// Imports we should ignore
				if (modes.indexOf("!not-sassy") > -1) {
					// TODO: replace everything except !not-sassy?
					node.params = "\"" + matches[1] + "\"";

					return;
				}

				if (modes.indexOf("!optional") > -1) {
					isOptional = true;
				}

				if (modes.indexOf("!once") > -1) {
					dedupeThis = true;
				} else if (modes.indexOf("!multiple") > -1) {
					dedupeThis = false;
				}

				const origin = node.source.input.file;

				if (glob.hasMagic(fragment)) {
					// Globbed imports

					prom = prom.then(() => {
						return processGlob(origin, fragment, {
							dedupe: dedupeThis,
							modes: modes
						});
					}).then(newNodes => {
						// If we have nodes, put 'em in!

						if (newNodes.length > 0) {
							node.replaceWith(...newNodes);
						} else {
							node.remove();
						}
					});
				} else {
					// Regular imports

					prom = prom.then(() => {
						return processNormal(origin, fragment, {
							dedupe: dedupeThis,
							modes: modes
						});
					}).then(newNode => {
						// Did we get a node out of this?

						if (newNode) {
							node.replaceWith(newNode);
						} else {
							node.remove();
						}
					}).catch(err => {
						// THAT isn't a node!

						if (isOptional) {
							node.remove();
						} else {
							node.warn(result, err ? err.message : err);

							// Error.stack is far more useful
							if (opts.debug) {
								console.error(err.stack.replace("\\n", "\n"))
							}
						}
					});
				}
			});

			resolve(prom);
		});
	};
});

module.exports = plugin;