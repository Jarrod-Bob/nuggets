# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.
- Go toolchain: `go` isn't on PATH by default in some environments; check `~/sdk/go1.27/bin` (or run `find ~ -maxdepth 3 -iname go1\* -type d`) if `go build`/`go test` report "command not found".
- goose migrations live in `internal/db/migrations/`, embedded via `//go:embed` in `internal/db/db.go` and applied automatically by `db.Open`. Number the next one sequentially — check the highest existing `NNNNN_*.sql` file, don't assume the issue tracker's numbering.
- Only importers set an idea's `source`/`source_ref` columns (the unique partial index added in migration 00003): `ApplySynced`/`DetachSource` in `internal/idea/store_sync.go` (spices). The public JSON `Draft` shape deliberately has no way to set them, so an import can't be spoofed through the regular API. Source names and their display labels live in `internal/idea/idea.go` (`Source*`, `OriginLabel`); `telegram` stays there only to label historical rows from nuggets' retired Telegram bot (removed 2026-09-27; spices is the only capture source now).
- `internal/settings.Store` is a generic key/value store (migration 00003's `settings` table); each integration owns its keys and is the only package that should read/write them directly — `internal/spices/config.go`, `internal/github/config.go`, `internal/kimi/config.go` and `internal/jev/config.go` (`Key*` constants), and `internal/look/config.go` (the Look, issue #50; `internal/web.Handler` stamps it onto `<html data-look>`). The API handlers in `internal/httpapi` go through those constants.
- Exactly one goroutine calls each external service — `internal/spices.Syncer` for spices, `internal/github.Sender` for GitHub, `internal/jev.Suggester` for TypeSafe. Anything else that wants a fetch — sync buttons, startup — calls `.Sync()` (spices) / `.Wake()` (GitHub, jev) or relies on `.Loop` running, never constructs its own client. Settings changes that must not interleave with an in-flight batch go through `.Reset(fn)`. Deliberate exception: kimi-no-name-wa (`internal/kimi`, issue #26) has no loop — its one `kimi.Client`, built in `main.go`, runs each call on the browser request's context so closing the form cancels it. That is also why the server has no `WriteTimeout`.
- A nugget's **project name** (`project_name`) is the captain's, never an importer's: spices never writes it, and `idea.Store.Update` keeps a spices nugget *unedited* when a save changes nothing else, comparing values because the form sends every field.
- Background imports tell open pages to refetch through `internal/events` (in-process broker → `GET /api/events` SSE → `web/src/live/LiveUpdates.tsx`). A new import path publishes `events.IdeasChanged` once per pass, after its writes commit; it gets the publisher through a `WithEvents` option, never by reaching into another importer.
- Tag → GitHub issue (issue #13, `docs/superpowers/specs/2026-09-28-tag-to-github-issue-design.md`): `idea.WithTagsAdded` runs inside the nugget write's transaction and `github.Outbox.TagsAdded` enqueues there; the Sender posts later. Code holding a `*sql.Tx` must read through it (`settings.GetTx`) — the DB has one connection, so a plain read deadlocks. Tests use an `httptest` fake GitHub (`internal/github/fake_test.go`); nothing may call the real API.
- Tag suggestions from TypeSafe's Jev (issue #25, `docs/superpowers/specs/2026-10-09-jev-tag-suggestions-design.md`): `idea.Store` hooks are lists — `WithTagsAdded`, `WithTagsRemoved`, `WithContentChanged` each append and run in order inside the write's tx. `jev.Queue` registers all three (queue a check only while `jev_api_key` is set; clear a hand-added suggestion; record a removed tag as dismissed, key or not). Settings changes go through `Suggester.Reset`, which runs between checks. Tests use an `httptest` fake TypeSafe (`internal/jev/fake_test.go`); there is no key in dev and nothing may call the real API.
- tagbench (`docs/benchmarks/tag-suggestions/`, issue #40, spec `docs/superpowers/specs/2026-10-09-tagbench-design.md`) is a developer benchmark of Jev vs Claude, not part of the app, so it sits outside the "one caller per service" and "no env-var config" rules: Claude credentials come from the Anthropic SDK's standard resolution (`ANTHROPIC_API_KEY` or `ant auth login`), and Jev's key is read read-only from the DB. It reuses `jev.BuildCandidates`/`BuildRequests`, so the benchmark follows production. It spends real money (`-max-usd`, default $2; `-dry-run` first). Its tests use `httptest` fakes only, and nothing runs it in tests.
- The Draw-a-nugget challenge (timebox + language/framework/track) is frontend-only and stateless. The catalog is `web/src/lib/challengeCatalog.ts`, weighted by the Stack Overflow survey; the yearly refresh steps are in README "Draw a nugget". A new framework also needs a row in `FRAMEWORK_FACTS` in its test.
- Plan with Claude (issue #16a phase 1) is frontend-only: the prompt template and deep-link trimming live in `web/src/lib/planPrompt.ts`, and Save to notes is a plain `PATCH` of `notes`. Only `claude://claude.ai/new?q=` (Claude Desktop) is documented to prefill; claude.ai's web `?q=` is undocumented, so the web route is copy-then-paste.
- Web animation uses Motion (`docs/adr/0001-motion-for-animation.md`): `m.*` components only (App's `LazyMotion strict` throws on `motion.*`), timings from `web/src/lib/motion.ts`, and anything non-transform (e.g. `clip-path`) checks `useReducedMotion()` itself.
- Web: `npm run typecheck` is a no-op (the root tsconfig has `files: []`); run `npx tsc --noEmit -p tsconfig.app.json` to actually typecheck. DOM tests opt in per file with `// @vitest-environment jsdom`.
- spices pull design (409 → explicit Re-sync, never deleting nuggets; tombstones archive): `docs/superpowers/specs/2026-09-26-spices-pull-design.md`. Tests use `httptest` fakes only; there is no live spices.
- No env-var config exists in this repo by design — all runtime config is either CLI flags in `cmd/nuggets/main.go` or rows in the `settings` DB table (the spices API token deliberately lives there, not in an env var — the reasoning is in the superseded `docs/superpowers/specs/2026-08-30-telegram-capture-design.md` §4.3).
- There is no app version: the web build's identifier is the git short SHA injected as `__NUGGETS_BUILD__` by `web/vite.config.ts` (`define`), used by the "Report a bug" link (`web/src/lib/bugReport.ts`, whose field ids must match `.github/ISSUE_TEMPLATE/bug_report.yml`).
- The `-race` build flag doesn't work in this sandboxed dev environment (no C toolchain for cgo); run plain `go test ./...` here.

## Agent skills

### Issue tracker

GitHub issues in `Jarrod-Bob/nuggets`, using the `gh` CLI. Bugs and feature requests follow `.github/ISSUE_TEMPLATE/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), added alongside `bug` / `enhancement`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
