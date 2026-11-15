# JSON editor

A full editor for JSON documents with four views of the same document: Tree, Code, Split and Table. Edit keys and values in place, switch a value between object, array, string, number, boolean and null, add, duplicate, move and drag nodes, and undo or redo any step from a labelled history.

## How to use it

Open the JSON editor tab. Double-click a key or value to edit it; F2 renames, Enter edits, Delete removes, Ctrl+D duplicates, Alt+Up and Alt+Down move, Insert adds a child, Ctrl+Z and Ctrl+Y undo and redo. Find filters the tree (plain text or regex). The $ bar runs a JSONPath query such as $..name, $.items[*].id or $.list[1:3] and selects every hit. Table shows an array of objects as an editable grid. Generate types from this document (or from the selected node) sends it straight to Generate.

## When something goes wrong

Text with an error stays in the Code view with its line and column while the tree keeps the last valid version. Comments and trailing commas are accepted and removed. A rename that would duplicate a key, a number that is not a number and a move into a node's own child are refused with a message and nothing changes.

## Privacy and security

Documents stay on this device. Validation uses a schema you lock from the current shape or load from a file; nothing is fetched.

## How to check it works

Open a sample, rename a key, change a type, drag a node, run $..name, lock the shape, break it, then undo back to the start.

## Suggested articles

- [Generating code](../generating/generate.md)
- [Local history and exports](../records/history.md)
