# nuggets — Telegram Capture Design

**Date:** 2026-08-30
**Status:** Approved design, pending implementation plan
**Issue:** [#2](https://github.com/Jarrod-Bob/nuggets/issues/2)
**Supersedes nothing.** Extends [`2026-08-29-nuggets-design.md`](2026-08-29-nuggets-design.md) §9, which recorded phone capture as a later addition rather than a rewrite.

## 1. Problem

The MVP design doc admits its own gap in §1: "The MVP is desktop-only, so it does not solve capture-while-out." Ideas still get typed into Telegram in the moment and drained into nuggets later, by hand.

That drain never happens reliably. The cost of capture on the desktop — open the app, click, type, save — is higher than the cost of typing a line into a chat that is already open, so the chat keeps winning and the bank keeps falling behind.

This feature closes the loop from the other end: instead of the user moving ideas into nuggets, nuggets collects them from where they already are.

## 2. Scope

### In scope

- A bot the user creates once with BotFather and connects from inside nuggets.
- Fetching new messages from that bot on three triggers: at startup, continuously while the app is open, and on demand from a button.
- Turning a text message into a nugget: first line as title, remainder as notes, hashtags as tags.
- A pairing step that binds the bot to one chat, so an unknown party cannot write into the bank.
- A settings screen — the app's first — to connect, pair, see status, and disconnect.
- Recording each nugget's origin, so the app can say where it came from.

### Out of scope

- Photos, voice notes, documents, and any other non-text message. The bot acknowledges and skips them.
- Editing or deleting a nugget from Telegram. Capture only, in one direction.
- Reacting to edited or deleted Telegram messages.
- Any inbound network listener. See §4.1.
- Idea-level de-duplication. That is a separate concern with its own issue; §4.6 explains precisely what this feature does and does not guarantee.
- Multiple bots, multiple paired chats, or multiple users.

## 3. Success criteria

1. An idea typed into the chat while away from the desk is in the bank, correctly titled and tagged, without any further action.
2. Closing the laptop for a week and reopening it imports everything from the last 24 hours and loses nothing older that Telegram still holds.
3. Restarting the app never imports the same message twice.
4. With no network, no bot configured, or Telegram down, the app behaves exactly as it does today and says why capture is idle.
5. No inbound port, no hosting, no account, no recurring cost — the constraints from the MVP doc's §12 hold.

## 4. Technical decisions

| Decision | Choice | Why |
|---|---|---|
| Transport | `getUpdates` long polling | §4.1 |
| Poll shape | One loop, ~25s held request | §4.2 |
| Credential storage | Settings table in the database, via an in-app screen | §4.3 |
| Access control | Pair to one chat on first use | §4.4 |
| Who may call Telegram | Exactly one goroutine, ever | §4.5 |
| Duplicate protection | Stored position, plus a unique origin per nugget | §4.6 |

### 4.1 Long polling, not a webhook

Telegram offers two delivery mechanisms. A webhook has Telegram POST to a public HTTPS URL, which means a hosting bill or a tunnel, a certificate, and an inbound listener — and nuggets deliberately binds `127.0.0.1` precisely so nothing on the network can reach it. `getUpdates` is an ordinary outbound HTTPS request from the machine, works behind any router and any NAT with no configuration, and requires no address of our own.

This is the only one of the two compatible with the zero-cost, zero-hosting constraint the project has held throughout, and it is what the issue itself proposed.

**Consequence to accept:** Telegram retains undelivered updates for roughly 24 hours. A machine left off for a week loses anything older than that window. This is inherent to polling, not to our implementation, and is documented on the settings screen rather than hidden.

### 4.2 One loop, three triggers

The issue lists three ways to fetch. They must not become three implementations that drift apart. There is one routine — `Drain` — which fetches everything waiting and saves it. The triggers only decide *when* it is called:

| Trigger | Mechanism |
|---|---|
| On startup | The loop's first iteration, started in a goroutine after `Serve` begins, never blocking the listener |
| While open | The loop asks Telegram to hold the request open (`timeout=25`) and answer the moment something arrives |
| Manual | The API handler signals the loop's wake channel; it does **not** call Telegram itself (§4.5) |

Holding the request open is preferred over a short poll on a timer: it makes a phone-typed nugget appear in seconds instead of up to a minute, while making *fewer* requests, not more.

### 4.3 The credential lives in the database, reached through a settings screen

The bot token is the one real secret the app will hold. It is stored in a `settings` table and managed from a new settings screen, rather than in an environment variable or a sidecar config file.

This is the most discoverable option and the only one that lets connect and disconnect happen without leaving the app. It costs the app its first settings screen, which is new surface area, and it carries one consequence that must be stated plainly rather than discovered later:

> **The database now contains a secret.** The MVP doc's §11 backup story is "backup is copying the file". Once the token lives in `nuggets.db`, copying or sharing that file shares the bot credential with it. Anyone holding it can read every message sent to the bot and post as the bot.

Mitigations, all mandatory:

- The token is **never** returned by any API response. `GET /api/settings/telegram` reports `connected: true` and the bot's username; it never echoes the token, not even masked.
- The token is **never** written to a log line, including error paths. Telegram's own error responses do not contain it, but the request URL does — so URLs are never logged verbatim.
- The settings screen states in plain words that the token is stored in the database file, next to the ideas.

The file itself lives under the per-user config directory, so it is protected by the operating system account and nothing more. That is the same protection the ideas already have; the point is only that the blast radius of the file changed.

### 4.4 Pairing binds the bot to one chat

Telegram bot usernames are searchable. A bot that accepts messages from every chat that finds it is a public write endpoint into a private idea bank.

The bot is therefore not hardcoded to an account — it learns which chat owns it, once:

1. The user connects a token. The app is now **connected but unpaired**.
2. The settings screen shows a six-character pairing code, valid for 15 minutes.
3. The user sends that code to the bot from whichever account and device they like.
4. The first chat to send the correct code becomes the owner. Its chat id is stored. The code is discarded.
5. From then on, messages from any other chat are ignored.

This satisfies "not tied to one specific user" — nothing is hardcoded and it can be re-paired from the settings screen at any time — without leaving the bank open.

**Two rules that are easy to get wrong:**

- While unpaired, a message that is not the pairing code is **dropped silently**. It is not answered, because answering confirms to a stranger that the bot is live and listening.
- A dropped message still **advances the stored position**. If ignored messages did not advance it, Telegram would hand back the same unwanted message forever and the poller would never progress. This is the single most likely implementation bug in the whole feature.

### 4.5 Exactly one goroutine may call Telegram

Telegram permits only one in-flight `getUpdates` per bot. A second concurrent call returns `409 Conflict`, and so does any `getUpdates` while a webhook is registered.

The manual sync button therefore does **not** call Telegram. It writes to the loop's wake channel and returns immediately. The loop remains the sole caller, which makes the conflict structurally impossible rather than merely unlikely.

A second copy of nuggets on the same machine would be a second caller — but it already cannot start, because `main.go` fails to bind `127.0.0.1:7777` and exits. The existing single-port design gives single-instance behaviour for free. This is worth knowing rather than relying on: if the app ever gains a `-addr` flag in normal use, this protection is gone and an explicit lock is needed.

### 4.6 What is and is not protected against duplicates

Two distinct mechanisms, guarding two distinct things:

- **The stored position** (`telegram_offset`) is Telegram's own acknowledgement mechanism. Passing `offset = last_update_id + 1` confirms everything before it and it is never sent again. This is what makes a restart safe.
- **A unique origin per nugget** (`source` + `source_ref`, with a unique index across the pair) is the backstop for when the stored position is wrong — a database restored from a backup, a half-committed transaction, a bug. It makes importing the same *message* twice impossible at the schema level.

**Neither of these de-duplicates ideas.** The same idea sent as two different messages, or typed into the app by hand and then also sent to the bot, produces two nuggets and always will under this design. That is a real gap, it gets materially worse the moment this feature ships, and it is tracked as its own feature request rather than smuggled in here.

## 5. Data model

One migration. Numbering note: the status-and-links work (issue #3) also adds a migration, and goose numbers are sequential — whichever lands first takes `00002`. The two are independent and can be applied in either order.

```sql
-- +goose Up
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

ALTER TABLE ideas ADD COLUMN source     TEXT;
ALTER TABLE ideas ADD COLUMN source_ref TEXT;

CREATE UNIQUE INDEX idx_ideas_source ON ideas(source, source_ref)
    WHERE source IS NOT NULL;

-- +goose Down
DROP INDEX idx_ideas_source;
DROP TABLE settings;
-- `source` and `source_ref` are left in place: SQLite cannot drop a
-- column without copying and swapping the whole table, which is not a
-- risk worth taking with the only file the ideas live in.
```

`source` is `NULL` for everything captured in the app — the partial index means those rows are exempt from the uniqueness rule, so any number of hand-typed nuggets remain legal. For an imported nugget, `source` is `'telegram'` and `source_ref` is the Telegram message id.

### Settings keys

| Key | Holds | Lost if the row is missing |
|---|---|---|
| `telegram_token` | The bot credential | Capture is off; the settings screen shows disconnected |
| `telegram_chat_id` | The paired chat | Connected but unpaired; a new code is offered |
| `telegram_offset` | Next update number to request | Up to 24h of messages re-fetched — and rejected by the unique origin index, so the visible effect is nil |
| `telegram_pair_code` | Active code and its expiry | A new one is generated on demand |
| `telegram_last_error` | Last failure, for the settings screen | Status shows as unknown until the next cycle |

Keeping these in a table rather than a config file means one storage mechanism, one backup, and one thing to reason about — and the table is immediately reusable by the next preference the app needs.

## 6. API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings/telegram` | Status: connected, bot username, paired, pairing code if active, last sync, last error. **Never the token.** |
| `PUT` | `/api/settings/telegram` | Store a token. Validates it with `getMe` first and returns 400 with Telegram's reason if it is rejected. |
| `DELETE` | `/api/settings/telegram` | Disconnect: clears token, chat, offset and code. Imported nuggets stay. |
| `POST` | `/api/settings/telegram/pair` | Generate a fresh pairing code. |
| `POST` | `/api/telegram/sync` | Wake the loop. Returns `202` immediately; it does not wait for the fetch. |

These follow the conventions already set in §6 of the MVP doc: the same single error envelope, the same `writeStoreError` mapping, and state changes as POST actions rather than PATCHes on a field.

`POST /api/telegram/sync` deliberately returns `202` with no import count. The count is not knowable synchronously without the handler calling Telegram itself, which §4.5 forbids. The UI reflects the result through the list refreshing, not through the button's response.

## 7. The capture pipeline

```
getUpdates(offset, timeout=25)
        │
        ├─ for each update, in order:
        │     ├─ not a message, or no text?  → skip, advance position
        │     ├─ unpaired?                   → is it the code? pair : drop
        │     ├─ wrong chat?                 → drop, advance position
        │     └─ text message from owner:
        │           ├─ parse → Draft
        │           ├─ INSERT in its own transaction
        │           ├─ on unique-origin conflict → treat as already imported
        │           └─ reply "saved ✓" (or the skip notice)
        │
        └─ persist offset = last update_id + 1
```

### Parsing a message

- **Title** — the first line, trimmed. If the message is a single line, that line is the title and notes are empty. An empty title after trimming means the message is skipped, matching `ErrEmptyTitle` in the existing store.
- **Notes** — everything after the first newline, trimmed.
- **Tags** — `#hashtags` found anywhere in the message, passed through the existing `NormalizeTag`, and removed from the text they were found in.

**Find hashtags with a regular expression over the message text, not with Telegram's `entities` offsets.** Telegram reports entity offsets in UTF-16 code units; Go strings are UTF-8 bytes. Any message containing an emoji or a non-BMP character silently mis-slices under a naive byte-offset read. The regex avoids the conversion entirely, and the only thing lost is Telegram's own opinion about what counts as a hashtag.

### Replying

Every accepted message gets a short confirmation naming the title. Every skipped non-text message gets "text only for now". Without a reply, the phone gives no signal that capture worked, which is the whole point of capturing from the phone. Failures to send the reply are logged and otherwise ignored — the nugget is already saved and that is what matters.

## 8. Concurrency

`internal/db` opens the database with `SetMaxOpenConns(1)`, with the comment "single-user app: one connection removes SQLITE_BUSY entirely". That assumption held while HTTP requests were the only writers. The poller is the first writer that runs on its own schedule.

Nothing corrupts — the single connection serialises everything — but a long transaction in the poller blocks a page request behind it. Three rules keep that invisible:

1. **One nugget per transaction.** Never wrap a whole batch. A batch of forty messages must not hold the connection for the length of forty inserts.
2. **Never query while rows are open.** `store_list.go` already carries this warning for its own tag loading; with a second writer the consequence is contention as well as deadlock.
3. **Never hold the connection across a network call.** Fetch everything from Telegram first, then write. Never write inside the loop that reads the HTTP response body.

If contention ever becomes visible, the fix is to raise the connection limit and rely on WAL — which the DSN already enables — not to restructure the poller. That is a deliberate later option, not something to pre-build.

## 9. Failure handling

| Condition | Response |
|---|---|
| Network unreachable, DNS failure, timeout | Back off: 1s doubling to a 5-minute ceiling, reset on success. Not surfaced to the user; this is ordinary laptop life. |
| `401 Unauthorized` | The token is wrong or revoked. Stop polling, record it, surface it on the settings screen. Retrying cannot help. |
| `409 Conflict` | Another poller or a registered webhook. Stop, surface it — retrying makes it worse. |
| `429 Too Many Requests` | Honour `parameters.retry_after` exactly. Never retry sooner. |
| `5xx` | Treat as a network failure and back off. |
| Malformed update | Skip the update, log it, **advance the position**. One bad message must never wedge the queue permanently. |

Nothing here may crash the process, block startup, or fill the log at poll frequency. The app with a broken bot must behave exactly like the app with no bot.

## 10. Testing

The Telegram client takes its base URL and its `*http.Client` as parameters, so tests stand up a fake Telegram with `httptest.NewServer` and never touch the network. This mirrors how `internal/httpapi` is already tested.

Coverage that must exist:

- Message-to-draft mapping, table-driven: single line, multi-line, hashtags in various positions, hashtags only, emoji before a hashtag (the UTF-16 trap in §7), empty after trimming, and whitespace-only.
- Position advances for every disposition — imported, dropped for wrong chat, skipped as non-text, and malformed.
- Pairing: correct code pairs, wrong code does not, an expired code does not, and a second chat cannot re-pair once bound.
- Re-importing the same message id is a no-op rather than an error to the caller.
- Each failure row in §9 produces the stated behaviour, including that `401` stops the loop and a network error does not.

## 11. Frontend

One new screen and one new control:

- **Settings** — reached from the top bar. Connect a token, show the pairing code, show status and last error, disconnect. It states where the token is stored (§4.3).
- **Sync now** — a manual fetch. It reflects only "asked", not "found N", per §6.

Imported nuggets show their origin on the individual nugget page (issue [#4](https://github.com/Jarrod-Bob/nuggets/issues/4)) — "arrived from Telegram, 3 days ago". If #4 has not landed, the origin is stored but not shown; nothing about this feature depends on it.

Everything uses the existing design system. Status uses the `Badge` component; the screen is a `Dialog` if #4's routing has not landed, and a route if it has.

## 12. Future paths

- **Capture from other chats.** The `source` column already distinguishes origins, so a second adapter is a new package and a new value, not a change to this design.
- **Photos and voice notes.** Both need attachment storage, which the MVP doc keeps out of scope; the skip-and-reply behaviour is what keeps that decision honest in the meantime.
- **Reaching the bank from the phone directly.** MVP doc §9.1's tailnet path remains the answer for *reading* on a phone. This feature solves capture, not browsing, and the two do not overlap.
