# nuggets — Tagged Nuggets Become GitHub Feature Requests

**Date:** 2026-09-28
**Status:** Implemented
**Issue:** closes [#13](https://github.com/Jarrod-Bob/nuggets/issues/13)
**Builds on:** [`2026-09-26-spices-pull-design.md`](2026-09-26-spices-pull-design.md) — the settings table, one goroutine per external service, a write-only token, and live-update events after commits.

## 1. Problem

Ideas about nuggets itself turn up the same way as every other idea: texted to spices (`#nuggets` becomes the tag `nuggets`) or typed into the bank. The captain wants those ideas to become feature-request issues on the nuggets repository too, without copying them over by hand.

## 2. Behaviour

- A nugget gets a **tag → repository mapping** match when a mapped tag is *added* to it: on create (web UI or spices import), or when an edit or a spices refresh adds the tag. Tags are already lowercase, so the match is case-insensitive.
- Each (nugget, repository) pair gets **at most one issue, ever**. A unique index on the outbox enforces it, across restarts and retries.
- Removing the tag, archiving or purging the nugget later does nothing to an issue that already exists. Purging a nugget whose issue hasn't been sent yet drops the queued row (`ON DELETE CASCADE`).
- An edit that doesn't add a mapped tag triggers nothing, including an edit of a nugget that had the tag before this feature (or before the mapping) existed. There is no backfill.
- **The same idea is never filed twice.** A spices Re-sync detaches the old nuggets and imports every idea again as new nuggets, so a `#nuggets` idea would otherwise get a second issue. Before queueing, if *another* nugget with the same title **and** the same notes already has a request on that repository in state `pending`, `sending` or `created`, the new nugget links to that request instead: its page shows the same "Feature request #N" (or the queued state until it exists), and Retry on it retries the original. Titles and notes are compared after trimming, case-folding and collapsing runs of whitespace to one space. Title alone never matches, so two different ideas that share a title each get an issue. A `failed` original doesn't count as a match: the new nugget gets its own request, since the original may never be retried.
- The default mapping is `nuggets` → `Jarrod-Bob/nuggets`. More tags can point at other repositories later (say `spices` → `Jarrod-Bob/spices`).

## 3. Configuration

Settings keys, owned by `internal/github` (`config.go`):

| Key | Holds | Default when missing |
|---|---|---|
| `github_token` | A fine-grained personal access token. Write-only: never returned, never logged | Not connected |
| `github_mappings` | JSON `[{"tag":"nuggets","repo":"Jarrod-Bob/nuggets"}]` | The default mapping above |
| `github_last_error` | The last connection-level failure (rejected token, rate limit, unreachable) | None |

Validation: a tag is trimmed, lowercased, may start with `#` (dropped), must be 1–64 characters with no control characters or commas, and may appear once. A repository is `owner/repo` using GitHub's name rules.

**Token scope.** A fine-grained token limited to the chosen repositories, with Repository permissions → Issues: Read and write, and nothing else. Read is needed for the duplicate check (§5).

With no token, matches still queue and are sent once a token is added.

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings/github` | `{connected, mappings, last_error?, pending, failed}`. Never the token. |
| `PUT` | `/api/settings/github` | `{token?, mappings?}`. Both optional. A new token clears the last error and un-parks the sender. |
| `DELETE` | `/api/settings/github` | Forgets the token and last error. The mapping and queue stay. |
| `GET` | `/api/ideas/{id}/github-issues` | The nugget's feature requests: `[{id, repo, tag, state, attempts, last_error?, number?, url?}]`. |
| `POST` | `/api/github-issues/{id}/retry` | A failed row goes back to pending. `409` for any other state. |

## 4. The outbox

Migration `00006_github_issues.sql` adds `github_issues`: `idea_id`, `repo` (`COLLATE NOCASE`, unique with `idea_id`), `tag`, `state`, `attempts`, `last_error`, `next_attempt_at`, `sent_at`, `idempotency_key` (random, set on insert), `issue_number`, `issue_url`, `linked_to`.

**Links.** `linked_to` points a nugget's row at the original row it shares a request with (§2); it always points at a row that isn't itself linked. A linked row is never sent and isn't counted in `pending`/`failed`; the nugget's feature-request list reports the original's state, attempts, error, number and URL for it. The per-(nugget, repo) unique index still holds. If the original row is deleted (its nugget purged), a trigger hands its state, number, URL, key and stored marker (the one its first POST embedded, which the duplicate search looks for) to the oldest linked row and re-points the rest at it, so the survivors keep the issue and nothing is sent again.

**Enqueue.** `idea.Store` takes a `WithTagsAdded` hook that runs inside the same transaction as the nugget write (`Create`, `Update` with tags, `ApplySynced` insert or refresh) and receives only the newly added tags. `github.Outbox.TagsAdded` reads the mapping, and the nugget's title and notes for the same-idea match, through that transaction and inserts `ON CONFLICT DO NOTHING`. No network call happens in a save or a spices page. The hook reads through the transaction because the database has a single connection: a read outside it would deadlock.

**States.** `pending` → `sending` → `created`, or `failed`.

## 5. The sender

`github.Sender` is the only code that calls GitHub. `Loop` runs a pass at startup, when woken (enqueue, Retry, a token change), and when the earliest backed-off row falls due.

For each due `pending` or `sending` row, in order:

1. If `attempts > 0`, an earlier POST may have landed (a crash between the POST and recording it, or a timeout after GitHub processed it). List the repository's issues updated since the first attempt (`GET /repos/{o}/{r}/issues?state=all&since=…`, up to five pages) and look for the row's marker, `<!-- nuggets:nugget-id=123 key=… -->`. A match is recorded as created without posting.
2. Mark the row `sending` and increment `attempts` (committed before the POST).
3. `POST /repos/{owner}/{repo}/issues` with `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28` and the token as a bearer header. The base URL defaults to `https://api.github.com` and is an option only tests change.

Outcomes:

| Answer | What happens |
|---|---|
| 201 | `created`, with the number and `html_url`. |
| 422 with labels sent | Retry once at once without labels; a second failure is handled like any other. |
| 401 | Row back to `pending`, last error "GitHub rejected the token". The sender parks until the stored token changes. |
| 403/429 rate limit | Row back to `pending`; nothing is sent until `Retry-After` or `X-RateLimit-Reset` (at least 60 s for a secondary limit). |
| Network error, 5xx | Row back to `pending` with the error; exponential backoff per row and for the sender. |
| Other 4xx (403, 404, 410, 422) | `failed` with GitHub's message. Only Retry sends it again. |

Created and failed rows, and status changes, publish `github-changed` on `internal/events`; the nugget page and the settings section refetch.

## 6. Issue content

Built from the nugget at send time, following `.github/ISSUE_TEMPLATE/feature_request.md`:

- **Title** `[Feature]: <nugget title>`, cut to GitHub's 256 characters.
- **Problem** — a line saying it was captured as an idea in nuggets.
- **Proposed Solution** — the nugget's notes.
- **Alternatives Considered** — none noted.
- **Additional Context** — the tags, the origin (spices, Telegram, or typed into nuggets) and the captured date.
- The hidden marker comment.
- Labels `["enhancement"]`.

No local URL (the nugget page lives on `127.0.0.1`), no link list, and no secret goes in.

## 7. UI

- Settings → **GitHub**: connected / not connected, the last error, how many requests are queued or failed, the token field (always empty; leaving it empty keeps the stored token), and the tag → repository rows.
- The nugget page: "Feature request #N" linking to the issue once created; "Feature request queued" (with the last error, if a retry is waiting) while pending; "Feature request failed" with the error and a Retry button.

## 8. Tests

All against an `httptest` fake GitHub; nothing calls the real API. They cover the request shape, the crash-between-POST-and-record case, a spices Re-sync opening no second issue (and same title with different notes still getting one), the triggers (create, import, edit adding the tag, and no trigger on unrelated edits), backoff, the 401 park, the 422 label fallback, the token never reaching a response or the log, and mapping validation. Vitest covers the settings section and the nugget page's link and states.
