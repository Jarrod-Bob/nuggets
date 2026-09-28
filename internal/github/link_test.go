package github

import (
	"context"
	"net/http"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func (e *testEnv) nuggetTitled(t *testing.T, title string) []idea.Idea {
	t.Helper()
	all, err := e.ideas.List(context.Background(), idea.ListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	var out []idea.Idea
	for _, n := range all {
		if n.Title == title {
			out = append(out, n)
		}
	}
	return out
}

func TestASpicesResyncOpensNoSecondIssue(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	ctx := context.Background()
	item := idea.SyncedItem{Ref: "7", Rev: 1, Title: "Dark mode", Notes: "Follow the system theme.", Tags: []string{"nuggets"}}
	if _, err := e.ideas.ApplySynced(ctx, idea.SourceSpices, []idea.SyncedItem{item}, nil); err != nil {
		t.Fatal(err)
	}
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}

	if _, err := e.ideas.DetachSource(ctx, idea.SourceSpices, idea.SourceSpicesDetached, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := e.ideas.ApplySynced(ctx, idea.SourceSpices, []idea.SyncedItem{item}, nil); err != nil {
		t.Fatal(err)
	}
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}

	issues, _ := e.fake.snapshot()
	if len(issues) != 1 || e.fake.countRequests(http.MethodPost) != 1 {
		t.Fatalf("issues = %+v, want the one opened before the Re-sync", issues)
	}
	copies := e.nuggetTitled(t, "Dark mode")
	if len(copies) != 2 {
		t.Fatalf("got %d copies of the idea, want the detached one and the re-import", len(copies))
	}
	for _, n := range copies {
		row := e.onlyRow(t, n.ID)
		if row.State != StateCreated || row.Number == nil || *row.Number != issues[0].Number ||
			row.URL == nil || *row.URL != "https://github.com/Jarrod-Bob/nuggets/issues/1" {
			t.Errorf("nugget %d shows %+v, want issue #%d", n.ID, row, issues[0].Number)
		}
	}
	if pending, failed, err := e.outbox.Counts(ctx); err != nil || pending != 0 || failed != 0 {
		t.Errorf("counts = %d, %d, %v; want 0, 0", pending, failed, err)
	}

	// Purging the detached copy leaves the re-import showing the issue, and
	// nothing is sent again.
	var detached, reimported idea.Idea
	for _, n := range copies {
		if n.Source != nil && *n.Source == idea.SourceSpicesDetached {
			detached = n
		} else {
			reimported = n
		}
	}
	if err := e.ideas.Purge(ctx, detached.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}
	if row := e.onlyRow(t, reimported.ID); row.State != StateCreated || row.Number == nil || *row.Number != 1 {
		t.Errorf("after purging the original, the re-import shows %+v, want issue #1", row)
	}
	if n := e.fake.countRequests(http.MethodPost); n != 1 {
		t.Errorf("%d POSTs, want 1", n)
	}
}

func TestSameTitleDifferentNotesGetsItsOwnIssue(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	a := e.createIdea(t, "Export", "As CSV.", "nuggets")
	b := e.createIdea(t, "Export", "As a PDF.", "nuggets")
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	issues, _ := e.fake.snapshot()
	if len(issues) != 2 {
		t.Fatalf("issues = %+v, want one per idea", issues)
	}
	ra, rb := e.onlyRow(t, a.ID), e.onlyRow(t, b.ID)
	if ra.Number == nil || rb.Number == nil || *ra.Number == *rb.Number {
		t.Errorf("rows = %+v, %+v; want different issues", ra, rb)
	}
}

func TestWhitespaceAndCaseStillMatch(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	original := e.createIdea(t, "Dark   mode", "Follow the\n\nsystem theme.", "nuggets")
	copy := e.createIdea(t, "  dark MODE ", "follow THE system\ttheme.  ", "nuggets")

	// Queued, not yet sent: the copy shows the original's queued state and
	// only one request is waiting.
	if row := e.onlyRow(t, copy.ID); row.State != StatePending {
		t.Errorf("copy shows %+v, want pending", row)
	}
	if pending, _, err := e.outbox.Counts(ctx); err != nil || pending != 1 {
		t.Errorf("pending = %d, %v; want 1", pending, err)
	}

	// The original fails; the copy shows it, and Retry on the copy retries
	// the original.
	e.setToken(t, testToken)
	e.fake.missingRepos["Jarrod-Bob/nuggets"] = true
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}
	row := e.onlyRow(t, copy.ID)
	if row.State != StateFailed || row.LastError == "" {
		t.Fatalf("copy shows %+v, want the original's failure", row)
	}
	e.fake.missingRepos["Jarrod-Bob/nuggets"] = false
	if _, err := e.outbox.Retry(ctx, row.ID); err != nil {
		t.Fatal(err)
	}
	if got := e.onlyRow(t, original.ID); got.State != StatePending {
		t.Errorf("original is %+v after retrying the copy, want pending", got)
	}
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}
	issues, _ := e.fake.snapshot()
	if len(issues) != 1 {
		t.Fatalf("issues = %+v, want one", issues)
	}
	for _, id := range []int64{original.ID, copy.ID} {
		if got := e.onlyRow(t, id); got.State != StateCreated || got.Number == nil || *got.Number != issues[0].Number {
			t.Errorf("nugget %d shows %+v, want issue #%d", id, got, issues[0].Number)
		}
	}
}

func TestAFailedOriginalDoesNotCountAsAMatch(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	ctx := context.Background()
	e.fake.missingRepos["Jarrod-Bob/nuggets"] = true
	e.createIdea(t, "Sync", "", "nuggets")
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}
	e.fake.missingRepos["Jarrod-Bob/nuggets"] = false
	later := e.createIdea(t, "Sync", "", "nuggets")
	if err := e.sender.Pass(ctx); err != nil {
		t.Fatal(err)
	}
	if row := e.onlyRow(t, later.ID); row.State != StateCreated {
		t.Errorf("later nugget shows %+v, want its own created issue", row)
	}
}

func TestAHandedOverRowFindsTheIssueItsOriginalPosted(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	ctx := context.Background()
	lossy := &http.Client{Transport: &droppingTransport{base: e.srv.Client().Transport, drops: 1}}
	e.sender = e.newSender(WithHTTPClient(lossy))
	original := e.createIdea(t, "Keyboard shortcuts", "", "nuggets")
	copy := e.createIdea(t, "Keyboard shortcuts", "", "nuggets")

	// The original's POST lands on GitHub but its answer is lost.
	if err := e.sender.Pass(ctx); err == nil {
		t.Fatal("Pass succeeded, want a pause after the lost answer")
	}
	if issues, _ := e.fake.snapshot(); len(issues) != 1 {
		t.Fatalf("GitHub has %d issues after the lost answer, want 1", len(issues))
	}

	// Purging the original hands its request over to the copy, which must
	// find that issue rather than post another.
	if err := e.ideas.Purge(ctx, original.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Exec(`UPDATE github_issues SET next_attempt_at = NULL`); err != nil {
		t.Fatal(err)
	}
	if err := e.newSender().Pass(ctx); err != nil {
		t.Fatalf("Pass after the hand-over: %v", err)
	}
	if n := e.fake.countRequests(http.MethodPost); n != 1 {
		t.Errorf("POSTs = %d, want 1", n)
	}
	if row := e.onlyRow(t, copy.ID); row.State != StateCreated || row.Number == nil || *row.Number != 1 {
		t.Errorf("copy shows %+v, want created #1 found by the original's marker", row)
	}
}
