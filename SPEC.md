# Code Taste Bench — v1 Spec

Status: locked (2026-09-22). This spec is the assembly of the wayfinder map's resolved decisions ([map #1](https://github.com/dymoo/code-taste-bench/issues/1)); each section links its originating ticket. Build work implements this document without reopening decisions.

## 1. What this is

A benchmark suite that ranks code-generating **models** on **taste** — code quality, communication, and test writing beyond functional correctness. Judged by **JEV** (TypeSafe, `typesafe/jev-1.13`) over the OpenRouter Decisions API. Headline metric: **Taste Elo** from duels; documented diagnostics: per-dimension rubric scores and slop density. Everything is open source except the test items themselves (two-tier test set: public **demo** items, private **sealed** items).

Glossary: `CONTEXT.md`. Judgment grounding: `research/slop-patterns.md` (114 patterns). Corpus grounding: `research/model-attributed-code-sources.md`.

## 2. Rubric v1 ([#11](https://github.com/dymoo/code-taste-bench/issues/11))

Machine-readable form: `rubric/rubric.json` (authoritative). Five score dimensions — `clarity`, `idiom`, `signal`, `comms`, `tests` — each with ordered levels 0–4; twelve `noul` slop diagnostics (slop density = mean); presence questions `has_explanation` / `has_tests`; composite = mean of available dimensions. `comms` is omitted when no explanation exists; `tests` when `tests_expected: false`. Contested patterns (conditional spread, TODO severity, JSDoc density, boundary widening) are judged through level descriptions, never auto-flagged.

## 3. Items and corpus ([#2](https://github.com/dymoo/code-taste-bench/issues/2), [#3](https://github.com/dymoo/code-taste-bench/issues/3))

Item schema and fields: `src/types.ts` (authoritative). v1 corpus is **generated** — harvested sources are license-blocked; they fold in `sealed-only` as permissions arrive. 8 tasks (4 demo in `data/tasks/demo/`, 4 sealed in the private store) × 6 frontier models (≥4 labs, from the live OpenRouter catalog) = 48 items. One shot per model per task at `temperature 0.3`, output captured verbatim (code + accompanying prose = the `comms` target). Failed/empty generations are recorded and excluded from duels.

## 4. Duels and rating ([#5](https://github.com/dymoo/code-taste-bench/issues/5))

Same-task pairs, full round-robin. A duel = two JEV `choice` calls with swapped A/B placement over one two-candidate state; verdict: same candidate both ways → win, both `too_close_to_call` → tie, split or decisive `confidence < 0.55` → tie. Bradley-Terry MLE (ties = half-win) → Taste Elo = `1500 + 400·log10(θ/θ_geo-mean)`. Rubric profiles come from one JEV call per item (5 score + 12 noul + 2 presence questions in a single request — independent questions over one state). 10% of duels re-run identically for reliability.

## 5. Judge policy ([#12](https://github.com/dymoo/code-taste-bench/issues/12))

Pinned `typesafe/jev-1.13` (never the `~latest` alias). Every run records serving snapshot ids in `results/results.json`; results freeze per judge generation (`jev-1.13`); upgrades are dual-run overlaps with published drift, then a full rescore into a new generation.

## 6. Custody and tiers ([#6](https://github.com/dymoo/code-taste-bench/issues/6))

Sealed briefs, items, and raw judge outputs live in private repo `dymoo/code-taste-bench-sealed` (never a submodule). The toolchain loads them via `SEALED_REPO_PATH` (local clone). Public methodology (`docs/methodology.md` + `results/results.json`) ships rubric, protocol, and sealed **aggregates only** — no item text, prompts, or paths. Publish-on-retire rotation stays open via a versioned schema.

## 7. Calibration ([#4](https://github.com/dymoo/code-taste-bench/issues/4))

Human study (the one external step): 3 raters × 30 items + 60 blinded duels; Krippendorff's α per dimension and judge-vs-human agreement (within-one-level %, Spearman ρ); trust threshold α ≥ 0.6 and within-one-level ≥ 70% on ≥ 3 dimensions. Shipped immediately as **judge reliability** (clearly labeled, not human validation): order-swap agreement, 10% repeat agreement, confidence-vs-agreement curve.

## 8. Site ([#8](https://github.com/dymoo/code-taste-bench/issues/8))

GitHub Pages, static, built by `scripts/build-site.ts` from `results/results.json` + `data/items/demo/**` only (the builder cannot read `SEALED_REPO_PATH` by construction). Sections: leaderboard, model pages, methodology, demo explorer. Deployed by GitHub Actions on push to `main`. Site copy passes the taste bar it publishes.

## 9. Layout and module contracts

```
rubric/rubric.json        authoritative rubric
src/types.ts              authoritative shared types
src/judge/client.ts       createJudge(): Decisions API calls (fetch, retry, cost accounting)
src/judge/questions.ts    itemProfileQuestions(), duelQuestions() — derived from rubric/rubric.json
src/judge/itemProfile.ts  profileItem(judge, item): one-call item scoring
src/judge/duel.ts         duel(judge, task, a, b): swapped calls + verdict(); verdictRule()
src/rate/bradleyTerry.ts  fitBT(wins), tasteElo(theta, geoMean)
src/rate/aggregate.ts     aggregate(profiles, duels, meta): Leaderboard
src/items/schema.ts       validateItem()
src/items/load.ts         loadItems(dir)
src/cli/generate.ts       corpus generation (OpenRouter chat completions)
src/cli/score.ts          judging run → results/
src/cli/reliability.ts    swap/repeat/confidence stats
src/cli/rating-sheet.ts   blinded human rating sheets
src/cli/rating-ingest.ts  Krippendorff α + judge-human agreement
data/tasks/demo/*.json    public briefs (Task objects)
data/items/demo/*.json    demo items (generated)
tests/*.test.ts           bun test: verdict rule, BT math, aggregation, item validation
scripts/build-site.ts     static site builder
docs/methodology.md       public methodology package
results/results.json      published aggregates + demo detail
```

Runtime: Bun ≥ 1.2, TypeScript strict, zero runtime dependencies. Commands: `bun run generate`, `bun run score`, `bun run reliability`, `bun run site`, `bun test`. Env: `OPENROUTER_API_KEY` (required), `SEALED_REPO_PATH` (required for sealed runs).

Results schema: `Leaderboard` in `src/types.ts` (models with `taste_elo`, dimension means + bootstrap CIs, slop density, duel counts; reliability block; sealed aggregates; snapshot map; suite sha).

## 10. Remaining external steps

1. **Human calibration study** (3 raters) — protocol and tooling shipped, cannot run autonomously.
2. **Dara Adedeji's license permission** for `SunkenInTime/which-ai` — gates folding that corpus into the sealed tier (not required for v1).
