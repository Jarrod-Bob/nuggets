repo: Jarrod-Bob/nuggets
branch: main

## Last sync

date: 2026-08-29T13:52:30Z

### Updated in this project
- Component inventory rebuilt against the spec's frontend structure: tags replace folders/buckets, and `IdeaList`, `IdeaCard`, `TagFilter`, `TagCombobox`, `IdeaForm`, `RandomNugget` and `TrashView` were added.
- Removed nine components the spec rules out (toasts, tabs, sidebar, mobile tab bar, selects, switches, avatar, always-on capture bar).
- Built the web app UI kit as a recreation of the one-screen-plus-two-dialogs MVP, including archive/restore/purge and the stateless random draw.
- readme.md rewritten around the spec's scope, data model and API semantics.

## Screen map

| Project file | Built from |
| --- | --- |
| `readme.md` | `README.md`, `docs/superpowers/specs/2026-08-29-nuggets-design.md` |
| `ui_kits/web_app/index.html`, `BankApp.jsx` | spec §7 (frontend structure), §6 (API), §2 (scope) |
| `ui_kits/web_app/data.js` | spec §5 (data model) |
| `components/nuggets/*` | spec §7, §6.1 (request semantics) |
| `components/core/Tag.*`, `components/nuggets/TagCombobox.*` | spec §5 (tag normalisation), §6 (`GET /api/tags`) |
| `components/nuggets/TrashView.*` | spec §6 (archive/restore/purge routes) |
| `components/nuggets/RandomNugget.*` | spec §6 (`GET /api/ideas/random`) |

## Notes

The repo contains no application code — the project is designed, not built. Nothing
visual (CSS, assets, fonts, components) was imported, because none exists upstream.
The spec is the source of truth for structure, naming, scope and behaviour only;
all visual decisions in this design system are authored here and should be
reconciled once real code lands.
