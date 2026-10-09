package tagbench

import (
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

func bankItems() []Item {
	at := func(d int) time.Time { return time.Date(2026, 10, d, 0, 0, 0, 0, time.UTC) }
	return []Item{
		{ID: "1", Dataset: DatasetBank, Group: "bank", NuggetID: 1, Title: "Synth", Tags: []string{"music", "hardware"}, UpdatedAt: at(5)},
		{ID: "2", Dataset: DatasetBank, Group: "bank", NuggetID: 2, Title: "Timer", Tags: []string{"hardware"}, UpdatedAt: at(4)},
		{ID: "3", Dataset: DatasetBank, Group: "bank", NuggetID: 3, Title: "Playlist", Tags: []string{"music", "web", "solo"}, UpdatedAt: at(3), Dismissed: []string{"hardware"}},
		{ID: "4", Dataset: DatasetBank, Group: "bank", NuggetID: 4, Title: "Site", Tags: []string{"web"}, UpdatedAt: at(2)},
	}
}

func casesOf(cs []Case, task string) []Case {
	var out []Case
	for _, c := range cs {
		if c.Task == task {
			out = append(out, c)
		}
	}
	return out
}

func candidateTags(c Case) []string {
	var tags []string
	for _, cand := range c.Input.Candidates {
		tags = append(tags, cand.Tag)
	}
	return tags
}

func TestHiddenCasesHideEachSharedTagOfMultiTagItems(t *testing.T) {
	cs := BuildCases(bankItems(), CaseOptions{Seed: 1, Repeats: 1})
	var keys []string
	for _, c := range casesOf(cs, TaskHidden) {
		keys = append(keys, c.Key)
		if slices.Contains(c.Input.Tags, c.Hidden) {
			t.Errorf("%s shows the hidden tag", c.Key)
		}
		if !slices.Contains(candidateTags(c), c.Hidden) {
			t.Errorf("%s doesn't ask about the hidden tag", c.Key)
		}
		for _, cand := range c.Input.Candidates {
			if slices.Contains(cand.Examples, c.Item.Title) {
				t.Errorf("%s uses the item's own title as an example", c.Key)
			}
		}
	}
	slices.Sort(keys)
	// Item 3's "solo" is on no other nugget, so hiding it would hide it from
	// the vocabulary too; item 2 has one tag.
	want := []string{"bank/hidden/1/hardware", "bank/hidden/1/music", "bank/hidden/3/music", "bank/hidden/3/web"}
	if !reflect.DeepEqual(keys, want) {
		t.Errorf("hidden cases %q, want %q", keys, want)
	}
}

func TestOpenCasesAskWhatProductionWouldAsk(t *testing.T) {
	cs := casesOf(BuildCases(bankItems(), CaseOptions{Seed: 1, Repeats: 1}), TaskOpen)
	// Item 3's own tags and its dismissed "hardware" cover the vocabulary:
	// with nothing to ask, production makes no call, so neither do we.
	var ids []string
	for _, c := range cs {
		ids = append(ids, c.Item.ID)
		if c.Item.ID == "4" && !reflect.DeepEqual(candidateTags(c), []string{"hardware", "music", "solo"}) {
			t.Errorf("item 4 candidates = %q", candidateTags(c))
		}
	}
	if !reflect.DeepEqual(ids, []string{"1", "2", "4"}) {
		t.Errorf("open cases for items %q, want 1, 2 and 4", ids)
	}
}

func TestCasesRepeatAndCapDeterministically(t *testing.T) {
	opt := CaseOptions{Seed: 7, Repeats: 3, MaxHidden: 2}
	a, b := BuildCases(bankItems(), opt), BuildCases(bankItems(), opt)
	if !reflect.DeepEqual(a, b) {
		t.Error("the same seed built different cases")
	}
	if n := len(casesOf(a, TaskHidden)); n != 2*3 {
		t.Errorf("%d hidden checks, want 2 cases × 3 repeats", n)
	}
	limited := BuildCases(bankItems(), CaseOptions{Seed: 7, Repeats: 3, Limit: 3})
	keys := map[string]bool{}
	for _, c := range limited {
		keys[c.Key] = true
	}
	if len(keys) != 3 || len(limited) != 9 {
		t.Errorf("-limit 3 gave %d cases in %d checks, want 3 in 9", len(keys), len(limited))
	}
}

func githubItems() []Item {
	at := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	var items []Item
	add := func(group, id string, padding bool, tags ...string) {
		items = append(items, Item{ID: group + "#" + id, Dataset: DatasetGitHub, Group: group, NuggetID: int64(len(items) + 1),
			Title: group + " issue " + id, Tags: tags, UpdatedAt: at, Padding: padding})
	}
	add("o/a", "1", false, "sync", "desktop")
	add("o/a", "2", false, "sync", "mobile")
	add("o/a", "3", false, "desktop")
	for i := range 30 {
		add("o/pad", string(rune('a'+i)), true, "pad-"+string(rune('a'+i)))
	}
	return items
}

func TestPaddingItemsAreNeverCases(t *testing.T) {
	for _, c := range BuildCases(githubItems(), CaseOptions{Seed: 1, Repeats: 1}) {
		if strings.HasPrefix(c.Item.ID, "o/pad") {
			t.Fatalf("padding item %s became a case", c.Item.ID)
		}
	}
}

func TestScaleCasesPadTheVocabularyFromOtherRepos(t *testing.T) {
	cs := casesOf(BuildCases(githubItems(), CaseOptions{Seed: 1, Repeats: 1, ScaleItems: 1, ScaleSizes: []int{2, 10, 200}}), TaskScale)
	if len(cs) != 3 {
		t.Fatalf("%d scale cases, want 3 sizes of 1 item", len(cs))
	}
	sizes := map[int]int{}
	for _, c := range cs {
		tags := candidateTags(c)
		sizes[c.VocabSize] = len(tags)
		if !slices.Contains(tags, c.Hidden) {
			t.Errorf("vocab %d drops the hidden tag", c.VocabSize)
		}
		if !slices.IsSorted(tags) {
			t.Errorf("vocab %d isn't sorted like production's", c.VocabSize)
		}
		for _, tag := range tags {
			if slices.Contains(c.Input.Tags, tag) {
				t.Errorf("vocab %d asks about a tag the item shows", c.VocabSize)
			}
		}
	}
	// Repo o/a offers 2 candidates (its 3 tags minus the one shown); o/pad
	// 30 more. Asking for 200 gets all 32 there are.
	if sizes[2] != 2 || sizes[10] != 10 || sizes[200] != 32 {
		t.Errorf("vocabulary sizes = %v, want 2, 10 and 32", sizes)
	}
}

func TestScalePaddingNeverUsesTheBanksTags(t *testing.T) {
	items := append(githubItems(), bankItems()...)
	for _, c := range casesOf(BuildCases(items, CaseOptions{Seed: 1, Repeats: 1, ScaleItems: 2, ScaleSizes: []int{200}}), TaskScale) {
		for _, tag := range candidateTags(c) {
			if slices.Contains([]string{"music", "hardware", "web", "solo"}, tag) {
				t.Errorf("%s pads with the bank's tag %q", c.Key, tag)
			}
		}
	}
}
