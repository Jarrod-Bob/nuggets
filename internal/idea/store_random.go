package idea

import (
	"context"
	"fmt"
)

// Random draws one active idea, optionally from a single tag. Stateless:
// nothing is recorded, so rerolling is free. ORDER BY RANDOM() is O(n), which
// is instant at this scale — do not optimise it.
func (s *Store) Random(ctx context.Context, tag string) (*Idea, error) {
	query := `SELECT i.id, i.title, i.notes, i.created_at, i.updated_at, i.archived_at
	          FROM ideas i WHERE i.archived_at IS NULL`
	var args []any

	if name := NormalizeTag(tag); name != "" {
		query += ` AND i.id IN (
			SELECT it.idea_id FROM idea_tags it
			JOIN tags t ON t.id = it.tag_id
			WHERE t.name = ?)`
		args = append(args, name)
	}
	query += ` ORDER BY RANDOM() LIMIT 1`

	found, err := scanIdea(s.db.QueryRowContext(ctx, query, args...))
	if err != nil {
		return nil, err // ErrNotFound when the bank (or the tag) is empty
	}
	if found.Tags, err = loadTags(ctx, s.db, found.ID); err != nil {
		return nil, err
	}
	return found, nil
}

// Tags lists tags carrying at least one active idea, with counts. Tags whose
// only ideas are archived are omitted: with no tag management screen they
// would otherwise haunt the autocomplete forever.
func (s *Store) Tags(ctx context.Context) ([]Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.name, COUNT(i.id) AS n
		 FROM tags t
		 JOIN idea_tags it ON it.tag_id = t.id
		 JOIN ideas i ON i.id = it.idea_id AND i.archived_at IS NULL
		 GROUP BY t.id, t.name
		 HAVING n > 0
		 ORDER BY t.name`)
	if err != nil {
		return nil, fmt.Errorf("listing tags: %w", err)
	}
	defer rows.Close()

	tags := []Tag{}
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.Name, &tag.Count); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}
