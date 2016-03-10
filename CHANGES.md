# 0.3.0 (WiP)
- Made 'loadPaths' option function
- Added support for explicit relative paths (`./path.css`)
- Added support for absolute paths (`/usr/bin/file.css`)
- Added `!not-sassy` flag for skipping import processing
- Added `!optional` flag for optional imports (WiP)
- Fixed settings cascading out of control on nested imports

# 0.2.0
- Added 'loadPaths' option, not yet implemented fully
- Renamed 'dedup' option to 'dedupe'
- Settings now append to existing values instead of replacing them
- More helpful error messages when imports fail

# 0.1.0
- First release!