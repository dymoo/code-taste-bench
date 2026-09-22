// score.ts — the judging run: profile every runnable item, duel every same-task model
// pair round-robin, re-run a deterministic 10% of duels for reliability, persist raw
// judge calls, and write results/results.json (Leaderboard).
//
// Tiers: demo items load from data/items/demo; sealed items load from
// $SEALED_REPO_PATH/data/items/sealed only when SEALED_REPO_PATH is set (otherwise the
// sealed tier is skipped with a warning; --demo-only skips it unconditionally).
// Custody (SPEC §6): raw judge calls for demo items land in results/raw/; raw calls for
// sealed items land ONLY under $SEALED_REPO_PATH/results/raw/. results/results.json is
// written through assertNoForeignStrings, which structurally rejects any string field
// outside the allowlisted identity/metadata paths — no item text, prompts, or paths can
// reach the published file.
//
// Usage: OPENROUTER_API_KEY=... bun run score [--demo-only]

import { mkdir } from "node:fs/promises";
import { createJudge } from "../judge/client";
import { profileItem } from "../judge/itemProfile";
import { duel } from "../judge/duel";
import { loadItems } from "../items/load";
import { aggregate } from "../rate/aggregate";
import type {
  ChoiceAnswer,
  DimensionId,
  DuelResult,
  Item,
  ItemProfile,
  JudgeCall,
  Leaderboard,
  Task,
} from "../types";

const PARALLEL = 4;
const REPEAT_MODULO = 10; // every 10th duel (stable-sorted) is re-run identically

const DIMENSIONS: DimensionId[] = ["clarity", "idiom", "signal", "comms", "tests"];

interface ScoreRubric {
  judge_model: string;
  duel_criteria: Record<string, string>;
}

interface DuelJob {
  task: Task;
  a: Item;
  b: Item;
  repeat: boolean;
  result: DuelResult | null;
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Run `jobs` through `run` with at most `limit` in flight; results are stored by the
 *  caller at each job's own index so output order never depends on completion order. */
async function pool<T>(jobs: readonly T[], limit: number, run: (job: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, jobs.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= jobs.length) return;
      await run(jobs[i]!, i);
    }
  });
  await Promise.all(workers);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const slash = path.lastIndexOf("/");
  if (slash > 0) await mkdir(path.slice(0, slash), { recursive: true });
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
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

type SwapClass = "agree" | "both_close" | "split" | "one_close";

/** Swap reliability classification over raw placement-space labels:
 *  same physical winner = opposite labels; both too close = both close. */
function classifySwap(res: DuelResult, closeLabel: string): SwapClass {
  const ab = duelChoice(res.swaps.ab)?.choice;
  const ba = duelChoice(res.swaps.ba)?.choice;
  if (ab === undefined || ba === undefined) {
    die(`score: duel ${res.task_id} ${res.a_item}x${res.b_item} returned a call without a choice answer`);
  }
  if (ab === ba) return ab === closeLabel ? "both_close" : "split";
  if (ab === closeLabel || ba === closeLabel) return "one_close";
  return "agree";
}

/** SPEC §6 guard: results.json may contain strings ONLY at these paths. Anything else
 *  (item text, prompts, file paths, ids) fails the run before the file is written. */
function assertNoForeignStrings(board: Leaderboard): void {
  const sealedDistKeys = new Set<string>([...DIMENSIONS, "composite", "slop_density"]);
  const allowed = (path: string): boolean => {
    if (path === "generated_at" || path === "judge_generation" || path === "suite_sha") return true;
    if (/^models\[\d+\]\.model(_label)?$/.test(path)) return true;
    if (/^snapshots\.[^.]+$/.test(path)) return true;
    if (path.startsWith("sealed_aggregates.distributions.")) {
      return sealedDistKeys.has(path.slice("sealed_aggregates.distributions.".length));
    }
    return false;
  };
  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (!allowed(path)) {
        die(
          `score: refusing to write results.json — unexpected string field at "${path}" ` +
            `(SPEC §6: no item text, prompts, or paths in published results)`,
        );
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node !== null && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path === "" ? k : `${path}.${k}`);
      return;
    }
    if (node !== null && typeof node !== "number" && typeof node !== "boolean" && node !== undefined) {
      die(`score: refusing to write results.json — non-JSON value at "${path}"`);
    }
  };
  walk(board, "");
}

function suiteSha(): string {
  const proc = Bun.spawnSync(["git", "rev-parse", "HEAD"]);
  const sha = proc.exitCode === 0 ? proc.stdout.toString().trim() : "";
  if (!/^[0-9a-f]{7,64}$/.test(sha)) {
    die("score: `git rev-parse HEAD` failed — suite_sha is a required field of results.json");
  }
  return sha;
}

