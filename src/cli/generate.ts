// Corpus generation: one OpenRouter chat-completions shot per model x task,
// output captured verbatim (prose + code fences), written as validated items.
//
// Failure policy: HTTP/network errors abort the run (rerun resumes via the
// idempotent skip); a request that times out twice, a completed response with
// null/empty content, or output whose files cannot be attributed to paths all
// record a `generation_failed` item with an empty artifact.

import { Glob, argv, env } from "bun";
import { validateItem } from "../items/schema";
import type { ArtifactFile, Item, Task, Tier } from "../types";

interface ModelEntry {
  model: string;
  model_label: string;
}

interface Job {
  tier: Tier;
  outDir: string;
  task: Task;
  entry: ModelEntry;
}

const ROOT = `${import.meta.dir}/../..`;
const CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 32768;
const REQUEST_TIMEOUT_MS = 300_000;
const SHOT_ATTEMPTS = 2; // one shot, retried once only when it times out
const CONCURRENCY = 4;
const TASK_ID_SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`generate: ${where} must be a non-empty string`);
  return value;
}

async function loadModels(): Promise<ModelEntry[]> {
  const file = `${ROOT}/config/models.json`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await Bun.file(file).text());
  } catch (cause) {
    throw new Error(
      `generate: cannot read ${file} — create it as { "models": [{ "model": "<openrouter-id>", "model_label": "<display>" }] } (${message(cause)})`,
    );
  }
  const models = (parsed as Record<string, unknown> | null)?.models;
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error(`generate: ${file} must contain a non-empty "models" array`);
  }
  return models.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) throw new Error(`generate: ${file}: models[${index}] must be an object`);
    const model = entry as Record<string, unknown>;
    const id = requireString(model.model, `${file}: models[${index}].model`);
    if (!/[a-z0-9]/i.test(id)) throw new Error(`generate: ${file}: models[${index}].model ${JSON.stringify(id)} has no slug-able characters`);
    return { model: id, model_label: requireString(model.model_label, `${file}: models[${index}].model_label`) };
  });
}

function validateTask(x: unknown, file: string): Task {
  if (typeof x !== "object" || x === null || Array.isArray(x)) throw new Error(`generate: ${file}: task must be an object`);
  const task = x as Record<string, unknown>;
  const id = requireString(task.id, `${file}: task.id`);
  if (!TASK_ID_SLUG.test(id)) throw new Error(`generate: ${file}: task.id ${JSON.stringify(id)} is not a slug`);
  const kind = requireString(task.kind, `${file}: task.kind`);
  if (!["web-app", "utility", "refactor", "fix"].includes(kind)) {
    throw new Error(`generate: ${file}: task.kind ${JSON.stringify(kind)} is unknown`);
  }
  requireString(task.brief, `${file}: task.brief`);
  const language = requireString(task.language, `${file}: task.language`);
  if (!["typescript", "javascript", "python"].includes(language)) {
    throw new Error(`generate: ${file}: task.language ${JSON.stringify(language)} is unknown`);
  }
  if (typeof task.tests_expected !== "boolean") throw new Error(`generate: ${file}: task.tests_expected must be a boolean`);
  if (task.seed !== undefined) {
    if (typeof task.seed !== "object" || task.seed === null) throw new Error(`generate: ${file}: task.seed must be an object`);
    const seed = task.seed as Record<string, unknown>;
    requireString(seed.path, `${file}: task.seed.path`);
    if (typeof seed.content !== "string") throw new Error(`generate: ${file}: task.seed.content must be a string`);
  }
  return task as unknown as Task;
}

async function loadTasks(dir: string, tier: Tier): Promise<Task[]> {
  const glob = new Glob("*.json");
  const paths: string[] = [];
  try {
    for await (const path of glob.scan({ cwd: dir, onlyFiles: true })) paths.push(path);
  } catch (cause) {
    throw new Error(`generate: cannot read ${tier} tasks from ${dir}: ${message(cause)}`);
  }
  if (paths.length === 0) throw new Error(`generate: no ${tier} task files found in ${dir}`);
  paths.sort();

  const tasks: Task[] = [];
  for (const path of paths) {
    const file = `${dir}/${path}`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await Bun.file(file).text());
    } catch (cause) {
      throw new Error(`generate: ${file} is not valid JSON: ${message(cause)}`);
    }
    tasks.push(validateTask(parsed, file));
  }
  return tasks;
}

