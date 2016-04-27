"use strict";

const fs = require("fs");
const path = require("path");

const plugin = {
	/**
	 * Returns a list of possible paths for a given fragment
	 */
	resolvePath(formats, loadPaths, origin, fragment) {
		const parsed = path.parse(fragment);
		const out = [];

		if (fragment.startsWith(".")) {
			// Explicit local paths ignore loadPaths and are relative to origin

			const dir = path.dirname(origin);

			formats.forEach(format => {
				let unresolved = path.join(parsed.dir, format.replace("%", parsed.base));

				out.push(path.join(dir, unresolved));
			});
		} else if (path.isAbsolute(fragment)) {
			// Absolute paths ignore loadPaths and are used as-is

			formats.forEach(format => {
				let unresolved = path.join(parsed.dir, format.replace("%", parsed.base));

				out.push(unresolved);
			});
		} else {
			// All other paths get run through loadPaths to find them

			loadPaths.forEach(pather => {
				formats.forEach(format => {
					let unresolved = path.join(parsed.dir, format.replace("%", parsed.base));

					out.push(path.join(pather(origin), unresolved));
				});
			});
		}

		return out;
	},

	/**
	 * Reads a file as UTF-8 text using a Promise
	 */
	readFile(file, vfs) {
		return new Promise((resolve, reject) => {
			if (vfs && vfs[file]) {
				resolve(vfs[file]);

				return;
			}

			fs.readFile(file, (err, contents) => {
				if (err) {
					return reject(err);
				}

				resolve(contents.toString("utf-8"));
			});
		});
	},

	/**
	 * Wraps a path and contents into a single object
	 */
	wrapFile(filePath, contents) {
		return {
			path: filePath,
			contents: contents
		};
	},

	/**
	 * Loads all of the given files in order, then returns an array of wrapped files.
	 */
	getFilesAllOf(paths, vfs) {
		let proms = [];

		for (const filePath of paths) {
			let prom = this.readFile(filePath, vfs)
				.then(contents => this.wrapFile(filePath, contents));

			proms.push(prom);
		}

		return Promise.all(proms);
	},

	/**
	 * Loads the given files in order, returning a wrapped file on success
	 */
	getFileOneOf(paths, vfs) {
		let prom = Promise.reject();

		for (const file of paths) {
			let wrapContents = (contents) => this.wrapFile(file, contents);

			// Read files until one succeeds
			prom = prom
				.catch(() => this.readFile(file, vfs).then(wrapContents))
				.then(result => {
					return result;
				});
		}

		return prom;
	}
};

module.exports = plugin;