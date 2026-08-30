# nuggets

nuggets is a fun little project that helps me store and manage all the different ideas I thought were cool to build at some point in my life.

## Why

Ideas turn up when I'm out, so they get typed into Telegram or WhatsApp as messages to myself. They survive there, but they end up buried among links, reminders and everything else I save to the same thread. The idea isn't lost exactly — it's just never found again, which comes to the same thing.

nuggets gives them somewhere to live: enough structure to find one on purpose, and a button to surface one at random when I feel like a challenge.

## What it does

- **Capture** an idea as a title plus notes, tagged however I like.
- **Tag** freely — tags autocomplete from ones I've already used, so I don't end up with `#saas` and `#SaaS`.
- **Find** by searching the text or filtering by tag.
- **Draw a random nugget** as a mini-challenge, optionally narrowed to one tag.
- **Archive** rather than delete, with a trash view to restore from. Losing an idea should take deliberate effort.

## Status

**Built.** The full design is in
[`docs/superpowers/specs/2026-08-29-nuggets-design.md`](docs/superpowers/specs/2026-08-29-nuggets-design.md) —
data model, API, and the reasoning behind each stack choice.

To build and run:

```powershell
./build.ps1
./nuggets.exe
```

`build.ps1` builds the frontend and embeds it into a single `nuggets.exe`. Running it opens
`http://127.0.0.1:7777` in your default browser, backed by a SQLite database at
`%AppData%\nuggets\nuggets.db`.

For a chromeless, app-like window instead of a browser tab:

```
msedge --app=http://127.0.0.1:7777
```

## Stack

| | |
|---|---|
| Backend | Go — stdlib `net/http`, SQLite via `modernc.org/sqlite` (pure Go, no cgo), `goose` migrations |
| Frontend | TypeScript, React, Vite, and the nuggets design system (CSS custom-property tokens, no Tailwind, no shadcn) |
| Shape | One Go binary that serves the API and the embedded frontend, then opens the browser at `127.0.0.1:7777` |
| Data | A single SQLite file at `%AppData%\nuggets\nuggets.db`. Backup is copying it. |

Two things drove most of these choices. I'm using this project to **learn Go and TypeScript**, so where there was a tie I took whichever option teaches the underlying mechanism rather than hides it — the stdlib router over a framework, hand-written types over codegen, real SQL over an ORM. And it has to run at **zero cost**, which rules out anything with a hosting bill, an account, or a free tier that could later stop being free.

## Scope

Desktop only for now, single user, no accounts. Deliberately.

Worth being honest about the gap: the thing that started this was capture *while I'm out*, and a desktop-only v1 doesn't fix that. For now ideas still land in Telegram and get drained into nuggets later. Getting the bank and the data model right comes first, and the design keeps phone access a later addition rather than a rewrite.

Deferred on purpose: a status field per idea, ratings, sorting, mobile, user accounts, export.
