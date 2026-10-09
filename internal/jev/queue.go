package jev

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// Suggestion states (the tag_suggestions table, migrations 00008 and 00009).
const (
	stateOpen      = "open"
	stateDismissed = "dismissed"
)

// Suggestion is one open tag suggestion: a tag in use that Jev thinks the
// nugget is missing, with its yes-probability and the example titles Jev
// was shown for it in the check that produced it. Examples is empty (never
// nil) for a suggestion stored before they were kept.
type Suggestion struct {
	Tag         string   `json:"tag"`
	Probability float64  `json:"probability"`
	Examples    []string `json:"examples"`
}

// Queue reads and writes the tag_checks and tag_suggestions tables.
type Queue struct {
	db       *sql.DB
	settings *settings.Store
	// wake tells the Suggester a check was queued or the settings changed.
	wake chan struct{}
}

func NewQueue(database *sql.DB, settingsStore *settings.Store) *Queue {
	return &Queue{db: database, settings: settingsStore, wake: make(chan struct{}, 1)}
}

// Wake asks the Suggester for a pass. It never blocks.
func (q *Queue) Wake() {
	select {
	case q.wake <- struct{}{}:
	default:
	}
}

// ContentChanged is the idea.ContentChangedFunc that queues a tag check for a
// nugget whose title or notes are new. With no API key stored it queues
// nothing. A nugget already waiting keeps its one row, with requested_at moved
// on, so a run of quick edits costs one check. It runs inside the nugget
// write's transaction and never calls TypeSafe.
//
// It wakes the Suggester before the transaction commits. That is harmless:
// the database has a single connection, so the Suggester can only read once
// the write has committed or rolled back.
func (q *Queue) ContentChanged(ctx context.Context, tx *sql.Tx, ideaID int64) error {
	key, _, err := q.settings.GetTx(ctx, tx, KeyAPIKey)
	if err != nil {
		return err
	}
	if key == "" {
		return nil
	}
	now := time.Now().UTC()
	var prev time.Time
	err = tx.QueryRowContext(ctx, `SELECT requested_at FROM tag_checks WHERE idea_id = ?`, ideaID).Scan(&prev)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("reading tag check: %w", err)
	}
	// requested_at must move on, or an in-flight check would take a newer
	// request's text for its own.
	if err == nil && !now.After(prev) {
		now = prev.Add(time.Microsecond)
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO tag_checks (idea_id, requested_at) VALUES (?, ?)
		 ON CONFLICT(idea_id) DO UPDATE SET requested_at = excluded.requested_at`,
		ideaID, now); err != nil {
		return fmt.Errorf("queueing tag check: %w", err)
	}
	q.Wake()
	return nil
}

// TagsAdded is the idea.TagsAddedFunc that clears open suggestions for tags
// the nugget now has, so a tag added by hand (or accepted) stops being
// offered. Dismissals are kept.
func (q *Queue) TagsAdded(ctx context.Context, tx *sql.Tx, ideaID int64, added []string) error {
	for _, tag := range added {
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM tag_suggestions WHERE idea_id = ? AND tag = ? AND state = ?`,
			ideaID, tag, stateOpen); err != nil {
			return fmt.Errorf("clearing suggestion %q: %w", tag, err)
		}
	}
	return nil
}

