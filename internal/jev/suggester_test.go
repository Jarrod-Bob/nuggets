package jev

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func TestACheckAsksJevAboutEachCandidateTag(t *testing.T) {
	e := newTestEnv(t)
	e.create(t, "Recipe box", "", "cooking")
	e.create(t, "Pantry tracker", "", "cooking", "home")
	e.setKey(t, testKey)
	e.create(t, "Meal planner", "Plan a week of dinners.", "home")

	if err := e.pass(t); err != nil {
		t.Fatalf("Pass: %v", err)
	}

	sent := e.fake.sent()
	if len(sent) != 1 {
		t.Fatalf("requests = %d, want 1", len(sent))
	}
	req := sent[0]
	if req.Path != "/v1/systemone" {
		t.Errorf("path = %q", req.Path)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer "+testKey {
		t.Errorf("Authorization = %q", got)
	}
	if req.Body.Model != "jev-latest" {
		t.Errorf("model = %q, want jev-latest", req.Body.Model)
	}

	var state struct {
		Nugget struct {
			Title string   `json:"title"`
			Notes string   `json:"notes"`
			Tags  []string `json:"tags"`
		} `json:"nugget"`
	}
	var raw struct {
		State json.RawMessage `json:"state"`
	}
	json.Unmarshal(req.Raw, &raw)
	if err := json.Unmarshal(raw.State, &state); err != nil {
		t.Fatalf("state %s: %v", raw.State, err)
	}
	if state.Nugget.Title != "Meal planner" || state.Nugget.Notes != "Plan a week of dinners." || !reflect.DeepEqual(state.Nugget.Tags, []string{"home"}) {
		t.Errorf("state = %+v", state.Nugget)
	}

	// home is the nugget's own tag, so only cooking is asked about.
	if len(req.Body.Questions) != 1 {
		t.Fatalf("questions = %+v, want one", req.Body.Questions)
	}
	q, ok := req.Body.Questions["t0"]
	if !ok {
		t.Fatalf("questions keyed %v, want t0", keys(req.Body.Questions))
	}
	if q.Type != "noul" || q.Instructions.Tag != "cooking" || q.Instructions.Question == "" {
		t.Errorf("question = %+v", q)
	}
	if !reflect.DeepEqual(q.Instructions.Examples, []string{"Pantry tracker", "Recipe box"}) {
		t.Errorf("examples = %v, want the most recently updated first", q.Instructions.Examples)
	}
	if q.Criteria.True == "" || q.Criteria.False == "" {
		t.Errorf("criteria = %+v, want both described", q.Criteria)
	}

	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d after the check, want 0", got)
	}
}

