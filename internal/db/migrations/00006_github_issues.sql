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
    -- The marker comment the first POST embedded, which later attempts
    -- search for and reuse. It names the nugget the row belonged to then,
    -- which differs from idea_id after a hand-over (below).
    marker          TEXT,
    issue_number    INTEGER,
    issue_url       TEXT,
    -- Set when another nugget with the same title and notes already had a
    -- request on this repository (a spices Re-sync importing an idea again):
    -- this row is never sent and shows the original row's state instead.
    -- Always points at a row whose own linked_to is NULL.
    linked_to       INTEGER REFERENCES github_issues(id),
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL
);

-- At most one issue per nugget per repository, ever: the durable half of
-- idempotency. Enqueueing is INSERT ... ON CONFLICT DO NOTHING against it.
CREATE UNIQUE INDEX idx_github_issues_idea_repo ON github_issues(idea_id, repo);
CREATE INDEX idx_github_issues_due ON github_issues(state, next_attempt_at);
CREATE INDEX idx_github_issues_linked_to ON github_issues(linked_to);

-- Deleting a row others link to (purging its nugget) hands its request to
-- the oldest linked row, which the rest then link to, so the surviving
-- nuggets keep the issue and it is never opened a second time.
-- +goose StatementBegin
CREATE TRIGGER github_issues_hand_over BEFORE DELETE ON github_issues
WHEN EXISTS (SELECT 1 FROM github_issues WHERE linked_to = OLD.id)
BEGIN
    UPDATE github_issues
    SET linked_to = (SELECT MIN(id) FROM github_issues WHERE linked_to = OLD.id)
    WHERE linked_to = OLD.id
      AND id <> (SELECT MIN(id) FROM github_issues WHERE linked_to = OLD.id);
    UPDATE github_issues
    SET state = OLD.state, attempts = OLD.attempts, last_error = OLD.last_error,
        next_attempt_at = OLD.next_attempt_at, sent_at = OLD.sent_at,
        idempotency_key = OLD.idempotency_key, marker = OLD.marker, issue_number = OLD.issue_number,
        issue_url = OLD.issue_url, linked_to = NULL, updated_at = OLD.updated_at
    WHERE linked_to = OLD.id;
END;
-- +goose StatementEnd

-- +goose Down
DROP TABLE github_issues;
