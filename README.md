# postcss-sassy-import

[![npm version](https://img.shields.io/npm/v/postcss-sassy-import.svg)](https://www.npmjs.com/package/postcss-sassy-import)
![node version](https://img.shields.io/badge/node-%3E=5.0-brightgreen.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

```sh
npm install postcss-sassy-import
```

*requires Node 5.0+*

## Goal
This plugin aims to implement imports like Sass, with select extensions and further plugin opportunities. At base, this yields:

- Inlining (like [postcss-import](https://github.com/postcss/postcss-import))
- Globbing (like [Ruby sass-globbing](https://github.com/chriseppstein/sass-globbing))
- Single-import by default (like [node-sass-glob-once](https://github.com/LPGhatguy/node-sass-glob-once))

postcss-sassy-import is not limited to SCSS, however! It can run on any syntax that PostCSS supports, and can import vanilla CSS, SCSS, and JSON out of the box!

There's also a simple plugin system for adding new resolvers, formats, and load paths.

## Why not postcss-import?
The authors of postcss-import are trying to [follow the CSS specification](https://github.com/postcss/postcss-import/issues/176#issuecomment-188995732), which means that support for extra features is second-class.

## Usage
Write imports how you want to write them:

```scss
@import "config.json";
@import "reset";
@import "components/**/*.scss";

my-scope {
	@import "scoped-stuff";
}
```

Get output like you expect:

```scss
/* contents of config.json */
/* contents of reset.css */
/* contents of all scss files in components/ */

my-scope {
	/* contents of _scoped-stuff.scss */
}
```

Sass (or another preprocessor) can then handle the rest of the processing from there.

postcss-sassy-import will import files based on globs, and only import files once by default. This lets you declare stylesheet dependencies sanely and get no duplicates!

postcss-sassy-import can import plenty of useful things out of the box:
- Sass (SCSS syntax)
- Sass Partials (SCSS syntax)
- CSS
- JSON (as SCSS variables)

It's also possible to force reuse of imports, which will cascade into their imports as well:

`main.scss`
```scss
first-scope {
	@import "b";
}

second-scope {
	@import "b";
}

third-scope {
	@import "b" !multiple;
}
```

`b.scss`
```scss
@import "c";

a {
	color: red;
}
```

`c.scss`
```scss
div {
	color: blue;
}
```

Results in:
```scss
first-scope {
	div {
		color: blue;
	}

	a {
		color: red;
	}
}

second-scope {
}

third-scope {
	div {
		color: blue;
	}

	a {
		color: red;
	}
}
```

### gulp
If you use gulp, use postcss-sassy-import with gulp-postcss:

```js
const gulp = require("gulp");
const postcss = require("gulp-postcss");
const sass = require("gulp-sass");
const sassyImport = require("postcss-sassy-import");

gulp.task("styles", () => {
	return gulp.src("main.scss")
		.pipe(postcss([ sassyImport({
			// Put your configuration here!
		}) ]))
		.pipe(sass())
		.pipe(gulp.dest("main.css"))
});
```

## Configuration
postcss-sassy-import takes in some configuration options and does some stuff with them.

** Setting a list configuration here will add new options to the end of the list. To replace or remove existing values, add a plugin. **

#### dedupe
- `boolean`
- default: `true`

Enable to deduplicate imports by default. Opt in and out of deduplication by using the `!once` and `!multiple` flags on imports, respectively.

#### formats
- `string[]`
- default: `["%", "%.scss", "_%.scss", "%.css", "%.json", "%/style.scss"]`

A list of formats to try to resolve a path with. `%` in the string is replaced with the file name, and the directory of the file is prepended to the result.

#### loadPaths
- `(() => string)[]`
- default: see source (loads current directory)

A list of paths to load. Paths are specified with functions that are passed the file an import is being called from. They should return an absolute path to load from.

**NYI: Though this feature is handled as a valid option by the plugin at this time, it does not currently do anything.**

#### loaders
- `array`
- default: see source (loads scss, css, and json)

A loader is an object with two fields, `test` and `method`. `test` is a function taking the path of the file, returning whether this loader is applicable. `method` is a method to return a PostCSS `Root` element from a wrapped file.

Wrapped files have two fields:
- `contents`: The contents of the file
- `path`: The path to the file

#### plugins
- `array`
- default: `[]`

Plugins are run when postcss-sassy-import is called. They are passed the options that were given and are expected to mutate them.

This is a good place to add new loaders and formats.

## Contributing
Pull requests and issues welcome!

## License
postcss-sassy-import is licnsed under the MIT license. See [LICENSE.md](LICENSE.md) for more details.