// Package idea holds the nuggets domain types and all SQL.
package idea

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrNotFound   = errors.New("nugget not found")
	ErrEmptyTitle = errors.New("A nugget needs a title.")
)

// Idea is one row of the ideas table plus its tags.
type Idea struct {
	ID         int64      `json:"id"`
	Title      string     `json:"title"`
	Notes      string     `json:"notes"`
	Tags       []string   `json:"tags"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	ArchivedAt *time.Time `json:"archived_at"`
}

// Tag is a tag name with how many active ideas carry it.
type Tag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// Draft is the writable shape of an idea. Tags is always the complete set:
// PATCH replaces rather than merges.
type Draft struct {
	Title string   `json:"title"`
	Notes string   `json:"notes"`
	Tags  []string `json:"tags"`
}

// NormalizeTag is the single definition of tag identity. The server owns this
// rule; the frontend only previews it.
func NormalizeTag(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// normalizeTagSet normalizes, drops blanks, and de-duplicates while preserving
// first-seen order.
func normalizeTagSet(names []string) []string {
	seen := make(map[string]bool, len(names))
	out := make([]string, 0, len(names))
	for _, raw := range names {
		n := NormalizeTag(raw)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
	}
	return out
}
