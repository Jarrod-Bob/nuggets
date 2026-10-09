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
	Created   int // new nuggets
	Updated   int // unedited nuggets whose content was refreshed
	Archived  int // nuggets archived by a tombstone
	Unchanged int // already applied, or edited here so left alone
	Skipped   int // nothing to import: no title, or a tombstone for an item never imported
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
	var result SyncResult

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	for _, item := range items {
		if err := s.applySyncedItem(ctx, tx, source, item, &result); err != nil {
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

func (s *Store) applySyncedItem(ctx context.Context, tx *sql.Tx, source string, item SyncedItem, result *SyncResult) error {
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
