// Package github opens a feature-request issue on GitHub for each nugget
// that gains a mapped tag (issue #13). Design:
// docs/superpowers/specs/2026-09-28-tag-to-github-issue-design.md.
//
// Outbox is the SQL side: it queues rows inside the nugget write's own
// transaction (TagsAdded) and records what the Sender did with them. Sender
// is the only code that calls GitHub.
package github

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// State is where one queued feature request is.
type State string

const (
	// StatePending is queued: new, or waiting to retry after a failure that
	// retrying can fix.
	StatePending State = "pending"
	// StateSending means a POST was started and its answer not yet recorded.
	// Found at startup, it means the app stopped mid-send: the issue may
	// exist, so the Sender looks for it before posting again.
	StateSending State = "sending"
	// StateCreated is done: the issue exists.
	StateCreated State = "created"
	// StateFailed means GitHub refused it in a way retrying won't fix (no
	// such repository, no permission). Only the captain's Retry sends it
	// again.
	StateFailed State = "failed"
)

var (
	ErrIssueNotFound = errors.New("That feature request doesn't exist.")
	ErrNotRetryable  = errors.New("Only a failed feature request can be retried.")
)

// Issue is one row of the outbox: one nugget's feature request on one
// repository. A row linked to another nugget's request (see TagsAdded)
// reports that request's state, attempts, error, number and URL.
type Issue struct {
	ID        int64   `json:"id"`
	IdeaID    int64   `json:"idea_id"`
	Repo      string  `json:"repo"`
	Tag       string  `json:"tag"`
	State     State   `json:"state"`
	Attempts  int     `json:"attempts"`
	LastError string  `json:"last_error,omitempty"`
	Number    *int    `json:"number,omitempty"`
	URL       *string `json:"url,omitempty"`

	nextAttemptAt *time.Time
	sentAt        *time.Time
	key           string
	// marker is the one the first POST embedded, "" before any.
	marker string
}

// Outbox reads and writes the github_issues table (migration 00006).
type Outbox struct {
	db       *sql.DB
	settings *settings.Store
	// wake tells the Sender a row was queued or retried.
	wake chan struct{}
}

func NewOutbox(database *sql.DB, settingsStore *settings.Store) *Outbox {
	return &Outbox{db: database, settings: settingsStore, wake: make(chan struct{}, 1)}
}

// Wake asks the Sender for a pass. It never blocks.
func (o *Outbox) Wake() {
	select {
	case o.wake <- struct{}{}:
	default:
	}
}

// TagsAdded is the idea.TagsAddedFunc that queues feature requests: one row
// per repository a newly added tag maps to, unless that nugget already has
// one for the repository — then nothing, ever (the unique index). It runs
// inside the nugget write's transaction and never calls GitHub.
//
// When another nugget with the same title and notes (see sameIdea) already
// has a pending, sending or created request on the repository — typically
// the copy a spices Re-sync left behind — the new row links to that request
// instead of opening a second issue.
//
// It wakes the Sender before the transaction commits. That is harmless: the
// database has a single connection, so the Sender's pass can only read once
// the write has committed or rolled back.
func (o *Outbox) TagsAdded(ctx context.Context, tx *sql.Tx, ideaID int64, added []string) error {
	mappings, err := loadMappingsTx(ctx, o.settings, tx)
	if err != nil {
		return err
	}
	repoFor := make(map[string]string, len(mappings))
	for _, m := range mappings {
		repoFor[m.Tag] = m.Repo
	}
	queued := false
	now := time.Now().UTC()
	for _, tag := range added {
		repo, ok := repoFor[tag]
		if !ok {
			continue
		}
		original, err := findSameIdea(ctx, tx, ideaID, repo)
		if err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx,
			`INSERT INTO github_issues (idea_id, repo, tag, state, idempotency_key, linked_to, created_at, updated_at)
			 VALUES (?, ?, ?, ?, lower(hex(randomblob(16))), ?, ?, ?)
			 ON CONFLICT(idea_id, repo) DO NOTHING`,
			ideaID, repo, tag, string(StatePending), original, now, now)
		if err != nil {
			return fmt.Errorf("queueing feature request for %s: %w", repo, err)
		}
		if n, _ := res.RowsAffected(); n > 0 && original == nil {
			queued = true
		}
	}
	if queued {
		o.Wake()
	}
	return nil
}

