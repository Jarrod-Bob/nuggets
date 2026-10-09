package tagbench

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestCleanLabelsDropsHousekeepingAndNormalizes(t *testing.T) {
	raw := []string{
		"enhancement", "bug", "Type: Feature request", "Needs: Triage", "Status: Confirmed", "Priority: High",
		"duplicate", "good first issue", "stale", "Stale", "wontfix", "question", "help wanted", "proposal-rejected",
		"backlog", "cannot reproduce", "v3.7", "high", "dependencies", "Close reason: No reply", "upstream",
		"severity:s3", "reach:some users", "meta:regression", ".contrib/good non-first issue", "good first issue for devs",
		"2026", "Q3 26", "confirmed", "archived", "insiders-released", "verified", "feature-request", "new feature",
		"improvements", "important", "error-telemetry", "recent-regression", "testplan-item", "unit-test-failure", "*as-designed",
		"info-needed", "papercut :drop_of_blood:", "design papercut", "debt", "candidate", "under-discussion",
		"Functionality: Automatic downloads", "area: kbd-layout", "Area: Accessibility", "Desktop", " sync ", "desktop",
	}
	got := CleanLabels(raw)
	want := []string{"automatic downloads", "kbd-layout", "accessibility", "desktop", "sync"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("CleanLabels = %q, want %q", got, want)
	}
}

// fakeGH answers `gh api` for issue pages from a fixed set, never the network.
type fakeGH struct {
	issues map[string][]ghIssue // by repo
	calls  []string
}

func (f *fakeGH) run(_ context.Context, args ...string) ([]byte, error) {
	f.calls = append(f.calls, strings.Join(args, " "))
	var repo string
	page := 1
	for _, a := range args {
		if strings.HasPrefix(a, "repos/") {
			repo = strings.TrimSuffix(strings.TrimPrefix(a, "repos/"), "/issues")
		}
		if strings.HasPrefix(a, "page=") {
			fmt.Sscan(strings.TrimPrefix(a, "page="), &page)
		}
	}
	all := f.issues[repo]
	start := (page - 1) * 100
	if start >= len(all) {
		return []byte("[]"), nil
	}
	return json.Marshal(all[start:min(start+100, len(all))])
}

func ghLabels(names ...string) []ghLabel {
	out := make([]ghLabel, len(names))
	for i, n := range names {
		out[i] = ghLabel{Name: n}
	}
	return out
}

func TestFetchPrefersIssuesWithMoreTopicalLabelsAndSkipsPullRequests(t *testing.T) {
	when := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	gh := &fakeGH{issues: map[string][]ghIssue{"o/app": {
		{Number: 1, Title: "One label", Labels: ghLabels("enhancement", "desktop"), UpdatedAt: when},
		{Number: 2, Title: "Two labels", Body: strings.Repeat("x", 2000), Labels: ghLabels("enhancement", "desktop", "sync"), UpdatedAt: when},
		{Number: 3, Title: "Only housekeeping", Labels: ghLabels("enhancement", "stale"), UpdatedAt: when},
		{Number: 4, Title: "A pull request", Labels: ghLabels("desktop", "sync"), PullRequest: &struct{}{}, UpdatedAt: when},
		{Number: 5, Title: "Also two", Labels: ghLabels("enhancement", "mobile", "sync"), UpdatedAt: when},
	}}}
	data, err := Fetch(context.Background(), gh.run, []RepoSpec{{Name: "o/app", Filter: "enhancement", Take: 2}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, is := range data.Issues {
		ids = append(ids, is.ID)
	}
	slices.Sort(ids)
	if !reflect.DeepEqual(ids, []string{"o/app#2", "o/app#5"}) {
		t.Errorf("kept issues %v, want the two with two topical labels", ids)
	}
	if n := len([]rune(data.Issues[0].Notes)); n > maxNotes+1 {
		t.Errorf("notes are %d runes, want at most %d", n, maxNotes+1)
	}
	if !strings.Contains(gh.calls[0], "labels=enhancement") {
		t.Errorf("gh call %q doesn't filter by the repo's feature label", gh.calls[0])
	}
}
