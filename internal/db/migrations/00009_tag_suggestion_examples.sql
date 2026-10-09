-- +goose Up
-- The example titles Jev was shown for each open tag suggestion, so the
-- nugget page can say why a tag was suggested
-- (docs/superpowers/specs/2026-10-09-jev-tag-suggestions-design.md §5).
-- A JSON array of strings, written by the check that produced the
-- suggestion and never recomputed. Rows written before this migration, and
-- dismissals, have none.
ALTER TABLE tag_suggestions ADD COLUMN examples TEXT NOT NULL DEFAULT '[]';

-- +goose Down
ALTER TABLE tag_suggestions DROP COLUMN examples;
