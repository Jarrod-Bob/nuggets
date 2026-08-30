# nuggets — Status and Links Design

**Date:** 2026-08-30
**Status:** Approved design, pending implementation plan
**Issue:** [#3](https://github.com/Jarrod-Bob/nuggets/issues/3)

An idea in the bank is currently only ever captured or archived. There is nothing between "I wrote it down" and "I'm done with it", so a nugget being actively built looks identical to one that was typed in a year ago and never touched. Two additions close that: a status that moves through the lifecycle, and links out to wherever the work actually lives.

The MVP design doc already anticipated the first half. Its §2 lists status as deliberately deferred, and adds: *"Status (raw / exploring / building / parked / killed) and rating are the first planned extensions. Neither is built now; adding them later is one migration adding nullable columns to `ideas`, with no change to the existing tables."* This design keeps that promise, with one deliberate deviation noted below.

---

## The status field

Five states, as named in the design doc:

| State | Means |
|---|---|
| `raw` | Written down, nothing done with it. Every existing nugget becomes this. |
| `exploring` | Being thought about — reading, sketching, checking whether it is worth building. |
| `building` | Actually under construction. |
| `parked` | Stopped, but not rejected. Might come back. |
| `killed` | Decided against. Kept for the record, not for the future. |

`parked` and `killed` are separate on purpose. Collapsing them loses the only distinction that matters when re-reading the bank a year later: whether past-you stopped because of circumstances or because of judgement.

### Schema

```sql
ALTER TABLE ideas ADD COLUMN status TEXT NOT NULL DEFAULT 'raw';
CREATE INDEX idx_ideas_status ON ideas(status) WHERE archived_at IS NULL;
```

One column with a constant default, so every existing row becomes `raw` on migration with nothing to fix by hand and no backfill step.

**Deviation from the design doc:** it predicted a *nullable* column. `NOT NULL DEFAULT 'raw'` is better here — every nugget genuinely has a state, and nullable would force a null branch into the store, the API, the TypeScript type and every component that renders a badge, in exchange for nothing.

**No `CHECK` constraint, deliberately.** SQLite cannot add one to an existing table; it requires creating a replacement table, copying every row, dropping the original and renaming — with foreign keys disabled for the duration. That is a real risk to run against the single file the ideas live in, for a guarantee that buys little: the app is the only writer, and validating in Go produces a far better error message than a constraint violation does.

So `Status` becomes a real Go type with a parser that returns `ErrInvalidStatus`, mapped to a 400 in `writeStoreError` alongside the existing `ErrEmptyTitle`. The list of valid values is defined once, in Go, and the TypeScript union mirrors it the same way the existing types mirror the domain.

### The random draw only sees live ideas

The draw exists as a mini-challenge — "give me something I could start". Once ideas can be marked dead, being handed one you killed is noise. `Random` gains `AND status IN ('raw','exploring')` alongside its existing `archived_at IS NULL`.

This changes existing behaviour, but harmlessly: on the day of the migration every nugget is `raw`, so the draw behaves exactly as before and only narrows as statuses are actually set.

The empty case already works. `Random` returns `ErrNotFound` when nothing matches, the API turns that into a 404, and `api.ts` already converts that into `null` for "nothing to draw" — so a bank where everything is parked shows the existing empty state with no new code.

### Filtering

`ListFilter` gains `Status`, combining with the existing query and tag filters by AND, following the same pattern `store_list.go` already uses to build its `WHERE`. Status chips sit beside the tag filter that already exists.

---

## Links

Nuggets get links out to the documents and code where the work lives.

**Web addresses only, for now.** Local paths — `C:\projects\thing`, `file://` — are explicitly not supported in this version. Worth recording *why*, since it will come up again: a browser refuses to navigate to a local path from a web page, and no amount of frontend code changes that. The workaround would be to have the Go server open the path with the OS handler, the same way it already opens the browser at startup. That is a real option and it works, but it means the app gains a "open an arbitrary path from stored data" capability, and it is not needed to cover what "project documents or code" usually means — a repo on GitHub, a doc in Drive, a page in Notion. Deferred rather than rejected.

### Schema

```sql
CREATE TABLE idea_links (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id  INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    url      TEXT NOT NULL,
    label    TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_idea_links_idea ON idea_links(idea_id, position);
```

A table, not a JSON column. A nugget has many links, which is what a table is for; the cascade delete then matches what `idea_tags` already does, so purging a nugget keeps working with no extra code. Packing them into one text column is cheaper today and unqueryable forever, and it cuts against the "real SQL, no ORM" line the project has held since the start.

`position` preserves the order they were entered in — the first link is usually the main one.

### They travel inside the nugget

Links are part of the idea's JSON, and a save replaces the whole set — exactly the rule tags already follow, implemented the same way (`DELETE` then re-insert inside the existing transaction). No `/api/ideas/{id}/links` sub-resource.

The alternative is more correct REST and more surface: four more routes, four more handlers, four more client methods, and a second mental model for "collections attached to an idea" when one already exists and works.

### Every URL is parsed before it is stored

A link beginning `javascript:` — or `data:`, or `vbscript:` — saved into a nugget and later clicked runs inside the app with everything the app can reach. The store parses each URL with `net/url` and accepts only `http` and `https` with a non-empty host, returning `ErrInvalidLink` → 400 otherwise.

Validation belongs in the store, not the component, for the same reason `NormalizeTag` does: the server owns the rule, the frontend only previews it. The frontend additionally renders links with `rel="noopener noreferrer"` and `target="_blank"`, but that is defence in depth, not the guarantee.

A blank `label` renders as the URL's host, so a bare link still reads as something.

---

## The save behaviour has to change first

This is the part that touches code that already works, so it is worth being precise about what is wrong today.

`Update` in `store_update.go` replaces the whole record: title, notes, and the complete tag set. `Draft` is a plain struct of value types, so a field the client omits arrives as its zero value and is indistinguishable from a field the client deliberately cleared. Two consequences exist right now, before any of this feature is added:

- A save that omits `tags` sends `nil`, which normalises to an empty set, which **deletes every tag on that nugget**.
- A save that omits `title` is rejected with `ErrEmptyTitle`. So "just move this one to `building`" is impossible without resending the entire nugget.

Adding `status` to that same shape makes it worse: any partial save would silently reset the status too.

**The fix: absent means unchanged.**

```go
// before — every field required; absent silently means empty
type Draft struct {
    Title string   `json:"title"`
    Notes string   `json:"notes"`
    Tags  []string `json:"tags"`
}

// after — absent means "leave it exactly as it was"
type Draft struct {
    Title  *string   `json:"title"`
    Notes  *string   `json:"notes"`
    Tags   *[]string `json:"tags"`
    Status *Status   `json:"status"`
    Links  *[]Link   `json:"links"`
}
```

Pointers rather than a separate patch type: `encoding/json` leaves a pointer `nil` when the key is absent and sets it when the key is present, which is exactly the distinction needed, with no third-party dependency and no reflection.

What this does and does not change:

- **Create still requires a title.** `Create` rejects a nil or blank title exactly as it does now. Only *edit* semantics change.
- **Update rebuilds its SQL from the fields actually present**, rather than always writing all three columns. `updated_at` is still always set.
- **An update with nothing present at all** is a no-op that returns the current nugget, not an error.
- **The existing screen keeps working unchanged**, because `IdeaForm` already submits the complete draft every time. Nothing visibly changes until the individual nugget page starts saving one field at a time.

The alternative was to leave `Update` alone and add a dedicated status endpoint beside `archive` and `restore`. Smaller today, but it leaves the tag-wiping trap in place, adds a route per future field, and pushes the same workaround onto issue [#4](https://github.com/Jarrod-Bob/nuggets/issues/4)'s page.

---

## How it looks

The design system already has the parts, which keeps this from becoming a design exercise:

- **`Badge`** ships with exactly five tones — `neutral`, `golden`, `ketchup`, `herb`, `ink` — one per status. `raw` neutral, `exploring` golden, `building` herb, `parked` ink, `killed` ketchup.
- **`IdeaCard`** already has a `bitten` prop, documented as *"Takes a chomp out of the top-right corner. Reserve it for ideas that have been acted on."* Anything past `raw` is bitten. The prop exists and is unused; this is what it was for.
- Status chips reuse the `TagFilter` pattern rather than introducing a second kind of filter control.

Links render on the individual nugget page. Until [#4](https://github.com/Jarrod-Bob/nuggets/issues/4) lands they are editable in the existing dialog and shown as a count on the card — the data is complete either way, and nothing here blocks on that issue.

---

## Testing

- **Migration**: a database seeded with pre-migration rows comes through with every nugget `raw` and nothing else altered.
- **Partial save**, the important one: a save with only `status` leaves title, notes and tags untouched; a save with only `title` leaves tags untouched — the case that is broken today; an explicitly empty tag array still clears tags; an empty body is a no-op.
- **Status validation**: an unknown value is a 400 with a readable message, not a 500.
- **Link validation**: `javascript:`, `data:`, a scheme-less string and an empty host are all rejected; ordinary `http`/`https` pass; ordering survives a round trip.
- **Draw**: `parked` and `killed` are never drawn; a bank of only those returns the empty state rather than an error.
- **Cascade**: purging a nugget removes its links.
- The golden file `internal/httpapi/testdata/idea.golden.json` gains `status` and `links` and must be regenerated — it exists precisely to make this shape change visible.

---

## Not in this design

- **Status history.** Knowing a nugget moved to `building` on a date needs an events table and a view to show it. Not asked for, and it can be added later without touching this schema.
- **Sorting or grouping by status.** Filtering covers the need; ordering is a separate conversation.
- **Ratings.** Named alongside status in the design doc's deferred list, but a genuinely separate feature.
- **Local file links.** Deferred with reasons above.