// TagsRemoved is the idea.TagsRemovedFunc that records each removed tag as a
// dismissed suggestion for the nugget, so no later check suggests it back.
// It records them whether or not a key is stored: the dismissal is the
// captain's choice, not Jev's.
func (q *Queue) TagsRemoved(ctx context.Context, tx *sql.Tx, ideaID int64, removed []string) error {
	for _, tag := range removed {
		if err := dismiss(ctx, tx, ideaID, tag); err != nil {
			return err
		}
	}
	return nil
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func dismiss(ctx context.Context, q execer, ideaID int64, tag string) error {
	now := time.Now().UTC()
	if _, err := q.ExecContext(ctx,
		`INSERT INTO tag_suggestions (idea_id, tag, state, probability, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, ?)
		 ON CONFLICT(idea_id, tag) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
		ideaID, tag, stateDismissed, now, now); err != nil {
		return fmt.Errorf("dismissing suggestion %q: %w", tag, err)
	}
	return nil
}

// Dismiss records that the captain turned tag down for the nugget, for good.
// The tag is normalized; dismissing a tag with no open suggestion still
// records it. A missing nugget is idea.ErrNotFound.
func (q *Queue) Dismiss(ctx context.Context, ideaID int64, tag string) error {
	tag = idea.NormalizeTag(tag)
	if tag == "" {
		return nil
	}
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()
	var exists int
	if err := tx.QueryRowContext(ctx, `SELECT 1 FROM ideas WHERE id = ?`, ideaID).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
		return idea.ErrNotFound
	} else if err != nil {
		return fmt.Errorf("loading nugget: %w", err)
	}
	if err := dismiss(ctx, tx, ideaID, tag); err != nil {
		return err
	}
	return tx.Commit()
}

// Suggestions returns the nugget's open suggestions, highest probability
// first, leaving out tags it now has. Never nil.
func (q *Queue) Suggestions(ctx context.Context, ideaID int64) ([]Suggestion, error) {
	rows, err := q.db.QueryContext(ctx,
		`SELECT s.tag, COALESCE(s.probability, 0), s.examples FROM tag_suggestions s
		 WHERE s.idea_id = ? AND s.state = ?
		   AND NOT EXISTS (
		     SELECT 1 FROM idea_tags it JOIN tags t ON t.id = it.tag_id
		     WHERE it.idea_id = s.idea_id AND t.name = s.tag)
		 ORDER BY s.probability DESC, s.tag`,
		ideaID, stateOpen)
	if err != nil {
		return nil, fmt.Errorf("loading tag suggestions: %w", err)
	}
	defer rows.Close()
	out := []Suggestion{}
	for rows.Next() {
		var (
			s        Suggestion
			examples string
		)
		if err := rows.Scan(&s.Tag, &s.Probability, &examples); err != nil {
			return nil, fmt.Errorf("scanning tag suggestion: %w", err)
		}
		if err := json.Unmarshal([]byte(examples), &s.Examples); err != nil {
			return nil, fmt.Errorf("decoding examples for suggestion %q: %w", s.Tag, err)
		}
		if s.Examples == nil {
			s.Examples = []string{}
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// Pending counts the nuggets waiting for a tag check.
func (q *Queue) Pending(ctx context.Context) (int, error) {
	var n int
	if err := q.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tag_checks`).Scan(&n); err != nil {
		return 0, fmt.Errorf("counting tag checks: %w", err)
	}
	return n, nil
}

// Clear empties the queue. Suggestions and dismissals stay.
func (q *Queue) Clear(ctx context.Context) error {
	if _, err := q.db.ExecContext(ctx, `DELETE FROM tag_checks`); err != nil {
		return fmt.Errorf("emptying tag checks: %w", err)
	}
	return nil
}

// check is one queued tag check as a pass read it.
type check struct {
	ideaID      int64
	requestedAt time.Time
	attempts    int
}

// nextDue returns the check to run next — the oldest request not backed off
// past now — or false when none is due.
func (q *Queue) nextDue(ctx context.Context, now time.Time) (check, bool, error) {
	var c check
	err := q.db.QueryRowContext(ctx,
		`SELECT idea_id, requested_at, attempts FROM tag_checks
		 WHERE next_attempt_at IS NULL OR next_attempt_at <= ?
		 ORDER BY requested_at, idea_id LIMIT 1`, now.UTC(),
	).Scan(&c.ideaID, &c.requestedAt, &c.attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return check{}, false, nil
	}
	if err != nil {
		return check{}, false, fmt.Errorf("finding the next tag check: %w", err)
	}
	return c, true, nil
}

// earliestDue is when the soonest backed-off check falls due, or nil when
// none is waiting on a backoff.
func (q *Queue) earliestDue(ctx context.Context) (*time.Time, error) {
	var at sql.NullTime
	err := q.db.QueryRowContext(ctx,
		`SELECT next_attempt_at FROM tag_checks WHERE next_attempt_at IS NOT NULL
		 ORDER BY next_attempt_at LIMIT 1`).Scan(&at)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !at.Valid) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding the next tag check retry: %w", err)
	}
	return &at.Time, nil
}

// candidates builds a check's questions (design §2, BuildCandidates): every
// tag carried by at least one active nugget, except the nugget's own tags
// and its dismissed suggestions.
func (q *Queue) candidates(ctx context.Context, nugget *idea.Idea) ([]Candidate, error) {
	skip := make(map[string]bool, len(nugget.Tags))
	for _, t := range nugget.Tags {
		skip[t] = true
	}
	dismissed, err := q.Dismissed(ctx, nugget.ID)
	if err != nil {
		return nil, err
	}
	for _, t := range dismissed {
		skip[t] = true
	}
	uses, err := q.tagUses(ctx)
	if err != nil {
		return nil, err
	}
	return BuildCandidates(nugget.ID, skip, uses), nil
}

// Dismissed returns the tags the captain turned down for a nugget.
func (q *Queue) Dismissed(ctx context.Context, ideaID int64) ([]string, error) {
	rows, err := q.db.QueryContext(ctx,
		`SELECT tag FROM tag_suggestions WHERE idea_id = ? AND state = ? ORDER BY tag`, ideaID, stateDismissed)
	if err != nil {
		return nil, fmt.Errorf("loading dismissed suggestions: %w", err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("scanning dismissed suggestion: %w", err)
		}
		out = append(out, tag)
	}
	return out, rows.Err()
}

