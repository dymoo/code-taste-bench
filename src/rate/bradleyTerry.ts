// Bradley-Terry MLE via minorization-maximization (SPEC §4). Ties contribute
// half-wins; strengths are identified up to scale and normalized so the fitted
// geometric mean is 1.

import type { BTResult, WinRecord } from "../types";

const DEFAULT_MAX_ITERATIONS = 500;
const DEFAULT_TOLERANCE = 1e-10;
// A model that lost every game sits on the MLE boundary (theta -> 0), where the
// MM step would collapse it to exact zero and poison the geo-mean scale. Pin
// winless models relative to the strongest one so results stay finite and
// orderable. Never binds for a model with any win.
const WINLESS_FLOOR = 1e-12;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function fitBT(
  wins: WinRecord[],
  opts?: { maxIterations?: number; tolerance?: number },
): BTResult {
  const maxIterations = opts?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = opts?.tolerance ?? DEFAULT_TOLERANCE;

  // Total order over (model, opponent, outcome): any permutation of `wins`
  // produces an identical computation. Self-duels carry no information.
  const records = wins
    .filter((w) => w.model !== w.opponent)
    .sort(
      (a, b) =>
        compare(a.model, b.model) ||
        compare(a.opponent, b.opponent) ||
        a.outcome - b.outcome,
    );

  const models = [
    ...new Set(records.flatMap((w) => [w.model, w.opponent])),
  ].sort(compare);
  if (models.length === 0) {
    return { theta: {}, iterations: 0, converged: true };
  }

  const n = models.length;
  const index = new Map(models.map((model, i) => [model, i]));
  const strength = new Array<number>(n).fill(1);
  const winsOf = new Array<number>(n).fill(0);
  const games = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (const record of records) {
    const i = index.get(record.model)!;
    const j = index.get(record.opponent)!;
    const rowI = games[i]!;
    const rowJ = games[j]!;
    rowI[j] = rowI[j]! + 1;
    rowJ[i] = rowJ[i]! + 1;
    winsOf[i] = winsOf[i]! + record.outcome;
    winsOf[j] = winsOf[j]! + 1 - record.outcome;
  }

  const opponents = games.map((row) => {
    const pairs: Array<{ j: number; count: number }> = [];
    for (let j = 0; j < n; j++) {
      const count = row[j]!;
      if (count > 0) pairs.push({ j, count });
    }
    return pairs;
  });

  let iterations = 0;
  let converged = false;
  for (let it = 1; it <= maxIterations; it++) {
    const next = new Array<number>(n).fill(0);
    let strongest = 0;
    for (let i = 0; i < n; i++) {
      if (winsOf[i]! === 0) continue;
      const own = strength[i]!;
      let denominator = 0;
      for (const { j, count } of opponents[i]!) {
        denominator += count / (own + strength[j]!);
      }
      const value = winsOf[i]! / denominator;
      next[i] = value;
      if (value > strongest) strongest = value;
    }
    for (let i = 0; i < n; i++) {
      if (winsOf[i]! === 0) next[i] = strongest * WINLESS_FLOOR;
    }

    let logSum = 0;
    for (let i = 0; i < n; i++) logSum += Math.log(next[i]!);
    const geoMean = Math.exp(logSum / n);

    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      const value = next[i]! / geoMean;
      maxChange = Math.max(maxChange, Math.abs(value - strength[i]!));
      strength[i] = value;
    }
    iterations = it;
    if (maxChange < tolerance) {
      converged = true;
      break;
    }
  }

  return {
    theta: Object.fromEntries(models.map((model, i) => [model, strength[i]!])),
    iterations,
    converged,
  };
}

export function tasteElo(theta: number, geoMean: number): number {
  return 1500 + 400 * Math.log10(theta / geoMean);
}
