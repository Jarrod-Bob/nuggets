package github

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// Settings keys (design §3). The github package owns them: the settings API
// handlers, the Outbox and the Sender are the only readers and writers.
const (
	KeyToken     = "github_token" // write-only: never returned by the API or logged
	KeyMappings  = "github_mappings"
	KeyLastError = "github_last_error"
)

// DefaultBaseURL is GitHub's REST API. Only tests point the Sender elsewhere.
const DefaultBaseURL = "https://api.github.com"

// Mapping sends nuggets that gain Tag to Repo ("owner/repo") as feature
// requests.
type Mapping struct {
	Tag  string `json:"tag"`
	Repo string `json:"repo"`
}

// DefaultMappings is the mapping used until the captain saves one.
func DefaultMappings() []Mapping {
	return []Mapping{{Tag: "nuggets", Repo: "Jarrod-Bob/nuggets"}}
}

// maxTagLength bounds a mapped tag; real tags are a word or two.
const maxTagLength = 64

var (
	// GitHub user and organisation names: alphanumerics and single hyphens,
	// not at either end, at most 39 characters.
	ownerPattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9]|-[A-Za-z0-9]){0,38}$`)
	// Repository names: letters, digits, '.', '-' and '_', at most 100.
	repoPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
)

// ValidateMappings checks and normalizes a mapping list: tags are trimmed,
// lowercased (idea.NormalizeTag) and may be typed with a leading '#';
// repositories are trimmed "owner/repo". The error is a sentence for the
// settings screen.
func ValidateMappings(in []Mapping) ([]Mapping, error) {
	out := make([]Mapping, 0, len(in))
	seen := make(map[string]bool, len(in))
	for _, m := range in {
		tag := idea.NormalizeTag(strings.TrimPrefix(strings.TrimSpace(m.Tag), "#"))
		if err := validateTag(tag); err != nil {
			return nil, err
		}
		if seen[tag] {
			return nil, fmt.Errorf("The tag %q is mapped twice; give each tag one repository.", tag)
		}
		seen[tag] = true

		repo := strings.TrimSpace(m.Repo)
		if err := validateRepo(repo); err != nil {
			return nil, err
		}
		out = append(out, Mapping{Tag: tag, Repo: repo})
	}
	return out, nil
}

func validateTag(tag string) error {
	if tag == "" {
		return errors.New("Every mapping needs a tag.")
	}
	if utf8.RuneCountInString(tag) > maxTagLength {
		return fmt.Errorf("A mapped tag can be at most %d characters.", maxTagLength)
	}
	for _, r := range tag {
		if unicode.IsControl(r) || r == ',' {
			return fmt.Errorf("The tag %q can't contain commas or control characters.", tag)
		}
	}
	return nil
}

func validateRepo(repo string) error {
	owner, name, ok := strings.Cut(repo, "/")
	if !ok || !ownerPattern.MatchString(owner) || !repoPattern.MatchString(name) || name == "." || name == ".." {
		return fmt.Errorf("%q isn't a GitHub repository. Write it as owner/repo, like Jarrod-Bob/nuggets.", repo)
	}
	return nil
}

// Config is everything stored about the GitHub connection. token is only
// ever read by the Sender; handlers use Connected.
type Config struct {
	token     string
	Connected bool
	Mappings  []Mapping
	LastError string
}

type getter func(key string) (string, error)

// LoadConfig reads the stored connection, falling back to DefaultMappings
// when no mapping was ever saved (or the stored one no longer parses).
func LoadConfig(ctx context.Context, store *settings.Store) (Config, error) {
	return loadConfig(func(key string) (string, error) {
		v, _, err := store.Get(ctx, key)
		return v, err
	})
}

func loadConfig(get getter) (Config, error) {
	var cfg Config
	var err error
	if cfg.token, err = get(KeyToken); err != nil {
		return Config{}, err
	}
	cfg.Connected = cfg.token != ""
	if cfg.Mappings, err = loadMappings(get); err != nil {
		return Config{}, err
	}
	if cfg.LastError, err = get(KeyLastError); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func loadMappings(get getter) ([]Mapping, error) {
	raw, err := get(KeyMappings)
	if err != nil {
		return nil, err
	}
	if raw == "" {
		return DefaultMappings(), nil
	}
	var stored []Mapping
	if json.Unmarshal([]byte(raw), &stored) != nil {
		return DefaultMappings(), nil
	}
	valid, err := ValidateMappings(stored)
	if err != nil {
		return DefaultMappings(), nil
	}
	return valid, nil
}

// loadMappingsTx reads the mapping through a caller's transaction.
func loadMappingsTx(ctx context.Context, store *settings.Store, tx *sql.Tx) ([]Mapping, error) {
	return loadMappings(func(key string) (string, error) {
		v, _, err := store.GetTx(ctx, tx, key)
		return v, err
	})
}

// EncodeMappings is the stored form of an already-validated mapping list.
func EncodeMappings(mappings []Mapping) (string, error) {
	if mappings == nil {
		mappings = []Mapping{}
	}
	b, err := json.Marshal(mappings)
	return string(b), err
}
