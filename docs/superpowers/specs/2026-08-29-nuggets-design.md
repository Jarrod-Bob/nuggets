# nuggets — MVP Design

**Date:** 2026-08-29
**Status:** Approved design, pending implementation plan

## 1. Problem

Ideas arrive while away from a desk. Today they are captured as self-messages in Telegram or WhatsApp, where they mix with links, reminders, and everything else saved to the same thread. The ideas survive but become unfindable, which amounts to losing them.

nuggets is a single-user idea bank: a dedicated home for those ideas, with enough structure to retrieve one on purpose, and a way to surface one at random as a mini-challenge.

### Known limitation of this MVP

The MVP is desktop-only, so it does not solve capture-while-out. Ideas will still be written into Telegram in the moment and drained into nuggets later. This is accepted for v1: the goal is to get the bank and the data model right first. The architecture is chosen so that phone access is a later addition rather than a rewrite (see section 9.1).

## 2. Scope

### In scope

1. **CRUD on ideas.** Create, read, update, archive, restore, purge.
2. **Tagging.** Freeform tags with autocomplete over tags already in use.
3. **Retrieval.** Newest-first list, text search over title and notes, tag filter.
4. **Random nugget.** One button returns a random idea, optionally narrowed to a tag. Stateless: nothing is recorded, reroll freely.

### Out of scope for MVP

Status field, rating, sort controls, mobile and responsive layouts, user accounts, export, file attachments, markdown rendering.

Status (raw / exploring / building / parked / killed) and rating are the first planned extensions. Neither is built now; adding them later is one migration adding nullable columns to `ideas`, with no change to the existing tables.

## 3. Success criteria

- An idea can be captured in under ten seconds from a running app.
- Any idea can be found again by either a remembered word or a remembered tag.
- The random draw returns a usable challenge without further navigation.
- The whole thing runs at zero recurring cost.
- Losing an idea requires deliberate action, not a mis-tap.

## 4. Technical decisions

| Area | Decision | Rationale |
|---|---|---|
| Shape | Go binary serves JSON API + embedded frontend; auto-opens browser at `127.0.0.1:7777` | Simplest to build, most transferable learning, and the only shape where phone access later is zero code change |
| Router | stdlib `net/http` + Go 1.22 `ServeMux` | Method+wildcard patterns cover the whole app; free 405s; transferable Go rather than framework Go |
| Database | SQLite via `modernc.org/sqlite` | Pure Go, no cgo. The single most important Windows decision — `mattn/go-sqlite3` would require gcc on PATH |
| Migrations | `goose`, embedded as a library, run at startup | Binary self-migrates; "did I run the migration?" never arises |
| Frontend | React + Vite + TypeScript | Chosen on volume of TS-specific teaching material |
| TypeScript | **Pinned to 6.x, not 7** | TS 7.0 ships no stable programmatic API until 7.1, so `typescript-eslint` cannot run on it. ESLint is worth more than compile speed here |
| Styling | The nuggets design system: CSS custom-property tokens + its own React components. No Tailwind, no shadcn | See 4.1 |
| Shared types | Hand-written in `web/src/api.ts`, guarded by a golden-JSON Go test | ~4 types; codegen would hide the JSON contract, which is the thing worth learning to design |
| Testing | Go stdlib `testing` + `httptest` against a real SQLite DB in `t.TempDir()` | No mocks, no store interface, no testify |

### 4.1 Styling: the design system supersedes Tailwind and shadcn

**Revised 2026-08-30.** This section previously specified Tailwind v4 plus
selective shadcn/ui. A design system was commissioned and delivered, and it
makes both redundant. Neither is used.

The design system lives at `.claude/skills/nuggets-design/` (installed as a
project skill so it is invocable, and kept there as the pristine reference
copy). It provides:

- **Design tokens** as plain CSS custom properties — colour, typography,
  spacing, shape, motion — aggregated by `styles.css`.
- **Eighteen React components**, including every component named in section 7.
- **Voice and microcopy rules**, which encode the section 6.1 request semantics
  directly into the interface.

**Its only dependency is React.** No Radix, no cmdk, no Tailwind.

Why Tailwind and shadcn are dropped:

