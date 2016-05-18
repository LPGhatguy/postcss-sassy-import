"use strict";

const plugin = {
	/**
	 * Converts an array to a Sass list
	 */
	fromArray(object, config) {
		return `(${ object.map(v => this.from(v, config)).join(", ") })`;
	},

	/**
	 * Converts an object to a Sass map
	 */
	fromObject(object, config) {
		let keys = Object.keys(object);
		let building = [];
		keys.forEach(key => {
			let val = this.from(object[key], config);

			if (val !== undefined) {
				building.push(`${ key }: ${ val }`);
			}
		});

		return `(${ building.join(", ") })`;
	},

	/**
	 * Converts something to a Sass something, if possible
	 */
	from(object, config) {
		if (typeof object === "string") {
			if (config && config.unquoteStrings) {
				return object;
			} else {
				return `"${ object.replace(`"`, `\"`) }"`;
			}
		} else if (typeof object === "number") {
			return object.toString();
		} else if (typeof object === "object") {
			if (Array.isArray(object)) {
				return this.fromArray(object);
			} else {
				return this.fromObject(object);
			}
		} else if (typeof object === "boolean") {
			return object.toString();
		}

		return undefined;
	},

	/**
	 * Turns an object into a list of Sass variables.
	 */
	fromRootObject(object, config) {
		let keys = Object.keys(object);
		let building = [];

		keys.forEach(key => {
			let val = this.from(object[key], config);

			if (val !== undefined) {
				building.push(`$${ key }: ${ val };`);
			}
		});

		return building.join("\n");
	}
};

module.exports = plugin;