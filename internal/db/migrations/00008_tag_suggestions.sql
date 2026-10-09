-- +goose Up
-- Tag suggestions from TypeSafe's Jev model
-- (docs/superpowers/specs/2026-10-09-jev-tag-suggestions-design.md §5).

-- The queue of nuggets waiting for a tag check: one row per nugget. Rows are
-- upserted in the same transaction as the write that changed the nugget's
-- title or notes, and only internal/jev's Suggester works through them.
CREATE TABLE tag_checks (
    idea_id         INTEGER PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
    -- When the latest change asked for this check. A second request moves it
    -- on instead of adding a row; a result is stored only if it is still the
    -- one the check started from (a stale result is thrown away).
    requested_at    TIMESTAMP NOT NULL,
    -- Failed calls so far, for this check's backoff.
    attempts        INTEGER NOT NULL DEFAULT 0,
    -- A backed-off check isn't run before this. NULL means due now.
    next_attempt_at TIMESTAMP,
    last_error      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_tag_checks_due ON tag_checks(next_attempt_at, requested_at);

-- One row per (nugget, tag) Jev suggested or the captain turned down.
CREATE TABLE tag_suggestions (
    idea_id     INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    -- Normalized like every tag (idea.NormalizeTag).
    tag         TEXT NOT NULL,
    -- open | dismissed. A dismissed row is permanent: that tag is never
    -- asked about for that nugget again.
    state       TEXT NOT NULL,
    -- Jev's yes-probability for an open suggestion; NULL for a dismissal
    -- that was never suggested.
    probability REAL,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    PRIMARY KEY (idea_id, tag)
);

-- +goose Down
DROP TABLE tag_suggestions;
DROP TABLE tag_checks;
