package tagbench

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// Item is one nugget, or one GitHub issue standing in for a nugget.
type Item struct {
	ID      string `json:"id"`
	Dataset string `json:"dataset"`
	// Group is the item's tag vocabulary: the bank, or one repo. Candidates
	// and examples come only from the item's own group.
	Group     string    `json:"group"`
	NuggetID  int64     `json:"nugget_id"`
	Title     string    `json:"title"`
	Notes     string    `json:"notes"`
	Tags      []string  `json:"tags"`
	UpdatedAt time.Time `json:"updated_at"`
	// Dismissed are the bank nugget's dismissed suggestions, never asked.
	Dismissed []string `json:"dismissed,omitempty"`
	// Padding items only lend their labels to the scaling task.
	Padding bool `json:"padding,omitempty"`
}

// RepoSpec is one repo to fetch: Filter is the label marking feature
// requests (so issues read like ideas), and Take how many issues to keep.
// Padding repos only supply extra labels for the scaling task, so they are
// fetched without a filter.
type RepoSpec struct {
	Name    string `json:"name"`
	Filter  string `json:"filter,omitempty"`
	Take    int    `json:"take"`
	Padding bool   `json:"padding,omitempty"`
	Why     string `json:"why,omitempty"`
}

// DefaultRepos are the GitHub stand-in (design §4): apps whose feature
// requests read like product ideas, with a moderate set of topical labels.
var DefaultRepos = []RepoSpec{
	{Name: "laurent22/joplin", Filter: "enhancement", Take: 80, Why: "note-taking app; ~25 topical labels (desktop, mobile, sync, plugins, editor…)"},
	{Name: "koreader/koreader", Filter: "enhancement", Take: 80, Why: "e-reader app; ~26 topical labels (Kindle, Kobo, OPDS, plugin, UX…)"},
	{Name: "AntennaPod/AntennaPod", Filter: "Type: Feature request", Take: 70, Why: "podcast app; ~15 functional areas (queue, chapters, sync, home…)"},
	{Name: "florisboard/florisboard", Filter: "proposal", Take: 70, Why: "keyboard app; ~21 areas (clipboard, smartbar, emoji, layouts…)"},
	{Name: "AppFlowy-IO/AppFlowy", Take: 200, Padding: true, Why: "padding labels for the scaling task"},
	{Name: "zed-industries/zed", Take: 200, Padding: true, Why: "padding labels for the scaling task"},
	{Name: "godotengine/godot", Take: 200, Padding: true, Why: "padding labels for the scaling task"},
	{Name: "microsoft/vscode", Take: 200, Padding: true, Why: "padding labels for the scaling task"},
}

// housekeeping matches labels about an issue's process, not its subject:
// type, triage, status, priority, duplicates, staleness and the like.
var housekeeping = regexp.MustCompile(`(?i)^(` + strings.Join([]string{
	`.*\b(triage|status|priority|duplicate|stale|wontfix|won'?t fix|invalid|question|awaiting|backlog|reproduc\w*|needs?\b.*|close reason.*|auto-closed.*)\b.*`,
	`good[ -]first[ -]issue`, `help[ -]wanted`, `bug.*`, `enhancement`, `feature( request)?`, `proposal.*`,
	`type:.*`, `state:.*`, `difficulty:.*`, `effort-.*`, `size:.*`, `v\d.*`, `kind/.*`,
	`high`, `medium`, `low`, `critical`, `major`, `minor`, `regression`, `upstream`, `downstream`, `rejected`, `solved`, `resolved`,
	`out-of-date`, `out-of-scope`, `can'?t fix`, `not our bug`, `not-a-bug`, `coming soon`, `to be continued`, `chore`,
	`low-hanging-fruit`, `user (plugin|patch) available`, `excellent contribution`, `area: (project issue|other|meta)`,
	`discussion`, `template-ignored`, `wtf\?!`, `ai[- ].*`, `rostig`, `dependencies`, `dependency upgrade`, `documentation`, `docs`,
	`ci`, `automerge`, `hacktoberfest.*`, `spam`, `wip`, `work in progress`, `do not merge`, `don't merge yet`, `lgtm`, `renovate`,
	`github_actions`, `javascript`, `typescript`, `rust`, `refactor(ing)?`, `tech debt`, `maintenance`, `as designed`,
	`community contribution`, `contribution welcome`, `in progress`, `need(s)? info.*`, `more info.*`,
	`severity:.*`, `reach:.*`, `meta:.*`, `\.contrib/.*`, `.*first[ -]issue.*`, `\d{4}`, `q\d \d{2}`, `confirmed`, `archived`,
	`insiders-released`, `verifi(ed|cation-needed)`, `feature-request`, `new feature`, `improvements?`, `important`,
	`error-telemetry`, `errors-fix`, `recent-regression`, `testplan-item`, `on-testplan`, `endgame-plan`, `new release`,
	`stable-anomaly`, `.*test-failure`, `unreleased`, `candidate`, `\*.*`, `info-needed`, `polish`, `.*papercut.*`, `debt`,
	`under-discussion`, `modernization`, `community champion`, `tracker`, `tests`, `buildsystem`, `thirdparty`,
}, "|") + `)$`)

// labelPrefix is a grouping prefix dropped from a topical label.
var labelPrefix = regexp.MustCompile(`(?i)^(area|functionality|unit|platform|component|scope|topic|feature)\s*:\s*`)

