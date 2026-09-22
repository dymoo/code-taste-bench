# Code Taste Bench

A benchmark that ranks code-generating models on **taste** — code quality, communication, and test writing beyond functional correctness. Judgments come from TypeSafe's JEV judge over the OpenRouter Decisions API: typed, calibrated opinions composed into pairwise duels (headline: **Taste Elo**) and per-dimension rubric diagnostics.

The site lives at [dymoo.github.io/code-taste-bench](https://dymoo.github.io/code-taste-bench/). The protocol is in [docs/methodology.md](docs/methodology.md); the locked design is [SPEC.md](SPEC.md).

## What is measured

Five rubric dimensions (clarity & structure, idiom & economy, signal discipline, communication, test taste) scored 0–4, twelve slop diagnostics grounded in documented anti-slop rulebases ([research/slop-patterns.md](research/slop-patterns.md)), and duels between same-task artifacts judged with order-swapped calls so position bias cannot survive the verdict rule.

The test set is two-tier: **demo items** are published in full with their judge outputs; **sealed items** are closed and documented in aggregate only, so the benchmark cannot be trained on. Everything except the items is open source.

## Running the suite

Requires Bun ≥ 1.2 and an `OPENROUTER_API_KEY`. Sealed-tier runs additionally need `SEALED_REPO_PATH` pointing at a local clone of `dymoo/code-taste-bench-sealed` (private).

| Command | What it does |
| --- | --- |
| `bun run generate` | **Disabled by spend policy** — exits nonzero before any network call; artifacts are sourced, never contestant-generated (no bypass) |
| `bun run score` | Runs item profiles and duels, writes `results/results.json` |
| `bun run reliability` | Swap/repeat/confidence reliability stats from raw calls |
| `bun run rating-sheet` | Blinded human rating sheets (custody-controlled output) |
| `bun run rating-ingest` | Krippendorff α and judge-vs-human agreement from completed sheets |
| `bun run site` | Builds the static site into `site/dist/` |
| `bun test` | Verdict rule, Bradley-Terry math, aggregation, item validation |

`bun run score -- --demo-only` restricts a run to the demo tier.

## Layout

- `rubric/rubric.json` — the authoritative rubric the judge is asked
- `src/` — judge client and duel protocol, rating math, CLIs (contracts in `src/types.ts`)
- `data/tasks/demo/` — public task briefs; sealed briefs live in the sealed store
- `data/items/demo/` — public items with verbatim artifacts and provenance
- `results/results.json` — published leaderboard and sealed aggregates
- `site/` — static site sources and build output
- `research/` — corpus and slop-pattern source inventories with citations

## Status

v1: 6 models from 6 labs × 8 tasks (4 public, 4 sealed) = 48 items, ~120 duels. Judge: `typesafe/jev-1.13`, pinned, serving snapshots recorded per run. Judge reliability is measured per run; the human calibration study (3 raters × 30 items + 60 duels, tooling in `bun run rating-sheet`) is the one step awaiting human raters.

## License

MIT. Third-party research notes cite their sources with licenses; no third-party artifact code is redistributed.
