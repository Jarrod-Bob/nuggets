package idea

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Store is the only place SQL is written. Keeping every query here means
// adding user accounts later is a WHERE clause in one file (spec §9.2).
type Store struct {
	db *sql.DB
}

func NewStore(database *sql.DB) *Store {
	return &Store{db: database}
}

// Create inserts an idea and its tags in one transaction.
func (s *Store) Create(ctx context.Context, draft Draft) (*Idea, error) {
	title := strings.TrimSpace(draft.Title)
	if title == "" {
		return nil, ErrEmptyTitle
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	res, err := tx.ExecContext(ctx,
		`INSERT INTO ideas (title, notes, created_at, updated_at) VALUES (?, ?, ?, ?)`,
		title, draft.Notes, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting idea: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("reading new id: %w", err)
	}

	tags := normalizeTagSet(draft.Tags)
	if err := upsertTags(ctx, tx, id, tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	// Re-load rather than hand-assembling the result, so the returned tag
	// order matches List/Get's alphabetical order instead of the draft's
	// first-seen order (see store_update.go's Update, which does the same).
	return s.Get(ctx, id)
}

// Get loads one idea, archived or not, with its tags.
func (s *Store) Get(ctx context.Context, id int64) (*Idea, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, title, notes, created_at, updated_at, archived_at
		 FROM ideas WHERE id = ?`, id)

	found, err := scanIdea(row)
	if err != nil {
		return nil, err
	}
	if found.Tags, err = loadTags(ctx, s.db, found.ID); err != nil {
		return nil, err
	}
	return found, nil
}

// rowScanner is satisfied by both *sql.Row and *sql.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanIdea(row rowScanner) (*Idea, error) {
	var found Idea
	var archivedAt sql.NullTime
	err := row.Scan(&found.ID, &found.Title, &found.Notes,
		&found.CreatedAt, &found.UpdatedAt, &archivedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scanning idea: %w", err)
	}
	if archivedAt.Valid {
		found.ArchivedAt = &archivedAt.Time
	}
	found.Tags = []string{} // never nil: JSON must be [] not null
	return &found, nil
}

// querier covers *sql.DB and *sql.Tx.
type querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func loadTags(ctx context.Context, q querier, ideaID int64) ([]string, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT t.name FROM tags t
		 JOIN idea_tags it ON it.tag_id = t.id
		 WHERE it.idea_id = ?
		 ORDER BY t.name`, ideaID)
	if err != nil {
		return nil, fmt.Errorf("loading tags: %w", err)
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, name)
	}
	return tags, rows.Err()
}

// upsertTags creates any missing tags and links them all to the idea.
// Callers pass an already-normalized set.
func upsertTags(ctx context.Context, q querier, ideaID int64, tags []string) error {
	for _, name := range tags {
		if _, err := q.ExecContext(ctx,
			`INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING`,
			name,
		); err != nil {
			return fmt.Errorf("inserting tag %q: %w", name, err)
		}
		var tagID int64
		if err := q.QueryRowContext(ctx,
			`SELECT id FROM tags WHERE name = ?`, name,
		).Scan(&tagID); err != nil {
			return fmt.Errorf("reading tag %q: %w", name, err)
		}
		if _, err := q.ExecContext(ctx,
			`INSERT INTO idea_tags (idea_id, tag_id) VALUES (?, ?)
			 ON CONFLICT DO NOTHING`, ideaID, tagID,
		); err != nil {
			return fmt.Errorf("linking tag %q: %w", name, err)
		}
	}
	return nil
}
