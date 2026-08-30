-- +goose Up
CREATE TABLE ideas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    archived_at TIMESTAMP
);

CREATE TABLE tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE idea_tags (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);

CREATE INDEX idx_ideas_archived_created ON ideas(archived_at, created_at DESC);
CREATE INDEX idx_idea_tags_tag ON idea_tags(tag_id);

-- +goose Down
DROP TABLE idea_tags;
DROP TABLE tags;
DROP TABLE ideas;
