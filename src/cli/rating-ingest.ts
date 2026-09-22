// rating-ingest.ts — ingest completed human rater CSVs and compute calibration metrics.
// Reads `ratings/rater-{a,b,c}.csv` + `ratings/keys.json` (sheet unblinding key) +
// judge raw profiles/duels from `results/raw/` (demo) and `$SEALED_REPO_PATH/results/raw/` (sealed).
// Writes `results/calibration.json` and prints PASS/FAIL against SPEC §7 thresholds:
//   Krippendorff's alpha >= 0.6 AND judge-vs-human within-one-level >= 70%
//   on at least 3 dimensions. Spearman rho and duel verdict agreement are reported
//   alongside (no threshold in SPEC §7).
//
// CSV column format (one file per rater, `ratings/rater-a.csv` etc.):
//   - Lines starting with `#` are comments (the rating-sheet export writes a documented preamble).
//   - The first non-comment line is the header: `kind,id,dimension,value`
//   - kind=item rows: id = sheet item code (I-001…), dimension = one of
//     clarity|idiom|signal|comms|tests (only dimensions shown on the sheet for that item),
//     value = rubric level `0`..`4` (single digit).
//   - kind=duel rows: id = sheet duel code (D-001…), dimension = empty,
//     value = `a` | `b` | `tie` — the blinded side labels exactly as printed on that
//     rater's sheet (per-rater randomized; unblinded here via ratings/keys.json).
//   - Any other shape is a structural error: the run aborts with line numbers (exit 1).
//
// Metrics (SPEC §7):
//   - Krippendorff's alpha per dimension, interval variant (squared-difference
//     disagreement), computed over the 3 raters on the sampled items with the standard
//     coincidence-matrix formulation (missing ratings tolerated).
//   - within-one-level %: per (rater, item, dimension) judgment where a judge score
//     exists, `|human - judge| <= 1`.
//   - Spearman rho per dimension: judge level vs the mean of available human ratings
//     per item (midrank ties; null when n < 3).
//   - duel verdict agreement %: per (rater, duel) judgment, the human pick unblinded to
//     a physical item (or tie) exactly equals the judge verdict's winner (or tie).

import { readdir, readFile, mkdir } from "node:fs/promises";
import type { DimensionId, ItemProfile, Verdict } from "../types";

const RATERS = ["rater-a", "rater-b", "rater-c"] as const;
type Rater = (typeof RATERS)[number];

const DIMENSIONS: DimensionId[] = ["clarity", "idiom", "signal", "comms", "tests"];

// SPEC §7 trust thresholds.
const ALPHA_MIN = 0.6;
const WITHIN_ONE_MIN = 0.7;
const MIN_TRUSTED_DIMENSIONS = 3;

// ---------------------------------------------------------------------------
// Sheet unblinding key (ratings/keys.json, produced by rating-sheet.ts; never ships)
// ---------------------------------------------------------------------------

