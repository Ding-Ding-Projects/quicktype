# Handoff: quicktype Studio

## What changed

- New `studio/`: a redesigned interface for the quicktype engine with three editions (Windows desktop app, self-hosted container, appliance image), its own tests, scripts and packaging.
- New `site/` and `docs/studio/`: a separate website with one article per feature, published through GitHub Pages.
- New `design/`: the design boards the interface follows.
- New workflows `studio-release.yaml` and `studio-site.yaml`; the npm and Marketplace workflows now skip `studio-` tags.
- New root `build.bat`, `build-installer.bat`, `download-dependencies.bat`, `download-dependencies.sh`, `dependencies.manifest.json` and `ROADMAP.md`.

## Verified in this pass

- `studio`: type check clean, production build succeeds, 22 unit tests pass (`npm test`).
- Web edition in headless Chrome: first-run setup, every tab, palette, dark bilingual mode and a phone width, with no page errors.
- Desktop app under a virtual display: starts, dropping a valid wording file applies it with the headline, an invalid file is refused and nothing changes, Extensions lists both built-in extensions.
- Packaged Linux build of the desktop app: TypeScript input generates code, the Code stats extension runs, the updater reports that a non-installed copy cannot update itself.
- Container image built locally: health check healthy, read-only file system, all capabilities dropped, TypeScript input works through `/api/generate`.
- Appliance recipe filled from pinned LinuxKit v1.8.2 components.
- Website built: 28 articles, no page errors, no sideways scrolling at 390 px.
- `biome check .` reports no errors.

## Not verified yet

- The release workflow has not run yet: Windows packaging, container push, appliance image build and publishing are unobserved.
- GitHub Pages must be set to deploy from GitHub Actions for `studio-site.yaml` to publish.
- The Windows `.bat` scripts were written but not run on Windows in this pass.
- See `ROADMAP.md` for features not built yet.

## Next owner

Watch the first `Studio release` run, fix anything Windows-specific it finds, then confirm the website shows the download button once a release exists.
