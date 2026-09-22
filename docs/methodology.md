# Methodology

How code-taste-bench measures taste. Everything on this page is the verbatim protocol; measured values live in [`results/results.json`](../results/results.json) and on the leaderboard. The test items themselves are a two-tier set: the demo tier is published in full, the sealed tier is documented here in aggregate only.

## What is measured

**Taste** is the quality of a code artifact judged on its code, its communication, and its test writing — beyond whether it works. The ranked entity is the **model**; every artifact records its harness provenance but the leaderboard ranks models. Judges are instructed to weigh taste only: never feature count, never mere correctness.

## The rubric

Five dimensions, each scored 0–4 against concrete level descriptions ([`rubric/rubric.json`](../rubric/rubric.json) is authoritative):

| Dimension | What it judges |
| --- | --- |
| Clarity & structure | Whether names, decomposition, and control flow convey what the code does |
| Idiom & economy | Language idiom at the right size; no redundant machinery or abstraction that earns nothing |
| Signal discipline | Comments and cosmetics: why-comments are signal, narration and restating comments are slop |
| Communication | The accompanying explanation: accurate, concise, honest about tradeoffs (omitted when an artifact carries none) |
| Test taste | Whether tests earn their place: real contract, failure paths, no mock theater (omitted when the task declares tests out of scope) |

A **composite taste score** is the mean of the available dimensions. The `comms` dimension is omitted when the artifact has no explanation and `tests` when the task does not expect them; the mean renormalizes.

### Slop diagnostics

Each artifact also carries twelve binary slop diagnostics (reported as `noul` probabilities by the judge), aggregated into a per-model **slop density**. The diagnostics are grounded in documented anti-slop rulebases ([`research/slop-patterns.md`](../research/slop-patterns.md) inventories 114 named patterns across 8 rulebases with citations and licenses): type-evidence laundering, unvalidated boundary data, accumulating copies, needless eager pipelines, comment slop, emoji and marketing tone, inflated prose, swallowed errors, placeholder residue, ceremony structure, self-proving tests, and tooling-silencing tells.

Contested patterns — conditional spread, TODO severity, JSDoc density, boundary widening — are deliberately not auto-flagged; the rulebases disagree about them, so they are judged through the rubric's level descriptions.

## Test items

An **item** is one model's artifact for one task: the code, the exact prompt, the model's accompanying explanation, and its provenance (model, harness, temperature, timestamp). Items come in two tiers:

- **Demo items** — published in full on the site, with judge outputs, so anyone can verify the judging.
- **Sealed items** — held in a private store while active. This page publishes only aggregates: counts per task kind and language, score distributions, duel counts, tie rates, slop-density histograms. No sealed prompt text, artifact code, or file paths appear anywhere in the public repository or the site bundle.

The sealed tier exists because a benchmark whose items are public can be trained on. The methodology is public so the benchmark can be trusted; the items are closed so the measurement stays honest. The site is a static bundle built exclusively from public data — the builder cannot read sealed material by construction.

### Corpus construction

The v1 corpus is **generated with recorded provenance**: six frontier models from six labs were run over eight task briefs (four demo, four sealed) in a single shot at temperature 0.3, one attempt per model per task, with the output captured verbatim including the accompanying prose. Harvested public corpora were evaluated ([`research/model-attributed-code-sources.md`](../research/model-attributed-code-sources.md)) and set aside for v1: every candidate source is unlicensed, redistribution-restricted, or not code. Such material can be folded into the sealed tier as permissions arrive.

## Duels and Taste Elo

Two items duel only when they solve the same task. A duel is two judge calls with the candidates swapped between positions; each call answers one question: which candidate has better taste, or `too_close_to_call`.

The verdict rule is bias-resistant by construction: both orderings must agree for a win; both-close, split verdicts, or a decisive confidence below 0.55 all record a **tie**. Position bias cannot survive the swap, and uncertainty degrades to ties instead of noise.

Wins feed a Bradley-Terry model (ties count as half-wins for each side), rendered as **Taste Elo** = $1500 + 400\cdot\log_{10}(\theta/\theta_{\text{geo-mean}})$, so a perfectly even field sits at 1500. Duel counts and tie rates are published per model alongside the rating.

## The judge

Judgments come from TypeSafe's **JEV** (`typesafe/jev-1.13`), called over the OpenRouter Decisions API. JEV returns typed answers with calibrated probabilities and confidence rather than generated text; every dimension, diagnostic, and duel verdict is one typed judgment. All independent questions about an artifact go in a single request.

The judge is **pinned to a version**; each run records the serving snapshot ids of every call. Published results are keyed to a judge generation and frozen — a judge upgrade triggers a dual-run overlap study with published drift, then a full rescore into a new generation.

## Calibration and reliability

The designed human study: three raters score 30 items (15 demo, 15 sealed) on the rubric and cast 60 blinded duel verdicts, with model identity stripped and candidate order randomized. Inter-rater agreement is measured with Krippendorff's α per dimension; judge quality with within-one-level agreement and Spearman ρ per dimension, plus verdict agreement on duels. The trust threshold for the judge as the production rater: α ≥ 0.6 among humans and judge-within-one-level ≥ 70% on at least three dimensions. The study requires human raters and is the one step that has not run autonomously; the tooling (`bun run rating-sheet`, `bun run rating-ingest`) ships ready to execute it.

Judge reliability without humans is measured on every run and published in `results/results.json`: order-swap agreement across all duels, identical re-run agreement on a 10% sample, and the relationship between judge confidence and swap agreement. These numbers say how reproducible the judge is; they are not a substitute for human agreement and are labeled accordingly.
