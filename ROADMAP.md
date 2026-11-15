# quicktype Studio roadmap

Ticks are claims: an item is ticked only when it is built and was checked in the built app or a test. Items not yet done stay unticked with a note. This roadmap covers `studio/`, `site/` and `docs/studio/`; the quicktype engine itself follows upstream.

## Phase 1: redesign and three editions

- [x] Ground-up redesign drawn on a design canvas and checked into `design/`
- [x] Shared interface: Generate, Samples, Languages, History, Tools, Extensions, Docs, Settings, Changelog, About
- [x] Desktop app (Electron): frameless window, narrow preload bridge, TypeScript input, extension host, packaged and smoke-tested on Linux
- [x] Windows installer (Squirrel) and portable files built and published by the release workflow
- [x] Self-hosted container: image built locally, read-only, unprivileged, health check passes, TypeScript input works
- [x] `host.bat` start, stop, restart, status, logs and update modes with verified network addresses
- [x] Appliance BIOS image and EFI ISO built and published by the release workflow (not yet booted on hardware or in a virtual machine)
- [x] Website separate from the app, one article per feature, phone layout without sideways scrolling
- [x] Website deployed to GitHub Pages, with the download button shown only after a release asset resolves

## Phase 2: interface behaviour

- [x] Tabs docked left by default, every tab open on first run, closed tabs stay closed, Open every tab, New tab catalog, pinning, drag and keyboard reordering, any dock edge
- [x] Ctrl+Shift+F palette with live setting controls and jump-to-element
- [x] Regex builder beside every search, plain text by default, anchors in sync
- [x] English, Cantonese and bilingual modes; independent playfulness sliders that change real messages
- [x] Emoji-in-dialogs switch (decoration only)
- [x] Personal wording files: strict parser, settings upload, window drop with headline, refusal changes nothing, clear restores
- [x] School mode shared through one record with PIN, rename and live updates
- [x] Spoken narrator with per-language voice pickers, rate and pitch; action sounds with a switch
- [x] Non-blocking notifications and a notification centre
- [x] Two-key confirmation for deletions
- [x] Local history with restore, bulk delete and export in five formats, never including wording data
- [x] Context menus with real shortcuts; per-element appearance editor; logo presets and custom upload
- [x] First-run setup with save and resume, Back, Next and Skip
- [x] File converter and Base64 toolkit
- [x] Extensions: versioned manifests, any-language JSON line protocol, permissions with consent, time and size limits, two built-in extensions
- [x] Offline docs browser; changelog viewer; version and build date on the front screen
- [x] Tab groups with names and colours; searches over the strip, inside each group, over group names and across every tab
- [x] Per-tab appearance editor and a deeper per-element editor (font, size, weight, spacing, colours, border, radius, padding, shadow) with per-property reset
- [x] Colour picker with area, hue and alpha sliders and HEX, RGB, HSL and OKLCH fields
- [x] Logo editor with crop, zoom, fit, background and size previews
- [x] Scheduled settings (theme, language, density by time of day), info buttons with defaults on every setting, focus timer
- [x] Midnight forge redesign: syntax-coloured editors with line numbers, inferred-types inspector, floating command bar, custom selects
- [x] JSON editor: Tree, Code, Split and Table views, inline editing, type switching, drag and drop, labelled undo and redo, regex find, JSONPath queries, schema validation, lenient import, transforms, hand-off to Generate
- [x] Full generator and JSON editor running on the website itself, in the visitor's browser
- [ ] External settings sources
- [ ] Local file conversion beyond text formats (images, documents)
- [ ] Dim sum release code names from the public catalogue (releases currently say none was chosen)

## Phase 3: release pipeline

- [x] Release workflow: unique tag per run, unsigned disclosure, line count, workflow timing, no test gate
- [x] Studio tags skip the npm and Marketplace workflows
- [x] Root `build.bat`, `build-installer.bat`, `download-dependencies.bat` and `.sh`
- [x] First release observed end to end: `studio-v24.0.0-build.5.1`, assets attached, container image publicly pullable
- [ ] Installed-copy update verified from one release to the next

## Not built yet

These were requested as part of the full feature set but are not built in this pass. Each is a large tool of its own:

- [ ] Minecraft server creator and manager
- [ ] Windows virtual disk manager
- [ ] Local Ollama model manager
- [ ] Built-in authenticator with QR pairing, and the unlock ladder
- [ ] Drawing and annotation
- [ ] Live status hub registration, Discord and Tidbyt status bridges
- [ ] Live charts
- [ ] Screen recording and the full per-surface screenshot matrix
