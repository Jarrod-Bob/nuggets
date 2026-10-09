package jev

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// Suggestion states (the tag_suggestions table, migration 00008).
const (
	stateOpen      = "open"
	stateDismissed = "dismissed"
)

// Suggestion is one open tag suggestion: a tag in use that Jev thinks the
// nugget is missing, with its yes-probability.
type Suggestion struct {
	Tag         string  `json:"tag"`
	Probability float64 `json:"probability"`
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
		`SELECT s.tag, COALESCE(s.probability, 0) FROM tag_suggestions s
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
		var s Suggestion
		if err := rows.Scan(&s.Tag, &s.Probability); err != nil {
			return nil, fmt.Errorf("scanning tag suggestion: %w", err)
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
