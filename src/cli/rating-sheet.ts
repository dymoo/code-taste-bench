// rating-sheet.ts — emit three blinded human rater sheets (static HTML) plus the
// unblinding key.
//
// Samples 30 items (15 demo + 15 sealed; demo-only when SEALED_REPO_PATH is unset,
// with a warning) balanced across tasks, and 60 duels balanced across tasks AND
// models, both with a deterministic seeded pick. Codes (I-001…, D-001…) are shared by
// all raters so calibration can join their ratings; duel candidates are shown in a
// per-rater randomized order and the mapping lives in ratings/keys.json — which never
// ships (the site builder cannot read ratings/ or SEALED_REPO_PATH by construction).
// Model identity is stripped from every sheet: no provenance, no labels, no tier notes.
//
// Each sheet's "Download CSV" button exports the completed ratings as
// ratings/rater-{a,b,c}.csv — the column format rating-ingest.ts documents and parses.
//
// Usage: bun run rating-sheet

import { mkdir } from "node:fs/promises";
import { loadItems } from "../items/load";
import type { Artifact, DimensionId, Item, Task, Tier } from "../types";

const ITEMS_PER_TIER = 15;
const TOTAL_ITEMS = 30;
const TOTAL_DUELS = 60;
const RATERS = ["rater-a", "rater-b", "rater-c"] as const;
type Rater = (typeof RATERS)[number];

// Fixed seeds: the same corpus always yields the same sheets.
const SEED_ITEMS_DEMO = 0x1001;
const SEED_ITEMS_SEALED = 0x1002;
const SEED_DUELS_DEMO = 0x2001;
const SEED_DUELS_SEALED = 0x2002;
const SEED_ORDER_BASE = 0x3001;

const DIMENSIONS: DimensionId[] = ["clarity", "idiom", "signal", "comms", "tests"];

interface RubricDimension {
  label: string;
  instructions: string;
  levels: string[];
}
interface SheetRubric {
  taste_definition: string;
  dimensions: Partial<Record<DimensionId, RubricDimension>>;
}

interface ItemCode {
  code: string;
  item: Item;
  dims: DimensionId[];
}
interface Pair {
  task: Task;
  a: Item;
  b: Item;
}
interface DuelCode {
  code: string;
  pair: Pair;
  key: string;
  sides: Record<Rater, [string, string]>;
}

interface SheetKeys {
  items: Record<string, { id: string; dims: DimensionId[] }>;
  duels: Record<string, { key: string; sides: Record<string, [string, string]> }>;
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** mulberry32 — tiny deterministic PRNG for all sampling/randomized display order. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], rng: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Deal `total` values as evenly as possible across groups (seeded shuffle first,
 *  then round-robin; exhausted groups spill into later passes). */
function dealEvenly<T>(groups: Map<string, T[]>, total: number, rng: () => number): T[] {
  const keys = shuffle([...groups.keys()], rng);
  const pools = new Map<string, T[]>();
  for (const key of keys) pools.set(key, shuffle(groups.get(key)!, rng));
  const out: T[] = [];
  let progressed = true;
  while (out.length < total && progressed) {
    progressed = false;
    for (const key of keys) {
      if (out.length >= total) break;
      const pool = pools.get(key)!;
      if (pool.length === 0) continue;
      out.push(pool.pop()!);
      progressed = true;
    }
  }
  return out;
}

/** Like dealEvenly, but within each group the next pick favors the pair whose models
 *  are least used so far (ties broken by the seeded shuffle order). */
function dealDuels(groups: Map<string, Pair[]>, total: number, rng: () => number): Pair[] {
  const keys = shuffle([...groups.keys()], rng);
  const pools = new Map<string, Pair[]>();
  for (const key of keys) pools.set(key, shuffle(groups.get(key)!, rng));
  const usage = new Map<string, number>();
  const out: Pair[] = [];
  let progressed = true;
  while (out.length < total && progressed) {
    progressed = false;
    for (const key of keys) {
      if (out.length >= total) break;
      const pool = pools.get(key);
      if (!pool || pool.length === 0) continue;
      let bestIndex = 0;
      let bestUse = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const pair = pool[i]!;
        const use = Math.max(
          usage.get(pair.a.provenance.model) ?? 0,
          usage.get(pair.b.provenance.model) ?? 0,
        );
        if (use < bestUse) {
          bestUse = use;
          bestIndex = i;
        }
      }
      const chosen = pool.splice(bestIndex, 1)[0]!;
      out.push(chosen);
      for (const model of [chosen.a.provenance.model, chosen.b.provenance.model]) {
        usage.set(model, (usage.get(model) ?? 0) + 1);
      }
      progressed = true;
    }
  }
  return out;
}

