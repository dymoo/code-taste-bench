import { describe, expect, test } from "bun:test";
import type {
  DimensionId,
  DuelResult,
  Item,
  ItemProfile,
  NoulAnswer,
  SlopId,
} from "../src/types";
import { aggregate } from "../src/rate/aggregate";

const SLOP_IDS = [
  "type_laundering",
  "unvalidated_boundary",
  "accumulating_copy",
  "eager_pipeline",
  "comment_slop",
  "emoji_marketing",
  "inflated_prose",
  "swallowed_errors",
  "placeholder_residue",
  "ceremony_structure",
  "self_proving_tests",
  "silencing_tells",
] as const satisfies readonly SlopId[];

const noul = (value: number): NoulAnswer => ({ type: "noul", noul: value });

function item(id: string, model: string, failed = false): Item {
  return {
    id,
    tier: "demo",
    task: {
      id: "t1",
      kind: "utility",
      brief: "brief",
      language: "typescript",
      tests_expected: true,
    },
    artifact: { form: "single-file", files: [] },
    context: { prompt: "prompt" },
    provenance: {
      model,
      model_label: `${model} label`,
      harness: "openrouter-chat-completions",
      harness_version: "0.1.0",
      temperature: 0.3,
      generated_at: "2026-09-22T00:00:00.000Z",
      source: "generated",
    },
    license: { spdx: "MIT", redistribution: "demo-eligible" },
    contamination: { viral: false },
    ...(failed ? { generation_failed: true } : {}),
  };
}

function profile(
  itemId: string,
  dimensions: Partial<Record<DimensionId, number>>,
  slopOverrides?: Partial<Record<SlopId, number>>,
  slopDefault = 0.25,
): ItemProfile {
  const dimensionAnswers: Partial<Record<DimensionId, ItemProfile["dimensions"][DimensionId]>> =
    {};
  for (const [key, value] of Object.entries(dimensions)) {
    if (value !== undefined) {
      dimensionAnswers[key as DimensionId] = {
        type: "score",
        score: value,
        legend: {},
        probabilities: {},
        confidence: 1,
      };
    }
  }
  const slopEntries = SLOP_IDS.map(
    (id) => [id, noul(slopOverrides?.[id] ?? slopDefault)] as const,
  );
  // Built for every SlopId listed above; fromEntries erases the key union.
  const slop = Object.fromEntries(slopEntries) as Record<SlopId, NoulAnswer>;
  return {
    item_id: itemId,
    dimensions: dimensionAnswers,
    has_explanation: noul(1),
    has_tests: noul(1),
    slop,
    composite: 0.5,
    calls: [],
  };
}

function duel(
  taskId: string,
  a: Item,
  b: Item,
  verdict: DuelResult["verdict"],
): DuelResult {
  return {
    task_id: taskId,
    a_item: a.id,
    b_item: b.id,
    a_model: a.provenance.model,
    b_model: b.provenance.model,
    verdict,
    swaps: {
      ab: {
        id: "swap-ab",
        model: "typesafe/jev-1.13",
        answers: {},
        usage: { input_tokens: 0, output_tokens: 0, cost: 0 },
      },
      ba: {
        id: "swap-ba",
        model: "typesafe/jev-1.13",
        answers: {},
        usage: { input_tokens: 0, output_tokens: 0, cost: 0 },
      },
    },
  };
}

const meta: Parameters<typeof aggregate>[0]["meta"] = {
  judge_generation: "jev-1.13",
  snapshots: { "typesafe/jev-1.13": 42 },
  suite_sha: "suite-sha",
  reliability: {
    swap_agreement: 0.9,
    repeat_agreement: 0.85,
    total_duels: 12,
    repeat_sample: 3,
  },
  sealed: {
    tasks: 4,
    items: 24,
    duels: 96,
    distributions: { clarity: [0.5, 0.75] },
  },
};

