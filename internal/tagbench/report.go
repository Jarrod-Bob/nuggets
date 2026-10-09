package tagbench

import (
	"context"
	"fmt"
	"io"
	"maps"
	"slices"
	"time"
)

// Results is a run's results file: the raw records, the items they came
// from (for judging), and the summary without judgments.
type Results struct {
	StartedAt  time.Time        `json:"started_at"`
	FinishedAt time.Time        `json:"finished_at"`
	Options    map[string]any   `json:"options"`
	Contenders []string         `json:"contenders"`
	Prices     map[string]Price `json:"prices"`
	Stopped    string           `json:"stopped,omitempty"`
	SpentUSD   float64          `json:"spent_usd"`
	Items      map[string]Item  `json:"items"`
	Records    []Record         `json:"records"`
	Summary    Summary          `json:"summary"`
}

var datasetTitles = map[string]string{DatasetBank: "Real bank", DatasetGitHub: "GitHub stand-in"}

// WriteReport writes the summary as Markdown tables.
func WriteReport(w io.Writer, s Summary) {
	for _, ds := range slices.Sorted(maps.Keys(s.Datasets)) {
		title := datasetTitles[ds]
		if title == "" {
			title = ds
		}
		fmt.Fprintf(w, "## %s\n\n", title)
		fmt.Fprintf(w, "Quality at threshold %.2f, top %d. Hidden-tag precision counts suggestions of known truth; on the bank that means judged ones.\n\n", Threshold, TopK)
		fmt.Fprintln(w, "| Contender | Checks | Recall@3 | Precision@3 | F1 | Hit@1 / Hit@3 (rank) | Open precision@3 (judged/suggested) | Best threshold | Brier | Top-3 change rate | p50 / p95 ms | $/check | $/1k checks | $/correct | Malformed / refused / errored per 100 |")
		fmt.Fprintln(w, "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
		byName := s.Datasets[ds]
		for _, name := range slices.Sorted(maps.Keys(byName)) {
			c := byName[name]
			fmt.Fprintf(w, "| %s | %d | %.3f | %.3f | %.3f | %.2f / %.2f | %.3f (%d/%d) | %.2f (F1 %.3f) | %.3f | %.2f (%d cases) | %.0f / %.0f | $%.6f | $%.3f | $%.6f | %.1f / %.1f / %.1f |\n",
				name, c.Checks, c.Hidden.RecallAt3, c.Hidden.PrecisionAt3, c.Hidden.F1, c.Hidden.HitAt1, c.Hidden.HitAt3,
				c.Open.PrecisionAt3, c.Open.Judged, c.Open.Suggestions, c.BestThreshold.Threshold, c.BestThreshold.F1,
				c.Brier, c.TopSetChangeRate, c.StabilityCases, c.LatencyP50MS, c.LatencyP95MS,
				c.CostPerCheck, c.CostPer1000, c.CostPerCorrect, c.MalformedPer100, c.RefusedPer100, c.ErroredPer100)
		}
		fmt.Fprintln(w)
	}
	if len(s.Scaling) == 0 {
		return
	}
	fmt.Fprintln(w, "## Scaling")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "| Contender | Vocabulary | Checks | Recall@3 | p50 / p95 ms | Input tokens | Output tokens | $/check | Errored per 100 |")
	fmt.Fprintln(w, "|---|---|---|---|---|---|---|---|---|")
	for _, name := range slices.Sorted(maps.Keys(s.Scaling)) {
		for _, size := range slices.Sorted(maps.Keys(s.Scaling[name])) {
			p := s.Scaling[name][size]
			fmt.Fprintf(w, "| %s | %d | %d | %.3f | %.0f / %.0f | %.0f | %.0f | $%.6f | %.1f |\n",
				name, size, p.Checks, p.RecallAt3, p.LatencyP50MS, p.LatencyP95MS, p.MeanInputTokens, p.MeanOutputTokens, p.CostPerCheck, p.ErroredPer100)
		}
	}
	fmt.Fprintln(w)
}

// RunEstimate is a dry run's forecast.
type RunEstimate struct {
	Contenders []ContenderEstimate `json:"contenders"`
	TotalUSD   float64             `json:"total_usd"`
	// WorstUSD is what the spend cap would reserve for every check at once.
	WorstUSD float64 `json:"worst_usd"`
}

// ContenderEstimate is one contender's share of a dry run.
type ContenderEstimate struct {
	Name         string  `json:"name"`
	Checks       int     `json:"checks"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
	USD          float64 `json:"usd"`
	Method       string  `json:"method"`
}

// EstimateRun forecasts a run's tokens and cost without calling any model.
// With countTokens, contenders that can (Claude) count input tokens through
// their provider's free counting endpoint instead of the chars/4 heuristic,
// once per case key.
func EstimateRun(ctx context.Context, cases []Case, contenders []Contender, countTokens bool) (RunEstimate, error) {
	var est RunEstimate
	for _, c := range contenders {
		ce := ContenderEstimate{Name: c.Name(), Method: "chars/4 heuristic"}
		counter, canCount := c.(TokenCounter)
		counted := map[string]int64{}
		for _, cs := range cases {
			e := c.Estimate(cs.Input)
			in := e.InputTokens
			if countTokens && canCount {
				n, ok := counted[cs.Key]
				if !ok {
					var err error
					if n, err = counter.CountInputTokens(ctx, cs.Input); err != nil {
						return RunEstimate{}, fmt.Errorf("%s: counting tokens: %w", c.Name(), err)
					}
					counted[cs.Key] = n
				}
				in, ce.Method = n, "count_tokens"
			}
			ce.Checks++
			ce.InputTokens += in
			ce.OutputTokens += e.OutputTokens
			est.WorstUSD += c.Price().Cost(e.WorstInputTokens, e.WorstOutputTokens)
		}
		ce.USD = c.Price().Cost(ce.InputTokens, ce.OutputTokens)
		est.TotalUSD += ce.USD
		est.Contenders = append(est.Contenders, ce)
	}
	return est, nil
}
