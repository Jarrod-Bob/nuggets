package github

import (
	"context"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func strs(v ...string) *[]string { return &v }
func str(v string) *string       { return &v }

func TestCreatingATaggedNuggetQueuesOneRequest(t *testing.T) {
	e := newTestEnv(t)
	n := e.createIdea(t, "Tagged", "", "NuggetS", "ui")
	row := e.onlyRow(t, n.ID)
	if row.Repo != "Jarrod-Bob/nuggets" || row.Tag != "nuggets" || row.State != StatePending || row.key == "" {
		t.Errorf("row = %+v", row)
	}
	if other := e.createIdea(t, "Untagged", "", "ui"); len(e.rows(t, other.ID)) != 0 {
		t.Error("a nugget without the tag queued a request")
	}
}

func TestAddingTheTagInAnEditQueuesARequest(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	n := e.createIdea(t, "Plain", "", "ui")

	// Unrelated edits: title, notes, status, other tags.
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Title: str("Renamed"), Notes: str("more")}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Tags: strs("ui", "later")}); err != nil {
		t.Fatal(err)
	}
	if rows := e.rows(t, n.ID); len(rows) != 0 {
		t.Fatalf("unrelated edits queued %d requests", len(rows))
	}

	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Tags: strs("ui", "nuggets")}); err != nil {
		t.Fatal(err)
	}
	e.onlyRow(t, n.ID)

	// Removing and re-adding the tag, or saving again with it, never queues a
	// second.
	for _, tags := range [][]string{{"ui"}, {"nuggets"}, {"nuggets", "ui"}} {
		if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Tags: &tags}); err != nil {
			t.Fatal(err)
		}
	}
	e.onlyRow(t, n.ID)
}

func TestAnEditKeepingATagThatPredatesTheMappingQueuesNothing(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	if err := e.settings.Set(ctx, KeyMappings, `[]`); err != nil {
		t.Fatal(err)
	}
	n := e.createIdea(t, "Old", "", "nuggets")
	if err := e.settings.Set(ctx, KeyMappings, `[{"tag":"nuggets","repo":"Jarrod-Bob/nuggets"}]`); err != nil {
		t.Fatal(err)
	}
	// The web form always sends the whole tag set; the tag was already there.
	if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Title: str("Old, edited"), Tags: strs("nuggets")}); err != nil {
		t.Fatal(err)
	}
	if rows := e.rows(t, n.ID); len(rows) != 0 {
		t.Errorf("an edit that added no tag queued %d requests", len(rows))
	}
}

func TestImportingATaggedIdeaQueuesARequest(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	if _, err := e.ideas.ApplySynced(ctx, idea.SourceSpices, []idea.SyncedItem{
		{Ref: "1", Rev: 1, Title: "From the phone", Tags: []string{"nuggets"}},
		{Ref: "2", Rev: 2, Title: "Unrelated", Tags: []string{"food"}},
	}, nil); err != nil {
		t.Fatal(err)
	}
	all, err := e.ideas.List(ctx, idea.ListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	queued := 0
	for _, n := range all {
		queued += len(e.rows(t, n.ID))
		if n.Title == "From the phone" {
			e.onlyRow(t, n.ID)
		}
	}
	if queued != 1 {
		t.Errorf("queued %d requests, want 1", queued)
	}

	// A later spices edit that adds the tag to the other idea queues it too.
	if _, err := e.ideas.ApplySynced(ctx, idea.SourceSpices, []idea.SyncedItem{
		{Ref: "2", Rev: 3, Title: "Unrelated", Tags: []string{"food", "nuggets"}},
	}, nil); err != nil {
		t.Fatal(err)
	}
	all, _ = e.ideas.List(ctx, idea.ListFilter{})
	for _, n := range all {
		if n.Title == "Unrelated" {
			e.onlyRow(t, n.ID)
		}
	}
}

func TestEachMappedRepoGetsItsOwnRequest(t *testing.T) {
	e := newTestEnv(t)
	if err := e.settings.Set(context.Background(), KeyMappings,
		`[{"tag":"nuggets","repo":"Jarrod-Bob/nuggets"},{"tag":"spices","repo":"Jarrod-Bob/spices"},{"tag":"bank","repo":"jarrod-bob/NUGGETS"}]`); err != nil {
		t.Fatal(err)
	}
	n := e.createIdea(t, "Both", "", "nuggets", "spices", "bank")
	rows := e.rows(t, n.ID)
	if len(rows) != 2 {
		t.Fatalf("rows = %+v, want one per repository (names compare case-insensitively)", rows)
	}
}

func TestPurgingANuggetDropsItsQueuedRequest(t *testing.T) {
	e := newTestEnv(t)
	n := e.createIdea(t, "Gone", "", "nuggets")
	if err := e.ideas.Purge(context.Background(), n.ID); err != nil {
		t.Fatal(err)
	}
	pending, failed, err := e.outbox.Counts(context.Background())
	if err != nil || pending != 0 || failed != 0 {
		t.Errorf("counts = %d, %d, %v; want 0, 0", pending, failed, err)
	}
}

func TestTheSpicesTagCanTargetAnotherRepo(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	if err := e.settings.Set(context.Background(), KeyMappings, `[{"tag":"spices","repo":"Jarrod-Bob/spices"}]`); err != nil {
		t.Fatal(err)
	}
	e.createIdea(t, "A spices idea", "", "spices")
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	issues, _ := e.fake.snapshot()
	if len(issues) != 1 || issues[0].Repo != "Jarrod-Bob/spices" {
		t.Errorf("issues = %+v, want one on Jarrod-Bob/spices", issues)
	}
}