1. **The shadcn case has evaporated.** Adopting shadcn was justified entirely by
   Dialog and Command/Popover — the combobox being the one component genuinely
   hard to hand-roll. The design system ships both. `TagCombobox` implements
   full keyboard navigation, `role="listbox"`, `aria-selected`, and create-new
   handling.
2. **The Tailwind case has inverted.** Tailwind was chosen because converting
   hand-written CSS to it later has no codemod. That cost does not apply here:
   the components style via inline styles, which do not participate in the
   cascade, so introducing Tailwind later for new layout work conflicts with
   nothing. Adopting it *now* would instead mean hand-rewriting eighteen
   working, accessible components to gain nothing.

The design system's own readme advises porting `tokens/` into a Tailwind
`@theme` block. **That advice is not followed**, because it assumes the
components would be rebuilt with Tailwind classes. They ship inline-styled, so
the advice would cost a full rewrite and buy nothing.

**Components are converted from `.jsx` to `.tsx`** as they are ported into
`web/src/`, using the supplied `.d.ts` files as the prop-type source. The
conversion is mechanical because the interfaces are already written. The
reference copy under `.claude/skills/nuggets-design/` is left untouched, so a
later re-sync from the designer can be diffed against it.

**Fonts and icons must be vendored.** The system loads Baloo 2, Figtree and DM
Mono from Google Fonts, and Lucide 0.462.0 from a CDN. A local-first app that
opens at `127.0.0.1` must not render incorrectly without a network connection,
nor make an external request to Google on every launch. Both are self-hosted
into the repo and served from the Go binary.

## 5. Data model

Three tables, one initial migration.

```sql
ideas
  id          INTEGER PRIMARY KEY
  title       TEXT NOT NULL
  notes       TEXT NOT NULL DEFAULT ''
  created_at  TIMESTAMP NOT NULL
  updated_at  TIMESTAMP NOT NULL
  archived_at TIMESTAMP NULL       -- NULL = active

tags
  id          INTEGER PRIMARY KEY
  name        TEXT NOT NULL UNIQUE -- normalized: trimmed, lowercased

idea_tags
  idea_id     INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE
  tag_id      INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE
  PRIMARY KEY (idea_id, tag_id)
```

Three decisions are embedded above:

- **Archive is a nullable timestamp, not a boolean.** Same storage cost, and it records *when* something was binned — the natural sort order for a trash view.
- **Tag names are normalized to trimmed lowercase on write.** Without this, `#SaaS` and `#saas` become separate tags and autocomplete stops helping, which defeats the reason freeform-with-autocomplete was chosen over managed tags.
- **Integer primary keys, not UUIDs.** One server, one writer, nothing to reconcile.

Tags are created implicitly on first use. There is no tag management screen.

## 6. API

```
GET    /api/ideas?q=&tag=&archived=   list, newest first
POST   /api/ideas                     create
GET    /api/ideas/{id}                read one
PATCH  /api/ideas/{id}                update title/notes/tags
POST   /api/ideas/{id}/archive        move to trash
POST   /api/ideas/{id}/restore        recover from trash
DELETE /api/ideas/{id}                permanent purge
GET    /api/ideas/random?tag=         the mini-challenge
GET    /api/tags                      autocomplete + filter source
```

**Archive and restore are POST actions, not a PATCH on a field.** This leaves `DELETE` to mean the genuinely destructive thing, so there is no route by which an ordinary edit can purge an idea.

**Search is `LIKE '%q%'` over title and notes.** Unsophisticated and correct at this scale. SQLite FTS5 is available in the driver as a later upgrade if the bank ever grows enough to need it.

**Random is `ORDER BY RANDOM() LIMIT 1`**, joined through `idea_tags` when a tag filter is present, and always excluding archived ideas. O(n) is instant for thousands of rows; this is not worth optimizing.

**`GET /api/tags` returns only tags with at least one non-archived idea.** Otherwise abandoned tags linger in autocomplete permanently, and the MVP has no tag management screen to clean them up. It returns the full list unfiltered; the combobox filters client-side, since the tag vocabulary of one person is small.

### 6.1 Request semantics

