# Tag suggestions: Jev vs Claude

**Date:** 2026-10-09
**Issue:** [#40](https://github.com/Jarrod-Bob/nuggets/issues/40), branch `feat/tagbench`. The feature it measures is [#25](https://github.com/Jarrod-Bob/nuggets/issues/25).
**Design:** [`2026-10-09-tagbench-design.md`](../../superpowers/specs/2026-10-09-tagbench-design.md)
**Measured:**
- `jev-latest`, which is `jev-1.13.0`;
- `claude-haiku-5-5` at `effort: low` with adaptive thinking;
- `claude-haiku-5-5` with thinking off.

Jev was asked exactly what production asks: one noul per candidate tag, with up to 3 example titles. Each Claude model got one call per check, with the same state and examples, and a structured-output answer of `{tag, applies, confidence}` per candidate. Phase 1 compared Jev with Haiku only, to keep the spend small. Sonnet 5.5 and Opus 5.5 are supported but not yet run.

## Summary

- **Jev is about 10× faster.** p50 is 254 ms against 2.6–2.7 s for Haiku. At 200 tags it's 1.25 s against 15–20 s.
- **Jev is 3–4× cheaper.** That holds per check ($0.13 per 1,000 against $0.43–0.44) and per correct suggestion.
- **Quality is at least level.**
  - On the GitHub stand-in, Jev finds more hidden tags (recall@3 0.48 against 0.37–0.39).
  - Haiku at low effort is a little more precise (0.69 against 0.61).
  - At each model's own best threshold, Jev and Haiku at low effort tie on F1 (0.534 against 0.531).
- **Jev's best threshold is 0.70**, the one the feature ships with. Haiku's best is 0.45–0.55, so a Claude version would need its own tuning.
- **Jev holds up as the vocabulary grows.** Its recall stays at 0.50 from 10 to 200 tags. Haiku's falls (thinking off: 0.57 → 0.29), and 7–13% of its 200-tag answers left tags out.
- **Jev is steadier.** Its top 3 changed in 0–6% of repeated checks, against 16–29% for Haiku. Jev never returned a malformed answer; Haiku at low effort did 3–6 times per 100.
- **On the real bank, Jev was never wrong but rarely spoke.** Blind judging found all 3 of its open suggestions right, against 14 of 18 for Haiku at low effort and 20 of 41 for Haiku with thinking off. Haiku surfaces more genuinely missing tags, at the cost of more noise.
- **The whole run cost $1.15** for 2,682 checks, plus $0.02 of smoke tests.

## Data

- **Real bank.** The captain's nuggets database, read-only: 19 nuggets and 10 tags. Only 6 nuggets have two or more tags, so it gives 28 hidden-tag cases.
- **GitHub stand-in.** 300 feature requests and their topical labels from 4 apps whose requests read like product ideas: Joplin, KOReader, AntennaPod and FlorisBoard. Housekeeping labels (triage, status, priority and the like) were dropped. 158 of the requests carry two or more labels.
- **Scaling padding.** For the 200-tag vocabulary, labels from 4 more repos pad the candidate list: AppFlowy, Zed, Godot and VS Code.

Every case was asked 3 times.

## Results

### GitHub stand-in

720 checks per contender. Quality is measured at threshold 0.70, top 3.

| Contender | Recall@3 | Precision@3 | F1 | Best threshold (F1) | Wrong open suggestions per check | p50 / p95 | $ per 1k checks | $ per correct | Top 3 changed | Malformed per 100 |
|---|---|---|---|---|---|---|---|---|---|---|
| **Jev** | **0.475** | 0.609 | **0.534** | 0.70 (0.534) | 0.49 | **254 / 380 ms** | **$0.127** | **$0.00054** | **6%** | **0** |
| Haiku, low effort | 0.372 | **0.690** | 0.483 | 0.45 (0.531) | **0.32** | 2,734 / 3,967 ms | $0.442 | $0.00246 | 16% | 3.2 |
| Haiku, thinking off | 0.393 | 0.567 | 0.464 | 0.55 (0.501) | 0.46 | 2,624 / 3,139 ms | $0.426 | $0.00219 | 29% | 0.8 |

An issue's labels are all on it already, so any suggestion on an unaltered issue is wrong by construction. Read that column as a false-positive rate.

### Real bank

84 checks per contender (28 cases × 3). The open suggestions were judged blind by the captain: 102 pooled suggestions, 16 yes and 86 no.

| Contender | Hidden-tag recall@3 | Open suggestions made | Judged right | Open precision | Precision@3 (hidden + open) | Best threshold (F1) | p50 / p95 | $ per 1k checks | $ per correct | Top 3 changed | Malformed per 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Jev** | 0.667 | 3 | 3 | **1.00** | **1.000** | 0.60 (**0.902**) | **247 / 340 ms** | **$0.061** | **$0.00025** | **0%** | **0** |
| Haiku, low effort | 0.640 | 18 | 14 | 0.78 | 0.800 | 0.60 (0.772) | 2,105 / 3,218 ms | $0.221 | $0.00062 | 19% | 6.0 |
| Haiku, thinking off | **0.778** | 41 | **20** | 0.49 | 0.875 | 0.80 (0.833) | 2,028 / 2,179 ms | $0.207 | $0.00043 | 29% | 0 |

Counts include the 3 repeats of each case.

**Jev never suggested a wrong tag on the bank, but it suggested very little.** It made 3 open suggestions, all right. Haiku with thinking off found the most genuinely missing tags (20), but more than half of its 41 suggestions were wrong. Haiku at low effort sits between them: 14 right out of 18. On a bank this small and sparsely tagged, a 0.70 threshold makes Jev quiet. Its best threshold here was 0.60, so it's worth watching whether real use feels too sparse.

### Scaling

The same 10 GitHub hidden-tag cases, asked against vocabularies of 10, 50 and 200 tags. 30 checks per contender at each size.

| Contender | Vocabulary | Recall@3 | p50 / p95 | Input tokens | $ per check | Malformed per 100 |
|---|---|---|---|---|---|---|
| Jev | 10 | 0.500 | 251 / 413 ms | 1,842 | $0.000077 | 0 |
| Jev | 50 | 0.500 | 291 / 454 ms | 7,729 | $0.000325 | 0 |
| Jev | 200 | 0.500 | 1,254 / 1,541 ms | 31,523 | $0.001324 | 0 |
| Haiku, low effort | 10 | 0.467 | 2,222 / 2,988 ms | 1,324 | $0.000274 | 0 |
| Haiku, low effort | 50 | 0.433 | 6,689 / 8,037 ms | 4,043 | $0.001248 | 0 |
| Haiku, low effort | 200 | 0.423 | 19,900 / 22,903 ms | 14,890 | $0.004403 | 13.3 |
| Haiku, thinking off | 10 | 0.567 | 2,098 / 2,460 ms | 1,323 | $0.000265 | 0 |
| Haiku, thinking off | 50 | 0.367 | 4,809 / 6,709 ms | 4,042 | $0.001074 | 0 |
| Haiku, thinking off | 200 | 0.286 | 15,325 / 15,828 ms | 14,889 | $0.004202 | 6.7 |

Jev reads about twice as many input tokens as Haiku, because each tag's question carries the nugget again. It's still cheaper because its input costs $0.042 per million tokens, about 2.4× less than Haiku's $0.10, and its output is free.

## Found while building it

- **Claude's answer schema can't name every tag.** One required property per tag made a structured-output grammar that the API rejects from about 50 tags: "The compiled grammar is too large". The benchmark therefore asks for a list of `{tag, applies, confidence}` and checks coverage in code. A missing tag counts as malformed.
- **Claude's confidence is self-reported.** The API exposes no logprobs. Score is the stated confidence when a tag applies, and 1 − confidence when it doesn't. Jev's noul is a trained probability. Brier scores came out similar (GitHub: Jev 0.044, Haiku 0.038–0.047), but the thresholds behave differently (see the summary).

## Limits of these numbers

- **The real bank is tiny.** 28 hidden-tag cases and 62 open suggestions are enough to spot a gross failure or a clear lean, not to rank the models. The GitHub stand-in carries the comparison.
- **GitHub labels are an imperfect stand-in.** They are other projects' labels, applied by other people, and incomplete in the same way the captain's tags are. The stand-in's absolute numbers matter less than the gaps between contenders.
- **Only Haiku has been run.** Sonnet 5.5 and Opus 5.5 may well beat Jev on quality, at roughly 20–40× Haiku's cost per check. That's Phase 2.
- **Latency was measured from one machine,** with up to 8 checks in flight and at most 4 calls per second per contender. It includes network time to both APIs.
- **Prices are list prices** as of 2026-10-09: Jev $0.042 per million input tokens with free output; Haiku 5.5 $0.10 / $0.50.

## Rerun it

From the repo root. It spends real money: start with `-dry-run`. Jev's key is read from the nuggets database, and Claude's comes from `ANTHROPIC_API_KEY` or an `ant auth login` profile.

```sh
go run ./docs/benchmarks/tag-suggestions fetch             # cache the GitHub stand-in (free, uses gh)
go run ./docs/benchmarks/tag-suggestions run -dry-run      # forecast the cost
go run ./docs/benchmarks/tag-suggestions run               # Phase 1 contenders, capped at -max-usd 2
go run ./docs/benchmarks/tag-suggestions judge             # blind y/n on the bank's open suggestions
go run ./docs/benchmarks/tag-suggestions report            # Markdown tables for the latest results
```

Cached data and results go to `docs/benchmarks/tag-suggestions/data/`, which is gitignored. Add Sonnet or Opus with `-contenders jev,claude:claude-sonnet-5-5:low`.
