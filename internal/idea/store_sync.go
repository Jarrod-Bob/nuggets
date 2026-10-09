package idea

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// SyncedItem is one item from a feed that keeps its own ids and change
// sequence (spices), already mapped onto a nugget's shape by the importer.
type SyncedItem struct {
	Ref   string // the feed's id for the item; stored as source_ref
	Rev   int64  // the feed's change sequence for this version of the item
	Title string
	Notes string
	Tags  []string
	// DeletedAt is set when the feed tombstoned the item.
	DeletedAt *time.Time
}

// SyncResult counts what ApplySynced did with a page, for logging and tests.
type SyncResult struct {
	Created    int // new nuggets
	Reattached int // detached nuggets that took an item back instead of a copy (ReattachSynced)
	Updated    int // unedited nuggets whose content was refreshed
	Archived   int // nuggets archived by a tombstone
	Unchanged  int // already applied, or edited here so left alone
	Skipped    int // nothing to import: no title, or a tombstone for an item never imported
}

// ApplySynced upserts a page of items from source by (source, source_ref) and
// then runs inTx, all in one transaction: the importer passes the write of its
// cursor, so the cursor can never commit without the page it covers, or the
// page without its cursor (spices pull design §4).
//
// The rules, per item (design §4, §6):
//   - New and live: inserted, with status raw.
//   - Already applied at this rev or later: nothing changes, which makes
//     replaying the feed a no-op.
//   - Live and newer, nugget unedited here since the last sync: its title,
//     notes and tags are refreshed.
//   - Live and newer, nugget edited here: the captain's edits win; only the
//     recorded rev moves.
//   - A tombstone: the nugget is archived (moved to the trash, restorable) and
//     the tombstone recorded in source_deleted_at. Never deleted.
func (s *Store) ApplySynced(ctx context.Context, source string, items []SyncedItem, inTx func(ctx context.Context, tx *sql.Tx) error) (SyncResult, error) {
	return s.applySynced(ctx, source, "", items, inTx)
}

// ReattachSynced is ApplySynced for the import that follows a Re-sync
// (spices pull design §5), given every item the feed holds at once. A live
// item that would be created instead reattaches to the nugget of source
// detached with the same title and notes (SameText), when exactly one
// detached nugget matches it and no other item matches that nugget. The
// nugget takes the item's ref and rev and goes back to source; everything
// else about it — content, tags, status, links, archive state, updated_at,
// tag suggestions — stays as the captain left it. Any ambiguity, either way
// round, creates a copy as ApplySynced would.
func (s *Store) ReattachSynced(ctx context.Context, source, detached string, items []SyncedItem, inTx func(ctx context.Context, tx *sql.Tx) error) (SyncResult, error) {
	return s.applySynced(ctx, source, detached, items, inTx)
}

// applySynced is ApplySynced, reattaching to nuggets of source detached when
// that is set.
func (s *Store) applySynced(ctx context.Context, source, detached string, items []SyncedItem, inTx func(ctx context.Context, tx *sql.Tx) error) (SyncResult, error) {
	var result SyncResult

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var reattach map[string]int64
	if detached != "" {
		if reattach, err = planReattach(ctx, tx, detached, items); err != nil {
			return SyncResult{}, err
		}
	}
	for _, item := range items {
		if err := s.applySyncedItem(ctx, tx, source, item, reattach, &result); err != nil {
			return SyncResult{}, fmt.Errorf("applying %s item %s: %w", source, item.Ref, err)
		}
	}
	if inTx != nil {
		if err := inTx(ctx, tx); err != nil {
			return SyncResult{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return SyncResult{}, fmt.Errorf("committing: %w", err)
	}
	return result, nil
}

// planReattach pairs items with the nuggets of source detached they should
// reattach to, by ref: only one-to-one matches on title and notes, and only
// for live items with a title, since nothing else would be created.
func planReattach(ctx context.Context, tx *sql.Tx, detached string, items []SyncedItem) (map[string]int64, error) {
	type candidate struct {
		id           int64
		title, notes string
	}
	rows, err := tx.QueryContext(ctx, `SELECT id, title, notes FROM ideas WHERE source = ? ORDER BY id`, detached)
	if err != nil {
		return nil, fmt.Errorf("loading %s nuggets: %w", detached, err)
	}
	var candidates []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.title, &c.notes); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scanning %s nugget: %w", detached, err)
		}
		candidates = append(candidates, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("loading %s nuggets: %w", detached, err)
	}

	matches := make(map[string][]int64) // item ref -> matching nuggets
	claims := make(map[int64]int)       // nugget -> how many items match it
	for _, item := range items {
		if item.DeletedAt != nil || strings.TrimSpace(item.Title) == "" {
			continue
		}
		for _, c := range candidates {
			if SameText(item.Title, c.title) && SameText(item.Notes, c.notes) {
				matches[item.Ref] = append(matches[item.Ref], c.id)
				claims[c.id]++
			}
		}
	}
	plan := make(map[string]int64)
	for ref, ids := range matches {
		if len(ids) == 1 && claims[ids[0]] == 1 {
			plan[ref] = ids[0]
		}
	}
	return plan, nil
}