These are spelled out because each is a coin-flip that would otherwise be guessed at during implementation.

- **`PATCH` replaces the whole tag set.** The request carries `tags` as a complete array of names; the server diffs it against the existing set, creating any tags that are new and removing join rows that are gone. There is no add-one-tag or remove-one-tag endpoint.
- **`archived` accepts only `true`.** Omitted or anything else lists active ideas; `archived=true` lists only archived ones. There is no "show both" view — active and trash are separate places.
- **`q` and `tag` combine with AND.** A search term plus a tag narrows to ideas matching both. `q` is case-insensitive.
- **`title` is required and must be non-empty after trimming**; `notes` may be empty. A blank title is a 400, not a silently-created untitled idea.
- **Tag normalization happens server-side**, on every write path. The frontend may show what a tag will become, but never owns the rule.

## 7. Frontend structure

One screen plus two dialogs.

| Component | Role |
|---|---|
| `IdeaList` | Newest-first list, with search box and tag filter above |
| `TagFilter` | Narrows the list; sources from `GET /api/tags` |
| `TagCombobox` | Tag entry with autocomplete; used in both the form and the filter |
| `IdeaForm` | Dialog for create and edit |
| `RandomNugget` | Button opening a result dialog with a reroll |
| `TrashView` | Behind a toggle; restore or purge |

Every one of these is supplied by the design system (section 4.1), converted to
`.tsx` on the way into `web/src/components/`. None is designed from scratch.
They sit on a further layer of design-system primitives — `Button`, `Card`,
`Tag`, `Input`, `Textarea`, `SearchField`, `IconButton`, `Badge`, `Dialog`,
`EmptyState`, `TopBar`, `Wordmark`, `NuggetMark` — ported alongside them.

Every `fetch` call and every hand-written type lives in `web/src/api.ts`, side by side, so the contract cannot drift unnoticed.

The design system's `ui_kits/web_app/BankApp.jsx` is a working, interactive
recreation of this whole screen against seed data. It is the reference for how
the pieces compose, and the closest thing to a target for the frontend work.

## 8. Error handling

A single `writeJSON` / `writeError` pair in the Go handlers, so every failure returns the same shape:

```json
{ "error": { "message": "..." } }
```

with an appropriate status code. A panic-recovery middleware ensures a bug returns 500 rather than killing the server mid-session.

On the frontend, errors render inline in the affected component. No toast system and no error boundaries at this size.

## 9. Future paths

These are not built now. They are recorded because decisions in section 4 were made to keep them cheap.

### 9.1 Phone access

Install Tailscale on the PC and the phone, bind the Go server to the tailnet interface, browse to it from the phone. Still zero cost, and **zero code changes**, because the binary already speaks HTTP/JSON over a real network. The tailnet is the authentication. Tailscale also supplies TLS via `tailscale cert`.

The remaining work is a responsive CSS pass — the one bounded cost of building desktop-only.

This is the strongest argument against a desktop framework such as Wails: its Go-to-JS binding layer is not HTTP, so going mobile would mean rewriting the entire backend boundary as a REST API.

### 9.2 User accounts

The current shape is already correct for this. Adding accounts means:

- A `users` table, a `sessions` table, and `user_id` foreign keys on `ideas` and `tags`. One goose migration.
- Password hashing with `golang.org/x/crypto/bcrypt` or argon2id. Never hand-rolled.
- A server-side session table plus `http.Cookie{HttpOnly, SameSite: Lax, Secure}`, and one middleware resolving cookie to user into the request `context.Context`. Roughly 100 lines, and the most transferable thing in the project. OAuth or Google sign-in only becomes worthwhile if other people use it.
- TLS becomes mandatory the moment credentials cross a network.

**Two things to do now, which cost nothing today:**

1. Keep *all* SQL in a single `internal/idea/store.go`. Adding accounts is then `WHERE user_id = ?` in one file.
2. Give every store method `context.Context` as its first parameter — idiomatic Go regardless, and the identity will ride there.

**Explicitly rejected:** adding a `user_id` column now, hardcoded to 1, to "prepare". It costs a column and a join today to save three lines of SQL in a migration later.

## 10. Repository layout

