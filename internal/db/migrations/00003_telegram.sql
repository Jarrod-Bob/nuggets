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
