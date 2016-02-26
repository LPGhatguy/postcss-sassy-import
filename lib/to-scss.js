"use strict";

const plugin = {
	/**
	 * Converts an array to a Sass list
	 */
	fromArray(object) {
		return `(${ object.map(v => this.from(v)).join(", ") })`;
	},

	/**
	 * Converts an object to a Sass map
	 */
	fromObject(object) {
		let keys = Object.keys(object);
		let building = [];
		keys.forEach(key => {
			let val = this.from(object[key]);

			if (val !== undefined) {
				building.push(`${ key }: ${ val }`);
			}
		});

		return `(${ building.join(", ") })`;
	},

	/**
	 * Converts something to a Sass something, if possible
	 */
	from(object) {
		if (typeof object === "string") {
			return `"${ object.replace(`"`, `\"`) }"`;
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
	fromRootObject(object) {
		let keys = Object.keys(object);
		let building = [];

		keys.forEach(key => {
			let val = this.from(object[key]);

			if (val !== undefined) {
				building.push(`$${ key }: ${ val };`);
			}
		});

		return building.join("\n");
	}
};

module.exports = plugin;