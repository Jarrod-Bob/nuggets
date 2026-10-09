package jev

import (
	"cmp"
	"encoding/json"
	"slices"
	"strconv"
	"strings"
	"time"
)

// The question every candidate tag is asked, and what yes and no mean
// (design §6). Question keys aren't sent to the model, so these carry the
// whole meaning. Exported so cmd/tagbench can give Claude the same wording.
const (
	QuestionText  = "Does this tag belong on the nugget in `nugget`? Tags group a person's project ideas."
	CriteriaTrue  = "The idea is about what the tag covers, judged by the tag's name and the example titles of other ideas carrying it."
	CriteriaFalse = "The idea is unrelated to what the tag covers, or only shares a word with the tag."
)

// TagUse is one active nugget carrying one tag: the raw material of a
// check's candidates.
type TagUse struct {
	Tag       string
	NuggetID  int64
	Title     string
	UpdatedAt time.Time
}

// Candidate is a tag a check asks Jev about, with the titles that explain it.
type Candidate struct {
	Tag      string
	Examples []string
}

// BuildCandidates builds a check's questions (design §2) from every use of a
// tag on an active nugget: one candidate per tag not in skip (the nugget's own
// tags and its dismissed suggestions), each with the titles of up to
// maxExamples other nuggets carrying it — most recently updated first, no
// title repeated after trimming, case-folding and collapsing whitespace.
// Sorted by tag. uses may come in any order.
func BuildCandidates(nuggetID int64, skip map[string]bool, uses []TagUse) []Candidate {
	sorted := slices.Clone(uses)
	slices.SortStableFunc(sorted, func(a, b TagUse) int {
		if c := cmp.Compare(a.Tag, b.Tag); c != 0 {
			return c
		}
		if c := b.UpdatedAt.Compare(a.UpdatedAt); c != 0 {
			return c
		}
		return cmp.Compare(b.NuggetID, a.NuggetID)
	})
	var out []Candidate
	seen := map[string]bool{}
	for _, u := range sorted {
		if skip[u.Tag] {
			continue
		}
		if len(out) == 0 || out[len(out)-1].Tag != u.Tag {
			out = append(out, Candidate{Tag: u.Tag, Examples: []string{}})
			seen = map[string]bool{}
		}
		c := &out[len(out)-1]
		folded := strings.ToLower(strings.Join(strings.Fields(u.Title), " "))
		if u.NuggetID == nuggetID || len(c.Examples) >= maxExamples || seen[folded] {
			continue
		}
		seen[folded] = true
		c.Examples = append(c.Examples, strings.TrimSpace(u.Title))
	}
	return out
}

// Request is one POST /v1/systemone body of a check, with the tag each
// question key stands for.
type Request struct {
	body   systemOneRequest
	TagFor map[string]string
}

// JSON is the request body exactly as it is sent.
func (r Request) JSON() ([]byte, error) { return json.Marshal(r.body) }

// BuildRequests turns a nugget and its candidates into the check's requests:
// at most maxQuestionsPerRequest questions each, sent one after another.
func BuildRequests(title, notes string, tags []string, candidates []Candidate) []Request {
	state := map[string]any{"nugget": map[string]any{"title": title, "notes": notes, "tags": tags}}
	var out []Request
	for start := 0; start < len(candidates); start += maxQuestionsPerRequest {
		batch := candidates[start:min(start+maxQuestionsPerRequest, len(candidates))]
		req := Request{
			body:   systemOneRequest{State: state, Model: Model, Questions: make(map[string]question, len(batch))},
			TagFor: make(map[string]string, len(batch)),
		}
		for i, cand := range batch {
			id := "t" + strconv.Itoa(i)
			req.TagFor[id] = cand.Tag
			req.body.Questions[id] = question{
				Type:         "noul",
				Instructions: instructions{Question: QuestionText, Tag: cand.Tag, Examples: cand.Examples},
				Criteria:     criteria{True: CriteriaTrue, False: CriteriaFalse},
			}
		}
		out = append(out, req)
	}
	return out
}
