package idea

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Update rewrites an idea. The tag set is replaced wholesale: the request
// carries the complete array, so anything absent is removed (spec §6.1).
func (s *Store) Update(ctx context.Context, id int64, draft Draft) (*Idea, error) {
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
		`UPDATE ideas SET title = ?, notes = ?, updated_at = ? WHERE id = ?`,
		title, draft.Notes, now, id)
	if err != nil {
		return nil, fmt.Errorf("updating idea: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("reading rows affected: %w", err)
	}
	if affected == 0 {
		return nil, ErrNotFound
	}

	// Clear then re-link: simplest correct implementation of set replacement.
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM idea_tags WHERE idea_id = ?`, id); err != nil {
		return nil, fmt.Errorf("clearing tags: %w", err)
	}
	tags := normalizeTagSet(draft.Tags)
	if err := upsertTags(ctx, tx, id, tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	return s.Get(ctx, id)
}