/** Dimensions the sheet shows for an item — mirrors profileItem's gates: comms only
 *  with a substantive explanation, tests only when the task expects them. */
function dimsFor(item: Item): DimensionId[] {
  const dims: DimensionId[] = ["clarity", "idiom", "signal"];
  if (item.context.explanation !== undefined && item.context.explanation.trim() !== "") dims.push("comms");
  if (item.task.tests_expected) dims.push("tests");
  return dims;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderArtifact(artifact: Artifact): string {
  return artifact.files
    .map(
      (file) =>
        `<div class="file"><h4>${esc(file.path)}</h4><pre><code>${esc(file.content)}</code></pre></div>`,
    )
    .join("\n");
}

function renderItemSection(entry: ItemCode, rubric: SheetRubric): string {
  const { item } = entry;
  const explanation = item.context.explanation;
  const fieldsets = entry.dims
    .map((dim) => {
      const spec = rubric.dimensions[dim];
      if (!spec) die(`rating-sheet: rubric/rubric.json is missing dimension "${dim}"`);
      const levels = spec.levels
        .map(
          (level, i) =>
            `<label class="level"><input type="radio" name="item:${entry.code}:${dim}" value="${i}">` +
            `<span><strong>${i}</strong> ${esc(level)}</span></label>`,
        )
        .join("\n");
      return (
        `<fieldset class="dim" data-dim="${dim}"><legend>${esc(spec.label)}</legend>` +
        `<p class="instr">${esc(spec.instructions)}</p>\n${levels}</fieldset>`
      );
    })
    .join("\n");
  return `<section class="item" data-code="${entry.code}">
<h2>Item ${entry.code}</h2>
<h3>Task brief</h3>
<p class="brief">${esc(item.task.brief)}</p>
<h3>Context prompt</h3>
<pre>${esc(item.context.prompt)}</pre>
${explanation !== undefined && explanation.trim() !== "" ? `<h3>Explanation</h3>\n<pre>${esc(explanation)}</pre>` : `<p class="instr">No explanation provided.</p>`}
<h3>Artifact</h3>
${renderArtifact(item.artifact)}
${fieldsets}
</section>`;
}

function renderDuelSection(entry: DuelCode, rater: Rater, rubric: SheetRubric): string {
  const sides = entry.sides[rater];
  const renderCandidate = (label: string, item: Item): string =>
    `<div class="cand" data-side="${label.toLowerCase()}"><h3>Candidate ${label}</h3>` +
    `<p class="brief">${esc(item.task.brief)}</p>\n${renderArtifact(item.artifact)}` +
    (item.context.explanation !== undefined && item.context.explanation.trim() !== ""
      ? `\n<h4>Explanation</h4><pre>${esc(item.context.explanation)}</pre>`
      : "") +
    `</div>`;
  const byId = new Map<string, Item>([
    [entry.pair.a.id, entry.pair.a],
    [entry.pair.b.id, entry.pair.b],
  ]);
  const options = ["a", "b", "tie"]
    .map(
      (value) =>
        `<label class="level"><input type="radio" name="duel:${entry.code}" value="${value}">` +
        `<span>${value === "tie" ? "Too close to call" : `Candidate ${value.toUpperCase()}`}</span></label>`,
    )
    .join("\n");
  return `<section class="duel" data-code="${entry.code}">
<h2>Duel ${entry.code}</h2>
<p class="instr">Same task, two candidates in randomized order. Pick the candidate whose <em>taste</em> is better — structure, idiom, signal, communication, tests beyond correctness — or <strong>Too close to call</strong>.</p>
${renderCandidate("A", byId.get(sides[0])!)}
${renderCandidate("B", byId.get(sides[1])!)}
<fieldset class="verdict" data-duel="${entry.code}"><legend>Your verdict</legend>
${options}</fieldset>
</section>`;
}

function csvPreamble(rater: string): string[] {
  return [
    `# code-taste-bench rating CSV — ${rater}`,
    "# columns: kind,id,dimension,value   (lines starting with # are comments)",
    "# kind=item: id = sheet item code, dimension = clarity|idiom|signal|comms|tests, value = rubric level 0-4",
    "# kind=duel: id = sheet duel code, dimension column empty, value = a|b|tie (blinded sides exactly as shown on this sheet)",
  ];
}

function renderSheet(rater: string, items: ItemCode[], duels: DuelCode[], rubric: SheetRubric): string {
  const itemSections = items.map((entry) => renderItemSection(entry, rubric)).join("\n");
  const duelSections = duels
    .map((entry) => renderDuelSection(entry, rater as Rater, rubric))
    .join("\n");
  const preamble = JSON.stringify(csvPreamble(rater));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>code-taste-bench — ${rater}</title>
<style>
:root { color-scheme: light; }
body { font: 15px/1.55 system-ui, -apple-system, sans-serif; margin: 0 auto; padding: 2rem 1rem 6rem; max-width: 62rem; color: #1c1c1e; background: #fff; }
header { border-bottom: 1px solid #d8d8dc; margin-bottom: 2rem; padding-bottom: 1rem; }
header h1 { font-size: 1.3rem; margin: 0 0 .5rem; }
.rater { float: right; color: #6e6e73; font-size: .9rem; }
section { border: 1px solid #d8d8dc; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
h2 { margin-top: 0; font-size: 1.1rem; }
h3 { font-size: 1rem; margin-bottom: .35rem; }
pre { background: #f5f5f7; padding: .7rem .8rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font: 13px/1.5 ui-monospace, SFMono-Regular, monospace; }
code { font: inherit; }
fieldset { border: 1px solid #d8d8dc; border-radius: 8px; margin: 1rem 0; padding: .4rem .8rem .8rem; }
legend { font-weight: 650; padding: 0 .4rem; }
label.level { display: block; padding: .28rem .1rem; cursor: pointer; }
label.level span { margin-left: .55rem; }
.instr { color: #48484a; font-size: .92rem; }
.brief { background: #f5f5f7; border-radius: 6px; padding: .6rem .8rem; }
.cand { border-top: 1px dashed #d8d8dc; padding-top: .8rem; margin-top: .8rem; }
.file h4 { margin: .6rem 0 .25rem; font: 650 12px/1.4 ui-monospace, monospace; color: #48484a; }
footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #d8d8dc; padding: .7rem 1rem; text-align: center; }
footer p { margin: 0 0 .5rem; color: #6e6e73; font-size: .85rem; }
button { font: 600 14px system-ui, sans-serif; padding: .6rem 1.3rem; border: 0; border-radius: 8px; background: #1c1c1e; color: #fff; cursor: pointer; }
</style>
</head>
<body>
<header>
<span class="rater">${rater}</span>
<h1>code-taste-bench — human rating sheet</h1>
<p>${esc(rubric.taste_definition)}</p>
<p class="instr">Rate what you see, not who wrote it — model identity is hidden. For every dimension, choose the rubric level 0–4 whose description fits best. For duels, pick the better-tasting candidate or Too close to call. When everything is rated, export your CSV into <code>ratings/</code>.</p>
</header>
<main>
<h1>Items</h1>
${itemSections}
<h1>Duels</h1>
${duelSections}
</main>
<footer>
<p>Export is blocked until every item dimension and duel verdict is rated.</p>
<button id="export">Download ${rater}.csv</button>
</footer>
<script>
var PREAMBLE = ${preamble};
var FILENAME = ${JSON.stringify(`${rater}.csv`)};
document.getElementById("export").addEventListener("click", function () {
  var rows = [];
  var missing = [];
  document.querySelectorAll("section.item").forEach(function (sec) {
    var code = sec.getAttribute("data-code");
    sec.querySelectorAll("fieldset[data-dim]").forEach(function (fs) {
      var checked = fs.querySelector("input:checked");
      var dim = fs.getAttribute("data-dim");
      if (checked) rows.push(["item", code, dim, checked.value].join(","));
      else missing.push(code + ":" + dim);
    });
  });
  document.querySelectorAll("section.duel").forEach(function (sec) {
    var code = sec.getAttribute("data-code");
    var checked = sec.querySelector("input:checked");
    if (checked) rows.push(["duel", code, "", checked.value].join(","));
    else missing.push(code);
  });
  if (missing.length) {
    alert("Still unrated: " + missing.slice(0, 20).join(", ") + (missing.length > 20 ? " …" : ""));
    return;
  }
  var lines = PREAMBLE.concat(["kind,id,dimension,value"], rows);
  var blob = new Blob([lines.join("\\n") + "\\n"], { type: "text/csv" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = FILENAME;
  link.click();
  URL.revokeObjectURL(link.href);
});
</script>
</body>
</html>
`;
}

async function main(): Promise<void> {
  const rubric = JSON.parse(await Bun.file("rubric/rubric.json").text()) as SheetRubric;
  if (!rubric.taste_definition || !rubric.dimensions) die("rating-sheet: rubric/rubric.json is malformed");

  let demo: Item[];
  try {
    demo = await loadItems("data/items/demo");
  } catch (e) {
    die(`rating-sheet: cannot load demo items from data/items/demo — ${errText(e)}`);
  }

  let sealed: Item[] = [];
  const sealedPath = process.env.SEALED_REPO_PATH;
  if (sealedPath) {
    try {
      sealed = await loadItems(`${sealedPath}/data/items/sealed`);
    } catch (e) {
      die(`rating-sheet: cannot load sealed items from ${sealedPath}/data/items/sealed — ${errText(e)}`);
    }
  } else {
    console.warn(
      `rating-sheet: warning: SEALED_REPO_PATH not set — sampling ${TOTAL_ITEMS} demo items and ${TOTAL_DUELS} demo duels instead of the ${TOTAL_ITEMS}-item (${ITEMS_PER_TIER}+${ITEMS_PER_TIER}) sealed split`,
    );
  }
  const fullSample = sealed.length > 0;

  const itemTargets: Array<{ tier: Tier; pool: Item[]; count: number; seed: number }> = [
    { tier: "demo", pool: demo.filter((i) => !i.generation_failed), count: fullSample ? ITEMS_PER_TIER : TOTAL_ITEMS, seed: SEED_ITEMS_DEMO },
  ];
  if (fullSample) {
    itemTargets.push({
      tier: "sealed",
      pool: sealed.filter((i) => !i.generation_failed),
      count: ITEMS_PER_TIER,
      seed: SEED_ITEMS_SEALED,
    });
  }
  const pickedItems: Item[] = [];
  for (const target of itemTargets) {
    const groups = new Map<string, Item[]>();
    for (const item of target.pool) {
      let group = groups.get(item.task.id);
      if (!group) groups.set(item.task.id, (group = []));
      group.push(item);
    }
    const picked = dealEvenly(groups, target.count, mulberry32(target.seed));
    if (picked.length < Math.min(target.count, target.pool.length)) {
      console.warn(`rating-sheet: warning: ${target.tier} tier yielded only ${picked.length}/${target.count} items`);
    }
    pickedItems.push(...picked);
  }
  if (pickedItems.length === 0) die("rating-sheet: no items to sample");

  const tierRank = (tier: Tier): number => (tier === "demo" ? 0 : 1);
  const itemCodes: ItemCode[] = [...pickedItems]
    .sort((x, y) => tierRank(x.tier) - tierRank(y.tier) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    .map((item, i) => ({
      code: `I-${String(i + 1).padStart(3, "0")}`,
      item,
      dims: dimsFor(item),
    }));

  // ---- duel pool: same-task pairs, distinct models, id-sorted (mirrors score) ----
  const pairTargets: Array<{ tier: Tier; pool: Item[]; count: number; seed: number }> = [
    { tier: "demo", pool: demo.filter((i) => !i.generation_failed), count: fullSample ? TOTAL_DUELS / 2 : TOTAL_DUELS, seed: SEED_DUELS_DEMO },
  ];
  if (fullSample) {
    pairTargets.push({
      tier: "sealed",
      pool: sealed.filter((i) => !i.generation_failed),
      count: TOTAL_DUELS / 2,
      seed: SEED_DUELS_SEALED,
    });
  }
  const pickedPairs: Pair[] = [];
  for (const target of pairTargets) {
    const byTask = new Map<string, Pair[]>();
    const grouped = new Map<string, Item[]>();
    for (const item of target.pool) {
      let group = grouped.get(item.task.id);
      if (!group) grouped.set(item.task.id, (group = []));
      group.push(item);
    }
    for (const [taskId, items] of grouped) {
      const sorted = [...items].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
      const pairs: Pair[] = [];
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i]!;
          const b = sorted[j]!;
          if (a.provenance.model === b.provenance.model) continue;
          pairs.push({ task: a.task, a, b });
        }
      }
      byTask.set(taskId, pairs);
    }
    const picked = dealDuels(byTask, target.count, mulberry32(target.seed));
    if (picked.length < Math.min(target.count, target.pool.length)) {
      console.warn(`rating-sheet: warning: ${target.tier} tier yielded only ${picked.length}/${target.count} duels`);
    }
    pickedPairs.push(...picked);
  }
  if (pickedPairs.length === 0) die("rating-sheet: no duels to sample");

  const pickedDuelCodes: DuelCode[] = [...pickedPairs]
    .sort(
      (x, y) =>
        (x.task.id < y.task.id ? -1 : x.task.id > y.task.id ? 1 : 0) ||
        (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0) ||
        (x.b.id < y.b.id ? -1 : x.b.id > y.b.id ? 1 : 0),
    )
    .map((pair, i) => {
      const [first, second] = [pair.a.id, pair.b.id].sort();
      const duelEntry: DuelCode = {
        code: `D-${String(i + 1).padStart(3, "0")}`,
        pair,
        key: `${pair.task.id}|${first}|${second}`,
        sides: { "rater-a": [pair.a.id, pair.b.id], "rater-b": [pair.a.id, pair.b.id], "rater-c": [pair.a.id, pair.b.id] },
      };
      return duelEntry;
    });
  // Per-rater randomized candidate order; the unblinding key records what was shown.
  pickedDuelCodes.forEach((entry, duelIndex) => {
    RATERS.forEach((rater, raterIndex) => {
      const order = shuffle([entry.pair.a.id, entry.pair.b.id], mulberry32(SEED_ORDER_BASE + raterIndex * 1000 + duelIndex));
      entry.sides[rater] = [order[0]!, order[1]!];
    });
  });

  const keys: SheetKeys = { items: {}, duels: {} };
  for (const entry of itemCodes) keys.items[entry.code] = { id: entry.item.id, dims: entry.dims };
  for (const entry of pickedDuelCodes) keys.duels[entry.code] = { key: entry.key, sides: entry.sides };

  await mkdir("ratings/sheets", { recursive: true });
  await Bun.write("ratings/keys.json", `${JSON.stringify(keys, null, 2)}\n`);
  for (const rater of RATERS) {
    const html = renderSheet(rater, itemCodes, pickedDuelCodes, rubric);
    await Bun.write(`ratings/sheets/${rater}.html`, html);
  }

  console.log("");
  console.log(
    `rating-sheet: ${itemCodes.length} items (${itemCodes.filter((e) => e.item.tier === "demo").length} demo, ` +
      `${itemCodes.filter((e) => e.item.tier === "sealed").length} sealed), ` +
      `${pickedDuelCodes.length} duels (${pickedDuelCodes.filter((e) => e.pair.a.tier === "demo").length} demo, ` +
      `${pickedDuelCodes.filter((e) => e.pair.a.tier === "sealed").length} sealed)`,
  );
  console.log(`rating-sheet: wrote ${RATERS.map((r) => `ratings/sheets/${r}.html`).join(", ")} and ratings/keys.json (never ships)`);
}

await main();
