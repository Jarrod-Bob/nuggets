package tagbench

import (
	"cmp"
	"math/rand/v2"
	"slices"
	"strconv"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

// Case is one check to put to every contender, once per repeat.
type Case struct {
	// Key identifies the case across repeats and runs:
	// dataset/task/item[/hidden tag][@vocabulary size].
	Key       string
	Dataset   string
	Task      string
	Item      Item
	Hidden    string
	VocabSize int
	Repeat    int
	Input     Input
}

// ID is the case's key and repeat.
func (c Case) ID() string { return c.Key + "#" + strconv.Itoa(c.Repeat) }

// CaseOptions shape the case list. Zero caps mean no cap.
type CaseOptions struct {
	Seed    uint64
	Repeats int
	// MinTags is the fewest tags an item needs for the hidden-tag task
	// (default 2).
	MinTags int
	// MaxHidden and MaxOpen cap each dataset's hidden-tag and open cases,
	// sampled with Seed.
	MaxHidden int
	MaxOpen   int
	// ScaleItems GitHub hidden-tag cases are re-asked at each of ScaleSizes
	// candidate tags.
	ScaleItems int
	ScaleSizes []int
	// Limit caps the cases (before repeats), sampled with Seed: for smoke
	// runs.
	Limit int
}

// BuildCases turns items into cases (design §5). Candidates and examples
// come from jev.BuildCandidates over the item's own group, so every case
// asks what production would ask of that nugget in that bank.
func BuildCases(items []Item, opt CaseOptions) []Case {
	if opt.MinTags == 0 {
		opt.MinTags = 2
	}
	if opt.Repeats < 1 {
		opt.Repeats = 1
	}
	rng := rand.New(rand.NewPCG(opt.Seed, 0x7a6b))

	uses := map[string][]jev.TagUse{}
	carriers := map[string]map[string]int{} // group → tag → items carrying it
	for _, it := range items {
		if carriers[it.Group] == nil {
			carriers[it.Group] = map[string]int{}
		}
		for _, tag := range it.Tags {
			uses[it.Group] = append(uses[it.Group], jev.TagUse{Tag: tag, NuggetID: it.NuggetID, Title: it.Title, UpdatedAt: it.UpdatedAt})
			carriers[it.Group][tag]++
		}
	}

	var hidden, open map[string][]Case = map[string][]Case{}, map[string][]Case{}
	for _, it := range items {
		if it.Padding {
			continue
		}
		// With nothing to ask, production makes no call; neither do we.
		if in := input(it, it.Tags, "", uses[it.Group]); len(in.Candidates) > 0 {
			open[it.Dataset] = append(open[it.Dataset], Case{
				Key: it.Dataset + "/" + TaskOpen + "/" + it.ID, Dataset: it.Dataset, Task: TaskOpen, Item: it, Input: in,
			})
		}
		if len(it.Tags) < opt.MinTags {
			continue
		}
		for _, h := range it.Tags {
			// A tag no other item carries would leave the vocabulary with
			// it: production could never suggest it back.
			if carriers[it.Group][h] < 2 {
				continue
			}
			shown := slices.DeleteFunc(slices.Clone(it.Tags), func(t string) bool { return t == h })
			hidden[it.Dataset] = append(hidden[it.Dataset], Case{
				Key: it.Dataset + "/" + TaskHidden + "/" + it.ID + "/" + h, Dataset: it.Dataset, Task: TaskHidden, Item: it, Hidden: h,
				Input: input(it, shown, h, uses[it.Group]),
			})
		}
	}

	var cases []Case
	for _, ds := range sortedKeys(hidden, open) {
		cases = append(cases, sample(rng, hidden[ds], opt.MaxHidden)...)
		cases = append(cases, sample(rng, open[ds], opt.MaxOpen)...)
	}
	cases = append(cases, scaleCases(rng, items, hidden[DatasetGitHub], uses, opt)...)
	if opt.Limit > 0 && len(cases) > opt.Limit {
		cases = sample(rng, cases, opt.Limit)
	}

	var out []Case
	for _, c := range cases {
		for r := range opt.Repeats {
			c.Repeat = r
			out = append(out, c)
		}
	}
	return out
}

// input is the item as production would see it showing only shown, with
// hidden (if any) never skipped.
func input(it Item, shown []string, hidden string, uses []jev.TagUse) Input {
	skip := map[string]bool{}
	for _, t := range shown {
		skip[t] = true
	}
	for _, t := range it.Dismissed {
		skip[t] = true
	}
	delete(skip, hidden)
	if shown == nil {
		shown = []string{}
	}
	return Input{Title: it.Title, Notes: it.Notes, Tags: shown, Candidates: jev.BuildCandidates(it.NuggetID, skip, uses)}
}

// scaleCases re-asks some GitHub hidden-tag cases with exactly size
// candidates: the hidden tag, the rest of its repo's candidates, then
// labels (with their examples) from other repos, in a seeded order so a
// smaller vocabulary is a subset of a larger one. Fewer exist than asked
// for, all are used.
func scaleCases(rng *rand.Rand, items []Item, hidden []Case, uses map[string][]jev.TagUse, opt CaseOptions) []Case {
	if opt.ScaleItems == 0 || len(opt.ScaleSizes) == 0 || len(hidden) == 0 {
		return nil
	}
	foreign := map[string][]jev.Candidate{} // GitHub group → its whole vocabulary
	for _, it := range items {
		if _, done := foreign[it.Group]; it.Dataset == DatasetGitHub && !done {
			foreign[it.Group] = jev.BuildCandidates(0, nil, uses[it.Group])
		}
	}
	groups := slices.Sorted(func(yield func(string) bool) {
		for g := range foreign {
			if !yield(g) {
				return
			}
		}
	})

	var out []Case
	for _, base := range sample(rng, hidden, opt.ScaleItems) {
		taken := map[string]bool{}
		for _, t := range base.Input.Tags {
			taken[t] = true
		}
		var own, pad []jev.Candidate
		var first jev.Candidate
		for _, c := range base.Input.Candidates {
			taken[c.Tag] = true
			if c.Tag == base.Hidden {
				first = c
			} else {
				own = append(own, c)
			}
		}
		for _, g := range groups {
			if g == base.Item.Group {
				continue
			}
			for _, c := range foreign[g] {
				if !taken[c.Tag] {
					taken[c.Tag] = true
					pad = append(pad, c)
				}
			}
		}
		rng.Shuffle(len(own), func(i, j int) { own[i], own[j] = own[j], own[i] })
		rng.Shuffle(len(pad), func(i, j int) { pad[i], pad[j] = pad[j], pad[i] })
		order := append(append([]jev.Candidate{first}, own...), pad...)
		for _, size := range opt.ScaleSizes {
			cands := slices.Clone(order[:min(size, len(order))])
			slices.SortFunc(cands, func(a, b jev.Candidate) int { return cmp.Compare(a.Tag, b.Tag) })
			c := base
			c.Key = DatasetGitHub + "/" + TaskScale + "/" + base.Item.ID + "/" + base.Hidden + "@" + strconv.Itoa(size)
			c.Task, c.VocabSize = TaskScale, size
			c.Input.Candidates = cands
			out = append(out, c)
		}
	}
	return out
}

// sample keeps n of cases chosen with rng, in their original order (all
// when n is 0 or covers them).
func sample(rng *rand.Rand, cases []Case, n int) []Case {
	if n <= 0 || n >= len(cases) {
		return cases
	}
	idx := rng.Perm(len(cases))[:n]
	slices.Sort(idx)
	out := make([]Case, n)
	for i, j := range idx {
		out[i] = cases[j]
	}
	return out
}

func sortedKeys(ms ...map[string][]Case) []string {
	seen := map[string]bool{}
	var keys []string
	for _, m := range ms {
		for k := range m {
			if !seen[k] {
				seen[k] = true
				keys = append(keys, k)
			}
		}
	}
	slices.Sort(keys)
	return keys
}
