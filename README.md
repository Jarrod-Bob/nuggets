# nuggets

nuggets is a fun little project that helps me store and manage all the different ideas I thought were cool to build at some point in my life.

## Why

Ideas turn up when I'm out, so they get typed into Telegram or WhatsApp as messages to myself. They survive there, but they end up buried among links, reminders and everything else I save to the same thread. The idea isn't lost exactly — it's just never found again, which comes to the same thing.

nuggets gives them somewhere to live: enough structure to find one on purpose, and a button to surface one at random when I feel like a challenge.

## What it does

- **Capture** an idea as a title plus notes, tagged however I like.
- **Tag** freely — tags autocomplete from ones I've already used, so I don't end up with `#saas` and `#SaaS`.
- **Find** by searching the text or filtering by tag.
- **Track status** through a lifecycle — raw, exploring, building, parked, killed — and filter by it.
- **Link out** to wherever the work actually lives, so a nugget points at its own progress.
- **Draw a random nugget** as a mini-challenge, optionally narrowed to one tag. Parked and killed nuggets stay out of the draw.
- **Archive** rather than delete, with a trash view to restore from. Losing an idea should take deliberate effort.

## Status

**Built.** The full design is in
[`docs/superpowers/specs/2026-08-29-nuggets-design.md`](docs/superpowers/specs/2026-08-29-nuggets-design.md) —
data model, API, and the reasoning behind each stack choice.

To build and run, pick whichever matches your platform:

```powershell
# Windows, PowerShell
./build.ps1
./nuggets.exe
```

```bat
:: Windows, cmd.exe — use this if PowerShell refuses to run build.ps1
:: ("running scripts is disabled on this system"). Batch scripts aren't
:: subject to PowerShell's execution policy at all, so this needs no
:: policy change. (The one-line fix for build.ps1 itself, if you'd
:: rather keep using it, is: powershell -ExecutionPolicy Bypass -File .\build.ps1)
build.cmd
nuggets.exe
```

```bash
# macOS / Linux
chmod +x build.sh   # once
./build.sh
./nuggets
```

All three do the same thing: build the frontend and embed it into a single binary. Running
it opens `http://127.0.0.1:7777` in your default browser, backed by a SQLite database at
`%AppData%\nuggets\nuggets.db` on Windows or `~/Library/Application Support/nuggets/nuggets.db`
on macOS.

For a chromeless, app-like window instead of a browser tab:

```
# Windows
msedge --app=http://127.0.0.1:7777

# macOS
open -na "Google Chrome" --args --app=http://127.0.0.1:7777
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

Deferred on purpose: ratings, sorting, mobile, user accounts, export.
