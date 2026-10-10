# nuggets Comic Strip

A second visual direction for nuggets: the idea bank drawn as a Sunday-paper comic. It is a design study and is not wired into `web/` yet.

- `index.html` is the clickable prototype (bucket → tip → tray → a single nugget, plus the drop dialog). Open it in a browser.
- `system/project/` is the design system: `README.md` (the rules), `tokens.json`, and `components/` (a React bundle that sets `window.Comic`, its CSS, types, and a README and preview for each component). It is published as the private Design System artifact "nuggets Comic Strip".
- `assets/` holds the illustrations and the curry-dip study art.
- The Paper file "nuggets — comic strip" has the boards: the bucket, tipping, the tray, a single nugget, the curry dip, and naming and suggested tags.

## Regenerating

Run these from `src/`:

| Command | Output |
| --- | --- |
| `node build.js` | `../index.html`, from `template.html` and the generated art |
| `node make-bundle.js` | `system/project/components/bundle.js`, from `bundle.template.js` and `cards.json` |
| `node make-components.js` | each component's `README.md` and `preview.html` |
| `node curry.js` | the curry SVGs in `../assets/` |

`bundle.css`, `index.d.ts`, `tokens.json` and the system `README.md` are edited by hand.