/** The exact prompt sent — stored verbatim as `context.prompt`. */
export function buildPrompt(task: Task): string {
  const sections: string[] = [task.brief.trim()];
  if (task.seed) {
    const seedFenceTag = task.language === "python" ? "python" : task.language === "typescript" ? "typescript" : "javascript";
    sections.push(
      "",
      "The module below is the starting point. Apply the required changes and re-emit the ENTIRE file as one block — never a diff, patch, or excerpt.",
      "",
      `Seed file \`${task.seed.path}\`:`,
      "",
      "```" + seedFenceTag,
      task.seed.content.replace(/\n+$/, ""),
      "```",
    );
  }
  sections.push(
    "",
    "## Output contract",
    "",
    "First, write a brief explanation of your design choices — plain prose, no code fences.",
    "",
    "Then emit exactly one fenced code block per file, and no other text between or after the blocks:",
    "- The FIRST line of every block is that file's marker line:",
    "  - TypeScript or JavaScript: `// FILE: <path>`",
    "  - Python: `# FILE: <path>`",
    "- A single-file web app is one file named `index.html`, so its marker line is `// FILE: index.html`.",
    "- Everything after the marker line is that file complete, from its first line to its last — no diffs, no omissions, no placeholders.",
    "- Tag each fence with the file's language, for example ```html, ```typescript, ```python.",
  );
  return sections.join("\n");
}

/**
 * The one file a single-file task must produce, or null when the task expects
 * several files (and therefore contract markers to attribute them).
 */
function defaultPath(task: Task): string | null {
  if (task.kind === "web-app") return "index.html";
  if (task.seed) return task.seed.path;
  return null;
}