function slopDensity(profile: ItemProfile): number {
  const values = Object.values(profile.slop) as { noul: number }[];
  return values.reduce((sum, a) => sum + a.noul, 0) / values.length;
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    die("score: OPENROUTER_API_KEY is not set — export it before running the judging suite");
  }
  const demoOnly = process.argv.includes("--demo-only");
  const sealedPath = process.env.SEALED_REPO_PATH;

  let rubric: ScoreRubric;
  try {
    rubric = JSON.parse(await Bun.file("rubric/rubric.json").text()) as ScoreRubric;
  } catch (e) {
    die(`score: cannot read rubric/rubric.json — run from the repo root (${errText(e)})`);
  }
  const closeLabel = "too_close_to_call";
  if (typeof rubric.duel_criteria[closeLabel] !== "string") {
    die(`score: rubric/rubric.json duel_criteria must define the "${closeLabel}" option`);
  }

  // ---- load tiers ----------------------------------------------------------
  let demo: Item[];
  try {
    demo = await loadItems("data/items/demo");
  } catch (e) {
    die(`score: cannot load demo items from data/items/demo — ${errText(e)}`);
  }
  for (const item of demo) {
    if (item.tier !== "demo") die(`score: ${item.id} lives in data/items/demo but has tier "${item.tier}"`);
  }

  let sealed: Item[] = [];
  let sealedRawDir: string | null = null;
  if (demoOnly) {
    console.log("score: --demo-only given — sealed tier skipped");
  } else if (!sealedPath) {
    console.warn("score: warning: SEALED_REPO_PATH not set — sealed tier skipped (demo-only run)");
  } else {
    try {
      sealed = await loadItems(`${sealedPath}/data/items/sealed`);
    } catch (e) {
      die(`score: cannot load sealed items from ${sealedPath}/data/items/sealed — ${errText(e)}`);
    }
    for (const item of sealed) {
      if (item.tier !== "sealed") die(`score: ${item.id} lives in the sealed store but has tier "${item.tier}"`);
    }
    sealedRawDir = `${sealedPath}/results/raw`;
  }

  const allItems = [...demo, ...sealed];
  const eligible = allItems.filter((item) => !item.generation_failed);
  const failed = allItems.filter((item) => item.generation_failed);
  if (failed.length > 0) {
    console.log(`score: ${failed.length} generation_failed item(s) excluded: ${failed.map((i) => i.id).join(", ")}`);
  }
  if (eligible.length === 0) die("score: no runnable items in either tier");

  const judge = createJudge({ apiKey, model: rubric.judge_model });
  const failures: string[] = [];
  const allCalls: JudgeCall[] = [];

  // ---- item profiles (one call per eligible item) --------------------------
  const slots: (ItemProfile | null)[] = eligible.map(() => null);
  let profileDone = 0;
  await pool(eligible, PARALLEL, async (item, index) => {
    try {
      const profile = await profileItem(judge, item);
      slots[index] = profile;
      allCalls.push(...profile.calls);
      const rawDir = item.tier === "sealed" ? sealedRawDir : "results/raw";
      if (rawDir) await writeJson(`${rawDir}/items/${item.id}.json`, profile);
      console.log(`[profile ${++profileDone}/${eligible.length}] ${item.id}`);
    } catch (e) {
      failures.push(`profile ${item.id}: ${errText(e)}`);
    }
  });
  if (failures.length > 0) {
    for (const f of failures) console.error(`score: FAILED ${f}`);
    die(`score: ${failures.length} profile call(s) failed — partial run aborted, results.json not written`);
  }
  // Every slot is filled: any null would have been recorded as a failure above.
  const profiles = slots as ItemProfile[];

  // ---- duels: per task, all model pairs, stable-sorted, 10% repeated -------
  const byTask = new Map<string, { task: Task; items: Item[] }>();
  for (const item of eligible) {
    let group = byTask.get(item.task.id);
    if (!group) byTask.set(item.task.id, (group = { task: item.task, items: [] }));
    group.items.push(item);
  }
  const jobs: DuelJob[] = [];
  for (const { task, items } of byTask.values()) {
    const sorted = [...items].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        if (a.provenance.model === b.provenance.model) continue; // one shot per model per task
        jobs.push({ task, a, b, repeat: false, result: null });
      }
    }
  }
  jobs.sort(
    (x, y) =>
      (x.task.id < y.task.id ? -1 : x.task.id > y.task.id ? 1 : 0) ||
      (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0) ||
      (x.b.id < y.b.id ? -1 : x.b.id > y.b.id ? 1 : 0),
  );
  jobs.forEach((job, i) => {
    job.repeat = i % REPEAT_MODULO === REPEAT_MODULO - 1;
  });
  if (jobs.length === 0) die("score: no model pairs to duel");

  const sealedIds = new Set(sealed.filter((i) => !i.generation_failed).map((i) => i.id));
  let duelDone = 0;
  await pool(jobs, PARALLEL, async (job) => {
    try {
      const result = await duel(judge, job.task, job.a, job.b);
      allCalls.push(result.swaps.ab, result.swaps.ba);
      if (job.repeat) {
        // Byte-identical re-run: same task/args build the same state+questions.
        const second = await duel(judge, job.task, job.a, job.b);
        allCalls.push(second.swaps.ab, second.swaps.ba);
        result.repeat = second.swaps.ab;
        result.consistent = result.verdict === second.verdict;
      }
      job.result = result;
      const rawDir = job.a.tier === "sealed" ? sealedRawDir : "results/raw";
      if (rawDir) await writeJson(`${rawDir}/duels/${job.task.id}__${job.a.id}__${job.b.id}.json`, result);
      const repeatNote = job.repeat ? ` [repeat consistent=${result.consistent}]` : "";
      console.log(`[duel ${++duelDone}/${jobs.length}] ${job.task.id} ${job.a.id} x ${job.b.id} -> ${result.verdict}${repeatNote}`);
    } catch (e) {
      failures.push(`duel ${job.task.id} ${job.a.id}x${job.b.id}: ${errText(e)}`);
    }
  });
  if (failures.length > 0) {
    for (const f of failures) console.error(`score: FAILED ${f}`);
    die(`score: ${failures.length} duel call(s) failed — partial run aborted, results.json not written`);
  }
  const duels = jobs.map((job) => job.result!);

  // ---- reliability block (SPEC §4/§7) -------------------------------------
  const classes = duels.map((d) => classifySwap(d, closeLabel));
  const agreeing = classes.filter((c) => c === "agree" || c === "both_close").length;
  const repeatSample = duels.filter((d) => d.consistent !== undefined).length;
  const repeatConsistent = duels.filter((d) => d.consistent === true).length;
  // The Leaderboard type demands numbers; with no repeat sample the honest value is
  // "no data", approximated as 0 so JSON never sees null/NaN. reliability.ts reports
  // the full picture from raw.
  const reliability = {
    swap_agreement: classes.length > 0 ? agreeing / classes.length : 0,
    repeat_agreement: repeatSample > 0 ? repeatConsistent / repeatSample : 0,
    total_duels: duels.length,
    repeat_sample: repeatSample,
  };

  // ---- sealed aggregates: counts + numeric distributions only ---------------
  const sealedProfiles = profiles.filter((p) => sealedIds.has(p.item_id));
  const distributions: Record<string, number[]> = {
    composite: sealedProfiles.map((p) => p.composite),
    slop_density: sealedProfiles.map(slopDensity),
  };
  for (const dim of DIMENSIONS) {
    const values: number[] = [];
    for (const profile of sealedProfiles) {
      const score = profile.dimensions[dim]?.score;
      if (score !== undefined && Number.isFinite(score)) values.push(score);
    }
    distributions[dim] = values;
  }
  const sealedAggregates = {
    tasks: new Set(sealed.filter((i) => !i.generation_failed).map((i) => i.task.id)).size,
    items: sealedIds.size,
    duels: duels.filter((d) => sealedIds.has(d.a_item)).length,
    distributions,
  };

  // ---- snapshots: occurrence count per serving model across every call -----
  const snapshots: Record<string, number> = {};
  for (const call of allCalls) snapshots[call.model] = (snapshots[call.model] ?? 0) + 1;

  const suite_sha = suiteSha();
  const board = aggregate({
    profiles,
    duels,
    items: allItems,
    meta: {
      judge_generation: rubric.judge_model.split("/").pop() ?? rubric.judge_model,
      snapshots,
      suite_sha,
      reliability,
      sealed: sealedAggregates,
    },
  });
  assertNoForeignStrings(board);
  await mkdir("results", { recursive: true });
  await Bun.write("results/results.json", `${JSON.stringify(board, null, 2)}\n`);

  const cost = allCalls.reduce((sum, call) => sum + call.usage.cost, 0);
  console.log("");
  console.log(
    `score: ${profiles.length} profiles, ${duels.length} duels ` +
      `(${repeatSample} repeated), swap agreement ${reliability.swap_agreement.toFixed(3)}, ` +
      `repeat agreement ${repeatSample > 0 ? reliability.repeat_agreement.toFixed(3) : "n/a"}`,
  );
  console.log(`score: judge calls ${allCalls.length}, cost $${cost.toFixed(4)}, suite ${suite_sha.slice(0, 12)}`);
  console.log("score: wrote results/results.json");
}

await main();
