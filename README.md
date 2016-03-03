# postcss-sassy-import
	A sassy import targeted at PostCSS + Sass pipelines

```sh
npm install postcss-sassy-import
```

postcss-sassy-import is an alternative to a number of import possibilities:
- Stock SCSS imports
- node-sass import plugins (like [node-sass-glob-once](https://github.com/LPGhatguy/node-sass-glob-once))
- [postcss-import](https://github.com/postcss/postcss-import)

postcss-sassy-import is not limited to SCSS, however! It can import vanilla CSS, JSON, or most anything else with a little bit of extension.

## Why not Sass imports?
Stock Sass imports don't handle globbing or single-file imports. Even with node-sass import plugins, mixing and matching functionality is difficult and error-prone.

## Why not postcss-import?
The authors of postcss-import are trying to [follow the CSS specification](https://github.com/postcss/postcss-import/issues/176#issuecomment-188995732) somewhat, which means that support for extra features is second-class.

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

#### dedupe
- `boolean`
- default: `true`

Enable to deduplicate imports by default. Opt in and out of deduplication by using the `!once` and `!multiple` flags on imports, respectively.

#### formats
- `string[]`
- default: `["%", "%.scss", "_%.scss", "%.css", "%.json", "%/style.scss"]`

A list of formats to try to resolve a path with. `%` in the string is replaced with the file name, and the directory of the file is prepended to the result.

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