func keys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func TestOnlyConfidentTagsAreSuggestedHighestFirstAtMostThree(t *testing.T) {
	e := newTestEnv(t)
	for _, tag := range []string{"a", "b", "c", "d", "e"} {
		e.create(t, "Has "+tag, "", tag)
	}
	e.fake.answer("a", 0.69)
	e.fake.answer("b", 0.7)
	e.fake.answer("c", 0.95)
	e.fake.answer("d", 0.8)
	e.fake.answer("e", 0.75)
	e.setKey(t, testKey)
	n := e.create(t, "New one", "")

	if err := e.pass(t); err != nil {
		t.Fatalf("Pass: %v", err)
	}
	got := e.suggestions(t, n.ID)
	want := []Suggestion{
		{Tag: "c", Probability: 0.95, Examples: []string{"Has c"}},
		{Tag: "d", Probability: 0.8, Examples: []string{"Has d"}},
		{Tag: "e", Probability: 0.75, Examples: []string{"Has e"}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("suggestions = %+v, want %+v", got, want)
	}
	if e.events.count("tag-suggestions-changed") != 1 {
		t.Errorf("tag-suggestions-changed published %d times, want 1", e.events.count("tag-suggestions-changed"))
	}
}

// askedTags is every tag asked about across requests, sorted.
func askedTags(reqs []sentRequest) []string {
	var tags []string
	for _, r := range reqs {
		for _, q := range r.Body.Questions {
			tags = append(tags, q.Instructions.Tag)
		}
	}
	sort.Strings(tags)
	return tags
}

func TestCandidatesLeaveOutOwnDismissedAndArchivedOnlyTags(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	e.create(t, "Active", "", "own", "dismissed", "wanted")
	binned := e.create(t, "Binned", "", "archived-only")
	if err := e.ideas.Archive(ctx, binned.ID); err != nil {
		t.Fatal(err)
	}
	e.setKey(t, testKey)
	n := e.create(t, "Checked", "", "own")
	if err := e.queue.Dismiss(ctx, n.ID, " Dismissed "); err != nil {
		t.Fatal(err)
	}

	if err := e.pass(t); err != nil {
		t.Fatalf("Pass: %v", err)
	}
	if got := askedTags(e.fake.sent()); !reflect.DeepEqual(got, []string{"wanted"}) {
		t.Errorf("asked about %v, want only [wanted]", got)
	}
}

func TestExamplesAreThreeRecentDistinctTitles(t *testing.T) {
	e := newTestEnv(t)
	for _, title := range []string{"Oldest", "Second", "Third", "Fourth"} {
		e.create(t, title, "", "x")
	}
	e.create(t, "  FOURTH  ", "", "x") // Fourth again, newest
	e.setKey(t, testKey)
	e.create(t, "Checked", "")

	if err := e.pass(t); err != nil {
		t.Fatalf("Pass: %v", err)
	}
	sent := e.fake.sent()
	if len(sent) != 1 || len(sent[0].Body.Questions) != 1 {
		t.Fatalf("requests = %+v, want one question", sent)
	}
	got := sent[0].Body.Questions["t0"].Instructions.Examples
	if want := []string{"FOURTH", "Third", "Second"}; !reflect.DeepEqual(got, want) {
		t.Errorf("examples = %q, want %q", got, want)
	}
}

func TestASuggestionKeepsTheExamplesJevWasShown(t *testing.T) {
	e := newTestEnv(t)
	for _, title := range []string{"Oldest", "Second", "Third", "Fourth"} {
		e.create(t, title, "", "x")
	}
	e.fake.answer("x", 0.9)
	e.setKey(t, testKey)
	n := e.create(t, "Checked", "")
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}

	// A nugget tagged x after the check doesn't change what was shown.
	e.create(t, "Newest", "", "x")
	got := e.suggestions(t, n.ID)
	want := []Suggestion{{Tag: "x", Probability: 0.9, Examples: []string{"Fourth", "Third", "Second"}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("suggestions = %+v, want %+v", got, want)
	}
	if sent := e.fake.sent()[0].Body.Questions["t0"].Instructions.Examples; !reflect.DeepEqual(sent, want[0].Examples) {
		t.Errorf("sent examples %q, stored %q: want the same", sent, want[0].Examples)
	}
}

func TestASuggestionStoredWithoutExamplesHasNone(t *testing.T) {
	e := newTestEnv(t)
	n := e.create(t, "Checked", "")
	// A row written before migration 00009 added the column.
	if _, err := e.db.Exec(
		`INSERT INTO tag_suggestions (idea_id, tag, state, probability, created_at, updated_at)
		 VALUES (?, 'old', 'open', 0.8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, n.ID); err != nil {
		t.Fatal(err)
	}
	got := e.suggestions(t, n.ID)
	want := []Suggestion{{Tag: "old", Probability: 0.8, Examples: []string{}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("suggestions = %+v, want %+v", got, want)
	}
}

func TestARecheckReplacesOpenSuggestionsAndKeepsDismissedOnes(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	for _, tag := range []string{"a", "b", "c"} {
		e.create(t, "Has "+tag, "", tag)
	}
	e.fake.answer("a", 0.9)
	e.fake.answer("b", 0.8)
	e.setKey(t, testKey)
	n := e.create(t, "Checked", "")
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	if got := e.suggestedTags(t, n.ID); !reflect.DeepEqual(got, []string{"a", "b"}) {
		t.Fatalf("first check suggested %v, want [a b]", got)
	}
	if err := e.queue.Dismiss(ctx, n.ID, "b"); err != nil {
		t.Fatal(err)
	}

	e.fake.answer("a", 0.1)
	e.fake.answer("b", 0.99)
	e.fake.answer("c", 0.85)
	notes := "Now about c"
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Notes: &notes}); err != nil {
		t.Fatal(err)
	}
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	if got := e.suggestedTags(t, n.ID); !reflect.DeepEqual(got, []string{"c"}) {
		t.Errorf("re-check suggested %v, want [c]: a replaced, b still dismissed", got)
	}
	if got := askedTags(e.fake.sent()[1:]); !reflect.DeepEqual(got, []string{"a", "c"}) {
		t.Errorf("re-check asked about %v, want [a c]", got)
	}
}

func TestAStaleResultIsThrownAwayAndTheCheckRunsAgain(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	e.create(t, "Has a", "", "a")
	e.fake.answer("a", 0.9)
	e.setKey(t, testKey)
	n := e.create(t, "Checked", "first")

	edited := false
	e.fake.setBefore(func() {
		if edited {
			return
		}
		edited = true
		e.fake.answer("a", 0.1) // the newer text isn't about a
		notes := "second"
		if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Notes: &notes}); err != nil {
			t.Errorf("editing mid-check: %v", err)
		}
	})
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	sent := e.fake.sent()
	if len(sent) != 2 {
		t.Fatalf("requests = %d, want the check run twice", len(sent))
	}
	var state struct {
		State struct {
			Nugget struct{ Notes string } `json:"nugget"`
		} `json:"state"`
	}
	json.Unmarshal(sent[1].Raw, &state)
	if state.State.Nugget.Notes != "second" {
		t.Errorf("second run saw notes %q, want the newer text", state.State.Nugget.Notes)
	}
	if got := e.suggestedTags(t, n.ID); len(got) != 0 {
		t.Errorf("suggestions = %v, want the stale [a] thrown away", got)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d, want 0", got)
	}
}

func TestMoreThanFiftyCandidatesAreSplitAcrossRequests(t *testing.T) {
	e := newTestEnv(t)
	var tags []string
	for i := range 120 {
		tags = append(tags, fmt.Sprintf("tag%03d", i))
	}
	e.create(t, "Carries them all", "", tags...)
	e.fake.answer("tag119", 0.9)
	e.setKey(t, testKey)
	n := e.create(t, "Checked", "")
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	sent := e.fake.sent()
	var sizes []int
	for _, r := range sent {
		sizes = append(sizes, len(r.Body.Questions))
	}
	if !reflect.DeepEqual(sizes, []int{50, 50, 20}) {
		t.Errorf("questions per request = %v, want [50 50 20]", sizes)
	}
	if got := askedTags(sent); !reflect.DeepEqual(got, tags) {
		t.Errorf("asked about %d tags, want all 120 once", len(got))
	}
	if got := e.suggestedTags(t, n.ID); !reflect.DeepEqual(got, []string{"tag119"}) {
		t.Errorf("suggestions = %v, want [tag119] mapped back from the last batch", got)
	}
}

func TestNoCandidatesMeansNoCall(t *testing.T) {
	e := newTestEnv(t)
	e.setKey(t, testKey)
	e.create(t, "The only nugget", "", "mine")
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	if n := len(e.fake.sent()); n != 0 {
		t.Errorf("requests = %d, want 0", n)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d, want the check done", got)
	}
}

func TestAnArchivedNuggetIsNeverChecked(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	e.create(t, "Has a", "", "a")
	e.setKey(t, testKey)
	n := e.create(t, "Binned", "")
	if err := e.ideas.Archive(ctx, n.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	if got := len(e.fake.sent()); got != 0 {
		t.Errorf("requests = %d, want 0", got)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d, want the check dropped", got)
	}
}

func TestAddingASuggestedTagByHandClearsTheSuggestion(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	e.create(t, "Has a", "", "a")
	e.create(t, "Has b", "", "b")
	e.fake.answer("a", 0.9)
	e.fake.answer("b", 0.8)
	e.setKey(t, testKey)
	n := e.create(t, "Checked", "")
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Tags: &[]string{"A"}}); err != nil {
		t.Fatal(err)
	}
	if got := e.suggestedTags(t, n.ID); !reflect.DeepEqual(got, []string{"b"}) {
		t.Errorf("suggestions = %v, want [b]", got)
	}
	// Removing it again dismisses it rather than bringing the suggestion back.
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Tags: &[]string{}}); err != nil {
		t.Fatal(err)
	}
	if got := e.suggestedTags(t, n.ID); !reflect.DeepEqual(got, []string{"b"}) {
		t.Errorf("suggestions after removing a = %v, want [b]", got)
	}
}

func TestARemovedTagIsNeverAskedAboutAgainEvenIfRemovedWithoutAKey(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	e.create(t, "Has a", "", "a")
	e.create(t, "Has b", "", "b")
	n := e.create(t, "Checked", "", "a")
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Tags: &[]string{}}); err != nil {
		t.Fatal(err)
	}
	e.setKey(t, testKey)
	notes := "changed"
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Notes: &notes}); err != nil {
		t.Fatal(err)
	}
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	if got := askedTags(e.fake.sent()); !reflect.DeepEqual(got, []string{"b"}) {
		t.Errorf("asked about %v, want only [b]", got)
	}
}
