package tagbench

import (
	"bytes"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func judgeRecords() []Record {
	return []Record{
		{Contender: "jev", Dataset: DatasetBank, Task: TaskOpen, ItemID: "4", ItemTags: []string{"web"}, Outcome: OutcomeOK,
			Scores: map[string]float64{"music": 0.9, "hardware": 0.2, "solo": 0.1, "games": 0.05}},
		{Contender: "claude:claude-haiku-5-5:low", Dataset: DatasetBank, Task: TaskOpen, ItemID: "4", ItemTags: []string{"web"}, Outcome: OutcomeOK,
			Scores: map[string]float64{"music": 0.8, "games": 0.7}},
		// A hidden-tag check: the hidden tag is already known to be right.
		{Contender: "jev", Dataset: DatasetBank, Task: TaskHidden, ItemID: "1", ItemTags: []string{"music", "hardware"}, Hidden: "music", Outcome: OutcomeOK,
			Scores: map[string]float64{"music": 0.9, "web": 0.8}},
		// Not pooled: GitHub labels are the truth, and a failed check has
		// no suggestions.
		{Contender: "jev", Dataset: DatasetGitHub, Task: TaskOpen, ItemID: "o/a#1", Outcome: OutcomeOK, Scores: map[string]float64{"sync": 0.9}},
		{Contender: "jev", Dataset: DatasetBank, Task: TaskOpen, ItemID: "2", Outcome: OutcomeError},
	}
}

func TestPoolIsEveryUniqueTopThreeBankSuggestion(t *testing.T) {
	var got []string
	for _, p := range Pool(judgeRecords()) {
		got = append(got, p.ItemID+":"+p.Tag)
	}
	want := []string{"1:web", "4:games", "4:hardware", "4:music", "4:solo"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("pool = %q, want %q", got, want)
	}
}

func TestJudgeIsBlindAndResumable(t *testing.T) {
	items := map[string]Item{}
	for _, it := range bankItems() {
		items[it.ID] = it
	}
	pool := Pool(judgeRecords())
	j := Judgments{}
	j.Set("4", "music", VerdictYes) // judged in an earlier session
	saves := 0
	save := func(Judgments) error { saves++; return nil }

	var out bytes.Buffer
	n, err := Judge(strings.NewReader("y\nmaybe\nn\nq\n"), &out, pool, items, j, save, 1)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 || saves != 2 || len(j) != 3 {
		t.Errorf("answered %d, saved %d times, %d judgments; want 2, 2, 3", n, saves, len(j))
	}
	for _, name := range []string{"jev", "claude", "haiku", "0.9", "0.8"} {
		if strings.Contains(strings.ToLower(out.String()), name) {
			t.Errorf("the judge shows %q, so it isn't blind:\n%s", name, out.String())
		}
	}
	if !strings.Contains(out.String(), "Site") {
		t.Errorf("the judge doesn't show the nugget:\n%s", out.String())
	}

	// A second session asks only what's left, then finishes.
	out.Reset()
	n, err = Judge(strings.NewReader("s\n"), &out, pool, items, j, save, 1)
	if err != nil || n != 1 || len(j) != 4 {
		t.Errorf("second session answered %d (err %v), %d judgments; want 1 and 4", n, err, len(j))
	}
	if v, _ := j.Get("4", "music"); v != VerdictYes {
		t.Error("an earlier verdict was asked again or overwritten")
	}
}

func TestJudgmentsRoundTripThroughJSON(t *testing.T) {
	j := Judgments{}
	j.Set("4", "music", VerdictYes)
	j.Set("1", "web", VerdictSkip)
	data, err := json.Marshal(j)
	if err != nil {
		t.Fatal(err)
	}
	var back Judgments
	if err := json.Unmarshal(data, &back); err != nil || !reflect.DeepEqual(back, j) {
		t.Errorf("round trip = %v (err %v) from %s", back, err, data)
	}
}
