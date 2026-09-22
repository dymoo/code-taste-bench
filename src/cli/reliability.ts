// reliability.ts — judge reliability report from raw duel calls. No API access needed:
// it only reads the demo-tier raw calls score.ts persisted under results/raw/duels/
// (sealed raw calls live in the private store and are deliberately not read here).
//
// Reports swap (order-swap) agreement, 10% repeat agreement, a confidence calibration
// curve (per-duel mean choice confidence in decile buckets vs swap agreement), and the
// verdict distribution. Writes results/reliability.json and prints the same numbers.
//
// Usage: bun run reliability

import { readdir, readFile, mkdir } from "node:fs/promises";
import type { ChoiceAnswer, DuelResult, JudgeCall } from "../types";

interface ScoreRubric {
  duel_criteria: Record<string, string>;
}

interface SwapCounts {
  agree: number;
  both_close: number;
  split: number;
  one_close: number;
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The single choice answer of a duel call; duel questions carry exactly one. */
function duelChoice(call: JudgeCall): ChoiceAnswer | null {
  const direct = call.answers["winner"];
  if (direct?.type === "choice") return direct;
  for (const answer of Object.values(call.answers)) {
    if (answer.type === "choice") return answer;
  }
  return null;
}

function isDuelResult(x: unknown): x is DuelResult {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Partial<DuelResult>;
  return (
    typeof d.task_id === "string" &&
    typeof d.a_item === "string" &&
    typeof d.b_item === "string" &&
    (d.verdict === "a" || d.verdict === "b" || d.verdict === "tie") &&
    typeof d.swaps === "object" &&
    d.swaps !== null &&
    typeof d.swaps.ab === "object" &&
    d.swaps.ab !== null &&
    typeof d.swaps.ba === "object" &&
    d.swaps.ba !== null
  );
}

async function main(): Promise<void> {
  let rubric: ScoreRubric;
  try {
    rubric = JSON.parse(await Bun.file("rubric/rubric.json").text()) as ScoreRubric;
  } catch (e) {
    die(`reliability: cannot read rubric/rubric.json — run from the repo root (${errText(e)})`);
  }
  const closeLabel = "too_close_to_call";
  if (typeof rubric.duel_criteria[closeLabel] !== "string") {
    die(`reliability: rubric/rubric.json duel_criteria must define the "${closeLabel}" option`);
  }

  const dir = "results/raw/duels";
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    die(`reliability: cannot read ${dir}/ — run \`bun run score\` first`);
  }

  const duels: DuelResult[] = [];
  let skipped = 0;
  for (const name of names) {
    try {
      const parsed: unknown = JSON.parse(await readFile(`${dir}/${name}`, "utf8"));
      if (!isDuelResult(parsed)) throw new Error("not a DuelResult");
      duels.push(parsed);
    } catch (e) {
      skipped++;
      console.warn(`reliability: warning: skipping ${name}: ${errText(e)}`);
    }
  }
  if (duels.length === 0) die(`reliability: no usable duel files in ${dir}/ — run \`bun run score\` first`);

  // ---- swap agreement: same physical winner = opposite placement-space labels;
  //      both too close = agreement; one close + one decisive = disagreement. -----
  const counts: SwapCounts = { agree: 0, both_close: 0, split: 0, one_close: 0 };
  const verdicts = { a: 0, b: 0, tie: 0 };
  const buckets = Array.from({ length: 10 }, (_, i) => ({ lo: i / 10, hi: (i + 1) / 10, n: 0, agree: 0 }));
  let repeatSample = 0;
  let repeatConsistent = 0;
  let withConfidence = 0;

  for (const d of duels) {
    const ab = duelChoice(d.swaps.ab)?.choice;
    const ba = duelChoice(d.swaps.ba)?.choice;
    if (ab === undefined || ba === undefined) {
      skipped++;
      console.warn(`reliability: warning: skipping ${d.task_id} ${d.a_item}x${d.b_item}: call without choice answer`);
      continue;
    }
    verdicts[d.verdict]++;

    let klass: keyof SwapCounts;
    if (ab === ba) klass = ab === closeLabel ? "both_close" : "split";
    else if (ab === closeLabel || ba === closeLabel) klass = "one_close";
    else klass = "agree";
    counts[klass]++;
    const agreed = klass === "agree" || klass === "both_close";

    const abConf = duelChoice(d.swaps.ab)?.confidence;
    const baConf = duelChoice(d.swaps.ba)?.confidence;
    if (abConf !== undefined && baConf !== undefined && Number.isFinite(abConf) && Number.isFinite(baConf)) {
      const mean = (abConf + baConf) / 2;
      const index = Math.min(9, Math.max(0, Math.floor(mean * 10)));
      const bucket = buckets[index]!;
      bucket.n++;
      if (agreed) bucket.agree++;
      withConfidence++;
    }

    if (d.consistent !== undefined) {
      repeatSample++;
      if (d.consistent) repeatConsistent++;
    }
  }

  const total = counts.agree + counts.both_close + counts.split + counts.one_close;
  if (total === 0) die("reliability: every duel file lacked usable choice answers");
  const swapAgreement = (counts.agree + counts.both_close) / total;
  const repeatAgreement = repeatSample > 0 ? repeatConsistent / repeatSample : null;
  const confidenceCurve = buckets
    .filter((b) => b.n > 0)
    .map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, swap_agreement: b.agree / b.n }));

  const report = {
    generated_at: new Date().toISOString(),
    total_duels: total,
    skipped_files: skipped,
    swap_agreement: swapAgreement,
    swap_counts: counts,
    repeat_sample: repeatSample,
    repeat_agreement: repeatAgreement,
    confidence_curve: confidenceCurve,
    verdicts,
  };
  await mkdir("results", { recursive: true });
  await Bun.write("results/reliability.json", `${JSON.stringify(report, null, 2)}\n`);

  console.log("");
  console.log(`reliability: ${total} duels from ${dir}/ (${skipped} file(s) skipped)`);
  console.log(
    `  swap agreement: ${swapAgreement.toFixed(3)} ` +
      `(agree ${counts.agree}, both close ${counts.both_close}, split ${counts.split}, one close ${counts.one_close})`,
  );
  console.log(
    `  repeat agreement: ${repeatAgreement === null ? "n/a (no repeats sampled)" : `${repeatAgreement.toFixed(3)} (n=${repeatSample})`}`,
  );
  const totalVerdicts = verdicts.a + verdicts.b + verdicts.tie;
  const pct = (n: number): string => `${((n / totalVerdicts) * 100).toFixed(1)}%`;
  console.log(`  verdicts: a ${verdicts.a} (${pct(verdicts.a)}), b ${verdicts.b} (${pct(verdicts.b)}), tie ${verdicts.tie} (${pct(verdicts.tie)})`);
  if (withConfidence > 0) {
    console.log("  confidence curve (mean choice confidence vs swap agreement):");
    for (const b of confidenceCurve) {
      console.log(`    ${b.lo.toFixed(1)}-${b.hi.toFixed(1)}  n=${String(b.n).padStart(4)}  swap ${b.swap_agreement.toFixed(3)}`);
    }
  } else {
    console.log("  confidence curve: n/a (no confidence values in raw calls)");
  }
  console.log("wrote results/reliability.json");
}

await main();
