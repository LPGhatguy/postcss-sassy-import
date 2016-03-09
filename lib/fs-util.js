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

		loadPaths.forEach(pather => {
			formats.forEach(format => {
				const parsed = path.parse(fragment);
				let unresolved = path.join(parsed.dir, format.replace("%", parsed.base));

				out.push(path.join(pather(origin), unresolved));
			});
		});

		return out;
	},

	/**
	 * Reads a file as UTF-8 text using a Promise
	 */
	readFile(file) {
		return new Promise((resolve, reject) => {
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
	getFilesAllOf(paths) {
		let proms = [];

		for (const filePath of paths) {
			let prom = this.readFile(filePath)
				.then(contents => this.wrapFile(filePath, contents));

			proms.push(prom);
		}

		return Promise.all(proms);
	},

	/**
	 * Loads the given files in order, returning a wrapped file on success
	 */
	getFileOneOf(paths) {
		let prom = Promise.reject();

		for (const file of paths) {
			let wrapContents = (contents) => this.wrapFile(file, contents);

			// Read files until one succeeds
			prom = prom
				.catch(() => this.readFile(file).then(wrapContents))
				.then(result => {
					return result;
				});
		}

		return prom
			.catch(() => {
				return new Error("Couldn't find any of the given files:\n- " + paths.join("\n- "));
			});
	}
};

module.exports = plugin;