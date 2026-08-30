# nuggets — Individual Nugget Page and Routing

**Date:** 2026-08-30
**Status:** Approved design, pending implementation plan
**Issue:** [#4](https://github.com/Jarrod-Bob/nuggets/issues/4)

Today a nugget is only ever seen two ways: as a row in the list with its notes clamped to two lines, or inside an edit dialog. Neither is a place to sit with an idea and flesh it out. The dialog in particular is shaped for capture — get in, type, get out — which is the opposite of what "work on this idea" needs.

This gives every nugget its own address and its own page.

---

## The backend is already done

Worth establishing first, because it changes the size of the job. `internal/web/embed.go` serves the built frontend and falls back to `index.html` for any path it does not recognise, with a comment stating the intent outright: *"falling back to index.html for unknown paths so client-side routes survive a refresh."*

And the fallback cannot swallow API mistakes, because `server.go` registers a catch-all on `/api/` that returns a proper 404 — added specifically because unmatched API requests were otherwise being served the page with a 200.

So `http://127.0.0.1:7777/nuggets/42` already returns the app, on a cold load, on a refresh, and on a pasted link. **No Go change is required for this feature.** In dev, Vite's own SPA fallback does the same thing, and its `/api` proxy to `127.0.0.1:7777` keeps everything same-origin.

What is missing is entirely on the frontend: `App.tsx` is a single screen holding every piece of state, and the dependency list is React, React DOM and three font packages — there is no routing of any kind.

---

## Routing

**React Router.** The alternative was hand-writing a small router over `pushState` and `popstate`, which would have matched the project's stated preference for learning the underlying mechanism — but this is where the app stops being one screen, and a library that already handles the back button, scroll restoration, relative navigation and search-param state correctly is worth the dependency here.

```
/                     the bank — search, tag filter, list, random draw
/nuggets/:id          one nugget
/trash                the archived view
```

`/trash` becomes a route rather than the current `showTrash` boolean. It is already a separate place with its own list, its own sort order and its own actions — making it a URL costs nothing extra once the router exists and removes a piece of state that has to be threaded around.

`BrowserRouter` mounts in `main.tsx` around `<App />`. The router owns *where you are*; nothing else changes about how data is fetched.

### List filters belong in the URL

The search text and the active tag move from `useState` into search params:

```
/?q=recipe&tag=saas
```

This is worth doing at the same time rather than later, because it is what makes the back button behave. Without it, opening a nugget from a filtered list and pressing back returns you to an unfiltered list — the filter you were using is simply gone, which is worse than today, where the dialog closes and the list is still there. It also makes a filtered view bookmarkable, which is free once the address holds the state.

One implementation note: the search field must stay responsive while typing. The input keeps its own local state and writes to the URL with a `replace` navigation after a short debounce, so a fast typist does not push twenty history entries and the back button does not walk backwards through their keystrokes character by character.

---

## Where state lives afterwards

`App.tsx` currently owns everything: `ideas`, `tags`, `query`, `activeTag`, `showTrash`, `form`, `purgeTarget`, `actionError`, and the prefetched random draw. After routing, it splits by who needs what:

| State | Moves to |
|---|---|
| `ideas`, `query`, `activeTag`, `showTrash` | The bank route — and `query` / `activeTag` become URL params |
| The prefetched random draw | The bank route (only reachable there) |
| `form`, `purgeTarget` | Split: create-dialog state on the bank route; edit and purge state on the nugget page |
| `tags` (the autocomplete source) | A shared provider — both routes need it |
| `actionError` | Per route; each screen shows its own failures inline, as the design doc's §8 requires |

**Do not disturb the random-draw prefetch.** `App.tsx` carries a carefully reasoned one-ahead prefetch with a monotonic request id, so a stale response from a superseded tag cannot land after a newer request. That logic moves to the bank route intact — its input simply becomes the tag from the URL rather than from `useState`. It has a subtle correctness argument written into its comments and should be moved, not reimplemented.

`App.tsx` keeps only the shell: the top bar and the layout the routes render inside.

---

## The page

| Section | Source |
|---|---|
| Title and the whole of the notes, unclamped | Already stored; only the list truncates |
| Every tag, each clicking through to `/?tag=…` | Already stored |
| Status, changeable from the page | Issue [#3](https://github.com/Jarrod-Bob/nuggets/issues/3) |
| Links out to documents and code | Issue [#3](https://github.com/Jarrod-Bob/nuggets/issues/3) |
| Origin — "arrived from Telegram, 3 days ago" | Issue [#2](https://github.com/Jarrod-Bob/nuggets/issues/2) |
| Captured and last-changed dates | Already stored, via the existing `formatRelative` |
| Archive, restore, purge | Existing endpoints |

Fetches with `api.get(id)`, which already exists and is currently unused by the UI — the client method was written and never called.

**Three states to handle explicitly:**

- **Loading** — a quiet placeholder. Not a spinner over the whole page; the shell renders immediately and the body fills in.
- **Not found** — a 404 from the API arrives as an `ApiError` carrying the server's own message, *"That nugget isn't in the bank."* Render that with a link back to the bank. This is the case that a deep link into a purged nugget produces, so it is a normal path, not an edge case.
- **Archived** — a nugget in the trash is still viewable at its address. It renders with the archived treatment `IdeaCard` already defines, and offers restore rather than archive.

A nugget that is archived or purged from its own page navigates back to the bank afterwards; there is nothing left to look at.

---

## Editing

**A view mode with an Edit action**, reusing the existing `IdeaForm` rather than inventing a second editor. Press Edit, the fields become editable, Save or Cancel.

The alternative was edit-in-place with fields saving as you type. It suits "flesh it out over time" better and it is where this should probably end up — but it needs decisions about half-typed saves, what happens when a save fails mid-sentence, and how a failed save is surfaced without a toast system the app deliberately does not have. Starting with the explicit form gets the page shipped, and moving to in-place editing later replaces the editor without touching the routing, the data flow or the page layout.

Worth noting for sequencing: because the form submits a complete draft, **this page does not strictly depend on the partial-save change in [#3](https://github.com/Jarrod-Bob/nuggets/issues/3)**. It can ship before it. Partial save becomes necessary at the moment a control on this page changes one field on its own — a status dropdown, or in-place editing — which is exactly when #3's frontend work lands.

---

## What changes in the list

**Clicking a nugget opens its page.** The edit dialog stays, for creating only.

Today a click opens the dialog in edit mode, and a pencil icon in the row does the same thing. After this: the row click navigates, and the pencil goes to the page with editing already open. Capture stays fast in a dialog — that flow is good and should not be disturbed — while reading and working on an idea gets the room. One obvious place for each, and no second way to edit the same nugget that can quietly drift from the first.

The archive action stays on the row; it is a one-click operation and does not need a page.

---

## Testing

The frontend's existing tests are pure-function tests — `fluidRadius`, `formatRelative`, `normalizeTag` — with no component or router testing in the project and no testing-library dependency. This design does not introduce one. Instead the logic worth testing is kept out of the components:

- **URL ↔ filter mapping** as a pure pair of functions: params to a `ListFilter` and back. Round-trip cases, empty params, a tag with characters needing encoding, and an unknown param being ignored rather than breaking.
- **Route path building and parsing** for `/nuggets/:id`, including a non-numeric id, which must produce the not-found page rather than an API call with a nonsense id.

Everything else on the page is composition of components that already exist and are already exercised.

Backend coverage needs nothing new: `GET /api/ideas/{id}` and its 404 are already tested in `ideas_test.go`.

---

## Not in this design

- **In-place editing.** Deferred with reasons above; the page is built so it can replace the editor without rework.
- **A `/new` route.** Capture stays a dialog. A URL for the create form has no benefit — nobody bookmarks an empty form.
- **Keyboard navigation between nuggets** (j/k, next/previous). Appealing, unasked-for, and easier to add once the page exists.
- **Scroll restoration beyond what React Router provides by default.** Revisit only if returning to a long list actually feels wrong.
