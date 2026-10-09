# nuggets

nuggets is a fun little project that helps me store and manage all the different ideas I thought were cool to build at some point in my life.

## Why

Ideas turn up when I'm out, so they get typed into Telegram or WhatsApp as messages to myself. They survive there, but they end up buried among links, reminders and everything else I save to the same thread. The idea isn't lost exactly — it's just never found again, which comes to the same thing.

nuggets gives them somewhere to live: enough structure to find one on purpose, and a button to surface one at random when I feel like a challenge.

## What it does

- **Capture** an idea as a title plus notes, tagged however I like.
- **Capture from your phone through spices.** Text ideas to [spices](https://github.com/Jarrod-Bob/spices), the always-on Telegram capture bot, and nuggets pulls every idea it has sorted — its title, description and tags. See [Connecting spices](#connecting-spices).
- **Live updates.** Nuggets that arrive in the background from spices appear in an open tab on their own, with no reload needed. The list keeps its filters, an open nugget refreshes in place, and an edit you haven't saved is never overwritten: the page catches up when you save or cancel. See [Live updates](#live-updates).
- **Turn tagged nuggets into GitHub feature requests.** Tag a nugget `nuggets` (in the app, or `#nuggets` when texting spices) and it becomes a feature-request issue on this repository, once. Other tags can point at other repositories. See [Feature requests on GitHub](#feature-requests-on-github).
- **See where a nugget came from.** An imported nugget's page says "arrived via spices, 2h ago"; the settings screen shows when spices last synced.
- **Tag** freely — tags autocomplete from ones I've already used, so I don't end up with `#saas` and `#SaaS`.
- **Find** by searching the text or filtering by tag.
- **Track status** through a lifecycle — raw, exploring, building, parked, killed, done — and filter by it.
- **Link out** to wherever the work actually lives, so a nugget points at its own progress.
- **Plan a nugget with Claude.** A nugget's page builds a planning prompt from it and opens Claude with that prompt filled in, or copies it. Claude's answer can be pasted back into the notes. nuggets itself calls no AI and needs no key.
- **Draw a random nugget** as a mini-challenge, optionally narrowed to one tag. Parked, killed and done nuggets stay out of the draw. Each draw also deals a timebox and a language + framework to build it with, and each of the three rerolls on its own. See [Draw a nugget](#draw-a-nugget).
- **Archive** rather than delete, with a trash view to restore from. Losing an idea should take deliberate effort.
- **Report a bug** from any page. The floating **Report a bug** button in the bottom-right corner opens this repository's bug-report form on GitHub in a new tab, with the page you were on, the nuggets build (the git commit it was built from) and your browser already filled in. You describe the rest, and can paste or drag screenshots in, on GitHub. nuggets sends nothing itself and never puts your nuggets, settings or tokens in the link.

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

## Connecting spices

1. Run spices somewhere nuggets can reach it — on the same machine it listens on `http://127.0.0.1:7788`; for another machine, use its tailnet address rather than a public port.
2. In nuggets, open **Settings** (top bar) and find the **spices** section.
3. Enter the spices address, the API token (spices' `SPICES_API_TOKEN`), and how often to pull (every 60 seconds by default), then **Connect**.

nuggets pulls straight away, then on that interval and whenever you press **Sync now**. It only ever pulls ideas. The token is stored in `nuggets.db` next to your ideas and is never shown again — leave the field empty when changing the address or interval to keep it. **Disconnect** forgets the token but keeps the nuggets and where the pull had got to.

If spices is ever recreated or restored from a backup, the section says *spices was reset or restored; press Re-sync* and stops pulling. **Re-sync** keeps every nugget that came from spices (set aside as detached, edits intact) and pulls everything in spices again; ideas that survived the reset then appear twice. Nothing is deleted either way. Changing the address once something has been pulled does the same — *spices address changed; press Re-sync* — because the new address may be a different spices whose ids mean different ideas. The reasoning is in [`docs/superpowers/specs/2026-09-26-spices-pull-design.md`](docs/superpowers/specs/2026-09-26-spices-pull-design.md).

## Feature requests on GitHub

A nugget that gets the tag `nuggets`, when it's created or imported from spices or when an edit adds the tag, becomes a feature-request issue on [Jarrod-Bob/nuggets](https://github.com/Jarrod-Bob/nuggets). The issue follows the repository's feature-request template: the nugget's title, its notes as the proposed solution, and its tags, origin and captured date. Each nugget gets one issue per repository, ever. A nugget with the same title and notes as one that already has a request (say, after a spices Re-sync imports your ideas again) shares that issue instead of opening another. Removing the tag or binning the nugget later leaves the issue alone, and an edit that doesn't add the tag sends nothing.

To set it up:

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Under **Repository access**, choose **Only select repositories** and pick the repositories you map tags to (`Jarrod-Bob/nuggets` by default).
3. Under **Permissions → Repository permissions**, set **Issues** to **Read and write**. Leave everything else as it is: no other permission is needed. (GitHub adds read-only Metadata by itself.) Read access is used to check for an issue that was already created before sending again.
4. In nuggets, open **Settings** (top bar), find the **GitHub** section, paste the token and **Connect**.

Ideas tagged before a token is saved wait in a queue and go out once one is saved. Each nugget's page shows **Feature request #N**, linked to the issue, once it exists. While it waits, the page says it's queued. If GitHub refused it (a missing repository, or a token that can't reach it), the page shows the error and a **Retry** button. A rejected token stops all sending until you save a new one, and rate limits and outages are retried by themselves. **Change** edits which tag goes to which repository (for example `spices` → `Jarrod-Bob/spices`). Like the spices token, the GitHub token is stored in `nuggets.db` and never shown again. The reasoning is in [`docs/superpowers/specs/2026-09-28-tag-to-github-issue-design.md`](docs/superpowers/specs/2026-09-28-tag-to-github-issue-design.md).

## Draw a nugget

**Draw a nugget** hands you one random raw or exploring nugget (`GET /api/ideas/random`), plus a challenge:

- **A timebox**: 90 minutes, one evening, a day or a weekend. The short ones come up more often, so a draw feels like something you could start today.
- **A stack**: a language plus a framework that fits it, for one track (web backend, frontend or full-stack, CLI, or mobile). For example, "Go + Cobra · CLI".

The nugget, the timebox and the stack each have their own reroll, so you can keep the nugget and change only the stack. A reroll never deals what's already showing unless it's the only option (the nugget's reroll passes `exclude=<id>` to the draw). Nothing is saved: the challenge only lives in the dialog, and taking it on doesn't change the nugget's status.

The stacks come from a static catalog that ships in the frontend, `web/src/lib/challengeCatalog.ts`. It maps language → track → frameworks. The picker in `web/src/lib/challenge.ts` chooses a language, then one of that language's tracks, then a framework listed under that track, so it can only deal a pairing that exists in the catalog. Languages, and frameworks the survey measures, are weighted by the [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/technology). The dialog shows a "data: Stack Overflow 2025" stamp, so you can tell when the figures are out of date. No network call is made at draw time.

**Refreshing the catalog** (once a year, when a new survey is published):

1. Open the new survey's technology page. Copy the "all respondents" usage percentages into each language's `share`, and into each framework's `share` where the survey lists that framework. Leave `share` out for a framework the survey doesn't measure. Within one track, the frameworks must either all have a share or all leave it out.
2. Update `CATALOG_SOURCE` (label, URL, retrieved date).
3. To add a framework, put it under its language and track, and add a matching row to `FRAMEWORK_FACTS` in `challengeCatalog.test.ts`. That table is a second, independent record of what each framework is for.
4. Run `npx vitest run src/lib/challenge` in `web/`. The tests reject a framework filed under the wrong language or track, an empty track, and malformed weights.

## Plan with Claude

On a nugget's page, **Plan with Claude** builds a prompt from the nugget's title, status, tags, notes and links. The prompt asks Claude to restate the problem, propose an MVP scope and a stack, list first steps, and flag risks. To change the wording, edit `PLAN_PROMPT_TEMPLATE` in [`web/src/lib/planPrompt.ts`](web/src/lib/planPrompt.ts).

There are three ways to send it:

- **Open in Claude Desktop** uses Claude Desktop's documented link, `claude://claude.ai/new?q=…` ([Claude Help](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)). Desktop opens a new chat with the prompt filled in but not sent. This needs the desktop app installed. Desktop cuts a prompt at roughly 14,000 characters, so when a nugget's notes are long, nuggets trims the notes in the link to keep the prompt under 12,000 characters and says so.
- **Copy & open claude.ai** copies the prompt and opens a new chat on claude.ai in the browser; paste it there. claude.ai in the browser has no documented way to fill in a prompt from a link.
- **Copy prompt** copies the complete prompt, never trimmed.

To keep Claude's answer, paste it into **Claude's answer** and press **Save to notes**. The answer goes at the end of the nugget's notes under a dated `Plan with Claude (YYYY-MM-DD):` line. nuggets reads the notes fresh from the server first, so nothing already in them is replaced. This costs nothing and stores nothing new: the conversation itself stays in Claude.

## Live updates

The page keeps one server-sent event stream open, `GET /api/events`. After a background import commits, the server sends `ideas-changed`, once per sync pass and never once per nugget. When the spices status changes (the last sync time, an error, needs-resync), it sends `spices-status`. When a GitHub feature request is created, fails or waits to retry, or the GitHub status changes, it sends `github-changed`. An event carries no data: the page just refetches whatever it is showing. The page also refetches when the tab becomes visible again or the stream reconnects, in case it missed an event while the laptop slept or the server restarted. A hidden tab closes its stream and reopens it when shown, because the server speaks plain HTTP/1.1 and browsers allow only about six connections per host: with six or more nuggets tabs visible at once, the streams can still use up every connection and stall API requests until one closes. The server side is `internal/events` and `internal/httpapi/events.go`; the page side is `web/src/live/LiveUpdates.tsx`.

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

Capture *while I'm out* — the thing that started this — goes through spices: ideas texted to its Telegram bot wait there, and land in the bank the next time the app is running and pulls. nuggets used to run its own Telegram bot too; that was retired in favour of spices, which owns the single bot token (the old design is kept, marked superseded, in [`docs/superpowers/specs/2026-08-30-telegram-capture-design.md`](docs/superpowers/specs/2026-08-30-telegram-capture-design.md)). Browsing the bank from a phone is still a later addition rather than a rewrite.

Deferred on purpose: ratings, sorting, mobile, user accounts, export.
