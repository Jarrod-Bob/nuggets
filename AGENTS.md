# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.
- Go toolchain: `go` isn't on PATH by default in some environments; check `~/sdk/go1.27/bin` (or run `find ~ -maxdepth 3 -iname go1\* -type d`) if `go build`/`go test` report "command not found".
- goose migrations live in `internal/db/migrations/`, embedded via `//go:embed` in `internal/db/db.go` and applied automatically by `db.Open`. Number the next one sequentially — check the highest existing `NNNNN_*.sql` file, don't assume the issue tracker's numbering.
- Only importers set an idea's `source`/`source_ref` columns (the unique partial index added in migration 00003): `internal/idea.Store.CreateImported` (Telegram) and `ApplySynced`/`DetachSource` in `internal/idea/store_sync.go` (spices). The public JSON `Draft` shape deliberately has no way to set them, so an import can't be spoofed through the regular API. Source names and their display labels live in `internal/idea/idea.go` (`Source*`, `OriginLabel`).
- `internal/settings.Store` is a generic key/value store (migration 00003's `settings` table); each integration owns its keys and is the only package that should read/write them directly — `internal/telegram/pairing.go` and `internal/spices/config.go` (`Key*` constants). The API handlers in `internal/httpapi` go through those constants.
- Exactly one goroutine calls each external service: `internal/telegram.Poller` for Telegram (`getUpdates` allows one in-flight caller per bot) and `internal/spices.Syncer` for spices. Anything else that wants a fetch — sync buttons, startup — calls `.Sync()` or relies on `.Loop` running, never constructs its own client. Settings changes that must not interleave with an in-flight batch go through `.Reset(fn)`.
- spices pull design (409 → explicit Re-sync, never deleting nuggets; tombstones archive): `docs/superpowers/specs/2026-09-26-spices-pull-design.md`. Tests use `httptest` fakes only; there is no live spices.
- No env-var config exists in this repo by design — all runtime config is either CLI flags in `cmd/nuggets/main.go` or rows in the `settings` DB table (the Telegram bot token deliberately lives there, not in an env var — see `docs/superpowers/specs/2026-08-30-telegram-capture-design.md` §4.3 for why).
- The `-race` build flag doesn't work in this sandboxed dev environment (no C toolchain for cgo); run plain `go test ./...` here.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
