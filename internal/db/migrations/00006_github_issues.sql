-- +goose Up
-- The outbox of feature-request issues to open on GitHub for nuggets that
-- gained a mapped tag (docs/superpowers/specs/2026-09-28-tag-to-github-issue-design.md).
-- Rows are inserted in the same transaction as the nugget write that added
-- the tag, and only internal/github's Sender sends them.
CREATE TABLE github_issues (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id         INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    -- owner/repo. GitHub names are case-insensitive, so the unique index
    -- below treats Jarrod-Bob/nuggets and jarrod-bob/NUGGETS as one repo.
    repo            TEXT NOT NULL COLLATE NOCASE,
    -- The mapped tag that queued this row, for display.
    tag             TEXT NOT NULL,
    -- pending | sending | created | failed. Validated in Go (github.State).
    state           TEXT NOT NULL DEFAULT 'pending',
    -- How many POSTs were started. Above 0, an earlier POST may have landed,
    -- so the sender looks for the marker before posting again.
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT NOT NULL DEFAULT '',
    -- A backed-off row isn't sent before this. NULL means due now.
    next_attempt_at TIMESTAMP,
    -- When the first POST started: the lower bound of the duplicate search.
    sent_at         TIMESTAMP,
    -- Random, embedded in the issue body's marker comment, so a found issue
    -- is certainly this row's and not one from another database.
    idempotency_key TEXT NOT NULL,
    issue_number    INTEGER,
    issue_url       TEXT,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL
);

-- At most one issue per nugget per repository, ever: the durable half of
-- idempotency. Enqueueing is INSERT ... ON CONFLICT DO NOTHING against it.
CREATE UNIQUE INDEX idx_github_issues_idea_repo ON github_issues(idea_id, repo);
CREATE INDEX idx_github_issues_due ON github_issues(state, next_attempt_at);

-- +goose Down
DROP TABLE github_issues;
