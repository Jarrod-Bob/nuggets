// Command tagbench benchmarks TypeSafe's Jev against Claude on the tag
// suggestion task (issue #40). It is a developer tool, not part of the app.
// Design: docs/superpowers/specs/2026-10-09-tagbench-design.md.
//
//	tagbench fetch                  # cache the GitHub stand-in (free, uses gh)
//	tagbench run -dry-run           # forecast tokens and cost, call nothing
//	tagbench run                    # the benchmark (spends up to -max-usd)
//	tagbench judge                  # judge pooled bank suggestions, blind
//	tagbench report                 # Markdown tables + a JSON summary
//
// Jev's key is read, read-only, from the nuggets database. Claude's
// credentials come from the Anthropic SDK's standard resolution
// (ANTHROPIC_API_KEY, or an `ant auth login` profile).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/tagbench"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	var err error
	switch os.Args[1] {
	case "fetch":
		err = fetch(ctx, os.Args[2:])
	case "run":
		err = run(ctx, os.Args[2:])
	case "judge":
		err = judge(os.Args[2:])
	case "report":
		err = report(os.Args[2:])
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "tagbench:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: tagbench fetch|run|judge|report [flags]   (tagbench <command> -h for flags)")
	os.Exit(2)
}

const githubFile = "github.json"

func fetch(ctx context.Context, args []string) error {
	fl := flag.NewFlagSet("fetch", flag.ExitOnError)
	dataDir := fl.String("data", "tagbench-data", "folder for cached data and results (gitignored)")
	fl.Parse(args)
	data, err := tagbench.Fetch(ctx, tagbench.RunGH, tagbench.DefaultRepos, func(line string) { fmt.Fprintln(os.Stderr, line) })
	if err != nil {
		return err
	}
	path := filepath.Join(*dataDir, githubFile)
	if err := writeJSON(path, data); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "wrote %d issues to %s\n", len(data.Issues), path)
	return nil
}