// findSameIdea returns the id of another nugget's pending, sending or
// created request on repo whose nugget has the same title and notes as
// ideaID, or nil when there is none. A failed request doesn't count: the
// new nugget gets its own chance.
func findSameIdea(ctx context.Context, tx *sql.Tx, ideaID int64, repo string) (*int64, error) {
	var title, notes string
	if err := tx.QueryRowContext(ctx, `SELECT title, notes FROM ideas WHERE id = ?`, ideaID).Scan(&title, &notes); err != nil {
		return nil, fmt.Errorf("loading nugget %d: %w", ideaID, err)
	}
	rows, err := tx.QueryContext(ctx,
		`SELECT g.id, i.title, i.notes FROM github_issues g JOIN ideas i ON i.id = g.idea_id
		 WHERE g.repo = ? AND g.idea_id <> ? AND g.linked_to IS NULL AND g.state IN (?, ?, ?)
		 ORDER BY g.id`,
		repo, ideaID, string(StatePending), string(StateSending), string(StateCreated))
	if err != nil {
		return nil, fmt.Errorf("looking for the same idea on %s: %w", repo, err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id                     int64
			otherTitle, otherNotes string
		)
		if err := rows.Scan(&id, &otherTitle, &otherNotes); err != nil {
			return nil, fmt.Errorf("scanning feature request: %w", err)
		}
		if sameIdea(title, otherTitle) && sameIdea(notes, otherNotes) {
			return &id, nil
		}
	}
	return nil, rows.Err()
}

// sameIdea compares two titles or two notes ignoring case, leading and
// trailing space, and how long each run of whitespace is.
func sameIdea(a, b string) bool {
	return strings.EqualFold(strings.Join(strings.Fields(a), " "), strings.Join(strings.Fields(b), " "))
}

// issueColumns reads a row as it is shown: a linked row's own id, nugget,
// repository and tag, with its original's request state.
const issueColumns = `g.id, g.idea_id, g.repo, g.tag, e.state, e.attempts, e.last_error, e.next_attempt_at, e.sent_at, e.idempotency_key, e.marker, e.issue_number, e.issue_url`

// issueFrom joins each row (g) to the row whose request it shows (e): itself,
// or the original it links to.
const issueFrom = ` FROM github_issues g JOIN github_issues e ON e.id = COALESCE(g.linked_to, g.id)`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanIssue(row rowScanner) (Issue, error) {
	var (
		is          Issue
		state       string
		nextAttempt sql.NullTime
		sentAt      sql.NullTime
		marker      sql.NullString
		number      sql.NullInt64
		url         sql.NullString
	)
	err := row.Scan(&is.ID, &is.IdeaID, &is.Repo, &is.Tag, &state, &is.Attempts, &is.LastError,
		&nextAttempt, &sentAt, &is.key, &marker, &number, &url)
	if err != nil {
		return Issue{}, err
	}
	is.State = State(state)
	is.marker = marker.String
	if nextAttempt.Valid {
		is.nextAttemptAt = &nextAttempt.Time
	}
	if sentAt.Valid {
		is.sentAt = &sentAt.Time
	}
	if number.Valid {
		n := int(number.Int64)
		is.Number = &n
	}
	if url.Valid {
		is.URL = &url.String
	}
	return is, nil
}

// ForIdea returns a nugget's feature requests, oldest first. Never nil.
func (o *Outbox) ForIdea(ctx context.Context, ideaID int64) ([]Issue, error) {
	rows, err := o.db.QueryContext(ctx,
		`SELECT `+issueColumns+issueFrom+` WHERE g.idea_id = ? ORDER BY g.id`, ideaID)
	if err != nil {
		return nil, fmt.Errorf("loading feature requests: %w", err)
	}
	defer rows.Close()
	out := []Issue{}
	for rows.Next() {
		is, err := scanIssue(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning feature request: %w", err)
		}
		out = append(out, is)
	}
	return out, rows.Err()
}