func (s *Store) applySyncedItem(ctx context.Context, tx *sql.Tx, source string, item SyncedItem, reattach map[string]int64, result *SyncResult) error {
	title := strings.TrimSpace(item.Title)

	var (
		id        int64
		rev       sql.NullInt64
		curTitle  string
		curNotes  string
		updatedAt time.Time
		syncedAt  sql.NullTime
	)
	err := tx.QueryRowContext(ctx,
		`SELECT id, source_rev, title, notes, updated_at, source_synced_at FROM ideas
		 WHERE source = ? AND source_ref = ?`, source, item.Ref,
	).Scan(&id, &rev, &curTitle, &curNotes, &updatedAt, &syncedAt)

	if errors.Is(err, sql.ErrNoRows) {
		if item.DeletedAt != nil || title == "" {
			result.Skipped++
			return nil
		}
		if nuggetID, ok := reattach[item.Ref]; ok {
			// source_synced_at and updated_at are left alone, so a nugget
			// edited here stays edited and an unedited one still refreshes.
			if _, err := tx.ExecContext(ctx,
				`UPDATE ideas SET source = ?, source_ref = ?, source_detached_ref = NULL, source_rev = ?, source_deleted_at = NULL
				 WHERE id = ?`,
				source, item.Ref, item.Rev, nuggetID,
			); err != nil {
				return fmt.Errorf("reattaching nugget %d: %w", nuggetID, err)
			}
			result.Reattached++
			return nil
		}
		now := time.Now().UTC()
		res, err := tx.ExecContext(ctx,
			`INSERT INTO ideas (title, notes, status, source, source_ref, source_rev, source_synced_at, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			title, item.Notes, string(StatusRaw), source, item.Ref, item.Rev, now, now, now,
		)
		if err != nil {
			return fmt.Errorf("inserting: %w", err)
		}
		newID, err := res.LastInsertId()
		if err != nil {
			return fmt.Errorf("reading new id: %w", err)
		}
		tags := normalizeTagSet(item.Tags)
		if err := upsertTags(ctx, tx, newID, tags); err != nil {
			return err
		}
		if err := s.notifyTagsChanged(ctx, tx, newID, nil, tags); err != nil {
			return err
		}
		if err := s.notifyContentChanged(ctx, tx, newID); err != nil {
			return err
		}
		result.Created++
		return nil
	}
	if err != nil {
		return fmt.Errorf("looking up: %w", err)
	}

	if rev.Valid && item.Rev <= rev.Int64 {
		result.Unchanged++
		return nil
	}

	if item.DeletedAt != nil {
		// archived_at is kept if the captain had already binned it, so the
		// trash still shows when they did. updated_at is left alone: archiving
		// isn't an edit, and a later revival of the item can still refresh it.
		if _, err := tx.ExecContext(ctx,
			`UPDATE ideas SET archived_at = COALESCE(archived_at, ?), source_deleted_at = ?, source_rev = ?
			 WHERE id = ?`,
			time.Now().UTC(), item.DeletedAt.UTC(), item.Rev, id,
		); err != nil {
			return fmt.Errorf("archiving tombstoned: %w", err)
		}
		result.Archived++
		return nil
	}

	unedited := syncedAt.Valid && syncedAt.Time.Equal(updatedAt)
	if !unedited || title == "" {
		if _, err := tx.ExecContext(ctx,
			`UPDATE ideas SET source_rev = ?, source_deleted_at = NULL WHERE id = ?`, item.Rev, id,
		); err != nil {
			return fmt.Errorf("recording rev: %w", err)
		}
		result.Unchanged++
		return nil
	}

	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx,
		`UPDATE ideas SET title = ?, notes = ?, updated_at = ?, source_synced_at = ?, source_rev = ?, source_deleted_at = NULL
		 WHERE id = ?`,
		title, item.Notes, now, now, item.Rev, id,
	); err != nil {
		return fmt.Errorf("refreshing: %w", err)
	}
	before, err := loadTags(ctx, tx, id)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM idea_tags WHERE idea_id = ?`, id); err != nil {
		return fmt.Errorf("clearing tags: %w", err)
	}
	after := normalizeTagSet(item.Tags)
	if err := upsertTags(ctx, tx, id, after); err != nil {
		return err
	}
	if err := s.notifyTagsChanged(ctx, tx, id, before, after); err != nil {
		return err
	}
	if title != curTitle || item.Notes != curNotes {
		if err := s.notifyContentChanged(ctx, tx, id); err != nil {
			return err
		}
	}
	result.Updated++
	return nil
}

// DetachSource moves every nugget whose source is from to source to, keeping
// the old source_ref in source_detached_ref and clearing source_ref, then runs
// inTx in the same transaction. Nothing else about the nuggets changes — not
// their content, status, tags or updated_at — so the captain's edits survive.
// It returns how many nuggets moved.
//
// This is spices' Re-sync (design §5): after spices was reset or restored its
// ids get reused, so the old rows must stop answering to them before the
// cursor goes back to 0. Clearing source_ref (rather than keeping it under the
// new source) is what lets a second reset detach again without colliding on
// the (source, source_ref) unique index.
func (s *Store) DetachSource(ctx context.Context, from, to string, inTx func(ctx context.Context, tx *sql.Tx) error) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx,
		`UPDATE ideas SET source = ?, source_detached_ref = source_ref, source_ref = NULL
		 WHERE source = ?`, to, from)
	if err != nil {
		return 0, fmt.Errorf("detaching %s nuggets: %w", from, err)
	}
	moved, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("reading rows affected: %w", err)
	}
	if inTx != nil {
		if err := inTx(ctx, tx); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("committing: %w", err)
	}
	return moved, nil
}

// CountBySource returns how many nuggets, archived or not, came from source.
func (s *Store) CountBySource(ctx context.Context, source string) (int64, error) {
	var n int64
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM ideas WHERE source = ?`, source).Scan(&n); err != nil {
		return 0, fmt.Errorf("counting %s nuggets: %w", source, err)
	}
	return n, nil
}
