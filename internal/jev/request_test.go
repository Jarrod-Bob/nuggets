package jev

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

// BuildCandidates is the pure half of a check's candidate list, shared with
// docs/benchmarks/tag-suggestions so the benchmark asks Jev exactly what production asks.
func TestBuildCandidatesOrdersExamplesByRecencyWhateverTheInputOrder(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 10, d, 0, 0, 0, 0, time.UTC) }
	uses := []TagUse{
		{Tag: "web", NuggetID: 1, Title: "Oldest web idea", UpdatedAt: day(1)},
		{Tag: "games", NuggetID: 9, Title: "The nugget itself", UpdatedAt: day(9)},
		{Tag: "web", NuggetID: 4, Title: "  Newest  web idea ", UpdatedAt: day(4)},
		{Tag: "web", NuggetID: 3, Title: "newest web IDEA", UpdatedAt: day(3)},
		{Tag: "web", NuggetID: 2, Title: "Middle web idea", UpdatedAt: day(2)},
		{Tag: "web", NuggetID: 5, Title: "Same day, higher id", UpdatedAt: day(2)},
		{Tag: "mine", NuggetID: 9, Title: "The nugget itself", UpdatedAt: day(9)},
		{Tag: "games", NuggetID: 6, Title: "A game", UpdatedAt: day(6)},
	}
	got := BuildCandidates(9, map[string]bool{"mine": true}, uses)
	want := []Candidate{
		{Tag: "games", Examples: []string{"A game"}},
		{Tag: "web", Examples: []string{"Newest  web idea", "Same day, higher id", "Middle web idea"}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("candidates = %#v, want %#v", got, want)
	}
}

func TestBuildRequestsSplitsAtFiftyAndMapsKeysBackToTags(t *testing.T) {
	var cands []Candidate
	for i := range 51 {
		cands = append(cands, Candidate{Tag: string(rune('a'+i%26)) + string(rune('a'+i/26)), Examples: []string{}})
	}
	reqs := BuildRequests("A title", "Some notes", []string{"x"}, cands)
	if len(reqs) != 2 || len(reqs[0].TagFor) != 50 || len(reqs[1].TagFor) != 1 {
		t.Fatalf("got %d requests, want 50 + 1 questions", len(reqs))
	}
	if reqs[1].TagFor["t0"] != cands[50].Tag {
		t.Errorf("second request t0 = %q, want %q", reqs[1].TagFor["t0"], cands[50].Tag)
	}
	raw, err := reqs[1].JSON()
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	wantState := map[string]any{"nugget": map[string]any{"title": "A title", "notes": "Some notes", "tags": []any{"x"}}}
	if !reflect.DeepEqual(body["state"], wantState) || body["model"] != Model {
		t.Errorf("body = %s", raw)
	}
}