const MARKER = /^(?:\/\/|#|<!--)[ \t]*FILE:[ \t]*(\S+?)[ \t]*(?:-->)?$/;

interface ParsedOutput {
  files: ArtifactFile[];
  explanation: string;
}

/**
 * Primary path: every fenced block starts with a FILE marker line. Documented
 * fallback for models that skip markers: a single unmarked fence on a
 * single-file task (web-app -> index.html, seeded refactor/fix -> the seed
 * path) is attributed to that default path. Anything else unattributable —
 * several unmarked fences, or an unmarked fence on a multi-file task — yields
 * no files, and the caller records `generation_failed`. Only `content` is
 * parsed; reasoning/usage fields are never touched.
 */
export function parseOutput(output: string, task: Task): ParsedOutput {
  const files = new Map<string, string>();
  const prose: string[] = [];
  let unmarked = 0;
  let unmarkedBlock = "";

  const fence = /```[^\n]*\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(output)) !== null) {
    const outside = output.slice(cursor, match.index).trim();
    if (outside) prose.push(outside);
    cursor = match.index + match[0].length;

    const block = match[1] ?? "";
    const newline = block.indexOf("\n");
    const firstLine = (newline === -1 ? block : block.slice(0, newline)).trim();
    const marker = MARKER.exec(firstLine);
    if (!marker) {
      unmarked += 1;
      unmarkedBlock = block;
      continue;
    }
    const path = marker[1] ?? "";
    if (path.length === 0 || path.startsWith("/") || path.split("/").includes("..")) continue;
    const body = newline === -1 ? "" : block.slice(newline + 1);
    files.set(path, body.replace(/^\n+/, "").replace(/\s+$/, ""));
  }
  const tail = output.slice(cursor).trim();
  if (tail) prose.push(tail);

  if (files.size === 0 && unmarked === 1) {
    const fallback = defaultPath(task);
    if (fallback) files.set(fallback, unmarkedBlock.replace(/^\n+/, "").replace(/\s+$/, ""));
  }

  return {
    files: [...files].map(([path, content]) => ({ path, content })),
    explanation: prose.join("\n\n").trim(),
  };
}

function errorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string" && parsed.error.message) return parsed.error.message;
  } catch {
    // not JSON; fall through
  }
  return raw.slice(0, 300) || "no error body";
}

/**
 * One generation shot. Returns the message content verbatim ("" for a
 * completed response with null/empty content, or after the single timeout
 * retry also timed out — both become `generation_failed` downstream). HTTP
 * errors throw: they are run-level failures, not bad generations.
 */
async function generateShot(apiKey: string, model: string, prompt: string): Promise<string> {
  for (let attempt = 1; attempt <= SHOT_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        const detail = errorDetail(await res.text().catch(() => ""));
        throw new Error(`generate: ${model}: chat completions failed (HTTP ${res.status}): ${detail}`);
      }
      const payload = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> | null };
      const content = payload.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : "";
    } catch (cause) {
      const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
      if (!timedOut) throw cause;
      if (attempt < SHOT_ATTEMPTS) continue;
      return ""; // retried once, timed out again -> recorded as generation_failed
    }
  }
  return ""; // unreachable: the last attempt returns or throws
}

async function runJob(job: Job, apiKey: string, force: boolean, counts: Record<"generated" | "failed" | "skipped", number>): Promise<void> {
  const modelSlug = job.entry.model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const id = `${job.task.id}--${modelSlug}`;
  const outPath = `${job.outDir}/${id}.json`;
  if (!force && (await Bun.file(outPath).exists())) {
    counts.skipped += 1;
    console.log(`skip       ${id}`);
    return;
  }

  const prompt = buildPrompt(job.task);
  const raw = await generateShot(apiKey, job.entry.model, prompt);
  const parsed = parseOutput(raw, job.task);
  const generationFailed = parsed.files.length === 0;
  const generatedAt = new Date().toISOString();

  const item: Item = {
    id,
    tier: job.tier,
    task: job.task,
    artifact: generationFailed
      ? { form: "single-file", files: [] }
      : { form: parsed.files.length === 1 ? "single-file" : "tree", files: parsed.files },
    context: parsed.explanation ? { prompt, explanation: parsed.explanation } : { prompt },
    provenance: {
      model: job.entry.model,
      model_label: job.entry.model_label,
      harness: "openrouter-chat-completions",
      harness_version: `openrouter-chat-${generatedAt.slice(0, 10)}`,
      temperature: TEMPERATURE,
      generated_at: generatedAt,
      source: "generated",
    },
    license: {
      spdx: "MIT",
      redistribution: job.tier === "demo" ? "demo-eligible" : "sealed-only",
    },
    contamination: { viral: false },
    ...(generationFailed ? { generation_failed: true } : {}),
  };

  validateItem(item);
  await Bun.write(outPath, `${JSON.stringify(item, null, 2)}\n`);

  counts[generationFailed ? "failed" : "generated"] += 1;
  console.log(
    `${generationFailed ? "failed    " : "generated "} ${id} (${parsed.files.length} file${parsed.files.length === 1 ? "" : "s"})`,
  );
}

/** Run jobs with a bounded worker pool so slow generations overlap without hammering the API. */
async function runPool(jobFns: Array<() => Promise<void>>, limit: number): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobFns.length) }, async () => {
      while (next < jobFns.length) {
        const jobFn = jobFns[next];
        next += 1;
        if (jobFn) await jobFn();
      }
    }),
  );
}

async function main(): Promise<void> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("generate: OPENROUTER_API_KEY is not set");
  const force = argv.includes("--force");
  const models = await loadModels();

  const sources: Array<{ tier: Tier; tasksDir: string; outDir: string }> = [
    { tier: "demo", tasksDir: `${ROOT}/data/tasks/demo`, outDir: `${ROOT}/data/items/demo` },
  ];
  const sealedRoot = env.SEALED_REPO_PATH;
  if (sealedRoot) {
    sources.push({
      tier: "sealed",
      tasksDir: `${sealedRoot}/data/tasks/sealed`,
      outDir: `${sealedRoot}/data/items/sealed`,
    });
  } else {
    console.log("SEALED_REPO_PATH not set — skipping sealed tasks");
  }

  const jobs: Job[] = [];
  for (const source of sources) {
    for (const task of await loadTasks(source.tasksDir, source.tier)) {
      for (const entry of models) jobs.push({ tier: source.tier, outDir: source.outDir, task, entry });
    }
  }

  const counts = { generated: 0, failed: 0, skipped: 0 };
  await runPool(
    jobs.map((job) => () => runJob(job, apiKey, force, counts)),
    CONCURRENCY,
  );
  console.log(`\ngenerate: ${counts.generated} generated, ${counts.failed} failed, ${counts.skipped} skipped (${jobs.length} planned)`);
}

if (import.meta.main) {
  await main();
}