```
nuggets/
├── go.mod
├── .gitattributes               # * text=auto eol=lf  (day one; avoids CRLF churn)
├── .gitignore                   # internal/web/dist/, *.db, node_modules/
├── build.ps1                    # PowerShell 5.1 has no &&; see section 11
├── cmd/nuggets/main.go          # config, open DB, wire deps, open browser, listen
├── internal/
│   ├── idea/
│   │   ├── idea.go              # domain types
│   │   ├── store.go             # ALL SQL lives here
│   │   └── store_test.go        # real DB in t.TempDir()
│   ├── httpapi/
│   │   ├── server.go            # ServeMux wiring, logging + recovery middleware
│   │   ├── ideas.go             # handlers
│   │   ├── respond.go           # writeJSON / writeError
│   │   ├── ideas_test.go        # httptest
│   │   └── testdata/idea.golden.json
│   ├── db/
│   │   ├── db.go                # DSN pragmas, SetMaxOpenConns(1), goose.Up
│   │   └── migrations/          # //go:embed *.sql
│   └── web/
│       ├── embed.go             # //go:embed all:dist + SPA fallback
│       └── dist/                # Vite output — GITIGNORED
└── web/                         # frontend source
    ├── package.json             # typescript pinned to 6.x
    ├── vite.config.ts           # outDir -> ../internal/web/dist ; /api proxy
    └── src/
        ├── api.ts               # fetch wrapper + hand-written types
        ├── components/
        └── styles.css
```

**Vite builds into `internal/web/dist` rather than in place** because `go:embed` cannot reach outside its own package directory. Use `//go:embed all:dist` — the `all:` prefix includes files beginning with `_` or `.`.

## 11. Operating environment

Windows 11. The following friction points are each known and verified:

1. **No cgo required.** `modernc.org/sqlite` is pure Go. Choosing `mattn/go-sqlite3` instead would drag MSYS2 or TDM-GCC into the toolchain.
2. **The SQLite driver name is `"sqlite"`, not `"sqlite3"`.**
3. **Foreign keys are OFF by default in SQLite.** `idea_tags` would silently enforce nothing. Set pragmas in the DSN: `?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)`
4. **Bind `127.0.0.1:7777`, not `:7777`.** Binding all interfaces triggers a Windows Defender Firewall prompt on every rebuild and exposes the app to the LAN.
5. **The database path** comes from `os.UserConfigDir()` giving `%AppData%\nuggets\nuggets.db`, never a relative path, or the database moves depending on where the shortcut launched from. Run the path through `filepath.ToSlash` before putting it in a `file:` DSN — Windows backslashes are misparsed as URI escapes.
6. **`db.SetMaxOpenConns(1)`** is a legitimate simplification for a single-user app and eliminates `SQLITE_BUSY` entirely.
7. **PowerShell 5.1 has no `&&`.** Chained build commands copied from tutorials will fail. Use npm scripts or `build.ps1`. Do not assume `make` exists.
8. **Dev-time wiring:** Vite on 5173, Go on 7777, with `server.proxy: { '/api': 'http://127.0.0.1:7777' }` in `vite.config.ts`. This avoids CORS entirely; in production the Go binary serves both from one origin.

### Running it

`nuggets.exe` opens the browser itself via `os/exec`. For a window that feels native rather than a browser tab, launch Edge in app mode:

```
msedge --app=http://127.0.0.1:7777
```

Chromeless, no tabs, no address bar, and Edge is guaranteed present on Windows 11.

### Backup

The database is one file. Backup is copying `%AppData%\nuggets\nuggets.db`, or placing that folder in something synced. There is no export endpoint in the MVP.

## 12. Cost

Zero, with no asterisks. Go, Node, SQLite, React, Vite, Tailwind and goose are all MIT/BSD/Apache. WebView2 ships with Windows 11. No account, no cloud, no service.

Costs avoided by these choices:

| Risk | Avoided by |
|---|---|
| Docker Desktop licensing and memory | SQLite over Postgres |
| Code-signing certificate to avoid SmartScreen | Never distributing the `.exe` |
| Domain, TLS, hosting | Staying on localhost |
| Managed-database free-tier limits | A local file |
