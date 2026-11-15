# quicktype Studio design handoff

The redesign was drawn on a design canvas and copied here so the repository holds the record. Open any `.dc.html` file to read its markup; `canvas.json` lists every board, its page and its size.

## Pages and boards

| Page | Boards |
| --- | --- |
| App front door | `Main.dc.html` (Generate workspace), `Palette.dc.html` (command palette and regex builder) |
| App first-run setup | `Onboarding.dc.html` |
| Settings and wording features | `Settings.dc.html` |
| Self-hosted web edition | `WebApp.dc.html`, `WebPhone.dc.html` |
| Appliance edition | `Appliance.dc.html` |
| Website (not the app) | `Landing.dc.html` |

## Design system

- Type: Bricolage Grotesque for headings, Atkinson Hyperlegible Next for text, JetBrains Mono for code.
- Colour: paper `#F7F3EC`, ink `#1C1B1F`, violet primary `#4B2FE0`, apricot accent `#FFB38A`, teal and warm containers for secondary surfaces, a near-black code pane.
- Shape: 28 px cards, pill buttons and chips, 44 px minimum targets.
- Layout: tabs docked on the left; Generate is source, code and options side by side, collapsing to one column on narrow windows.

## Status

These boards are a design reference. The implementation lives in `studio/` and follows them; differences are intentional where the real data needed more room (the options panel lists every engine option rather than four).

## Review notes

- The third-party review skill normally used for a design pass could not be installed in this environment, so its review step did not run.
- Placeholder values such as network addresses and image versions are shown in square brackets in the boards; the running app shows real values.