func run(ctx context.Context, args []string) error {
	fl := flag.NewFlagSet("run", flag.ExitOnError)
	dbPath := fl.String("db", "", "nuggets database, opened read-only (default: the app's)")
	dataDir := fl.String("data", "tagbench-data", "folder for cached data and results (gitignored)")
	contenderList := fl.String("contenders", strings.Join(tagbench.PhaseOne, ","), "comma-separated: jev, claude:<model>:<low|medium|high|xhigh|max|nothink>")
	datasets := fl.String("datasets", "bank,github", "comma-separated: bank, github")
	tasks := fl.String("tasks", "hidden,open,scale", "comma-separated: hidden, open, scale")
	repeats := fl.Int("repeats", 3, "times each case is asked, for stability")
	maxUSD := fl.Float64("max-usd", 2.00, "spend cap in dollars; the run stops cleanly before crossing it")
	limit := fl.Int("limit", 0, "cap on cases (before repeats), sampled; 0 = all")
	seed := fl.Uint64("seed", 1, "seed for sampling and hiding")
	maxHidden := fl.Int("max-hidden", 120, "cap on hidden-tag cases per dataset")
	maxOpen := fl.Int("max-open", 120, "cap on open-suggestion cases per dataset")
	scaleItems := fl.Int("scale-items", 10, "GitHub hidden-tag cases re-asked at each vocabulary size")
	scaleSizes := fl.String("scale-sizes", "10,50,200", "vocabulary sizes for the scaling task")
	concurrency := fl.Int("concurrency", 4, "checks in flight at once")
	rps := fl.Float64("rps", 4, "most calls per second per contender")
	dryRun := fl.Bool("dry-run", false, "forecast tokens and cost; call nothing")
	countTokens := fl.Bool("count-tokens", false, "with -dry-run: count Claude input tokens with Anthropic's count_tokens endpoint (a free call) instead of chars/4")
	fl.Parse(args)

	sizes, err := ints(*scaleSizes)
	if err != nil {
		return fmt.Errorf("-scale-sizes: %w", err)
	}
	specs := split(*contenderList)
	wantDS, wantTasks := split(*datasets), split(*tasks)

	path := *dbPath
	if path == "" {
		if path, err = db.DefaultPath(); err != nil {
			return err
		}
	}
	var items []tagbench.Item
	needDB := slices.Contains(wantDS, tagbench.DatasetBank) || (slices.Contains(specs, "jev") && !*dryRun)
	var jevKey string
	if needDB {
		database, err := db.OpenReadOnly(path)
		if err != nil {
			return err
		}
		defer database.Close()
		if slices.Contains(wantDS, tagbench.DatasetBank) {
			bank, err := tagbench.LoadBank(ctx, database)
			if err != nil {
				return err
			}
			items = append(items, bank...)
		}
		if slices.Contains(specs, "jev") && !*dryRun {
			if jevKey, err = tagbench.JevKey(ctx, database); err != nil {
				return err
			}
			if jevKey == "" {
				return errors.New("no TypeSafe key in the nuggets settings; connect Tag suggestions in the app first")
			}
		}
	}
	if slices.Contains(wantDS, tagbench.DatasetGitHub) {
		var gh tagbench.GitHubData
		if err := readJSON(filepath.Join(*dataDir, githubFile), &gh); err != nil {
			return fmt.Errorf("%w (run `tagbench fetch` first)", err)
		}
		items = append(items, gh.Issues...)
	}

	cases := tagbench.BuildCases(items, tagbench.CaseOptions{Seed: *seed, Repeats: *repeats, MaxHidden: *maxHidden, MaxOpen: *maxOpen,
		ScaleItems: *scaleItems, ScaleSizes: sizes, Tasks: wantTasks, Limit: *limit})

	ep := tagbench.Endpoints{JevKey: jevKey}
	var contenders []tagbench.Contender
	for _, s := range specs {
		c, err := tagbench.ParseContender(s, ep)
		if err != nil {
			return err
		}
		contenders = append(contenders, c)
	}
	printCaseCounts(cases)

	if *dryRun {
		est, err := tagbench.EstimateRun(ctx, cases, contenders, *countTokens)
		if err != nil {
			return err
		}
		fmt.Println("Dry run: no model was called.")
		fmt.Println()
		fmt.Println("| Contender | Checks | Input tokens | Output tokens | Est. cost | Input counted by |")
		fmt.Println("|---|---|---|---|---|---|")
		for _, c := range est.Contenders {
			fmt.Printf("| %s | %d | %d | %d | $%.4f | %s |\n", c.Name, c.Checks, c.InputTokens, c.OutputTokens, c.USD, c.Method)
		}
		fmt.Printf("\nEstimated total: $%.4f (cap $%.2f). Output assumes a thinking allowance per effort (low: 400 tokens); the heuristic is chars/4.\n", est.TotalUSD, *maxUSD)
		fmt.Printf("Worst case if every check used its full max_tokens: $%.2f. The cap stops the run before crossing $%.2f either way.\n", est.WorstUSD, *maxUSD)
		return nil
	}

	runOpt := tagbench.RunOptions{MaxUSD: *maxUSD, Concurrency: *concurrency,
		Progress: func(done, total int, spent float64) {
			if done%25 == 0 || done == total {
				fmt.Fprintf(os.Stderr, "%d/%d checks, $%.4f spent\n", done, total, spent)
			}
		}}
	if *rps > 0 {
		runOpt.MinInterval = time.Duration(float64(time.Second) / *rps)
	}
	started := time.Now().UTC()
	res := tagbench.Run(ctx, cases, contenders, runOpt)

	results := tagbench.Results{
		StartedAt: started, FinishedAt: time.Now().UTC(), Stopped: res.Stopped, SpentUSD: res.SpentUSD,
		Contenders: specs, Prices: tagbench.Prices, Items: map[string]tagbench.Item{}, Records: res.Records,
		Summary: tagbench.Summarize(res.Records, nil),
		Options: map[string]any{"datasets": wantDS, "tasks": wantTasks, "repeats": *repeats, "max_usd": *maxUSD, "limit": *limit,
			"seed": *seed, "max_hidden": *maxHidden, "max_open": *maxOpen, "scale_items": *scaleItems, "scale_sizes": sizes,
			"concurrency": *concurrency, "rps": *rps},
	}
	for _, c := range cases {
		results.Items[c.Item.ID] = c.Item
	}
	// Bank items not in any case still help the judge show a tag's carriers.
	for _, it := range items {
		if it.Dataset == tagbench.DatasetBank {
			results.Items[it.ID] = it
		}
	}
	out := filepath.Join(*dataDir, "results-"+started.Format("20060102T150405Z")+".json")
	if err := writeJSON(out, results); err != nil {
		return err
	}
	if res.Stopped != "" {
		fmt.Fprintln(os.Stderr, "stopped early:", res.Stopped)
	}
	fmt.Fprintf(os.Stderr, "%d checks, $%.4f spent; wrote %s\n", len(res.Records), res.SpentUSD, out)
	return nil
}

