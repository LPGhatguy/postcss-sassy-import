const glob = require("glob");

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

globPromise.hasMagic = glob.hasMagic.bind(glob);
globPromise.minimatch = glob.minimatch;

module.exports = globPromise;