# nuggets — tagbench: Jev vs Claude on tag suggestions

**Date:** 2026-10-09
**Status:** Implemented
**Issue:** [#40](https://github.com/Jarrod-Bob/nuggets/issues/40)
**Builds on:** [`2026-10-09-jev-tag-suggestions-design.md`](2026-10-09-jev-tag-suggestions-design.md) (what a tag check asks Jev, the 0.7 threshold, the top 3).

Terms (**Nugget**, **Tag**, **Tag suggestion**, **Dismissed suggestion**) are defined in [`CONTEXT.md`](../../../CONTEXT.md).

## 1. Problem

Tag suggestions ask TypeSafe's Jev. We don't know how Jev compares with Claude on this exact task: quality, speed, tokens and cost. The developer command in [`docs/benchmarks/tag-suggestions/`](../../benchmarks/tag-suggestions/) (results in its README) that puts the same inputs to both and reports them side by side. It is not part of the app and never runs in tests.

## 2. Commands

| Command | What it does |
|---|---|
| `tagbench fetch` | Caches the GitHub stand-in (§4) in `docs/benchmarks/tag-suggestions/data/github.json`, through `gh`. Free. |
| `tagbench run` | Runs the benchmark and writes `docs/benchmarks/tag-suggestions/data/results-<timestamp>.json`: every raw check plus a summary without judgments. `-dry-run` calls nothing and prints a cost forecast. |
| `tagbench judge` | Asks the captain about each pooled bank suggestion (§6), blind and shuffled, saving to `docs/benchmarks/tag-suggestions/data/judgments.json` after every answer. Resumable. |
| `tagbench report` | Prints Markdown tables for a results file (the latest by default) with the judgments, and writes `<results>.summary.json` for charting. |

Run them from the repo root: `go run ./docs/benchmarks/tag-suggestions <command>`. `docs/benchmarks/tag-suggestions/data/` is gitignored.

## 3. Contenders

Every contender implements one interface (`tagbench.Contender`): given the nugget (title, notes, shown tags) and its candidate tags with their examples, it returns a score from 0 to 1 per candidate, plus latency and input and output tokens. Cost is computed from a price table in code (per million tokens):

| Model | Input | Output |
|---|---|---|
| `jev-latest` | $0.042 | free |
| `claude-haiku-5-5` | $0.10 | $0.50 |
| `claude-sonnet-5-5` | $2 | $10 |
| `claude-opus-5-5` | $4 | $20 |

Thinking tokens are output tokens: Anthropic reports them inside `output_tokens`, so they are billed there.

- **`jev`** sends exactly what production sends: `jev.BuildCandidates` and `jev.BuildRequests` are the same code the Suggester uses, split at 50 questions, requests sent one after another, latency summed.
- **`claude:<model>:<config>`** makes one Messages call per check. `config` is an effort level (`low` … `max`, with adaptive thinking) or `nothink` (`thinking: {type: "disabled"}`; Haiku 5.5 only, since Sonnet 5.5 and Opus 5.5 reject it). The system prompt is short and neutral and reuses Jev's criteria word for word (`jev.CriteriaTrue`, `jev.CriteriaFalse`). The user message carries the same `{"nugget": {title, notes, tags}}` state and every candidate with the same examples, after Jev's question (`jev.QuestionText`). Structured outputs (`output_config.format`) constrain the answer to `{answers: [{tag, applies: boolean, confidence: number}]}`. The schema deliberately doesn't name the tags: one required property per tag compiles to a grammar the API rejects at around 50 tags ("The compiled grammar is too large"), found in the first paid smoke test. Code then requires the list to cover exactly the candidates, each once; anything else is malformed. `max_tokens` is 16,000.
- **Claude's score** is `confidence` when it says the tag applies and `1 − confidence` when it says it doesn't, so it reads like Jev's yes-probability. The confidence is self-reported: the API exposes no logprobs. That is what the calibration metrics (§7) test.
- **Malformed answers:** non-JSON, a missing or extra tag, a missing field, a confidence outside 0–1, or `stop_reason: max_tokens` count as malformed; `stop_reason: refusal` counts as refused. Both still cost their tokens. A Jev answer missing a question is malformed too.

**Phase 1** (the default `-contenders`) is `jev`, `claude:claude-haiku-5-5:low` and `claude:claude-haiku-5-5:nothink`. Sonnet 5.5 and Opus 5.5 run only when named.

**Keys.** Jev's is read from the nuggets settings table (`jev.KeyAPIKey`) through a read-only connection (`db.OpenReadOnly`). Claude's come from the Anthropic SDK's standard resolution (`ANTHROPIC_API_KEY`, or an `ant auth login` profile). Neither is app config, and neither is ever logged.

## 4. Datasets

Reported separately.

1. **The real bank.** The active nuggets in the app's database (`-db`, default the app's own path), read-only, with their dismissed suggestions.
2. **The GitHub stand-in.** About 300 feature requests from four apps whose requests read like product ideas and whose topical label sets are moderate (14–22 labels kept each):

