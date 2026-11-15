# quicktype Studio roadmap

Ticks are claims: an item is ticked only when it is built and was checked in the built app or a test. Items not yet done stay unticked with a note. This roadmap covers `studio/`, `site/` and `docs/studio/`; the quicktype engine itself follows upstream.

## Phase 1: redesign and three editions

- [x] Ground-up redesign drawn on a design canvas and checked into `design/`
- [x] Shared interface: Generate, Samples, Languages, History, Tools, Extensions, Docs, Settings, Changelog, About
- [x] Desktop app (Electron): frameless window, narrow preload bridge, TypeScript input, extension host, packaged and smoke-tested on Linux
- [ ] Windows installer and portable files built by the release workflow (workflow written; first run not yet observed)
- [x] Self-hosted container: image built locally, read-only, unprivileged, health check passes, TypeScript input works
- [x] `host.bat` start, stop, restart, status, logs and update modes with verified network addresses
- [ ] Appliance image built by the release workflow (recipe filled from pinned LinuxKit components locally; full image build not yet run)
- [x] Website separate from the app, one article per feature, phone layout without sideways scrolling
- [ ] Website deployed to GitHub Pages (workflow written; needs Pages set to deploy from Actions)

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
- [ ] Tab groups and the group-level searches
- [ ] Per-tab appearance editor
- [ ] Scheduled and external settings sources
- [ ] Local file conversion beyond text formats (images, documents)
- [ ] Dim sum release code names from the public catalogue (releases currently say none was chosen)

## Phase 3: release pipeline

- [x] Release workflow: unique tag per run, unsigned disclosure, line count, workflow timing, no test gate
- [x] Studio tags skip the npm and Marketplace workflows
- [x] Root `build.bat`, `build-installer.bat`, `download-dependencies.bat` and `.sh`
- [ ] First release observed end to end with assets downloadable
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
