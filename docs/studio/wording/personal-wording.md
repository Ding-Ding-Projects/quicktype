# Personal wording files

Load a personal vocabulary JSON file to replace the app's own words with yours. Nothing ships built in; until you load a file the original wording is used everywhere.

## How to use it

Settings, Language and wording, Choose JSON file. In the desktop app you can also drop the file anywhere on the window; a short full-window headline confirms it. Clear and restore original removes it.

## When something goes wrong

The file is checked in full first. Anything wrong (over 256 KiB, not UTF-8, malformed JSON, a duplicate key, nesting deeper than 8, an unknown field, a schemaVersion other than 1, a key over 160 characters, a value over 1,000 characters or a control character) refuses the whole file and changes nothing.

## Privacy and security

The file stays on this device. It is never uploaded, logged, exported, put in history or synced. Clearing it deletes the local copy.

## How to check it works

Load a valid file, drop an invalid one, restart, then clear, checking wording each time.

## Suggested articles

- [Personal wording file format](../wording/file-format.md)
- [School mode](../wording/school-mode.md)
