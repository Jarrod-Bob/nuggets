package idea

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
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
//
// A save that changes nothing but the project name keeps an imported nugget
// unedited in the spices sense (kimi project-name design §6): if
// source_synced_at equalled updated_at before, both advance together, so
// spices keeps refreshing the title and notes. The edit form sends every field
// on save, so "changes nothing" compares values, not which keys are present.
func (s *Store) Update(ctx context.Context, id int64, draft Draft) (*Idea, error) {
	// Nothing to change: return the current nugget (or ErrNotFound if it is
	// gone). No write, so updated_at is not touched either.
	if draft.Title == nil && draft.Notes == nil && draft.Tags == nil &&
		draft.Status == nil && draft.Links == nil && draft.ProjectName == nil {
		return s.Get(ctx, id)
	}

	// Validate everything up front so a bad value is a clean error before any
	// write, and so an unknown status or link is a 400, not a 500.
	now := time.Now().UTC()
	sets := []string{"updated_at = ?"}
	args := []any{now}

	var title string
	if draft.Title != nil {
		title = strings.TrimSpace(*draft.Title)
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
	if draft.ProjectName != nil {
		sets = append(sets, "project_name = ?")
		args = append(args, strings.TrimSpace(*draft.ProjectName))
	}
	var status Status
	if draft.Status != nil {
		parsed, err := ParseStatus(string(*draft.Status))
		if err != nil {
			return nil, err
		}
		status = parsed
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
	var tags []string
	if draft.Tags != nil {
		tags = normalizeTagSet(*draft.Tags)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var (
		curTitle, curNotes, curStatus string
		updatedAt                     time.Time
		syncedAt                      sql.NullTime
	)
	err = tx.QueryRowContext(ctx,
		`SELECT title, notes, status, updated_at, source_synced_at FROM ideas WHERE id = ?`, id,
	).Scan(&curTitle, &curNotes, &curStatus, &updatedAt, &syncedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("loading idea: %w", err)
	}
	var beforeTags []string
	if draft.Tags != nil {
		if beforeTags, err = loadTags(ctx, tx, id); err != nil {
			return nil, err
		}
	}

	// changesNothingElse: every other field present in the draft already holds
	// the value it carries, so at most the project name changes.
	if syncedAt.Valid && syncedAt.Time.Equal(updatedAt) && draft.ProjectName != nil {
		changesNothingElse := (draft.Title == nil || title == curTitle) &&
			(draft.Notes == nil || *draft.Notes == curNotes) &&
			(draft.Status == nil || string(status) == curStatus) &&
			(draft.Tags == nil || sameTagSet(tags, beforeTags))
		if changesNothingElse && draft.Links != nil {
			beforeLinks, err := loadLinks(ctx, tx, id)
			if err != nil {
				return nil, err
			}
			changesNothingElse = slices.Equal(links, beforeLinks)
		}
		if changesNothingElse {
			sets = append(sets, "source_synced_at = ?")
			args = append(args, now)
		}
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE ideas SET %s WHERE id = ?", strings.Join(sets, ", "))
	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return nil, fmt.Errorf("updating idea: %w", err)
	}

	// Tags and links replace the whole set — clear then re-insert, the same rule
	// the request follows for tags. Only touched when the field is present.
	if draft.Tags != nil {
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM idea_tags WHERE idea_id = ?`, id); err != nil {
			return nil, fmt.Errorf("clearing tags: %w", err)
		}
		if err := upsertTags(ctx, tx, id, tags); err != nil {
			return nil, err
		}
		if err := s.notifyTagsChanged(ctx, tx, id, beforeTags, tags); err != nil {
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
	if (draft.Title != nil && title != curTitle) || (draft.Notes != nil && *draft.Notes != curNotes) {
		if err := s.notifyContentChanged(ctx, tx, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	return s.Get(ctx, id)
}

// sameTagSet reports whether two normalized tag sets hold the same tags,
// ignoring order.
func sameTagSet(a, b []string) bool {
	return len(a) == len(b) && !slices.ContainsFunc(a, func(t string) bool { return !slices.Contains(b, t) })
}