describe("aggregate", () => {
  test("dimension gating renormalizes means when a dimension is absent", () => {
    const a1 = item("a1", "alpha");
    const a2 = item("a2", "alpha");
    const b1 = item("b1", "beta");
    const board = aggregate({
      profiles: [
        profile("a1", { clarity: 4, idiom: 2, comms: 3 }),
        profile("a2", { clarity: 2, idiom: 4 }),
        profile("b1", { clarity: 1 }),
      ],
      duels: [],
      items: [a1, a2, b1],
      meta,
    });

    const alpha = board.models.find((m) => m.model === "alpha")!;
    // a2 has no comms (no explanation): the mean renormalizes over a1 alone
    // instead of averaging in a missing value.
    expect(alpha.dimensions.comms?.mean).toBe(3);
    expect(alpha.dimensions.comms?.n).toBe(1);
    expect(alpha.dimensions.clarity?.mean).toBe(3);
    expect(alpha.dimensions.clarity?.n).toBe(2);
    expect(alpha.dimensions.tests).toBeUndefined();

    const beta = board.models.find((m) => m.model === "beta")!;
    expect(beta.dimensions.comms).toBeUndefined();
    expect(beta.dimensions.clarity?.mean).toBe(1);
    expect(beta.dimensions.clarity?.n).toBe(1);
  });

  test("slop density averages every noul probability across the model's items", () => {
    const a1 = item("a1", "alpha");
    const a2 = item("a2", "alpha");
    const board = aggregate({
      profiles: [
        profile("a1", {}, { comment_slop: 0.9 }, 0.3),
        profile("a2", {}, undefined, 0.6),
      ],
      duels: [],
      items: [a1, a2],
      meta,
    });

    // (11 * 0.3 + 0.9 + 12 * 0.6) / 24 = 11.4 / 24
    const alpha = board.models.find((m) => m.model === "alpha")!;
    expect(alpha.slop_density).toBeCloseTo(0.475, 12);
  });

  test("even field anchors Taste Elo at 1500; meta passes through verbatim", () => {
    const a = item("a1", "alpha");
    const b = item("b1", "beta");
    const c = item("c1", "gamma");
    const board = aggregate({
      profiles: [],
      duels: [
        duel("t1", a, b, "tie"),
        duel("t1", a, c, "tie"),
        duel("t1", b, c, "tie"),
      ],
      items: [a, b, c],
      meta,
    });

    expect(board.models).toHaveLength(3);
    for (const model of board.models) {
      expect(model.taste_elo).toBeCloseTo(1500, 9);
      expect(model.duels).toBe(2);
      expect(model.ties).toBe(2);
      expect(model.wins).toBe(0);
      expect(model.losses).toBe(0);
    }

    expect(board.judge_generation).toBe(meta.judge_generation);
    expect(board.snapshots).toEqual(meta.snapshots);
    expect(board.suite_sha).toBe(meta.suite_sha);
    expect(board.reliability).toEqual(meta.reliability);
    expect(board.sealed_aggregates).toEqual(meta.sealed);
  });

  test("bootstrap CIs contain the mean, are ordered, and are seeded", () => {
    const a1 = item("a1", "alpha");
    const a2 = item("a2", "alpha");
    const a3 = item("a3", "alpha");
    const a4 = item("a4", "alpha");
    const run = () =>
      aggregate({
        profiles: [
          profile("a1", { clarity: 0, idiom: 4, comms: 0 }),
          profile("a2", { clarity: 1.5, idiom: 4 }),
          profile("a3", { clarity: 3 }),
          profile("a4", { clarity: 4, comms: 4 }),
        ],
        duels: [],
        items: [a1, a2, a3, a4],
        meta,
      });
    const board = run();
    const alpha = board.models.find((m) => m.model === "alpha")!;

    const expectedN: Partial<Record<DimensionId, number>> = {
      clarity: 4,
      idiom: 2,
      comms: 2,
    };
    for (const dimension of ["clarity", "idiom", "comms"] as const) {
      const stat = alpha.dimensions[dimension]!;
      expect(stat.n).toBe(expectedN[dimension]);
      expect(stat.ci[0]).toBeLessThanOrEqual(stat.mean);
      expect(stat.ci[1]).toBeGreaterThanOrEqual(stat.mean);
      expect(stat.ci[0]).toBeLessThanOrEqual(stat.ci[1]);
    }
    expect(alpha.dimensions.signal).toBeUndefined();
    expect(alpha.dimensions.tests).toBeUndefined();

    // Seeded PRNG: a second run reproduces the identical interval.
    const again = run();
    expect(
      again.models.find((m) => m.model === "alpha")!.dimensions,
    ).toEqual(alpha.dimensions);
  });

  test("failed-generation duels are excluded; no-game models keep theta 1", () => {
    const a1 = item("a1", "alpha");
    const a2 = item("a2", "alpha");
    const b1 = item("b1", "beta", true);
    const c1 = item("c1", "gamma");
    const c2 = item("c2", "gamma");
    const board = aggregate({
      profiles: [
        profile("a1", { clarity: 4 }),
        profile("c1", { clarity: 0 }),
      ],
      duels: [
        duel("t1", a1, b1, "a"),
        duel("t1", b1, c1, "b"),
        duel("t1", a1, c1, "a"),
        duel("t2", a2, c2, "tie"),
      ],
      items: [a1, a2, b1, c1, c2],
      meta,
    });

    expect(board.models.map((m) => m.model)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);

    const alpha = board.models[0]!;
    expect(alpha.wins).toBe(1);
    expect(alpha.ties).toBe(1);
    expect(alpha.duels).toBe(2);

    const beta = board.models[1]!;
    expect(beta.duels).toBe(0);
    expect(beta.wins + beta.losses + beta.ties).toBe(0);
    expect(beta.items).toBe(1);
    expect(beta.dimensions).toEqual({});
    expect(beta.slop_density).toBe(0);
    // theta 1 against the fitted geo-mean (~1): the neutral midpoint.
    expect(beta.taste_elo).toBeCloseTo(1500, 6);

    const gamma = board.models[2]!;
    expect(gamma.losses).toBe(1);
    expect(gamma.ties).toBe(1);
    expect(gamma.duels).toBe(2);

    // Fitted pair: alpha beat gamma once and tied once (ratio 3), so
    // theta = (sqrt(3), 1/sqrt(3)) and the elos split symmetrically around
    // beta's neutral 1500.
    expect(alpha.taste_elo).toBeCloseTo(
      1500 + 400 * Math.log10(Math.sqrt(3)),
      6,
    );
    expect(gamma.taste_elo).toBeCloseTo(
      1500 - 400 * Math.log10(Math.sqrt(3)),
      6,
    );
  });
});