| Repo | Filter label | Why |
|---|---|---|
| `laurent22/joplin` | `enhancement` | Note-taking app; desktop, mobile, sync, plugins, editor… |
| `koreader/koreader` | `enhancement` | E-reader app; Kindle, Kobo, OPDS, plugin, firmware… |
| `AntennaPod/AntennaPod` | `Type: Feature request` | Podcast app; queue, chapters, automatic downloads… |
| `florisboard/florisboard` | `proposal` | Keyboard app; clipboard, layouts, emoji, gestures… |

`fetch` reads up to 20 pages of each repo's filtered issues (pull requests skipped) and keeps the issues with the most topical labels: two or more first, then the most recently updated. Housekeeping labels are dropped (`CleanLabels`): type, triage, status, priority, severity, duplicate, `good first issue`, stale, release and test bookkeeping, and the like. Grouping prefixes (`area:`, `functionality:`) are stripped and labels are normalized like tags. Issue bodies are cut to 600 characters, near the size of a nugget's notes. Labels are the ground truth.

Four more repos (`AppFlowy-IO/AppFlowy`, `zed-industries/zed`, `godotengine/godot`, `microsoft/vscode`, 200 issues each, unfiltered) only lend their labels, with their own issues' titles as examples, to the scaling task.

Each repo is its own bank: an issue's candidates and examples come only from its own repo, built by `jev.BuildCandidates`.

## 5. Tasks

- **Hidden tag.** For each item with 2 or more tags, every variant with one tag hidden. A tag no other item carries is skipped, because hiding it would drop it from the vocabulary. The variants are capped per dataset (`-max-hidden`, default 120) by a seeded sample.
- **Open suggestion.** Each item as it is (`-max-open`, default 120 per dataset). An item with no candidates is skipped, as production makes no call.
- **Scaling.** `-scale-items` (default 10) GitHub hidden-tag cases are re-asked with exactly 10, 50 and 200 candidates. The hidden tag comes first, then the rest of its repo's candidates, then labels from the other repos, in a seeded order (each smaller vocabulary is a subset of the larger one), then sorted by tag like production.
- **Repeats.** Every case is asked `-repeats` times (default 3).
- `-limit N` caps the cases of the chosen `-tasks` (before repeats) for a smoke run. `-seed` fixes every sample.

## 6. Ground truth and judging

- **Hidden tag:** the hidden tag is right.
- **GitHub:** labels are the whole truth. Any other suggestion is wrong.
- **Bank:** other suggestions are right or wrong only once judged. `Pool` collects every unique (nugget, tag) pair that any contender put in its top 3 of an answered bank check, at any score, so the threshold sweep has truth all the way down. Tags already on the nugget and the hidden tag are left out. `judge` shows each pair with the nugget's title, notes, tags and up to 3 other nuggets carrying the tag, never the contender or the score, in a shuffled order. Answers are `y`, `n`, `s` (skip, stays unknown) or `q`. Each is saved at once through a temp file, so the next session asks only what's left.

## 7. Metrics

Production's rule applies throughout: the suggested tags are those scoring at least **0.7**, at most **3**, highest first. Quality metrics use the checks that answered. Cost and failure rates use every check.

