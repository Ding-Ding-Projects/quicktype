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
| Website | `Landing.dc.html` |
| Second round: three directions | `DirA.dc.html` (Midnight forge, chosen), `DirB.dc.html`, `DirC.dc.html` |
| JSON editor | `JsonEditor.dc.html` |

## Design system

The second round replaced the first look with direction A, Midnight forge. The first-round boards stay as a record.

- Type: Geist for text and headings, Geist Mono for code and numbers.
- Colour: near-black `#0B0B10` with a violet glow, glass panels with hairline edges, lime primary `#C6F432`, coloured dots per target language, syntax colours in the code panes. Light and high-contrast themes keep the same structure, with a violet primary in light.
- Shape: 18 px panels, 11 px controls, 44 px minimum targets.
- Layout: tabs docked on the left; Generate is a source and output editor pair beside an inspector (inferred types, inference switches, language options); a floating command bar at the bottom opens the palette.
- JSON editor: Tree, Code, Split and Table views share one document, with an inspector for the selected node, validation, document stats and a clickable history.

## Status

These boards are a design reference. The implementation lives in `studio/` and follows them; differences are intentional where the real data needed more room (the options panel lists every engine option rather than four).

## Review notes

- The third-party review skill normally used for a design pass could not be installed in this environment, so its review step did not run.
- Placeholder values such as network addresses and image versions are shown in square brackets in the boards; the running app shows real values.
