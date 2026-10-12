# nuggets — Pulling Ideas from spices

**Date:** 2026-09-26
**Status:** Implemented
**Issues:** closes [#7](https://github.com/Jarrod-Bob/nuggets/issues/7) (show a nugget's origin) and [#8](https://github.com/Jarrod-Bob/nuggets/issues/8) (show the last sync time), which ship with it.
**Builds on:** [`2026-08-30-telegram-capture-design.md`](2026-08-30-telegram-capture-design.md), whose patterns this reuses: the settings table, one loop with three triggers, `source` + `source_ref` with a unique index, the single error envelope, never echoing a secret, and never holding the DB connection across a network call.
**Contract:** spices' pull API, contract v1 (spices design §7).
**Update (2026-09-27):** nuggets' own Telegram capture has since been retired; spices is now the only source. References below to running alongside it are historical.

## 1. Problem

spices is the captain's always-on Telegram capture bot. It sorts what it receives into types, and one of them is `idea`. Until now those ideas never reached nuggets. The whole point of spices is to be the buffer that nuggets' own Telegram capture can't be: Telegram holds undelivered messages for about 24 hours, and spices holds them indefinitely.

This design makes nuggets a spices consumer. It pulls `type=idea` items into the bank **alongside** nuggets' own direct Telegram capture. Both can run at once. Retiring the direct capture is a later, separate decision, and nothing here depends on it.

## 2. Scope

**In:** configuring the spices connection from the settings screen, a sync loop, mapping ideas onto nuggets, tombstones, surviving a spices reset without losing anything, showing each nugget's origin (#7), and showing each source's last successful sync (#8).

**Out:** other spices types; spices' `?wait=` long poll and `feed_id` (both on spices' roadmap); de-duplicating the same idea arriving through both routes (the Telegram design §4.6 gap, which still stands); retiring nuggets' own Telegram capture.

## 3. Configuration

Everything lives in the `settings` table, owned by `internal/spices` (`config.go` has the key constants):

| Key | Holds | Default when missing |
|---|---|---|
| `spices_url` | The spices base URL | `http://127.0.0.1:7788` |
| `spices_token` | The bearer token (`SPICES_API_TOKEN` on the spices side) | Not connected |
| `spices_interval_seconds` | How often to pull | 60 |
| `spices_cursor` | The last `next_cursor` stored | 0 |
| `spices_last_sync_at` | When the last pull succeeded, RFC 3339 | "not synced yet" |
| `spices_last_error` | The last failure, for the status | None |
| `spices_needs_resync` | `1` after a 409 or an address change (§5), until Re-sync | Not set |
| `spices_reattach` | `1` from a Re-sync until the full pull after it commits (§5) | Not set |

**The token is write-only.** No response includes it, not even masked. It travels only in the `Authorization` header, never in a URL, so a transport error, which embeds the request URL, can't carry it into a log or into `spices_last_error`. A test drives every failure path and checks that the log never contains it. As with the Telegram token, this means `nuggets.db` now holds a second credential. The settings screen says so.

An address containing `user:password@` is rejected, so a secret can't hide in the one field that does get shown and logged.

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings/spices` | `{connected, url, interval_seconds, last_sync_at?, last_error?, needs_resync}`. Never the token. |
| `PUT` | `/api/settings/spices` | `{url?, token?, interval_seconds?}`. Every field is optional, so the address or interval can change without retyping the token. The token is required only when none is stored. The interval must be between 10 s and 24 h. If the address changes (compared after trimming whitespace and trailing slashes, against the stored address or the default) once anything has been pulled — a cursor past 0 or any `source='spices'` nugget — it also sets `spices_needs_resync` and the error "spices address changed; press Re-sync" (§5). A first connect with nothing pulled yet doesn't. Wakes the loop. |
| `DELETE` | `/api/settings/spices` | Disconnect: forgets the token, last error and last sync. **Keeps the address, interval and cursor**, so reconnecting resumes where it left off, and a spices that was reset in the meantime is still caught by its 409. Imported nuggets stay. |
| `POST` | `/api/spices/sync` | Wakes the loop. `202` straight away. |
| `POST` | `/api/spices/resync` | Re-sync (§5). Answers with the status plus `detached`, the number of nuggets set aside. |

Unlike Telegram's connect, `PUT` doesn't validate the token by calling spices. The loop is the only caller of spices (§4), so a wrong token shows up a moment later as the status error "spices rejected the API token".

## 4. The sync loop

`spices.Syncer` is the only code that calls spices. `Drain` does one full pull. `Loop` decides when to call it:

| Trigger | Mechanism |
|---|---|
| Startup | The loop's first iteration, started in a goroutine before the listener serves. With no token it parks immediately. |
| Interval | After a successful pull the loop sleeps for `spices_interval_seconds`. |
| Sync now | `Sync()` writes to the loop's wake channel. It never calls spices itself. |

**A pull (`Drain`):**

1. `GET /api/v1/items?since=<cursor>&type=idea&limit=100`, with a 15 s timeout.
2. Take the lock, re-read the settings, and **drop the page unsaved** if the token, the address or the cursor changed while it was in flight (disconnect, reconnect, Re-sync). This is the same guard Telegram uses against a batch arriving after a disconnect.
3. Apply the page and write `spices_cursor = next_cursor` **in one transaction** (`idea.Store.ApplySynced`, with the cursor write passed in via `settings.Store.SetTx`). The cursor can't commit without the page it covers, or the page without its cursor. The network call finished at step 1, so the transaction never spans a network call. At 100 items, a page holds the connection for a few milliseconds. This relaxes the Telegram design's "one nugget per transaction" rule (§8 of that spec), because spices' contract asks for the cursor to be stored with the page's writes. The pull right after a Re-sync is the one exception: it saves every page in one transaction (§5).
4. Loop while `has_more`. A `next_cursor` that doesn't advance is treated as an error rather than an infinite loop.
5. **Acknowledge** with `PUT /api/v1/consumers/nuggets/cursor`. This is best effort. A failure is logged and never retried inside the pull. The next successful pull tries again, so a failing ack is retried at most once per interval. The stored cursor stays authoritative, as spices' contract says. The last cursor acknowledged is remembered in memory, so an unchanged cursor isn't acknowledged twice.
6. Record `spices_last_sync_at` and clear `spices_last_error`.

Items that don't decode are skipped and logged, and the cursor still moves past them, so one bad item can't wedge the feed.

### Failure handling

This mirrors the Telegram poller's §9, as fixed in its follow-ups: parking stops all calls but keeps the goroutine alive.

| Condition | Response |
|---|---|
| Network failure, timeout, 5xx, other 4xx | Record the error for the status, then back off 1 s, doubling to 5 min. Sync now cuts the wait short. The error is logged only when it changes, so a dead spices doesn't fill the log. Unlike Telegram, a network failure *is* shown, because spices is a server the captain runs and "Couldn't reach spices: …" is actionable. |
| `401` / `403` | "spices rejected the API token." Park until Sync (connecting a new token calls it too). |
| `409` | §5. |
| No token | Park silently. |

## 5. A reset spices: 409 and Re-sync

A `409` means nuggets' cursor is ahead of spices' database: spices was recreated or restored from an older backup. **That database hands out item ids again**, so upserting by id would write new, unrelated ideas over old nuggets. spices' contract rule 5 says to clear or archive the consumer's spices rows first. **nuggets never does that on its own. The 409 path never deletes, archives or edits a nugget.**

**On 409:** the loop sets `spices_needs_resync`, records "spices was reset or restored; press Re-sync" as the status error, and parks. From then on `Drain` refuses to call spices at all, even on Sync now, until Re-sync. This matters. Once the reset spices has grown past the old cursor it stops answering 409, and a plain retry would silently resume and write reused ids over old nuggets. Only the flag prevents that.

**On an address change:** a new address may be a different spices database. If its latest rev is already past nuggets' cursor it never answers 409, and pulling would match its ids against the old server's nuggets. So once anything has been pulled, `PUT` treats a changed address like a 409: in the same locked write as the new settings it sets `spices_needs_resync` and records "spices address changed; press Re-sync". It leaves the cursor and the refs alone; Re-sync does the detaching. An existing flag is never cleared by `PUT`, and while the flag is set the loop never overwrites the stored reason. Moving the same spices to a new address (localhost to a tailnet name, say) costs a Re-sync, and the duplicates of any idea it can't match with certainty; that is the price of not guessing.

**Re-sync** (`POST /api/spices/resync`, a confirmed button in the Spices section) runs one transaction that:

- moves every `source='spices'` nugget to `source='spices-detached'`
- copies its old id to `source_detached_ref` and sets `source_ref = NULL`. A second reset can then detach again without colliding on the `(source, source_ref)` unique index, whose partial `WHERE source IS NOT NULL` treats NULL refs as distinct.
- sets the cursor to 0, sets `spices_reattach`, and clears the flag and the error

Then it wakes the loop, which pulls everything from spices again.

Nothing about a detached nugget's content changes: not its title, notes, tags, status, links, archive state or `updated_at`. A test edits a nugget before Re-sync and checks the edits survive. A detached nugget still shows "arrived via spices".

**Reattaching survivors (issue #38).** While `spices_reattach` is set, the pull is not saved a page at a time: `Drain` holds every page, then saves all the ideas, the final cursor and the end of `spices_reattach` in one transaction (`idea.Store.ReattachSynced`). A failure part-way saves nothing, and the next pass starts again from 0. In that transaction, a live idea with a title that would otherwise be created reattaches to a `spices-detached` nugget instead, when:

- its title and its notes each match the nugget's, compared after trimming, case-folding and collapsing runs of whitespace (`idea.SameText`, the same rule the tag → GitHub issue feature uses), and
- exactly one detached nugget matches the idea, and no other idea in the pull matches that nugget.

Reattaching sets the nugget's `source` back to `spices`, its `source_ref` and `source_rev` to the idea's, and clears `source_detached_ref` and `source_deleted_at`. Nothing else changes: not its content, tags, status, links, project name, archive state, `updated_at`/`source_synced_at` (an edited nugget stays edited) or tag suggestions, and no tag or content hook runs, so it isn't checked as a new nugget. Any ambiguity, either way round, falls back to a fresh copy as before, leaving every matching nugget detached. So does an idea edited in spices since the reset, since its title or notes no longer match. Tombstones never reattach. Every `spices-detached` nugget is a candidate, including ones left from an earlier Re-sync. Holding the whole pull is why the ambiguity check is exact: a match on page 1 can't be undone by a second match on page 5.

**The cost, accepted:** an idea that survived the reset but can't be matched with certainty (edited in spices since, or sharing its title and notes with another idea or nugget) is in the bank twice afterwards: once detached, once fresh. Duplicates are recoverable by hand. Ideas overwritten by unrelated ones are not, which is why a match must be exact and one-to-one. spices' planned per-database `feed_id` would let a future version tell a restore from a recreation, and match items instead of detaching them.

**Known limitation, inherited from spices §7:** a restore that leaves spices' latest rev at or above nuggets' cursor raises no 409, and can't be detected until `feed_id` exists. The per-nugget rev guard (§6) blunts it: a reused id arriving with a rev no higher than the one already applied changes nothing.

## 6. Mapping, upserts and tombstones

**Fields** (spices §7 "Field mapping for an idea"):

- `fields.title` → title, `fields.description` → notes, `tags` → tags (through the usual `NormalizeTag`).
- **Fallback:** when `fields.title` is empty, for example an item saved before spices had fields, whose `fields` is `{}`, the raw `text` stands in. Its first non-blank line becomes the title and the lines after it become the notes, unless a description exists. Indentation inside the notes is kept.
- An item with no usable title at all is skipped. The cursor still moves past it.
- `url` is not mapped: for an idea, spices leaves links inside the text, so they already arrive in the title or notes.

**Upsert by `(source='spices', source_ref=<id>)`**, using migration `00004_spices.sql`'s columns:

| Column | Role |
|---|---|
| `source_rev` | The spices `rev` last applied. An item whose rev isn't higher is a no-op, so a replayed feed changes nothing. |
| `source_synced_at` | Set to the same instant as `updated_at` whenever a sync writes the nugget's content. |
| `source_deleted_at` | The tombstone's `deleted_at`. |
| `source_detached_ref` | The old id, after Re-sync (§5). |

A newer version of an item refreshes the nugget's title, notes and tags **only if the captain hasn't touched the nugget since**, which is when `updated_at` still equals `source_synced_at`. Once the nugget has been edited in nuggets, the captain's version wins, and later pulls only move `source_rev`. Imported nuggets start as `raw`, like Telegram's.

**Tombstones** (`deleted_at` set): nuggets' status field has no archived-like value (`raw / exploring / building / parked / killed`; `killed` is a judgement the captain makes, not a deletion). But nuggets does have a first-class archive, `archived_at`, which is the Archive button and the trash, and it is reversible with Restore. **The choice: a tombstone archives the nugget and records `source_deleted_at`.** It never hard-deletes. It leaves `updated_at` alone (archiving isn't an edit), and keeps an existing `archived_at` if the captain had already binned it. A tombstone for an item nuggets never imported is skipped. If spices later revives the item, the nugget's content can refresh under the usual rule, but it stays in the trash until the captain restores it.

## 7. Origin (#7) and last sync (#8)

**Origin.** The Idea JSON always carries `source`, `source_ref` and `origin`. `origin` is a friendly label (`"Telegram"`, `"spices"`), and all three are `null` for a nugget typed into the app. `idea.OriginLabel` is the single mapping. `spices-detached` is also labelled "spices". The nugget page's meta line reads **"arrived via Telegram, 3d ago"** for an imported nugget, in place of "captured 3d ago" (both would name the same moment, `created_at`). A manually created nugget shows no origin.

**Last sync.** Each source records its last successful sync: `telegram_last_sync_at` is written after every `getUpdates` that answered, even an empty one, and `spices_last_sync_at` after every complete pull. Both are written under the loop's lock, and only if the connection is still the one the fetch used, so a late answer can't leave a stale time after a disconnect. Both status endpoints return `last_sync_at`, and the settings screen shows "last synced 2m ago" or "not synced yet" in each section. Disconnecting clears it. Connecting a new Telegram token clears it too.

## 8. Frontend

The settings dialog now holds one section per source: **Telegram**, then **spices**.

- The spices section has the address, the token (a password field, always empty; leaving it empty keeps the stored token) and the interval, with **Connect**, and once connected **Change**, **Disconnect** and **Sync now**.
- The status line shows the address, the last sync and the interval. Any error appears beneath it.
- After a 409 or an address change, the badge turns to "Needs re-sync" and **Sync now** becomes **Re-sync**. It asks for confirmation, spelling out the duplicate cost, before detaching.
- While the dialog is open, the Telegram section polls its status every 3 s. The spices section instead refreshes on the `spices-status` live event (below).

**Live updates.** The Syncer publishes to `internal/events` (a `WithEvents` option; `cmd/nuggets` passes the app's broker), and `GET /api/events` streams that to the page as server-sent events. A Drain that created, refreshed or archived any nugget publishes `ideas-changed` once, after its last page commits, even if a later page failed. A pass that changed nothing publishes no `ideas-changed`. Re-sync publishes it too if it detached anything. `spices-status` goes out whenever the status in settings moves: a recorded sync, a new error, a 409, Re-sync, and any settings change through `Reset`. The page refetches its current view on `ideas-changed` (the list under its URL filters, the open nugget, the trash, the tag list). It holds a reload that would reset an edit form with unsaved changes until the form closes, and says so in the form.

## 9. Testing

Everything runs against `httptest` fakes. No test reaches a real spices or Telegram.

- `internal/spices/syncer_test.go`, against a fake spices that implements paging, bearer auth, 409 and acks. It covers: paging, cursor persistence and resuming, idempotent re-pull, field mapping and the text fallback, tombstones, startup and interval pulls, Sync now, 401 parking until Sync, 5xx backoff and recovery, a 409 stopping without touching nuggets (and staying stopped once spices grows past the cursor), Re-sync detaching while keeping the captain's edits, best-effort acks, a page dropped on disconnect, and the token never appearing in the log.
- `internal/idea/store_sync_test.go`: the upsert rules, tombstones, the page rolling back when its cursor write fails, and detaching twice.
- `internal/spices/events_test.go`: one `ideas-changed` per pass that imports (across pages), none for a pass or replay that changes nothing, and `spices-status` on sync, 409, a new error and Reset. `internal/events` covers the broker's fan-out and slow-subscriber drop; `internal/httpapi/events_test.go` covers the stream's headers, events, heartbeat and close.
- `internal/httpapi/spices_test.go`: validation, the write-only token, the pull showing up in `last_sync_at`, the 409 → Re-sync flow over HTTP, an address change after a pull needing Re-sync (and a same-address save or first connect not), and disconnect keeping nuggets and the cursor.
