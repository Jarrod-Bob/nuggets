package tagbench

import (
	"bufio"
	"cmp"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"math/rand/v2"
	"slices"
	"strings"
)

// Verdict is the captain's judgment of one pooled bank suggestion.
type Verdict string

const (
	VerdictYes  Verdict = "y"
	VerdictNo   Verdict = "n"
	VerdictSkip Verdict = "skip"
)

// Judgments maps (item, tag) to a verdict.
type Judgments map[judgmentKey]Verdict

type judgmentKey struct{ Item, Tag string }

func (j Judgments) Set(item, tag string, v Verdict) { j[judgmentKey{item, tag}] = v }

func (j Judgments) Get(item, tag string) (Verdict, bool) {
	v, ok := j[judgmentKey{item, tag}]
	return v, ok
}

type judgmentJSON struct {
	ItemID  string  `json:"item_id"`
	Tag     string  `json:"tag"`
	Verdict Verdict `json:"verdict"`
}

// MarshalJSON writes the judgments as a list, sorted, so the file diffs well.
func (j Judgments) MarshalJSON() ([]byte, error) {
	list := make([]judgmentJSON, 0, len(j))
	for k, v := range j {
		list = append(list, judgmentJSON{k.Item, k.Tag, v})
	}
	slices.SortFunc(list, func(a, b judgmentJSON) int {
		return cmp.Or(cmp.Compare(a.ItemID, b.ItemID), cmp.Compare(a.Tag, b.Tag))
	})
	return json.Marshal(struct {
		Judgments []judgmentJSON `json:"judgments"`
	}{list})
}

func (j *Judgments) UnmarshalJSON(data []byte) error {
	var file struct {
		Judgments []judgmentJSON `json:"judgments"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		return err
	}
	*j = Judgments{}
	for _, e := range file.Judgments {
		j.Set(e.ItemID, e.Tag, e.Verdict)
	}
	return nil
}

// PoolItem is one bank suggestion to judge: an (item, tag) pair some
// contender put in its top 3 at any score. It never says which contender.
type PoolItem struct {
	ItemID string
	Tag    string
}

// Pool collects every unique bank suggestion worth judging: the top 3 of
// each answered bank check, at any score (so the threshold sweep has truth
// all the way down), minus tags already on the item and the hidden tag.
// Sorted by item and tag; Judge shuffles.
func Pool(records []Record) []PoolItem {
	seen := map[PoolItem]bool{}
	var out []PoolItem
	for _, r := range records {
		if r.Dataset != DatasetBank || r.Outcome != OutcomeOK {
			continue
		}
		for _, tag := range Top(r.Scores, 0) {
			p := PoolItem{r.ItemID, tag}
			if tag == r.Hidden || slices.Contains(r.ItemTags, tag) || seen[p] {
				continue
			}
			seen[p] = true
			out = append(out, p)
		}
	}
	slices.SortFunc(out, func(a, b PoolItem) int {
		return cmp.Or(cmp.Compare(a.ItemID, b.ItemID), cmp.Compare(a.Tag, b.Tag))
	})
	return out
}

// Judge asks about each pooled suggestion not yet judged, in a shuffled
// order, and saves after every answer, so quitting (q, or the end of input)
// loses nothing and the next session carries on. items supplies the
// nugget's text and the other nuggets carrying the tag. It returns how many
// it recorded.
func Judge(in io.Reader, out io.Writer, pool []PoolItem, items map[string]Item, j Judgments, save func(Judgments) error, seed uint64) (int, error) {
	order := slices.Clone(pool)
	rand.New(rand.NewPCG(seed, 0x1d6e)).Shuffle(len(order), func(a, b int) { order[a], order[b] = order[b], order[a] })
	var todo []PoolItem
	for _, p := range order {
		if _, done := j.Get(p.ItemID, p.Tag); !done {
			todo = append(todo, p)
		}
	}
	fmt.Fprintf(out, "%d of %d suggestions left to judge. y = it belongs, n = it doesn't, s = skip, q = quit.\n", len(todo), len(pool))
	scanner := bufio.NewScanner(in)
	answered := 0
	for i, p := range todo {
		it := items[p.ItemID]
		fmt.Fprintf(out, "\n[%d/%d] %s\n", i+1, len(todo), it.Title)
		if notes := strings.TrimSpace(it.Notes); notes != "" {
			fmt.Fprintf(out, "  notes: %s\n", oneLine(notes, 300))
		}
		fmt.Fprintf(out, "  tags:  %s\n", strings.Join(it.Tags, ", "))
		fmt.Fprintf(out, "Does the tag %q belong?", p.Tag)
		if ex := carriers(items, p); len(ex) > 0 {
			fmt.Fprintf(out, " (also on: %s)", strings.Join(ex, "; "))
		}
		fmt.Fprintln(out)
		for {
			fmt.Fprint(out, "y/n/s/q> ")
			if !scanner.Scan() {
				return answered, scanner.Err()
			}
			var v Verdict
			switch strings.ToLower(strings.TrimSpace(scanner.Text())) {
			case "y", "yes":
				v = VerdictYes
			case "n", "no":
				v = VerdictNo
			case "s", "skip":
				v = VerdictSkip
			case "q", "quit":
				return answered, nil
			default:
				continue
			}
			j.Set(p.ItemID, p.Tag, v)
			if err := save(j); err != nil {
				return answered, err
			}
			answered++
			break
		}
	}
	fmt.Fprintln(out, "\nAll suggestions judged.")
	return answered, nil
}

// carriers are up to 3 titles of other items carrying the tag.
func carriers(items map[string]Item, p PoolItem) []string {
	var titles []string
	for _, id := range slices.Sorted(maps.Keys(items)) {
		it := items[id]
		if id != p.ItemID && slices.Contains(it.Tags, p.Tag) && len(titles) < 3 {
			titles = append(titles, it.Title)
		}
	}
	return titles
}

func oneLine(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > max {
		return string(r[:max]) + "…"
	}
	return s
}
