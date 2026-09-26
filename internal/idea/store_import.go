package idea

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// CreateImported inserts a nugget captured from an external source (currently
// only Telegram). Unlike Create, it never goes through the JSON Draft shape —
// source and source_ref are not settable through the public API, only by an
// importer that owns them.
//
// A conflict on the (source, source_ref) unique index means this exact
// message was already imported — that is ErrAlreadyImported, a no-op the
// caller should treat as success, not a failure (design §4.6 and §7).
func (s *Store) CreateImported(ctx context.Context, title, notes string, tags []string, source, sourceRef string) (*Idea, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, ErrEmptyTitle
	}
	normTags := normalizeTagSet(tags)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	res, err := tx.ExecContext(ctx,
		`INSERT INTO ideas (title, notes, status, source, source_ref, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(source, source_ref) WHERE source IS NOT NULL DO NOTHING`,
		title, notes, string(StatusRaw), source, sourceRef, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting imported idea: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("reading rows affected: %w", err)
	}
	if affected == 0 {
		return nil, ErrAlreadyImported
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("reading new id: %w", err)
	}

	if err := upsertTags(ctx, tx, id, normTags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	return s.Get(ctx, id)
}