// tagUses returns every use of a tag on an active nugget.
func (q *Queue) tagUses(ctx context.Context) ([]TagUse, error) {
	rows, err := q.db.QueryContext(ctx,
		`SELECT t.name, i.id, i.title, i.updated_at FROM tags t
		 JOIN idea_tags it ON it.tag_id = t.id
		 JOIN ideas i ON i.id = it.idea_id
		 WHERE i.archived_at IS NULL`)
	if err != nil {
		return nil, fmt.Errorf("loading tags in use: %w", err)
	}
	defer rows.Close()
	var out []TagUse
	for rows.Next() {
		var u TagUse
		if err := rows.Scan(&u.Tag, &u.NuggetID, &u.Title, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning tag in use: %w", err)
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// storeResult replaces the nugget's open suggestions with result and deletes
// the check, in one transaction — but only if the check is still the one
// that started from requestedAt. stored is false when it isn't (the title or
// notes changed meanwhile, or the check is gone): nothing is written, and a
// queued check runs again on the newer text. changed reports whether the set
// of open suggested tags differs from before. Dismissed rows are never
// touched.
func (q *Queue) storeResult(ctx context.Context, ideaID int64, requestedAt time.Time, result []Suggestion) (stored, changed bool, err error) {
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return false, false, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var current time.Time
	err = tx.QueryRowContext(ctx, `SELECT requested_at FROM tag_checks WHERE idea_id = ?`, ideaID).Scan(&current)
	if errors.Is(err, sql.ErrNoRows) {
		return false, false, nil
	}
	if err != nil {
		return false, false, fmt.Errorf("reading tag check: %w", err)
	}
	if !current.Equal(requestedAt) {
		return false, false, nil
	}

	before, err := openTags(ctx, tx, ideaID)
	if err != nil {
		return false, false, err
	}
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM tag_suggestions WHERE idea_id = ? AND state = ?`, ideaID, stateOpen); err != nil {
		return false, false, fmt.Errorf("clearing open suggestions: %w", err)
	}
	now := time.Now().UTC()
	after := map[string]bool{}
	for _, s := range result {
		if s.Examples == nil {
			s.Examples = []string{}
		}
		examples, err := json.Marshal(s.Examples)
		if err != nil {
			return false, false, fmt.Errorf("encoding examples for %q: %w", s.Tag, err)
		}
		res, err := tx.ExecContext(ctx,
			`INSERT INTO tag_suggestions (idea_id, tag, state, probability, examples, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(idea_id, tag) DO NOTHING`,
			ideaID, s.Tag, stateOpen, s.Probability, string(examples), now, now)
		if err != nil {
			return false, false, fmt.Errorf("storing suggestion %q: %w", s.Tag, err)
		}
		if n, _ := res.RowsAffected(); n > 0 {
			after[s.Tag] = true
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM tag_checks WHERE idea_id = ?`, ideaID); err != nil {
		return false, false, fmt.Errorf("deleting tag check: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return false, false, fmt.Errorf("committing: %w", err)
	}
	return true, !maps.Equal(before, after), nil
}

func openTags(ctx context.Context, tx *sql.Tx, ideaID int64) (map[string]bool, error) {
	rows, err := tx.QueryContext(ctx,
		`SELECT tag FROM tag_suggestions WHERE idea_id = ? AND state = ?`, ideaID, stateOpen)
	if err != nil {
		return nil, fmt.Errorf("loading open suggestions: %w", err)
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("scanning open suggestion: %w", err)
		}
		out[tag] = true
	}
	return out, rows.Err()
}

// deleteCheck drops a nugget's check if it is still the one that started
// from requestedAt: the nugget is archived or gone, or TypeSafe refused the
// request in a way a retry can't fix. A newer request made meanwhile stays
// queued.
func (q *Queue) deleteCheck(ctx context.Context, ideaID int64, requestedAt time.Time) error {
	if _, err := q.db.ExecContext(ctx,
		`DELETE FROM tag_checks WHERE idea_id = ? AND requested_at = ?`, ideaID, requestedAt); err != nil {
		return fmt.Errorf("deleting tag check: %w", err)
	}
	return nil
}

// holdCheck records why a check waits, without counting it against the
// check: it stays queued until next (nil: whenever the Suggester runs
// again). For failures that are about the connection, not this check.
func (q *Queue) holdCheck(ctx context.Context, ideaID int64, message string, next *time.Time) error {
	return q.recordFailure(ctx, ideaID, message, next, 0)
}

// retryCheck records a failed attempt on a check, which stays queued until
// next, and counts it towards the check's own backoff.
func (q *Queue) retryCheck(ctx context.Context, ideaID int64, message string, next time.Time) error {
	return q.recordFailure(ctx, ideaID, message, &next, 1)
}

func (q *Queue) recordFailure(ctx context.Context, ideaID int64, message string, next *time.Time, attempt int) error {
	var due any
	if next != nil {
		due = next.UTC()
	}
	if _, err := q.db.ExecContext(ctx,
		`UPDATE tag_checks SET last_error = ?, next_attempt_at = ?, attempts = attempts + ? WHERE idea_id = ?`,
		message, due, attempt, ideaID); err != nil {
		return fmt.Errorf("recording failed tag check: %w", err)
	}
	return nil
}