func judge(args []string) error {
	fl := flag.NewFlagSet("judge", flag.ExitOnError)
	dataDir := fl.String("data", "tagbench-data", "folder for cached data and results")
	resultsPath := fl.String("results", "", "results file (default: the latest in -data)")
	judgmentsPath := fl.String("judgments", "", "judgments file (default: judgments.json in -data)")
	fl.Parse(args)
	results, err := loadResults(*dataDir, *resultsPath)
	if err != nil {
		return err
	}
	jp := *judgmentsPath
	if jp == "" {
		jp = filepath.Join(*dataDir, "judgments.json")
	}
	j, err := loadJudgments(jp)
	if err != nil {
		return err
	}
	bank := map[string]tagbench.Item{}
	for id, it := range results.Items {
		if it.Dataset == tagbench.DatasetBank {
			bank[id] = it
		}
	}
	save := func(j tagbench.Judgments) error { return writeJSON(jp, j) }
	n, err := tagbench.Judge(os.Stdin, os.Stdout, tagbench.Pool(results.Records), bank, j, save, 1)
	fmt.Fprintf(os.Stderr, "recorded %d judgments in %s\n", n, jp)
	return err
}

func report(args []string) error {
	fl := flag.NewFlagSet("report", flag.ExitOnError)
	dataDir := fl.String("data", "tagbench-data", "folder for cached data and results")
	resultsPath := fl.String("results", "", "results file (default: the latest in -data)")
	judgmentsPath := fl.String("judgments", "", "judgments file (default: judgments.json in -data)")
	jsonOut := fl.String("json", "", "where to write the JSON summary (default: <results>.summary.json)")
	fl.Parse(args)
	path := *resultsPath
	if path == "" {
		var err error
		if path, err = latestResults(*dataDir); err != nil {
			return err
		}
	}
	results, err := loadResults(*dataDir, path)
	if err != nil {
		return err
	}
	jp := *judgmentsPath
	if jp == "" {
		jp = filepath.Join(*dataDir, "judgments.json")
	}
	j, err := loadJudgments(jp)
	if err != nil {
		return err
	}
	summary := tagbench.Summarize(results.Records, j)
	fmt.Printf("# tagbench: %s\n\n", filepath.Base(path))
	fmt.Printf("%d checks, $%.4f spent, contenders %s.", len(results.Records), results.SpentUSD, strings.Join(results.Contenders, ", "))
	if results.Stopped != "" {
		fmt.Printf(" Stopped early: %s.", results.Stopped)
	}
	fmt.Printf(" %d bank judgments.\n\n", len(j))
	tagbench.WriteReport(os.Stdout, summary)
	out := *jsonOut
	if out == "" {
		out = strings.TrimSuffix(path, ".json") + ".summary.json"
	}
	if err := writeJSON(out, summary); err != nil {
		return err
	}
	fmt.Fprintln(os.Stderr, "wrote", out)
	return nil
}

func printCaseCounts(cases []tagbench.Case) {
	counts := map[string]int{}
	for _, c := range cases {
		counts[c.Dataset+"/"+c.Task]++
	}
	var parts []string
	for _, k := range slices.Sorted(func(yield func(string) bool) {
		for k := range counts {
			if !yield(k) {
				return
			}
		}
	}) {
		parts = append(parts, fmt.Sprintf("%s %d", k, counts[k]))
	}
	fmt.Fprintf(os.Stderr, "%d checks per contender (repeats included): %s\n", len(cases), strings.Join(parts, ", "))
}

func latestResults(dir string) (string, error) {
	matches, err := filepath.Glob(filepath.Join(dir, "results-*.json"))
	if err != nil {
		return "", err
	}
	matches = slices.DeleteFunc(matches, func(m string) bool { return strings.HasSuffix(m, ".summary.json") })
	if len(matches) == 0 {
		return "", fmt.Errorf("no results in %s (run `tagbench run` first)", dir)
	}
	slices.Sort(matches)
	return matches[len(matches)-1], nil
}

func loadResults(dir, path string) (tagbench.Results, error) {
	if path == "" {
		var err error
		if path, err = latestResults(dir); err != nil {
			return tagbench.Results{}, err
		}
	}
	var r tagbench.Results
	return r, readJSON(path, &r)
}

func loadJudgments(path string) (tagbench.Judgments, error) {
	j := tagbench.Judgments{}
	if err := readJSON(path, &j); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	return j, nil
}

func readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// writeJSON writes through a temporary file, so an interrupted write never
// leaves half a file (the judge saves after every answer).
func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func split(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func ints(s string) ([]int, error) {
	var out []int
	for _, p := range split(s) {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}
