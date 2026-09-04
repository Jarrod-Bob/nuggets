package idea

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Update edits an idea. Absent means unchanged: a nil field on the draft is left
// exactly as it was, so a save carrying only status touches nothing else, and a
// save carrying only title no longer wipes the tags (spec §"The save behaviour
// has to change first"). A present field is applied — including an explicitly
// empty tag or link array, which clears the set. An update with nothing present
// is a no-op that returns the current nugget. updated_at is always set whenever
// any field is present.
func (s *Store) Update(ctx context.Context, id int64, draft Draft) (*Idea, error) {
	// Nothing to change: return the current nugget (or ErrNotFound if it is
	// gone). No write, so updated_at is not touched either.
	if draft.Title == nil && draft.Notes == nil && draft.Tags == nil &&
		draft.Status == nil && draft.Links == nil {
		return s.Get(ctx, id)
	}

	// Validate everything up front so a bad value is a clean error before any
	// write, and so an unknown status or link is a 400, not a 500.
	sets := []string{"updated_at = ?"}
	args := []any{time.Now().UTC()}

	if draft.Title != nil {
		title := strings.TrimSpace(*draft.Title)
		if title == "" {
			return nil, ErrEmptyTitle
		}
		sets = append(sets, "title = ?")
		args = append(args, title)
	}
	if draft.Notes != nil {
		sets = append(sets, "notes = ?")
		args = append(args, *draft.Notes)
	}
	if draft.Status != nil {
		status, err := ParseStatus(string(*draft.Status))
		if err != nil {
			return nil, err
		}
		sets = append(sets, "status = ?")
		args = append(args, string(status))
	}

	var links []Link
	if draft.Links != nil {
		valid, err := validateLinks(*draft.Links)
		if err != nil {
			return nil, err
		}
		links = valid
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	args = append(args, id)
	query := fmt.Sprintf("UPDATE ideas SET %s WHERE id = ?", strings.Join(sets, ", "))
	res, err := tx.ExecContext(ctx, query, args...)
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

	// Tags and links replace the whole set — clear then re-insert, the same rule
	// the request follows for tags. Only touched when the field is present.
	if draft.Tags != nil {
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM idea_tags WHERE idea_id = ?`, id); err != nil {
			return nil, fmt.Errorf("clearing tags: %w", err)
		}
		if err := upsertTags(ctx, tx, id, normalizeTagSet(*draft.Tags)); err != nil {
			return nil, err
		}
	}
	if draft.Links != nil {
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM idea_links WHERE idea_id = ?`, id); err != nil {
			return nil, fmt.Errorf("clearing links: %w", err)
		}
		if err := insertLinks(ctx, tx, id, links); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	return s.Get(ctx, id)
}
