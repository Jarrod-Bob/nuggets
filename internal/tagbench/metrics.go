package tagbench

import (
	"math"
	"slices"
	"sort"
	"strings"
)

// Summary is every metric, by dataset and contender, plus the scaling table.
// It is the JSON a chart is drawn from.
type Summary struct {
	Datasets map[string]map[string]*ContenderSummary `json:"datasets"`
	// Scaling is by contender, then vocabulary size.
	Scaling map[string]map[int]*ScalePoint `json:"scaling"`
}

// ContenderSummary is one contender on one dataset. Quality metrics count
// only checks that answered (outcome ok); cost and failure rates count every
// check.
type ContenderSummary struct {
	Hidden HiddenQuality `json:"hidden"`
	Open   OpenQuality   `json:"open"`

	Sweep         []SweepPoint `json:"sweep"`
	BestThreshold SweepPoint   `json:"best_threshold"`

	Reliability  []Bin   `json:"reliability"`
	Brier        float64 `json:"brier"`
	CalibrationN int     `json:"calibration_n"`

	StabilityCases   int     `json:"stability_cases"`
	TopSetChangeRate float64 `json:"top_set_change_rate"`

	Checks           int     `json:"checks"`
	LatencyP50MS     float64 `json:"latency_p50_ms"`
	LatencyP95MS     float64 `json:"latency_p95_ms"`
	MeanInputTokens  float64 `json:"mean_input_tokens"`
	MeanOutputTokens float64 `json:"mean_output_tokens"`
	TotalCostUSD     float64 `json:"total_cost_usd"`
	CostPerCheck     float64 `json:"cost_per_check_usd"`
	CostPer1000      float64 `json:"cost_per_1000_checks_usd"`
	// CostPerCorrect is the total cost over the suggestions known to be
	// right at the threshold, both tasks together; 0 when none were.
	CostPerCorrect  float64 `json:"cost_per_correct_suggestion_usd"`
	MalformedPer100 float64 `json:"malformed_per_100"`
	RefusedPer100   float64 `json:"refused_per_100"`
	ErroredPer100   float64 `json:"errored_per_100"`
}

// HiddenQuality is the hidden-tag task at the threshold, and by rank.
type HiddenQuality struct {
	Cases        int     `json:"cases"`
	RecallAt3    float64 `json:"recall_at_3"`
	PrecisionAt3 float64 `json:"precision_at_3"`
	F1           float64 `json:"f1"`
	Suggestions  int     `json:"suggestions"`
	Judged       int     `json:"judged"`
	HitAt1       float64 `json:"hit_at_1"`
	HitAt3       float64 `json:"hit_at_3"`
	MeanRank     float64 `json:"mean_rank"`
}

// OpenQuality is the open-suggestion task at the threshold. Precision counts
// only suggestions whose truth is known: every one on GitHub data, the
// judged ones on the bank.
type OpenQuality struct {
	Cases        int     `json:"cases"`
	Suggestions  int     `json:"suggestions"`
	Judged       int     `json:"judged"`
	PrecisionAt3 float64 `json:"precision_at_3"`
	// PerCheck is the mean number of suggestions. On GitHub data every one
	// is wrong by construction (the item's labels are all already on it),
	// so this is the false-positive rate there.
	PerCheck float64 `json:"suggestions_per_check"`
}

// SweepPoint is the hidden-tag task's precision and recall at one threshold.
type SweepPoint struct {
	Threshold float64 `json:"threshold"`
	Precision float64 `json:"precision"`
	Recall    float64 `json:"recall"`
	F1        float64 `json:"f1"`
}

// Bin is one tenth of the score range in the reliability curve.
type Bin struct {
	Low           float64 `json:"low"`
	N             int     `json:"n"`
	MeanPredicted float64 `json:"mean_predicted"`
	Observed      float64 `json:"observed"`
}

// ScalePoint is one contender at one vocabulary size.
type ScalePoint struct {
	Checks           int     `json:"checks"`
	RecallAt3        float64 `json:"recall_at_3"`
	LatencyP50MS     float64 `json:"latency_p50_ms"`
	LatencyP95MS     float64 `json:"latency_p95_ms"`
	MeanInputTokens  float64 `json:"mean_input_tokens"`
	MeanOutputTokens float64 `json:"mean_output_tokens"`
	CostPerCheck     float64 `json:"cost_per_check_usd"`
	MalformedPer100  float64 `json:"malformed_per_100"`
	RefusedPer100    float64 `json:"refused_per_100"`
	ErroredPer100    float64 `json:"errored_per_100"`
}