- **Recall@3** (hidden tag): the share of checks whose hidden tag is suggested. **By rank**, ignoring the threshold: Hit@1, Hit@3 and the hidden tag's mean rank.
- **Precision@3:** right suggestions over suggestions of known truth, for the hidden-tag and open tasks. **F1** combines hidden-tag precision and recall. **Open suggestions per check** sits beside open precision: on GitHub data every open suggestion is wrong by construction (an item's labels are all on it already), so there it is the false-positive rate, and the report says so.
- **Threshold sweep:** precision, recall and F1 for the hidden-tag task at 0.05, 0.10, … 0.95. The best threshold is the highest F1 (the higher threshold on a tie), and none when every F1 is 0.
- **Calibration:** every candidate score with known truth, in ten reliability bins (mean score against the observed rate), plus the Brier score. On the bank only hidden tags and judged top-3 suggestions are known, so low scores are under-represented; on GitHub, open-task negatives dominate. The report notes both.
- **Stability:** the share of cases whose suggested set (as a set) differs between any two repeats.
- **Scaling:** for each vocabulary size, recall@3, latency p50 and p95, mean input and output tokens, and cost per check.
- **Latency:** p50 and p95, nearest rank.
- **Cost:** per check, per 1,000 checks, and per correct suggestion (total cost over suggestions known to be right, both tasks).
- **Failures:** malformed, refused and errored checks per 100, overall and per vocabulary size.

## 8. Spend safety

- **`-max-usd`** (default **$2.00**) is a hard cap. Before a case starts, the runner reserves its estimated worst case for every contender: twice the heuristic input (plus 1,000 tokens per question for Jev, whose own usage counts overhead the heuristic can't see), and the full `max_tokens` of output for Claude. The case starts only if the spend so far, plus every reservation in flight, plus its own, fits under the cap. At the first one that doesn't, the run stops dispatching, waits for the checks in flight, and writes its partial results with the reason. Reserving whole cases means a stopped run still compares every contender on the same cases. The worst case is an estimate, not a proof, but the margin is wide (a Haiku check reserves about 30 times its expected cost).
- **Spend is what was paid.** Tokens used by attempts that then failed (an early request of a split Jev check, before a later one was rate limited) count towards the check's cost. Ctrl-C stops dispatching the same way; checks it cuts short are paid for but not recorded, since their failure isn't the model's.
- **`-dry-run`** calls nothing and prints tokens and cost per contender. Input tokens are estimated as characters / 4, and output as the answer's size plus a labelled thinking allowance (400 tokens at `low`). With **`-count-tokens`**, Claude's input is counted by Anthropic's free `count_tokens` endpoint instead: still a network call, so only on request.
- **Rate limits:** `-concurrency` checks at once (default 4), and at most `-rps` check starts per second per contender (default 4); a split Jev check sends its requests back to back, as production does. A 429 or 529 is retried up to 5 tries, waiting 2 s doubled each time or the `Retry-After`, whichever is longer. The Anthropic SDK's own retries are off, so latency is one call's.

## 9. Tests

`httptest` fakes stand in for TypeSafe and Anthropic. Nothing calls a real API.

- The metric math against hand-computed fixtures: recall, precision, F1, rank, calibration bins and Brier, the sweep and best threshold, latency percentiles, the cost per check, per 1,000 and per correct, the failure rates, stability, and bank precision from judgments.
- The spend cap stops a run before the cap, reserving whole cases so contenders of different prices stay in step. Retries back off on 429 and 529, honouring `Retry-After`, and tokens paid on a failed attempt are charged. Failures are recorded without stopping the run. An interrupt stops it and leaves out the checks it cut short.
- Claude: the schema covers exactly the candidate tags; the request carries Jev's state, examples and criteria; `low` and `nothink` set thinking and effort; score mapping; every malformed shape, and refusal; rate limits surface for the runner, with no SDK retry.
- Jev: the requests are byte-identical to `jev.BuildRequests`; usage is summed across split requests.
- Datasets: housekeeping labels are dropped; fetch prefers multi-label issues and skips pull requests; the bank loader reads only active nuggets, their dismissals and the key, through a read-only handle.
- Cases: hidden variants, skipping single-carrier tags; open cases match production's candidates, dismissals included; seeded caps and `-limit` are deterministic; padding items never become cases; scaling pads from other repos only, never the bank.
- Judge: the pool is unique and blind; a session saves after each answer, re-asks on bad input, and resumes where it stopped.

## 10. Out of scope

- A findings page. `report`'s JSON summary is shaped for charting later.
- Prompt caching, batches, or tuning either model's prompt. The point is the task as production poses it.
- Running Sonnet 5.5 or Opus 5.5 by default (Phase 2, if Phase 1 says it's worth it).
