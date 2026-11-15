# Handoff: quicktype Studio

## What changed

- New `studio/`: a redesigned interface for the quicktype engine with three editions (Windows desktop app, self-hosted container, appliance image), its own tests, scripts and packaging.
- New `site/` and `docs/studio/`: a separate website with one article per feature, published through GitHub Pages.
- New `design/`: the design boards the interface follows.
- New workflows `studio-release.yaml` and `studio-site.yaml`; the npm and Marketplace workflows now skip `studio-` tags.
- New root `build.bat`, `build-installer.bat`, `download-dependencies.bat`, `download-dependencies.sh`, `dependencies.manifest.json` and `ROADMAP.md`.

## Second pass: Midnight forge, JSON editor and the in-browser tool

- Interface rebuilt in the chosen Midnight forge direction; new JSON editor page; tab groups, appearance, colour and logo editors, scheduled settings.
- The website now builds the interface as an in-browser edition into `site/dist/app/` and shows it on `app.html`. The Pages workflow builds the engine and installs `studio/` dependencies first.
- Verified locally: type check clean, 34 unit tests pass (including the JSON document model and colour conversion), every tab captured in headless Chrome with no page errors, and the in-browser build generates TypeScript from the Pokédex sample and opens the JSON editor with no page errors.
- Not yet verified: the desktop app has not been recaptured since the redesign; the in-browser page has not been checked on the published site until the Pages run finishes.

## Verified in the first pass

- `studio`: type check clean, production build succeeds, 22 unit tests pass (`npm test`).
- Web edition in headless Chrome: first-run setup, every tab, palette, dark bilingual mode and a phone width, with no page errors.
- Desktop app under a virtual display: starts, dropping a valid wording file applies it with the headline, an invalid file is refused and nothing changes, Extensions lists both built-in extensions.
- Packaged Linux build of the desktop app: TypeScript input generates code, the Code stats extension runs, the updater reports that a non-installed copy cannot update itself.
- Container image built locally: health check healthy, read-only file system, all capabilities dropped, TypeScript input works through `/api/generate`.
- Appliance recipe filled from pinned LinuxKit v1.8.2 components.
- Website built: 28 articles, no page errors, no sideways scrolling at 390 px.
- `biome check .` reports no errors.

## Verified on GitHub

- `Studio release` run for `237ea79` succeeded and published `studio-v24.0.0-build.5.1` with the Squirrel installer, `RELEASES`, the full `.nupkg`, the portable `.exe`, both appliance images, the filled appliance recipe and SHA-256 lists. The notes carry the line count and workflow timing (00:05:00).
- The `studio-channel` update feed holds the installer files.
- `ghcr.io/ding-ding-projects/quicktype-studio:latest` is publicly pullable.
- `Studio site` deployed to GitHub Pages after the release and found the portable asset, so the download button is live.

## Not verified yet

- The installer and portable app have not been run on a Windows machine.
- The appliance images have not been booted.
- Updating an installed copy from one release to the next has not been observed.
- The Windows `.bat` scripts were written but not run on Windows in this pass.
- See `ROADMAP.md` for features not built yet.

## Next owner

Install the setup `.exe` on Windows, boot the appliance ISO in a virtual machine, then publish a second release and confirm the installed copy offers to restart and update.