// truth says whether tag is right for the record's item, and whether that
// is known. The hidden tag and the item's own tags are right. On GitHub
// data the labels are the whole truth; on the bank anything else is known
// only once judged (a skip stays unknown).
func truth(r Record, tag string, j Judgments) (correct, known bool) {
	if tag == r.Hidden || slices.Contains(r.ItemTags, tag) {
		return true, true
	}
	if r.Dataset == DatasetGitHub {
		return false, true
	}
	switch v, _ := j.Get(r.ItemID, tag); v {
	case VerdictYes:
		return true, true
	case VerdictNo:
		return false, true
	}
	return false, false
}

// Summarize computes every metric from the records and the bank judgments
// (nil when there are none yet).
func Summarize(records []Record, j Judgments) Summary {
	s := Summary{Datasets: map[string]map[string]*ContenderSummary{}, Scaling: map[string]map[int]*ScalePoint{}}
	type key struct{ dataset, contender string }
	groups := map[key][]Record{}
	scale := map[string]map[int][]Record{}
	for _, r := range records {
		if r.Task == TaskScale {
			if scale[r.Contender] == nil {
				scale[r.Contender] = map[int][]Record{}
			}
			scale[r.Contender][r.VocabSize] = append(scale[r.Contender][r.VocabSize], r)
			continue
		}
		k := key{r.Dataset, r.Contender}
		groups[k] = append(groups[k], r)
	}
	for k, rs := range groups {
		if s.Datasets[k.dataset] == nil {
			s.Datasets[k.dataset] = map[string]*ContenderSummary{}
		}
		s.Datasets[k.dataset][k.contender] = summarize(rs, j)
	}
	for c, bySize := range scale {
		s.Scaling[c] = map[int]*ScalePoint{}
		for size, rs := range bySize {
			s.Scaling[c][size] = scalePoint(rs)
		}
	}
	return s
}

func summarize(rs []Record, j Judgments) *ContenderSummary {
	cs := &ContenderSummary{}
	var hidden, ok []Record
	for _, r := range rs {
		if r.Outcome != OutcomeOK {
			continue
		}
		ok = append(ok, r)
		if r.Task == TaskHidden {
			hidden = append(hidden, r)
		}
	}

	// The hidden-tag task.
	h := atThreshold(hidden, Threshold, j)
	cs.Hidden = HiddenQuality{Cases: len(hidden), RecallAt3: h.recall, PrecisionAt3: h.precision, F1: f1(h.precision, h.recall),
		Suggestions: h.suggestions, Judged: h.judged}
	var hit1, hit3, rankSum int
	for _, r := range hidden {
		n := rank(r.Scores, r.Hidden)
		if n == 0 {
			n = len(r.Scores) + 1
		}
		rankSum += n
		if n <= 1 {
			hit1++
		}
		if n <= TopK {
			hit3++
		}
	}
	cs.Hidden.HitAt1 = ratio(hit1, len(hidden))
	cs.Hidden.HitAt3 = ratio(hit3, len(hidden))
	cs.Hidden.MeanRank = ratio(rankSum, len(hidden))

	// The open-suggestion task.
	var open []Record
	for _, r := range ok {
		if r.Task == TaskOpen {
			open = append(open, r)
		}
	}
	o := atThreshold(open, Threshold, j)
	cs.Open.Cases = len(open)
	cs.Open.PerCheck = ratio(o.suggestions, len(open))
	cs.Open.Suggestions, cs.Open.Judged, cs.Open.PrecisionAt3 = o.suggestions, o.judged, o.precision

	// The threshold sweep, on the hidden-tag task.
	for i := 1; i <= 19; i++ {
		t := float64(i) / 20
		m := atThreshold(hidden, t, j)
		p := SweepPoint{Threshold: t, Precision: m.precision, Recall: m.recall, F1: f1(m.precision, m.recall)}
		cs.Sweep = append(cs.Sweep, p)
		// Ties go to the higher threshold; no F1 at all, no best.
		if p.F1 > 0 && p.F1 >= cs.BestThreshold.F1 {
			cs.BestThreshold = p
		}
	}

	// Calibration: every candidate score whose truth is known.
	cs.Reliability = make([]Bin, 10)
	var predicted [10]float64
	var observed [10]int
	var brier float64
	for _, r := range ok {
		for tag, p := range r.Scores {
			correct, known := truth(r, tag, j)
			if !known {
				continue
			}
			y := 0.0
			if correct {
				y = 1
			}
			brier += (p - y) * (p - y)
			cs.CalibrationN++
			b := min(int(p*10), 9)
			cs.Reliability[b].N++
			predicted[b] += p
			observed[b] += int(y)
		}
	}
	for b := range cs.Reliability {
		cs.Reliability[b].Low = float64(b) / 10
		if n := cs.Reliability[b].N; n > 0 {
			cs.Reliability[b].MeanPredicted = predicted[b] / float64(n)
			cs.Reliability[b].Observed = float64(observed[b]) / float64(n)
		}
	}
	if cs.CalibrationN > 0 {
		cs.Brier = brier / float64(cs.CalibrationN)
	}

	// Stability: does the suggested set change across repeats of a case?
	byCase := map[string][]Record{}
	for _, r := range ok {
		byCase[r.CaseKey] = append(byCase[r.CaseKey], r)
	}
	changed := 0
	for _, reps := range byCase {
		if len(reps) < 2 {
			continue
		}
		cs.StabilityCases++
		first := setKey(Top(reps[0].Scores, Threshold))
		for _, r := range reps[1:] {
			if setKey(Top(r.Scores, Threshold)) != first {
				changed++
				break
			}
		}
	}
	cs.TopSetChangeRate = ratio(changed, cs.StabilityCases)

	// Latency, tokens, cost and failures.
	cs.Checks = len(rs)
	var latencies []float64
	var in, out int64
	for _, r := range rs {
		cs.TotalCostUSD += r.CostUSD
		in += r.InputTokens
		out += r.OutputTokens
		if r.Outcome == OutcomeOK {
			latencies = append(latencies, r.LatencyMS)
		}
	}
	cs.LatencyP50MS = percentile(latencies, 50)
	cs.LatencyP95MS = percentile(latencies, 95)
	cs.MeanInputTokens = ratio64(float64(in), len(rs))
	cs.MeanOutputTokens = ratio64(float64(out), len(rs))
	cs.CostPerCheck = ratio64(cs.TotalCostUSD, len(rs))
	cs.CostPer1000 = cs.CostPerCheck * 1000
	if correct := h.correct + o.correct; correct > 0 {
		cs.CostPerCorrect = cs.TotalCostUSD / float64(correct)
	}
	cs.MalformedPer100, cs.RefusedPer100, cs.ErroredPer100 = failuresPer100(rs)
	return cs
}

