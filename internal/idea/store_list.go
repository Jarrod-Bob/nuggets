package idea

import (
	"context"
	"fmt"
	"strings"
)

// ListFilter narrows the bank. Query and Tag combine with AND.
// Archived is a separate place, never merged with active ideas.
type ListFilter struct {
	Query    string
	Tag      string
	Archived bool
}

// List returns matching ideas, newest first, each with its tags loaded.
func (s *Store) List(ctx context.Context, filter ListFilter) ([]Idea, error) {
	var where []string
	var args []any

	if filter.Archived {
		where = append(where, "i.archived_at IS NOT NULL")
	} else {
		where = append(where, "i.archived_at IS NULL")
	}

	if q := strings.TrimSpace(filter.Query); q != "" {
		// LIKE is case-insensitive for ASCII in SQLite by default.
		where = append(where, "(i.title LIKE ? OR i.notes LIKE ?)")
		pattern := "%" + q + "%"
		args = append(args, pattern, pattern)
	}

	if tag := NormalizeTag(filter.Tag); tag != "" {
		where = append(where, `i.id IN (
			SELECT it.idea_id FROM idea_tags it
			JOIN tags t ON t.id = it.tag_id
			WHERE t.name = ?)`)
		args = append(args, tag)
	}

	// Archived ideas sort by when they were binned; active by when created.
	order := "i.created_at DESC, i.id DESC"
	if filter.Archived {
		order = "i.archived_at DESC, i.id DESC"
	}

	query := fmt.Sprintf(
		`SELECT i.id, i.title, i.notes, i.created_at, i.updated_at, i.archived_at
		 FROM ideas i WHERE %s ORDER BY %s`,
		strings.Join(where, " AND "), order)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing ideas: %w", err)
	}
	defer rows.Close()

	ideas := []Idea{}
	for rows.Next() {
		found, err := scanIdea(rows)
		if err != nil {
			return nil, err
		}
		ideas = append(ideas, *found)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating ideas: %w", err)
	}

	// Tags load after the rows are closed: SetMaxOpenConns(1) means a query
	// issued while rows are open would deadlock.
	for i := range ideas {
		if ideas[i].Tags, err = loadTags(ctx, s.db, ideas[i].ID); err != nil {
			return nil, err
		}
	}
	return ideas, nil
}
