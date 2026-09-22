// Leaderboard aggregation (SPEC §4): per-model rubric dimension means with
// bootstrap confidence intervals, slop density, duel tallies, and Taste Elo
// from Bradley-Terry strengths.

import type {
  DimensionId,
  DimensionStat,
  DuelResult,
  Item,
  ItemProfile,
  Leaderboard,
  ModelSummary,
  WinRecord,
} from "../types";
import { fitBT, tasteElo } from "./bradleyTerry";

const DIMENSIONS: readonly DimensionId[] = [
  "clarity",
  "idiom",
  "signal",
  "comms",
  "tests",
];
const BOOTSTRAP_RESAMPLES = 2000;
const CI_LOWER_QUANTILE = 0.025;
const CI_UPPER_QUANTILE = 0.975;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// FNV-1a over model + dimension: every stat gets its own reproducible stream.
function seedFor(model: string, dimension: DimensionId): number {
  const text = model + " " + dimension;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bootstrapCI(values: number[], seed: number): [number, number] {
  const random = mulberry32(seed);
  const means: number[] = new Array<number>(BOOTSTRAP_RESAMPLES);
  for (let b = 0; b < BOOTSTRAP_RESAMPLES; b++) {
    let sum = 0;
    for (let k = 0; k < values.length; k++) {
      sum += values[Math.floor(random() * values.length)]!;
    }
    means[b] = sum / values.length;
  }
  means.sort((a, b) => a - b);
  return [
    means[Math.floor(CI_LOWER_QUANTILE * BOOTSTRAP_RESAMPLES)]!,
    means[Math.floor(CI_UPPER_QUANTILE * BOOTSTRAP_RESAMPLES)]!,
  ];
}

export function aggregate(input: {
  profiles: ItemProfile[];
  duels: DuelResult[];
  items: Item[];
  meta: {
    judge_generation: string;
    snapshots: Record<string, number>;
    suite_sha: string;
    reliability: Leaderboard["reliability"];
    sealed: Leaderboard["sealed_aggregates"];
  };
}): Leaderboard {
  const { profiles, duels, items, meta } = input;

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const itemsByModel = new Map<string, Item[]>();
  for (const item of items) {
    const bucket = itemsByModel.get(item.provenance.model);
    if (bucket) bucket.push(item);
    else itemsByModel.set(item.provenance.model, [item]);
  }
  const models = [...itemsByModel.keys()].sort(compare);
  for (const bucket of itemsByModel.values()) {
    bucket.sort((a, b) => compare(a.id, b.id));
  }

  const profilesByModel = new Map<string, ItemProfile[]>(
    models.map((model) => [model, []]),
  );
  for (const profile of profiles) {
    const item = itemsById.get(profile.item_id);
    if (!item) continue;
    profilesByModel.get(item.provenance.model)?.push(profile);
  }
  for (const bucket of profilesByModel.values()) {
    bucket.sort((a, b) => compare(a.item_id, b.item_id));
  }

  // Duel tallies. Duels touching failed generations must not exist, but are
  // skipped defensively so their verdicts never reach the ratings.
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const ties = new Map<string, number>();
  const records: WinRecord[] = [];
  const bump = (tally: Map<string, number>, model: string) => {
    tally.set(model, (tally.get(model) ?? 0) + 1);
  };
  for (const duel of duels) {
    const a = itemsById.get(duel.a_item);
    const b = itemsById.get(duel.b_item);
    if (!a || !b || a.generation_failed || b.generation_failed) continue;
    if (duel.verdict === "tie") {
      bump(ties, duel.a_model);
      bump(ties, duel.b_model);
      records.push({ model: duel.a_model, opponent: duel.b_model, outcome: 0.5 });
    } else if (duel.verdict === "a") {
      bump(wins, duel.a_model);
      bump(losses, duel.b_model);
      records.push({ model: duel.a_model, opponent: duel.b_model, outcome: 1 });
    } else {
      bump(wins, duel.b_model);
      bump(losses, duel.a_model);
      records.push({ model: duel.a_model, opponent: duel.b_model, outcome: 0 });
    }
  }

  // Taste Elo: fitted strengths for models with duels, theta 1 for models with
  // no games; the reference is the geometric mean across every model.
  const fitted = fitBT(records).theta;
  const strengths = new Map(
    models.map((model) => [model, fitted[model] ?? 1] as const),
  );
  let logSum = 0;
  for (const strength of strengths.values()) logSum += Math.log(strength);
  const geoMean = models.length > 0 ? Math.exp(logSum / models.length) : 1;

  const summaries: ModelSummary[] = models.map((model) => {
    const modelItems = itemsByModel.get(model)!;
    const modelProfiles = profilesByModel.get(model)!;

    const dimensions: Partial<Record<DimensionId, DimensionStat>> = {};
    for (const dimension of DIMENSIONS) {
      const values: number[] = [];
      for (const profile of modelProfiles) {
        const answer = profile.dimensions[dimension];
        if (answer) values.push(answer.score);
      }
      if (values.length === 0) continue;
      let sum = 0;
      for (const value of values) sum += value;
      dimensions[dimension] = {
        mean: sum / values.length,
        ci: bootstrapCI(values, seedFor(model, dimension)),
        n: values.length,
      };
    }

    let slopSum = 0;
    let slopCount = 0;
    for (const profile of modelProfiles) {
      // Sort keys so the float sum is independent of profile key order.
      const entries = Object.entries(profile.slop).sort(([a], [b]) =>
        compare(a, b),
      );
      for (const [, answer] of entries) {
        slopSum += answer.noul;
        slopCount += 1;
      }
    }

    const won = wins.get(model) ?? 0;
    const lost = losses.get(model) ?? 0;
    const tied = ties.get(model) ?? 0;
    return {
      model,
      model_label: modelItems[0]!.provenance.model_label,
      taste_elo: tasteElo(strengths.get(model)!, geoMean),
      duels: won + lost + tied,
      wins: won,
      losses: lost,
      ties: tied,
      dimensions,
      slop_density: slopCount > 0 ? slopSum / slopCount : 0,
      items: modelItems.length,
    };
  });
  summaries.sort(
    (a, b) => b.taste_elo - a.taste_elo || compare(a.model, b.model),
  );

  return {
    generated_at: new Date().toISOString(),
    judge_generation: meta.judge_generation,
    snapshots: meta.snapshots,
    suite_sha: meta.suite_sha,
    models: summaries,
    reliability: meta.reliability,
    sealed_aggregates: meta.sealed,
  };
}
