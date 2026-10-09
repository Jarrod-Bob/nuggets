# nuggets — Tag Suggestions from Jev

**Date:** 2026-10-09
**Status:** Approved, not yet implemented
**Issue:** closes [#25](https://github.com/Jarrod-Bob/nuggets/issues/25)
**Builds on:** [`2026-09-28-tag-to-github-issue-design.md`](2026-09-28-tag-to-github-issue-design.md) (a hook inside the nugget write's transaction, one goroutine per external service, a write-only token, events after commits) and [`2026-09-26-spices-pull-design.md`](2026-09-26-spices-pull-design.md) (imports, refreshes and Re-sync).

Terms (**Nugget**, **Title**, **Notes**, **Tag**, **Tag suggestion**, **Dismissed suggestion**) are defined in [`CONTEXT.md`](../../../CONTEXT.md). Jev is TypeSafe's System One model; its contract is the live HTTP API reference at <https://docs.typesafe.ai/api.md>.

## 1. Problem

The captain tags nuggets by hand, mostly through spices hashtags, and sometimes misses a tag a nugget plainly deserves. Nuggets should notice and offer the missing tag. The tags it knows about should be the ones in use, so a tag the captain starts using today is suggested for the next nugget without anyone editing a list.

## 2. Behaviour

- **Suggest, never apply.** A tag suggestion is shown on the nugget page for the captain to accept or dismiss. Accepting is an ordinary tag save, with everything a tag save already does: adding a mapped tag such as `nuggets` still queues a GitHub feature request, because the captain chose it.
- **When a nugget is checked.** A nugget is checked in the background after:
  - it is created, in the web UI or by a spices import (Re-sync included);
  - an edit or a spices refresh changes its title or notes. Values are compared, because the form sends every field.

  A save that changes only tags, status, links or project name doesn't trigger a check. Archived nuggets are never checked. There is no manual "suggest" button and no backfill: nuggets that exist when this ships, or that are saved while Jev isn't connected, are checked only after their next title or notes change.
- **Candidate tags.** Each check asks about every tag carried by at least one active nugget, except tags this nugget already has and its dismissed suggestions. The list is built fresh on every check, so new tags join automatically and tags that fall out of use drop out.
- **What Jev sees** (§6). The nugget's title, notes and current tags, plus one yes/no question per candidate tag. Each question gives the tag's name and the titles of up to 3 other active nuggets carrying it, the most recently updated first, with no title repeated after trimming, case-folding and collapsing whitespace. A tag whose name is vague (`nuggets`, `weekend`) is explained by the nuggets that carry it.
- **What gets shown.** Tags whose yes-probability is at least **0.7**, at most **3** of them, highest first. Both are constants (`jev.Threshold`, `jev.MaxSuggestions`), to be tuned against the real bank.
- **A re-check replaces.** A completed check replaces all of the nugget's open suggestions with its new result. Dismissed suggestions are untouched.
- **Dismissals stick.** Dismissing records the (nugget, tag) pair permanently. That tag is never asked about for that nugget again.
- **Adding a suggested tag by hand** (instead of accepting) clears the suggestion in the same transaction.
- **Removing a tag counts as a dismissal.** A tag removed from a nugget, by an edit or a spices refresh, is recorded as dismissed for that nugget in the same transaction, so a later check never suggests it back.
- **Stale results are thrown away.** If the nugget's title or notes change while its check is in flight, the result isn't stored, and the check runs again on the newer text.
- **Re-sync.** Every nugget a Re-sync creates is checked like any other new nugget, through the same queue, one check at a time. Dismissals on the detached originals don't carry over to the copies. Re-sync duplicates themselves are [#38](https://github.com/Jarrod-Bob/nuggets/issues/38).
- **Not connected.** With no TypeSafe API key, saves queue nothing and nothing is shown. Disconnecting empties the queue and keeps existing suggestions.

## 3. Configuration

Settings keys, owned by a new `internal/jev` package (`config.go`):

| Key | Holds | Default when missing |
|---|---|---|
| `jev_api_key` | The TypeSafe API key. Write-only: never returned, never logged | Not connected |
| `jev_last_error` | The last connection-level failure (rejected key, rate limit, unreachable) | None |

The model is fixed at `jev-latest`, and the base URL at `https://api.typesafe.ai`. Only tests change the base URL (an option on the Suggester, like the GitHub Sender's).

## 4. API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings/jev` | `{connected, last_error?, pending}`. `pending` is the number of queued checks. Never the key. |
| `PUT` | `/api/settings/jev` | `{api_key}`. A new key clears the last error and un-parks the Suggester. |
| `DELETE` | `/api/settings/jev` | Forgets the key and last error, and empties the queue (through `Suggester.Reset`). Suggestions stay. |
| `GET` | `/api/ideas/{id}/tag-suggestions` | The nugget's open suggestions: `[{tag, probability}]`, highest first, excluding tags it now has. |
| `POST` | `/api/ideas/{id}/tag-suggestions/{tag}/dismiss` | Records a dismissal. `204`. The tag is normalized with `idea.NormalizeTag`. Dismissing a tag with no open suggestion still records it. |

Accepting has no endpoint of its own. The page `PATCH`es the nugget's tags with the suggested tag added, and the hand-added rule (§2) clears the suggestion.

## 5. Data and the queue

Migration `00008_tag_suggestions.sql` adds two tables.

**`tag_checks`**, the queue: one row per nugget waiting for a check.
- Columns: `idea_id` (primary key, `REFERENCES ideas(id) ON DELETE CASCADE`), `requested_at`, `attempts`, `next_attempt_at`, `last_error`.
- A second request for a queued nugget updates `requested_at` instead of adding a row, so ten quick edits cost one check.

**`tag_suggestions`**: one row per (nugget, tag).
- Columns: `idea_id` (`ON DELETE CASCADE`), `tag`, `state` (`open` | `dismissed`), `probability`, `created_at`, `updated_at`.
- Primary key `(idea_id, tag)`.
- A dismissal sets `state = 'dismissed'`, inserting the row if needed.

**Enqueue.** `idea.Store` takes a new `WithContentChanged` hook. It runs inside the transaction of `Create`, the `ApplySynced` insert, and any `Update` or `ApplySynced` refresh whose title or notes differ from before. `jev.Queue.ContentChanged` reads `jev_api_key` through the transaction (`settings.GetTx`) and upserts a `tag_checks` row only when a key is set. No network call happens in a save.

**Hand-added tags.** `WithTagsAdded` becomes a list: each option adds a hook, and the hooks run in order. GitHub's hook and `jev.Queue.TagsAdded` both register. The jev hook deletes the nugget's open suggestions for the added tags, through the transaction.

**Removed tags.** A matching `WithTagsRemoved` hook (also a list) runs inside the transaction of any `Update` or `ApplySynced` refresh that removes tags, with only the removed ones. `jev.Queue.TagsRemoved` upserts them as `dismissed`. It records them whether or not a key is set, because the dismissal is the captain's choice, not Jev's.

## 6. The Suggester

`jev.Suggester` is the only code that calls TypeSafe. `Loop` runs a pass at startup, when woken (enqueue, a key change), and when the earliest backed-off check falls due. Each pass works through due checks one at a time, oldest `requested_at` first:

1. Read the nugget. If it's archived or gone, delete the check.
2. Build the candidates (§2) and their examples. If there are no candidates, store an empty result (step 5) without calling Jev.
3. `POST /v1/systemone` with the API key as a bearer token:
   - `state`: `{"nugget": {"title", "notes", "tags"}}`.
   - `questions`: one `noul` per candidate tag, keyed `t0`, `t1`, …, with the key mapped back to the tag in code. Question keys aren't sent to the model, so each question carries its full meaning.
   - Each question's `instructions` is an object: the question ("Does this tag belong on the nugget in `nugget`? Tags group a person's project ideas."), the tag name, and its example titles. Its `criteria`: `true` means the idea is about what the tag covers, judged by its name and examples; `false` means the idea is unrelated, or only shares a word with the tag.
   - If there are more than 50 candidates, the questions are split across requests of at most 50, sent one after another. The API documents no per-request maximum, so 50 is a starting point to measure.
4. Read the answers and keep `noul ≥ Threshold`, the top `MaxSuggestions`.
5. In one transaction: if the check's `requested_at` is still the one read in step 1, replace the nugget's open suggestions with the result and delete the check. Otherwise leave the check for the next pass (§2 "Stale results"). Dismissed rows are never touched.
6. After the commit, publish `tag-suggestions-changed` with the nugget's id if its open suggestions changed.

Outcomes:

| Answer | What happens |
|---|---|
| 200 | Steps 4 to 6. |
| 401 | Check stays queued. Last error "TypeSafe rejected the API key". The Suggester parks until the stored key changes. |
| 429, 529 | Check stays queued. Nothing is sent for at least 60 s, or longer if the response carries `Retry-After` (the API docs say only "retry with backoff"). Exponential backoff after that. |
| Network error, other 5xx | Check stays queued with the error; exponential backoff per check and for the Suggester. |
| 422 | A bug in the request: log TypeSafe's message (it names the field), record it as the last error, and delete the check. A retry would fail the same way. |

`Reset(fn)` runs a settings change between checks, never in the middle of one, as `github.Sender.Reset` does.

## 7. UI

**Nugget page:** under the tags, a **"Suggested tags"** row appears when there are open suggestions. Each suggestion is a chip showing the tag, with **Add** and **Dismiss** controls. The probability isn't shown. The row is hidden while the edit form is open. It refetches on `tag-suggestions-changed` for this nugget and on `ideas-changed`. The UI never names Jev.

**Settings:** a "Tag suggestions" section in the style of the GitHub one. It has the API key field (write-only, "Connected" or "Not connected"), Disconnect, the last error, and "N nuggets waiting to be checked" when `pending > 0`. The help text names TypeSafe and links to where a key is issued.

## 8. Tests

- **`internal/jev`:** an `httptest` fake TypeSafe (`fake_test.go`); nothing may call the real API. Cover:
  - The request shape: bearer key, `jev-latest`, `state`, and one noul per candidate with its examples.
  - The candidates exclude the nugget's own tags, its dismissed tags, and tags found only on archived nuggets.
  - Examples: at most 3, most recently updated first, excluding the nugget itself, with no repeated titles.
  - The threshold, the cap and the ordering.
  - A re-check replaces open suggestions and keeps dismissed ones.
  - A stale result is discarded and the check re-runs.
  - Batching above 50 candidates.
  - No candidates means no call.
  - The outcomes table: 401 parking until a new key, 429/529 `Retry-After`, 5xx backoff, and 422 deleting the check.
  - No key set: nothing is queued. Disconnect empties the queue.
  - The key never appears in a log.
- **`internal/idea`:** `WithContentChanged` fires on create, on import, on a title or notes change by edit or refresh, and not on a tags-, status-, links- or project-name-only save. Several `WithTagsAdded` hooks run in order, and an error from any one rolls the write back. `WithTagsRemoved` fires with only the removed tags on an edit or a refresh, and never on create or import.
- **`internal/httpapi`:** the settings round trip with the key never echoed; listing suggestions excludes tags the nugget now has; dismiss normalizes the tag and is idempotent; removing a tag in a `PATCH` records it as dismissed, with or without a key; accepting via `PATCH` clears the suggestion and still queues a GitHub request for a mapped tag.
- **Web** (vitest, jsdom): the row shows only with suggestions and hides in edit mode; Add sends the current tags plus the suggested one; Dismiss calls the endpoint and removes the chip; the event refetches; the settings section's connected, not connected and pending states.

## 9. Out of scope

- Auto-applying tags, at any confidence.
- Suggesting tags that aren't in use yet.
- A manual "suggest tags" button, a bank-wide backfill, re-checking old nuggets when a new tag appears, and checking nuggets saved while disconnected once a key is added.
- Suggestion badges on bank cards, or a "has suggestions" filter.
- Per-tag descriptions written by the captain.
- Carrying dismissals over to Re-sync copies, and Re-sync duplicates themselves ([#38](https://github.com/Jarrod-Bob/nuggets/issues/38)).

