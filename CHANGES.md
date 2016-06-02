# 1.2.3
- Removed accidental debug prompt

# 1.2.2
- Fixed loaders array not being unpacked

# 1.2.1
- Fixed JSON import for nested objects

# 1.2.0
- Added `!unquote-strings` flag to JSON importing
	- Unquotes strings, allowing use of dynamic data without Sass's `unquote`!

# 1.1.0
- Added `vfs` attribute for adding virtual files to the system

# 1.0.0
- Fixed errors bubbling in strange ways
- Improved documentation

# 0.3.0
- Made `loadPaths` option work as expected
- Added `postPlugins` option
- Added support for explicit relative paths (`./path.css`)
- Added support for absolute paths (`/usr/bin/file.css`)
- Added `!not-sassy` flag for skipping import processing
- Added `!optional` flag for optional imports
- Fixed settings cascading out of control on nested imports

# 0.2.0
- Added 'loadPaths' option, not yet implemented fully
- Renamed 'dedup' option to 'dedupe'
- Settings now append to existing values instead of replacing them
- More helpful error messages when imports fail

# 0.1.0
- First release!