// Get loads one row.
func (o *Outbox) Get(ctx context.Context, id int64) (Issue, error) {
	is, err := scanIssue(o.db.QueryRowContext(ctx,
		`SELECT `+issueColumns+issueFrom+` WHERE g.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Issue{}, ErrIssueNotFound
	}
	if err != nil {
		return Issue{}, fmt.Errorf("loading feature request: %w", err)
	}
	return is, nil
}

// Retry puts a failed row back in the queue and wakes the Sender. attempts
// is kept, so if any earlier POST might have landed the Sender still looks
// for it first. Retrying a linked row retries the original it links to.
func (o *Outbox) Retry(ctx context.Context, id int64) (Issue, error) {
	res, err := o.db.ExecContext(ctx,
		`UPDATE github_issues SET state = ?, last_error = '', next_attempt_at = NULL, updated_at = ?
		 WHERE id = (SELECT COALESCE(linked_to, id) FROM github_issues WHERE id = ?) AND state = ?`,
		string(StatePending), time.Now().UTC(), id, string(StateFailed))
	if err != nil {
		return Issue{}, fmt.Errorf("retrying feature request: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, err := o.Get(ctx, id); err != nil {
			return Issue{}, err
		}
		return Issue{}, ErrNotRetryable
	}
	o.Wake()
	return o.Get(ctx, id)
}

// Counts reports how many requests are waiting to be sent and how many
// failed. Linked rows share their original's request, so they aren't
// counted again.
func (o *Outbox) Counts(ctx context.Context) (pending, failed int, err error) {
	err = o.db.QueryRowContext(ctx,
		`SELECT
		   COALESCE(SUM(CASE WHEN state IN (?, ?) THEN 1 ELSE 0 END), 0),
		   COALESCE(SUM(CASE WHEN state = ? THEN 1 ELSE 0 END), 0)
		 FROM github_issues WHERE linked_to IS NULL`,
		string(StatePending), string(StateSending), string(StateFailed),
	).Scan(&pending, &failed)
	if err != nil {
		return 0, 0, fmt.Errorf("counting feature requests: %w", err)
	}
	return pending, failed, nil
}

// nextDue returns the queued row to send next — the one due longest — or
// false when none is due at now. Linked rows are never sent.
func (o *Outbox) nextDue(ctx context.Context, now time.Time) (Issue, bool, error) {
	is, err := scanIssue(o.db.QueryRowContext(ctx,
		`SELECT `+issueColumns+issueFrom+`
		 WHERE g.linked_to IS NULL AND g.state IN (?, ?) AND (g.next_attempt_at IS NULL OR g.next_attempt_at <= ?)
		 ORDER BY COALESCE(g.next_attempt_at, g.created_at), g.id
		 LIMIT 1`,
		string(StatePending), string(StateSending), now))
	if errors.Is(err, sql.ErrNoRows) {
		return Issue{}, false, nil
	}
	if err != nil {
		return Issue{}, false, fmt.Errorf("finding the next feature request: %w", err)
	}
	return is, true, nil
}

// earliestDue is when the soonest backed-off queued row falls due, or nil
// when none is waiting on a backoff.
func (o *Outbox) earliestDue(ctx context.Context) (*time.Time, error) {
	var at sql.NullTime
	err := o.db.QueryRowContext(ctx,
		`SELECT next_attempt_at FROM github_issues
		 WHERE linked_to IS NULL AND state IN (?, ?) AND next_attempt_at IS NOT NULL
		 ORDER BY next_attempt_at LIMIT 1`,
		string(StatePending), string(StateSending)).Scan(&at)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !at.Valid) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding the next retry: %w", err)
	}
	return &at.Time, nil
}

// markSending records, before the POST, that one is starting: the state
// that makes a restart look for the issue before posting again. The first
// one also records the marker the POST embeds. It reports false, changing
// nothing, when row is no longer as the pass read it (deleted, handed over,
// linked, or no longer queued): the caller must not POST.
func (o *Outbox) markSending(ctx context.Context, row Issue, marker string) (bool, error) {
	now := time.Now().UTC()
	res, err := o.db.ExecContext(ctx,
		`UPDATE github_issues SET state = ?, attempts = attempts + 1, sent_at = COALESCE(sent_at, ?),
		   marker = COALESCE(marker, ?), updated_at = ?
		 WHERE id = ? AND linked_to IS NULL AND state IN (?, ?) AND attempts = ? AND COALESCE(marker, '') = ?`,
		string(StateSending), now, marker, now,
		row.ID, string(StatePending), string(StateSending), row.Attempts, row.marker)
	if err != nil {
		return false, fmt.Errorf("marking feature request sending: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("marking feature request sending: %w", err)
	}
	return n > 0, nil
}

func (o *Outbox) markCreated(ctx context.Context, id int64, number int, url string) error {
	var storedURL any
	if url != "" {
		storedURL = url
	}
	_, err := o.db.ExecContext(ctx,
		`UPDATE github_issues SET state = ?, issue_number = ?, issue_url = ?, last_error = '', next_attempt_at = NULL, updated_at = ?
		 WHERE id = ?`, string(StateCreated), number, storedURL, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("recording created feature request: %w", err)
	}
	return nil
}

// markPending puts a row back in the queue, due at next (nil: at once).
func (o *Outbox) markPending(ctx context.Context, id int64, message string, next *time.Time) error {
	var due any
	if next != nil {
		due = next.UTC()
	}
	_, err := o.db.ExecContext(ctx,
		`UPDATE github_issues SET state = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
		 WHERE id = ?`, string(StatePending), message, due, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("re-queueing feature request: %w", err)
	}
	return nil
}

func (o *Outbox) markFailed(ctx context.Context, id int64, message string) error {
	_, err := o.db.ExecContext(ctx,
		`UPDATE github_issues SET state = ?, last_error = ?, next_attempt_at = NULL, updated_at = ?
		 WHERE id = ?`, string(StateFailed), message, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("recording failed feature request: %w", err)
	}
	return nil
}
