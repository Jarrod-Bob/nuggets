-- +goose Up
-- Every existing nugget becomes 'raw': one column with a constant default, so
-- there is no backfill step and nothing to fix by hand. No CHECK constraint —
-- SQLite cannot add one in place, and the app validates status in Go, which
-- gives a far better error than a constraint violation would (see idea.Status).
ALTER TABLE ideas ADD COLUMN status TEXT NOT NULL DEFAULT 'raw';
CREATE INDEX idx_ideas_status ON ideas(status) WHERE archived_at IS NULL;

-- Links out to where the work lives. A table, not a JSON column: a nugget has
-- many links, and ON DELETE CASCADE then matches what idea_tags already does,
-- so purging a nugget removes its links for free.
CREATE TABLE idea_links (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id  INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    url      TEXT NOT NULL,
    label    TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_idea_links_idea ON idea_links(idea_id, position);

-- +goose Down
DROP TABLE idea_links;
DROP INDEX idx_ideas_status;
ALTER TABLE ideas DROP COLUMN status;
