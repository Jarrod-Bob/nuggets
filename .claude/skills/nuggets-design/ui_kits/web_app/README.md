# UI kit — nuggets web app

A recreation of the MVP described in
[`docs/superpowers/specs/2026-08-29-nuggets-design.md`](https://github.com/Jarrod-Bob/nuggets/blob/main/docs/superpowers/specs/2026-08-29-nuggets-design.md).
**Nothing has been built yet**, so this is a design recreation of the specified
structure, not of running code.

## What the spec fixes

- **One screen plus two dialogs.** No sidebar, no tabs, no second nav destination.
- **Desktop only**, single user, no accounts. The app opens itself at `127.0.0.1:7777`.
- **Newest-first list** with a search box and tag filter above it. `q` (LIKE over
  title and notes, case-insensitive) and `tag` combine with AND.
- **Freeform tags**, normalised server-side to trimmed lowercase, autocompleting
  from tags already in use. No tag management screen.
- **Random draw** — one button, a result dialog, reroll freely. Stateless.
- **Archive, not delete.** Archived ideas live in a trash view behind a toggle;
  purge is a separate destructive action.
- **No toast system, no error boundaries.** Errors render inline.

## Files

| File | Role |
| --- | --- |
| `index.html` | Mounts the interactive kit. Load this. |
| `App.jsx` | The whole screen: top bar, bank view, trash view, both dialogs. |
| `data.js` | Seed ideas and tags, shaped like the API responses. |

## What's interactive

Search, tag filter (single-select with an All reset), drop a nugget (dialog with
tag autocomplete and the blank-title error), edit a row, archive a row, the trash
toggle, restore, purge behind a confirm dialog, and the random draw with reroll.

## Screen → spec mapping

| Kit element | Spec component | Endpoint |
| --- | --- | --- |
| Bank list | `IdeaList` / `IdeaCard` | `GET /api/ideas?q=&tag=` |
| Tag filter row | `TagFilter` | `GET /api/tags` |
| Drop / edit dialog | `IdeaForm` + `TagCombobox` | `POST /api/ideas`, `PATCH /api/ideas/{id}` |
| Archive button | — | `POST /api/ideas/{id}/archive` |
| Trash view | `TrashView` | `GET /api/ideas?archived=true`, `POST …/restore` |
| Purge confirm | `Dialog` | `DELETE /api/ideas/{id}` |
| Draw a nugget | `RandomNugget` | `GET /api/ideas/random?tag=` |

## Not built, deliberately

Mobile and marketing surfaces. The spec puts responsive layouts out of scope and
there is no marketing site in the repo — inventing either would mean designing
product that doesn't exist. Say the word and they get built as a separate,
clearly-labelled exploration.