interface SheetKeys {
  items: Record<string, { id: string; dims: DimensionId[] }>;
  duels: Record<string, { key: string; sides: Record<string, [string, string]> }>;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

interface ItemRow {
  kind: "item";
  id: string;
  dimension: DimensionId;
  value: number;
  line: number;
}
interface DuelRow {
  kind: "duel";
  id: string;
  value: "a" | "b" | "tie";
  line: number;
}
type Row = ItemRow | DuelRow;

const CSV_HEADER = "kind,id,dimension,value";

function parseCsv(rater: Rater, text: string): { rows: Row[]; errors: string[] } {
  const rows: Row[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let headerFound = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (!headerFound) {
      headerFound = true;
      if (line !== CSV_HEADER) {
        errors.push(`${rater}.csv:${i + 1}: expected header "${CSV_HEADER}", got "${line}"`);
      }
      continue;
    }
    const at = i + 1;
    const cells = line.split(",");
    if (cells.length !== 4) {
      errors.push(`${rater}.csv:${at}: expected 4 comma-separated columns, got ${cells.length}`);
      continue;
    }
    const [kind, id, dimension, value] = cells as [string, string, string, string];
    if (kind === "item") {
      if (!DIMENSIONS.includes(dimension as DimensionId)) {
        errors.push(`${rater}.csv:${at}: unknown dimension "${dimension}"`);
        continue;
      }
      if (!/^[0-4]$/.test(value)) {
        errors.push(`${rater}.csv:${at}: item value must be a single digit 0-4, got "${value}"`);
        continue;
      }
      const key = `item:${id}:${dimension}`;
      if (seen.has(key)) {
        errors.push(`${rater}.csv:${at}: duplicate row for ${key}`);
        continue;
      }
      seen.add(key);
      rows.push({ kind: "item", id, dimension: dimension as DimensionId, value: Number(value), line: at });
    } else if (kind === "duel") {
      if (dimension !== "") {
        errors.push(`${rater}.csv:${at}: duel rows must have an empty dimension column`);
        continue;
      }
      if (value !== "a" && value !== "b" && value !== "tie") {
        errors.push(`${rater}.csv:${at}: duel value must be a|b|tie, got "${value}"`);
        continue;
      }
      const key = `duel:${id}`;
      if (seen.has(key)) {
        errors.push(`${rater}.csv:${at}: duplicate row for ${key}`);
        continue;
      }
      seen.add(key);
      rows.push({ kind: "duel", id, value, line: at });
    } else {
      errors.push(`${rater}.csv:${at}: unknown kind "${kind}"`);
    }
  }
  if (!headerFound) errors.push(`${rater}.csv}: missing header row "${CSV_HEADER}"`);
  return { rows, errors };
}

// Rows must reference codes that exist on the sheet, and item dimensions must be
// ones the sheet actually showed for that item.
function validateAgainstKeys(rater: Rater, rows: Row[], keys: SheetKeys): string[] {
  const errors: string[] = [];
  for (const row of rows) {
    const entry = keys.items[row.id];
    if (row.kind === "item") {
      if (!entry) {
        errors.push(`${rater}.csv:${row.line}: unknown item code "${row.id}"`);
      } else if (!entry.dims.includes(row.dimension)) {
        errors.push(`${rater}.csv:${row.line}: dimension "${row.dimension}" was not shown for item ${row.id}`);
      }
    } else if (!keys.duels[row.id]) {
      errors.push(`${rater}.csv:${row.line}: unknown duel code "${row.id}"`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Pure metric helpers
// ---------------------------------------------------------------------------

/** Interval-variant Krippendorff's alpha over 0..4 ratings. Null when no unit has
 *  >= 2 ratings (nothing to compare); 1 when every comparable unit is unanimous. */
function krippendorffAlpha(units: (number | null)[][]): number | null {
  const o: number[][] = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  let unitsWithPair = 0;
  for (const values of units) {
    const present = values.filter((v): v is number => v !== null);
    const m = present.length;
    if (m < 2) continue;
    unitsWithPair++;
    const f = Array<number>(5).fill(0);
    for (const v of present) f[v] = (f[v] ?? 0) + 1;
    for (let c = 0; c < 5; c++) {
      for (let k = 0; k < 5; k++) {
        if (c === k) continue;
        const add = ((f[c] ?? 0) * (f[k] ?? 0)) / (m - 1);
        if (add > 0) o[c]![k] = o[c]![k]! + add;
      }
    }
  }
  if (unitsWithPair === 0) return null;
  let n = 0;
  const rowSums = Array<number>(5).fill(0);
  for (let c = 0; c < 5; c++) {
    for (let k = 0; k < 5; k++) {
      n += o[c]![k]!;
      rowSums[c] = rowSums[c]! + o[c]![k]!;
    }
  }
  // Coincidences exist only between differing ratings: zero mass = unanimous units.
  if (n === 0) return 1;
  // A single coincidence has no chance baseline to normalize against: report the
  // observed pair directly (it always disagrees, alpha = 0).
  if (n === 1) return 0;
  let observed = 0;
  let expected = 0;
  for (let c = 0; c < 5; c++) {
    for (let k = 0; k < 5; k++) {
      if (c === k) continue;
      const d2 = (c - k) * (c - k);
      observed += o[c]![k]! * d2;
      expected += rowSums[c]! * rowSums[k]! * d2;
    }
  }
  observed /= n;
  expected /= n * (n - 1);
  if (expected <= 0) return observed === 0 ? 1 : 0;
  return 1 - observed / expected;
}

/** Spearman rank correlation with midrank tie handling; null when n < 3. */
function spearman(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const rank = (v: number[]): number[] => {
    const idx = v.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
    const out = Array<number>(n).fill(0);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1]!.value === idx[i]!.value) j++;
      const mid = (i + j) / 2 + 1; // 1-based average rank for the tied block
      for (let k = i; k <= j; k++) out[idx[k]!.i] = mid;
      i = j + 1;
    }
    return out;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = rx[i]! - mx;
    const b = ry[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx <= 0 || dy <= 0) return null;
  return num / Math.sqrt(dx * dy);
}



// ---------------------------------------------------------------------------
// Raw judge data (written by score.ts)
// ---------------------------------------------------------------------------

async function loadJsonFiles(dir: string): Promise<unknown[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: unknown[] = [];
  for (const name of names) {
    out.push(JSON.parse(await readFile(`${dir}/${name}`, "utf8")));
  }
  return out;
}

interface RawJudgeData {
  profiles: Map<string, ItemProfile>;
  duelWinners: Map<string, { winner: string | null }>; // canonical key -> physical winner id (null = tie)
  profileFiles: number;
  duelFiles: number;
}

function isProfile(x: unknown): x is ItemProfile {
  return typeof x === "object" && x !== null && "item_id" in x && "dimensions" in x;
}

function isDuel(x: unknown): x is { task_id: string; a_item: string; b_item: string; verdict: Verdict } {
  return (
    typeof x === "object" &&
    x !== null &&
    "task_id" in x &&
    "a_item" in x &&
    "b_item" in x &&
    "verdict" in x
  );
}

function duelKey(taskId: string, a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `${taskId}|${x}|${y}`;
}

async function loadRawJudge(): Promise<RawJudgeData> {
  const profiles = new Map<string, ItemProfile>();
  const duelWinners = new Map<string, { winner: string | null }>();
  let profileFiles = 0;
  let duelFiles = 0;

  const roots: string[] = ["results/raw"];
  const sealed = process.env.SEALED_REPO_PATH;
  if (sealed) roots.push(`${sealed}/results/raw`);
  else
    console.warn(
      "warning: SEALED_REPO_PATH unset — sealed judge profiles/duels unavailable; calibration metrics will cover demo tier only",
    );

  for (const root of roots) {
    for (const x of await loadJsonFiles(`${root}/items`)) {
      if (!isProfile(x)) continue;
      profiles.set(x.item_id, x);
      profileFiles++;
    }
    for (const x of await loadJsonFiles(`${root}/duels`)) {
      if (!isDuel(x)) continue;
      duelWinners.set(duelKey(x.task_id, x.a_item, x.b_item), {
        winner: x.verdict === "a" ? x.a_item : x.verdict === "b" ? x.b_item : null,
      });
      duelFiles++;
    }
  }
  return { profiles, duelWinners, profileFiles, duelFiles };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface DimensionReport {
  alpha: number | null;
  alpha_units: number;
  within_one: number | null;
  within_one_n: number;
  spearman: number | null;
  spearman_n: number;
}

async function main(): Promise<void> {
  const errors: string[] = [];

  let keys: SheetKeys;
  try {
    keys = JSON.parse(await readFile("ratings/keys.json", "utf8")) as SheetKeys;
  } catch {
    console.error("rating-ingest: cannot read ratings/keys.json — run `bun run rating-sheet` first");
    process.exit(1);
  }
  if (typeof keys !== "object" || keys === null || !keys.items || !keys.duels) {
    console.error("rating-ingest: ratings/keys.json is malformed (needs `items` and `duels` maps)");
    process.exit(1);
  }

  const rowsByRater = new Map<Rater, Row[]>();
  for (const rater of RATERS) {
    let text: string;
    try {
      text = await readFile(`ratings/${rater}.csv`, "utf8");
    } catch {
      console.error(`rating-ingest: missing ratings/${rater}.csv — all three completed rater CSVs are required`);
      process.exit(1);
    }
    const { rows, errors: parseErrors } = parseCsv(rater, text);
    errors.push(...parseErrors, ...validateAgainstKeys(rater, rows, keys));
    rowsByRater.set(rater, rows);
  }

  // Expected-row completeness check (the sheet's export button blocks incomplete
  // exports; a shortfall here means a hand-edited CSV).
  const expectedItemRows = Object.values(keys.items).reduce((n, it) => n + it.dims.length, 0);
  const expectedDuelRows = Object.keys(keys.duels).length;
  const expected = expectedItemRows + expectedDuelRows;
  for (const rater of RATERS) {
    const got = rowsByRater.get(rater)?.length ?? 0;
    if (got !== expected) {
      console.warn(`warning: ${rater}.csv has ${got} rows, expected ${expected} (missing rows are treated as unrated)`);
    }
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`rating-ingest: ${errors.length} structural error(s) in rater CSVs — aborting`);
    process.exit(1);
  }

  const raw = await loadRawJudge();
  if (raw.profileFiles === 0 && raw.duelFiles === 0) {
    console.error("rating-ingest: no judge raw data found under results/raw/ — run `bun run score` first");
    process.exit(1);
  }
  if (raw.profileFiles === 0) console.warn("warning: no judge item profiles found; within-one-level and Spearman will be null");
  if (raw.duelFiles === 0) console.warn("warning: no judge duels found; duel verdict agreement will be null");

  const itemCodes = Object.keys(keys.items).sort();
  const duelCodes = Object.keys(keys.duels).sort();

  // Human ratings indexed for metrics: code -> dimension -> rater -> value.
  const humanItems = new Map<string, Map<DimensionId, Map<Rater, number>>>();
  const humanDuels = new Map<string, Map<Rater, "a" | "b" | "tie">>();
  for (const rater of RATERS) {
    for (const row of rowsByRater.get(rater) ?? []) {
      if (row.kind === "item") {
        let byDim = humanItems.get(row.id);
        if (!byDim) humanItems.set(row.id, (byDim = new Map()));
        let byRater = byDim.get(row.dimension);
        if (!byRater) byDim.set(row.dimension, (byRater = new Map()));
        byRater.set(rater, row.value);
      } else {
        let byRater = humanDuels.get(row.id);
        if (!byRater) humanDuels.set(row.id, (byRater = new Map()));
        byRater.set(rater, row.value);
      }
    }
  }

  // Per-dimension reports.
  const dimensions: Partial<Record<DimensionId, DimensionReport>> = {};
  const trusted: DimensionId[] = [];
  for (const dim of DIMENSIONS) {
    const codes = itemCodes.filter((code) => keys.items[code]?.dims.includes(dim));

    // Alpha: human-human, over all sampled items where >= 2 raters gave the dimension.
    const units = codes.map((code) => {
      const byRater = humanItems.get(code)?.get(dim);
      return RATERS.map((r) => (byRater?.get(r) ?? null));
    });
    const alpha = krippendorffAlpha(units);
    const alphaUnits = units.filter((u) => u.filter((v) => v !== null).length >= 2).length;

    // Judge-side metrics need profiles.
    let agree = 0;
    let judgedN = 0;
    const judgeLevels: number[] = [];
    const humanMeans: number[] = [];
    for (const code of codes) {
      const entry = keys.items[code]!;
      const profile = raw.profiles.get(entry.id);
      if (!profile) continue;
      // Judge dimension scores are 0..4 level indices (profileItem contract);
      // fractional values are kept — within-one-level comparisons tolerate them.
      const rawScore = profile.dimensions[dim]?.score;
      if (rawScore === undefined || !Number.isFinite(rawScore)) continue;
      const level = Math.max(0, Math.min(4, rawScore));
      const byRater = humanItems.get(code)?.get(dim);
      if (!byRater || byRater.size === 0) continue;
      const mean = [...byRater.values()].reduce((a, b) => a + b, 0) / byRater.size;
      judgeLevels.push(level);
      humanMeans.push(mean);
      for (const v of byRater.values()) {
        judgedN++;
        if (Math.abs(v - level) <= 1) agree++;
      }
    }
    const withinOne = judgedN > 0 ? agree / judgedN : null;
    const rho = spearman(judgeLevels, humanMeans);

    const report: DimensionReport = {
      alpha,
      alpha_units: alphaUnits,
      within_one: withinOne,
      within_one_n: judgedN,
      spearman: rho,
      spearman_n: judgeLevels.length,
    };
    dimensions[dim] = report;
    if (alpha !== null && withinOne !== null && alpha >= ALPHA_MIN && withinOne >= WITHIN_ONE_MIN) {
      trusted.push(dim);
    }
  }

  // Duel verdict agreement: per (rater, duel) judgment, unblind then compare.
  let duelAgree = 0;
  let duelN = 0;
  let duelMissing = 0;
  for (const code of duelCodes) {
    const entry = keys.duels[code]!;
    const judge = raw.duelWinners.get(entry.key);
    const picks = humanDuels.get(code);
    if (!judge) {
      if (picks && picks.size > 0) duelMissing++;
      continue;
    }
    for (const rater of RATERS) {
      const pick = picks?.get(rater);
      if (!pick) continue;
      duelN++;
      if (pick === "tie") {
        if (judge.winner === null) duelAgree++;
      } else {
        const side = entry.sides[rater];
        const physical = side ? side[pick === "a" ? 0 : 1] : undefined;
        if (physical !== undefined && physical === judge.winner) duelAgree++;
      }
    }
  }
  if (duelMissing > 0) {
    console.warn(`warning: ${duelMissing} sampled duel(s) have no judge verdict in results/raw/ (skipped)`);
  }

  const duelAgreement = duelN > 0 ? duelAgree / duelN : null;
  const pass = trusted.length >= MIN_TRUSTED_DIMENSIONS;

  const calibration = {
    generated_at: new Date().toISOString(),
    raters: RATERS.length,
    items: itemCodes.length,
    duels: duelCodes.length,
    thresholds: {
      alpha_min: ALPHA_MIN,
      within_one_min: WITHIN_ONE_MIN,
      min_trusted_dimensions: MIN_TRUSTED_DIMENSIONS,
    },
    dimensions,
    duel_agreement: { pct: duelAgreement, n: duelN },
    trusted_dimensions: trusted,
    pass,
  };
  await mkdir("results", { recursive: true });
  await Bun.write("results/calibration.json", `${JSON.stringify(calibration, null, 2)}\n`);

  // Human-readable report.
  console.log("");
  console.log("dimension  alpha   units  within-1   n      spearman   n");
  for (const dim of DIMENSIONS) {
    const r = dimensions[dim];
    if (!r) continue;
    const within = r.within_one === null ? "n/a" : `${(r.within_one * 100).toFixed(1)}%`;
    console.log(
      `${dim.padEnd(9)}  ${(r.alpha === null ? "n/a" : r.alpha.toFixed(3)).padStart(6)}  ` +
        `${String(r.alpha_units).padStart(5)}  ${within.padStart(8)}  ${String(r.within_one_n).padStart(4)}  ` +
        `${(r.spearman === null ? "n/a" : r.spearman.toFixed(3)).padStart(8)}  ${String(r.spearman_n).padStart(3)}`,
    );
  }
  console.log("");
  console.log(
    `duel verdict agreement: ${duelAgreement === null ? "n/a" : `${(duelAgreement * 100).toFixed(1)}%`} (n=${duelN})`,
  );
  console.log(
    `trusted dimensions (alpha >= ${ALPHA_MIN} and within-one >= ${WITHIN_ONE_MIN * 100}%): ` +
      `${trusted.length >= 1 ? trusted.join(", ") : "none"}`,
  );
  console.log(`PASS: ${pass ? "PASS" : "FAIL"} (needs >= ${MIN_TRUSTED_DIMENSIONS} trusted dimensions per SPEC §7)`);
  console.log("wrote results/calibration.json");
}

await main();
