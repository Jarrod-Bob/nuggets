-- +goose Up
-- Pulling ideas from spices (docs/superpowers/specs/2026-09-26-spices-pull-design.md).
-- All four columns are NULL for nuggets typed into the app or captured from
-- Telegram; only internal/idea's spices sync methods write them.

-- The spices `rev` last applied to this nugget. A re-pulled item whose rev is
-- not higher is a no-op, so replaying the feed never rewrites anything.
ALTER TABLE ideas ADD COLUMN source_rev INTEGER;

-- Set to the same instant as updated_at whenever a sync writes the nugget's
-- content. If the two differ, the captain has edited it since, and a later
-- pull leaves its content alone.
ALTER TABLE ideas ADD COLUMN source_synced_at TIMESTAMP;

-- When spices tombstoned the item (its deleted_at). The nugget is archived,
-- never deleted; this records why.
ALTER TABLE ideas ADD COLUMN source_deleted_at TIMESTAMP;

-- A Re-sync after spices was reset moves source='spices' rows to
-- 'spices-detached' and clears source_ref, so a reset spices handing out the
-- same ids again can never match them. The old id is kept here.
ALTER TABLE ideas ADD COLUMN source_detached_ref TEXT;

-- +goose Down
-- Nothing to undo that is safe to undo: SQLite cannot drop a column without
-- copying and swapping the whole table (same reasoning as 00003).
SELECT 1;