type thresholdMetrics struct {
	suggestions, judged, correct int
	precision, recall            float64
}

// atThreshold counts what production would suggest at t across records:
// recall is the share of records whose hidden tag is suggested, precision
// the share of known suggestions that are right.
func atThreshold(rs []Record, t float64, j Judgments) thresholdMetrics {
	var m thresholdMetrics
	hits := 0
	for _, r := range rs {
		top := Top(r.Scores, t)
		if r.Hidden != "" && slices.Contains(top, r.Hidden) {
			hits++
		}
		for _, tag := range top {
			m.suggestions++
			correct, known := truth(r, tag, j)
			if !known {
				continue
			}
			m.judged++
			if correct {
				m.correct++
			}
		}
	}
	m.recall = ratio(hits, len(rs))
	m.precision = ratio(m.correct, m.judged)
	return m
}

func scalePoint(rs []Record) *ScalePoint {
	p := &ScalePoint{Checks: len(rs)}
	var latencies []float64
	var in, out int64
	var cost float64
	var answered, hits int
	for _, r := range rs {
		in += r.InputTokens
		out += r.OutputTokens
		cost += r.CostUSD
		if r.Outcome != OutcomeOK {
			continue
		}
		answered++
		latencies = append(latencies, r.LatencyMS)
		if slices.Contains(Top(r.Scores, Threshold), r.Hidden) {
			hits++
		}
	}
	p.RecallAt3 = ratio(hits, answered)
	p.LatencyP50MS = percentile(latencies, 50)
	p.LatencyP95MS = percentile(latencies, 95)
	p.MeanInputTokens = ratio64(float64(in), len(rs))
	p.MeanOutputTokens = ratio64(float64(out), len(rs))
	p.CostPerCheck = ratio64(cost, len(rs))
	p.MalformedPer100, p.RefusedPer100, p.ErroredPer100 = failuresPer100(rs)
	return p
}

// failuresPer100 counts malformed, refused and errored checks per 100.
func failuresPer100(rs []Record) (malformed, refused, errored float64) {
	var m, f, e int
	for _, r := range rs {
		switch r.Outcome {
		case OutcomeOK:
		case OutcomeMalformed:
			m++
		case OutcomeRefused:
			f++
		default:
			e++
		}
	}
	return 100 * ratio(m, len(rs)), 100 * ratio(f, len(rs)), 100 * ratio(e, len(rs))
}

func f1(p, r float64) float64 {
	if p+r == 0 {
		return 0
	}
	return 2 * p * r / (p + r)
}

func ratio(n, d int) float64 { return ratio64(float64(n), d) }

func ratio64(n float64, d int) float64 {
	if d == 0 {
		return 0
	}
	return n / float64(d)
}

// percentile is the nearest-rank percentile; 0 for no values.
func percentile(values []float64, pct float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := slices.Clone(values)
	sort.Float64s(sorted)
	i := int(math.Ceil(pct/100*float64(len(sorted)))) - 1
	return sorted[max(i, 0)]
}

func setKey(tags []string) string {
	sorted := slices.Clone(tags)
	slices.Sort(sorted)
	return strings.Join(sorted, "\x00")
}