// CleanLabels turns an issue's labels into tags: housekeeping labels
// dropped, grouping prefixes stripped, normalized like a nugget's tags, no
// repeats.
func CleanLabels(raw []string) []string {
	out := []string{}
	for _, l := range raw {
		l = strings.TrimSpace(l)
		if l == "" || housekeeping.MatchString(l) {
			continue
		}
		tag := idea.NormalizeTag(labelPrefix.ReplaceAllString(l, ""))
		if tag != "" && !slices.Contains(out, tag) {
			out = append(out, tag)
		}
	}
	return out
}

// GH runs the gh CLI and returns its stdout.
type GH func(ctx context.Context, args ...string) ([]byte, error)

// RunGH is the real gh.
func RunGH(ctx context.Context, args ...string) ([]byte, error) {
	out, err := exec.CommandContext(ctx, "gh", args...).Output()
	if ee, ok := err.(*exec.ExitError); ok {
		return nil, fmt.Errorf("gh %s: %w: %s", strings.Join(args, " "), err, ee.Stderr)
	}
	return out, err
}

type ghLabel struct {
	Name string `json:"name"`
}

type ghIssue struct {
	Number      int       `json:"number"`
	Title       string    `json:"title"`
	Body        string    `json:"body"`
	Labels      []ghLabel `json:"labels"`
	UpdatedAt   time.Time `json:"updated_at"`
	PullRequest *struct{} `json:"pull_request,omitempty"`
}

// maxNotes keeps an issue body near the size of a nugget's notes.
const maxNotes = 600

// maxPages bounds how far back a repo's issues are read.
const maxPages = 20

// GitHubData is the cached stand-in dataset (tagbench-data/github.json).
type GitHubData struct {
	FetchedAt time.Time  `json:"fetched_at"`
	Repos     []RepoInfo `json:"repos"`
	Issues    []Item     `json:"issues"`
}

// RepoInfo is what was kept from one repo.
type RepoInfo struct {
	RepoSpec
	Issues int `json:"issues"`
	Labels int `json:"labels"`
	// MultiLabel counts the kept issues with two or more topical labels:
	// the ones the hidden-tag task can use.
	MultiLabel int `json:"multi_label"`
}

// Fetch reads issues and their labels through gh: up to maxPages pages per
// repo (open and closed, pull requests skipped), keeping the Take issues
// with the most topical labels — two or more first, most recently updated
// first within a count. Issues with no topical label are dropped. progress,
// if set, hears about each repo.
func Fetch(ctx context.Context, gh GH, repos []RepoSpec, progress func(string)) (GitHubData, error) {
	data := GitHubData{FetchedAt: time.Now().UTC()}
	for _, spec := range repos {
		var all []ghIssue
		for page := 1; page <= maxPages; page++ {
			args := []string{"api", "-X", "GET", "repos/" + spec.Name + "/issues", "-f", "state=all", "-f", "per_page=100", "-f", "page=" + strconv.Itoa(page)}
			if spec.Filter != "" {
				args = append(args, "-f", "labels="+spec.Filter)
			}
			out, err := gh(ctx, args...)
			if err != nil {
				return GitHubData{}, err
			}
			var batch []ghIssue
			if err := json.Unmarshal(out, &batch); err != nil {
				return GitHubData{}, fmt.Errorf("decoding %s page %d: %w", spec.Name, page, err)
			}
			all = append(all, batch...)
			if len(batch) < 100 {
				break
			}
		}
		var kept []Item
		for _, is := range all {
			if is.PullRequest != nil {
				continue
			}
			raw := make([]string, len(is.Labels))
			for i, l := range is.Labels {
				raw[i] = l.Name
			}
			tags := CleanLabels(raw)
			if len(tags) == 0 {
				continue
			}
			slices.Sort(tags)
			notes := strings.TrimSpace(is.Body)
			if r := []rune(notes); len(r) > maxNotes {
				notes = string(r[:maxNotes]) + "…"
			}
			kept = append(kept, Item{
				ID: fmt.Sprintf("%s#%d", spec.Name, is.Number), Dataset: DatasetGitHub, Group: spec.Name,
				Title: strings.TrimSpace(is.Title), Notes: notes, Tags: tags, UpdatedAt: is.UpdatedAt, Padding: spec.Padding,
			})
		}
		slices.SortStableFunc(kept, func(a, b Item) int {
			if c := min(len(b.Tags), 2) - min(len(a.Tags), 2); c != 0 {
				return c
			}
			return b.UpdatedAt.Compare(a.UpdatedAt)
		})
		if len(kept) > spec.Take {
			kept = kept[:spec.Take]
		}
		info := RepoInfo{RepoSpec: spec, Issues: len(kept)}
		labels := map[string]bool{}
		for _, it := range kept {
			for _, t := range it.Tags {
				labels[t] = true
			}
			if len(it.Tags) >= 2 {
				info.MultiLabel++
			}
		}
		info.Labels = len(labels)
		data.Repos = append(data.Repos, info)
		data.Issues = append(data.Issues, kept...)
		if progress != nil {
			progress(fmt.Sprintf("%s: %d issues (%d with 2+ labels), %d labels", spec.Name, info.Issues, info.MultiLabel, info.Labels))
		}
	}
	// Synthetic nugget ids, so examples can leave out the item itself.
	for i := range data.Issues {
		data.Issues[i].NuggetID = int64(i + 1)
	}
	return data, nil
}
