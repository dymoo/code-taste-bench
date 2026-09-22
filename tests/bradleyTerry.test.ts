import { describe, expect, test } from "bun:test";
import type { WinRecord } from "../src/types";
import { fitBT, tasteElo } from "../src/rate/bradleyTerry";

const record = (
  model: string,
  opponent: string,
  outcome: 1 | 0 | 0.5,
): WinRecord => ({ model, opponent, outcome });

// Hand fixture: A beats B in 3 of 4 duels. For a single pair the
// Bradley-Terry MLE fixed point is theta_A / theta_B = W_A / W_B = 3 / 1,
// so with the fitted geometric mean normalized to 1:
//   theta_A = sqrt(3) ~= 1.7320508075688772
//   theta_B = 1 / sqrt(3) ~= 0.5773502691896257
const twoModel = [
  record("A", "B", 1),
  record("A", "B", 1),
  record("A", "B", 1),
  record("B", "A", 1),
];

const ties = [
  record("A", "B", 0.5),
  record("A", "B", 0.5),
  record("A", "B", 0.5),
  record("A", "B", 0.5),
];

// Transitive tournament: A beats B and C, B beats C (separable data — the
// winless model lands on the floored boundary, ordering must still hold).
const chain = [record("A", "B", 1), record("A", "C", 1), record("B", "C", 1)];

describe("fitBT", () => {
  test("two-model fixture converges to the hand-computed ratio", () => {
    const result = fitBT(twoModel);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.theta.A).toBeCloseTo(Math.sqrt(3), 9);
    expect(result.theta.B).toBeCloseTo(1 / Math.sqrt(3), 9);
    expect(result.theta.A! / result.theta.B!).toBeCloseTo(3, 8);
  });

  test("ties keep equal thetas", () => {
    const result = fitBT(ties);
    expect(result.converged).toBe(true);
    expect(result.theta.A).toBeCloseTo(1, 9);
    expect(result.theta.B).toBeCloseTo(1, 9);
    expect(result.theta.A! - result.theta.B!).toBeCloseTo(0, 12);
  });

  test("transitive 3-model chain orders correctly", () => {
    const { theta } = fitBT(chain);
    expect(theta.A!).toBeGreaterThan(theta.B!);
    expect(theta.B!).toBeGreaterThan(theta.C!);
    for (const model of ["A", "B", "C"] as const) {
      expect(theta[model]!).toBeGreaterThan(0);
      expect(Number.isFinite(theta[model]!)).toBe(true);
    }
  });

  test("deterministic across input orderings", () => {
    const records = [
      record("A", "B", 1),
      record("B", "C", 0.5),
      record("C", "A", 0.5),
      record("A", "B", 0.5),
      record("B", "C", 1),
      record("C", "A", 1),
      record("A", "C", 1),
    ];
    const shuffled = [
      records[3]!,
      records[6]!,
      records[0]!,
      records[4]!,
      records[2]!,
      records[1]!,
      records[5]!,
    ];
    expect(fitBT(shuffled)).toEqual(fitBT(records));
    expect(fitBT([...records].reverse())).toEqual(fitBT(records));
  });

  test("geometric mean of fitted thetas is 1", () => {
    for (const fixture of [twoModel, ties, chain]) {
      const theta = fitBT(fixture).theta;
      const models = Object.keys(theta);
      let logSum = 0;
      for (const model of models) logSum += Math.log(theta[model]!);
      expect(Math.exp(logSum / models.length)).toBeCloseTo(1, 9);
    }
  });
});

describe("tasteElo", () => {
  test("follows the 400-log formula anchored at the geo-mean", () => {
    expect(tasteElo(1, 1)).toBe(1500);
    expect(tasteElo(2, 1)).toBeCloseTo(1500 + 400 * Math.log10(2), 9);
    expect(tasteElo(1, 10)).toBeCloseTo(1100, 9);
  });
});
