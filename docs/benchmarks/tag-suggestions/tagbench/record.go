// Package tagbench benchmarks TypeSafe's Jev against Claude on the tag
// suggestion task (issue #40). It is a developer tool behind docs/benchmarks/tag-suggestions,
// never part of the app. Design:
// docs/superpowers/specs/2026-10-09-tagbench-design.md.
package tagbench

import (
	"cmp"
	"slices"
)

// Datasets are reported separately.
const (
	DatasetBank   = "bank"   // the captain's nuggets, read from the app's DB
	DatasetGitHub = "github" // labelled issues from public repos, labels as truth
)

// Tasks.
const (
	TaskHidden = "hidden" // one tag removed; does it come back?
	TaskOpen   = "open"   // the item as it is; what else is suggested?
	TaskScale  = "scale"  // a hidden-tag check with a padded vocabulary
)

// Outcomes of one check.
const (
	OutcomeOK        = "ok"
	OutcomeMalformed = "malformed" // an answer that doesn't fit the schema
	OutcomeRefused   = "refused"   // Claude's stop_reason "refusal"
	OutcomeError     = "error"     // no answer: an API or network failure
)

// Threshold and TopK match production (jev.Threshold, jev.MaxSuggestions).
const (
	Threshold = 0.7
	TopK      = 3
)

// Record is one contender's answer to one case: the raw material of every
// metric, written to the results file.
type Record struct {
	Contender string `json:"contender"`
	CaseID    string `json:"case_id"`
	// CaseKey identifies the case across repeats.
	CaseKey   string   `json:"case_key"`
	Dataset   string   `json:"dataset"`
	Task      string   `json:"task"`
	ItemID    string   `json:"item_id"`
	ItemTags  []string `json:"item_tags"` // the item's real tags, before any was hidden
	Hidden    string   `json:"hidden,omitempty"`
	VocabSize int      `json:"vocab_size"`
	Repeat    int      `json:"repeat"`

	Candidates   []string           `json:"candidates"`
	Scores       map[string]float64 `json:"scores,omitempty"`
	Outcome      string             `json:"outcome"`
	Error        string             `json:"error,omitempty"`
	Attempts     int                `json:"attempts"`
	LatencyMS    float64            `json:"latency_ms"`
	InputTokens  int64              `json:"input_tokens"`
	OutputTokens int64              `json:"output_tokens"`
	CostUSD      float64            `json:"cost_usd"`
}

// Top returns the tags scoring at least threshold, highest first (ties by
// name), at most TopK: what production would suggest.
func Top(scores map[string]float64, threshold float64) []string {
	var tags []string
	for tag, p := range scores {
		if p >= threshold {
			tags = append(tags, tag)
		}
	}
	sortByScore(tags, scores)
	if len(tags) > TopK {
		tags = tags[:TopK]
	}
	return tags
}

// rank is the 1-based position of tag among all scored tags, or 0.
func rank(scores map[string]float64, tag string) int {
	if _, ok := scores[tag]; !ok {
		return 0
	}
	tags := make([]string, 0, len(scores))
	for t := range scores {
		tags = append(tags, t)
	}
	sortByScore(tags, scores)
	return slices.Index(tags, tag) + 1
}

func sortByScore(tags []string, scores map[string]float64) {
	slices.SortFunc(tags, func(a, b string) int {
		if c := cmp.Compare(scores[b], scores[a]); c != 0 {
			return c
		}
		return cmp.Compare(a, b)
	})
}
