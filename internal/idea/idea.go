// Package idea holds the nuggets domain types and all SQL.
package idea

import (
	"errors"
	"net/url"
	"strings"
	"time"
)

var (
	ErrNotFound      = errors.New("nugget not found")
	ErrEmptyTitle    = errors.New("A nugget needs a title.")
	ErrInvalidStatus = errors.New("That isn't a status a nugget can have.")
	ErrInvalidLink   = errors.New("A link needs to be a http or https web address.")
)

// Status is a nugget's place in its lifecycle. It is a real type with a parser
// rather than a bare string so an unknown value is a readable 400, not a 500 or
// a silent bad row. The list here is the single source of truth; the TypeScript
// union in web/src/api.ts mirrors it.
type Status string

const (
	StatusRaw       Status = "raw"       // Written down, nothing done with it.
	StatusExploring Status = "exploring" // Being thought about.
	StatusBuilding  Status = "building"  // Actually under construction.
	StatusParked    Status = "parked"    // Stopped, but not rejected.
	StatusKilled    Status = "killed"    // Decided against.
)

// ParseStatus validates a status value, returning ErrInvalidStatus for anything
// outside the five known states.
func ParseStatus(s string) (Status, error) {
	switch Status(s) {
	case StatusRaw, StatusExploring, StatusBuilding, StatusParked, StatusKilled:
		return Status(s), nil
	default:
		return "", ErrInvalidStatus
	}
}

// Link is one outward link on a nugget — the repo, the doc, the page where the
// work lives. Links travel inside the idea's JSON; a save replaces the whole
// set, exactly as tags do.
type Link struct {
	URL   string `json:"url"`
	Label string `json:"label"`
}

// validateLink parses the URL and accepts only http/https with a non-empty
// host, returning ErrInvalidLink otherwise. This rejects javascript:, data:,
// vbscript:, scheme-less strings and empty hosts — a link saved into a nugget
// and later clicked runs with everything the app can reach, so the rule lives
// in the store, never only in the component.
func validateLink(l Link) (Link, error) {
	raw := strings.TrimSpace(l.URL)
	parsed, err := url.Parse(raw)
	if err != nil {
		return Link{}, ErrInvalidLink
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return Link{}, ErrInvalidLink
	}
	if parsed.Host == "" {
		return Link{}, ErrInvalidLink
	}
	return Link{URL: raw, Label: strings.TrimSpace(l.Label)}, nil
}

// validateLinks validates a whole set, preserving order.
func validateLinks(links []Link) ([]Link, error) {
	out := make([]Link, 0, len(links))
	for _, l := range links {
		valid, err := validateLink(l)
		if err != nil {
			return nil, err
		}
		out = append(out, valid)
	}
	return out, nil
}

// Idea is one row of the ideas table plus its tags and links.
type Idea struct {
	ID         int64      `json:"id"`
	Title      string     `json:"title"`
	Notes      string     `json:"notes"`
	Tags       []string   `json:"tags"`
	Status     Status     `json:"status"`
	Links      []Link     `json:"links"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	ArchivedAt *time.Time `json:"archived_at"`
}

// Tag is a tag name with how many active ideas carry it.
type Tag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// Draft is the writable shape of an idea. Every field is a pointer so that
// absent means "leave it exactly as it was": encoding/json leaves a pointer nil
// when the key is absent and sets it when the key is present. This closes the
// trap where a save omitting tags used to wipe every tag. Create still requires
// a title; only edit semantics rely on the absent/present distinction.
type Draft struct {
	Title  *string   `json:"title"`
	Notes  *string   `json:"notes"`
	Tags   *[]string `json:"tags"`
	Status *Status   `json:"status"`
	Links  *[]Link   `json:"links"`
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
