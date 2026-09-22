// Static site builder for the public GitHub Pages bundle (SPEC §8).
// Reads public data only: results/results.json, data/items/demo/*.json,
// optional results/raw/ judge detail, and docs/methodology.md.
// Zero runtime dependencies; Bun ≥ 1.2, TypeScript strict.

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { validateItem } from "../src/items/schema";
import type { DimensionId, Item, Leaderboard, ModelSummary, SlopId } from "../src/types";

// ---------------------------------------------------------------------------
// Sealed refusal — enforced before any read, and again on every read.
// ---------------------------------------------------------------------------

function sealedRoot(): string | null {
  const raw = process.env["SEALED_REPO_PATH"];
  const value = raw?.trim();
  return value ? resolve(value) : null;
}

function refuseSealed(): void {
  const root = sealedRoot();
  if (root !== null) {
    throw new Error(
      `build-site refuses to run: SEALED_REPO_PATH is set (${root}). ` +
        "The public site bundle is built exclusively from public data; nothing under a sealed checkout may be read.",
    );
  }
}

function assertPublic(path: string): void {
  const root = sealedRoot(); // re-checked per read: env must never open a door mid-build
  if (root === null) return;
  const target = resolve(path);
  if (target === root || target.startsWith(root.endsWith("/") ? root : root + "/")) {
    throw new Error(
      `build-site refuses to read ${target}: it resolves inside the sealed checkout ${root}.`,
    );
  }
  throw new Error(
    `build-site refuses to run: SEALED_REPO_PATH is set (${root}); no input may be read.`,
  );
}

function readText(path: string): string {
  assertPublic(path);
  return readFileSync(path, "utf8");
}

function readJson(path: string): unknown {
  const text = readText(path);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`build-site: ${path} is not valid JSON.`);
  }
}

/** Deepest existing ancestor of `start` (inclusive) — used to validate a write
 *  target before mkdirSync, so creating directories can never itself escape. */
function existingAncestor(start: string): string {
  let current = start;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Codepoint comparison — locale-independent, so builds are deterministic. */
function byCodepoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Turn an id into a safe relative path (segments keep "/" as directories).
 *  Rejects — never silently rewrites — absolute paths, backslashes, and
 *  traversal/dot/empty segments: a hostile id or model name fails the build
 *  instead of steering a write outside --out. */
function safePath(id: string): string {
  const refuse = (reason: string): never => {
    throw new Error(`build-site: refusing path-like identity ${JSON.stringify(id)}: ${reason}`);
  };
  if (id.includes("\\")) refuse("backslashes are not allowed");
  if (id.startsWith("/")) refuse("absolute paths are not allowed");
  const segments = id.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      refuse(`segment ${JSON.stringify(segment)} is empty, a dot, or traversal`);
    }
  }
  return segments.map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, "-") || "_").join("/");
}

function fmt(value: number, digits: number): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function fmtPercent(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}

const DIMENSIONS: DimensionId[] = ["clarity", "idiom", "signal", "comms", "tests"];

const DIMENSION_LABELS: Record<DimensionId, string> = {
  clarity: "Clarity & structure",
  idiom: "Idiom & economy",
  signal: "Signal discipline",
  comms: "Communication",
  tests: "Test taste",
};

const SLOP_IDS: SlopId[] = [
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
];

const SLOP_LABELS: Record<SlopId, string> = {
  type_laundering: "Type laundering",
  unvalidated_boundary: "Unvalidated boundary",
  accumulating_copy: "Accumulating copy",
  eager_pipeline: "Eager pipeline",
  comment_slop: "Comment slop",
  emoji_marketing: "Emoji and marketing tone",
  inflated_prose: "Inflated prose",
  swallowed_errors: "Swallowed errors",
  placeholder_residue: "Placeholder residue",
  ceremony_structure: "Ceremony structure",
  self_proving_tests: "Self-proving tests",
  silencing_tells: "Tooling-silencing tells",
};

// ---------------------------------------------------------------------------
// Hand-rolled Markdown → HTML (headings, paragraphs, lists, links, inline
// code/bold/italic, fenced code, tables). No dependencies.
// ---------------------------------------------------------------------------

function inlineMarkdown(source: string): string {
  // Protect code spans from every other transform.
  const codeSpans: string[] = [];
  const tokenized = source.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  let text = escapeHtml(tokenized);

  // Links: [label](url) — only http(s), mailto, and relative targets survive.
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    const decoded = url.replace(/&amp;/g, "&");
    if (!/^(https?:\/\/|mailto:|#|\/|\.)/.test(decoded)) return label;
    return `<a href="${url}">${label}</a>`;
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  text = text.replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>");

  return text.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codeSpans[Number(index)] ?? "");
}

function markdownToHtml(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let i = 0;

  const flush = (): void => {
    if (paragraph.length > 0) {
      out.push(`<p>${paragraph.map(inlineMarkdown).join(" ")}</p>`);
      paragraph = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Fenced code block
    if (/^\s*```/.test(line)) {
      flush();
      const language = line.replace(/^\s*```/, "").trim();
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // closing fence (or EOF)
      const cls = language ? ` class="language-${escapeHtml(language)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(body.join("\n"))}\n</code></pre>`);
      continue;
    }

    // ATX heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      flush();
      const level = Math.min(6, (heading[1] ?? "#").length);
      out.push(`<h${level}>${inlineMarkdown((heading[2] ?? "").trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // Table: header row + divider row
    const nextLine = lines[i + 1] ?? "";
    if (line.trim() !== "" && line.includes("|") && /^\s*\|?[\s:|-]*-[\s:|-]*\|[\s:|-]*$/.test(nextLine)) {
      flush();
      const rawRows = [line];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").trim() !== "" && (lines[i] ?? "").includes("|")) {
        rawRows.push(lines[i] ?? "");
        i += 1;
      }
      const rows = rawRows.map((row) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim()),
      );
      const [header, ...body] = rows;
      const head = (header ?? []).map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`).join("");
      const bodyHtml = body
        .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
        .join("");
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        items.push(`<li>${inlineMarkdown((lines[i] ?? "").replace(/^\s*[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push(`<li>${inlineMarkdown((lines[i] ?? "").replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (line.trim() === "") {
      flush();
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flush();
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Stylesheet — one emitted file, semantic role tokens, dark-mode block.
// ---------------------------------------------------------------------------

const STYLESHEET = `/* Code Taste Bench — generated by scripts/build-site.ts */

:root {
  color-scheme: light;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --label-primary: #1d1d1f;
  --label-secondary: #6e6e73;
  --accent: #0066cc;
  --separator: #d2d2d7;

  /* Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, in rem */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Concentric radii: inner = outer − card padding (16px − 12px = 4px) */
  --radius-outer: 1rem;
  --radius-inner: 0.25rem;
  --pad-card: 0.75rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg-primary: #000000;
    /* Elevation becomes a lighter surface, never a shadow */
    --bg-secondary: #1c1c1e;
    --label-primary: #f5f5f7;
    --label-secondary: #a1a1a6;
    /* Accent desaturates on dark */
    --accent: #6699cc;
    --separator: #38383a;
  }
}

* {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg-primary);
  color: var(--label-primary);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.wrap {
  max-width: 72rem;
  margin-inline: auto;
  padding-inline: var(--space-6);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.skip {
  position: absolute;
  left: var(--space-4);
  top: -4rem;
  z-index: 20;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  padding-inline: var(--space-4);
  background: var(--bg-primary);
  color: var(--accent);
  border: 1px solid var(--separator);
  border-radius: var(--radius-inner);
}

.skip:focus {
  top: var(--space-2);
}

/* Sticky translucent header; content scrolls under it */
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--separator);
}

.header-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  min-height: 3.5rem;
}

.brand {
  color: var(--label-primary);
  text-decoration: none;
  font-weight: 600;
  font-size: 1.0625rem;
}

.site-header nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-left: auto;
}

.site-header nav a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem; /* 44px target */
  padding-inline: var(--space-3);
  color: var(--label-secondary);
  text-decoration: none;
  font-size: 0.9375rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
}

.site-header nav a[aria-current="page"] {
  color: var(--label-primary);
  border-bottom-color: var(--accent);
}

a {
  color: var(--accent);
}

a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

main {
  padding-block: var(--space-8) var(--space-16);
}

h1,
h2,
h3,
h4 {
  line-height: 1.15;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

h1 {
  margin: 0 0 var(--space-3);
  font-size: clamp(1.875rem, 1.25rem + 2vw, 2.75rem);
  font-weight: 700;
  letter-spacing: -0.02em; /* display tracking tightens with size */
  line-height: 1.08;
}

h2 {
  margin: var(--space-8) 0 var(--space-3);
  font-size: 1.375rem;
  font-weight: 600;
}

h3 {
  margin: var(--space-6) 0 var(--space-2);
  font-size: 1.125rem;
  font-weight: 600;
}

p {
  margin: 0 0 var(--space-4);
  max-width: 68ch; /* 45–75ch measure */
}

.lede {
  color: var(--label-secondary);
  font-size: 1.0625rem;
  max-width: 64ch;
}

ul,
ol {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-6);
  max-width: 68ch;
}

li {
  margin-block: var(--space-1);
}

code,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
}

:not(pre) > code {
  background: var(--bg-secondary);
  border-radius: var(--radius-inner);
  padding: 0.125rem 0.375rem;
}

pre {
  margin: 0 0 var(--space-4);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--separator);
  border-radius: var(--radius-outer);
  overflow-x: auto;
  line-height: 1.5;
}

/* Nested inside a padded card, the radius stays concentric */
.card pre,
.card .inner-block {
  border-radius: var(--radius-inner);
}

.card {
  background: var(--bg-primary);
  border: 1px solid var(--separator);
  border-radius: var(--radius-outer);
  padding: var(--pad-card);
}

/* Primary object: the leaderboard table at the largest useful size */
.table-wrap {
  border: 1px solid var(--separator);
  border-radius: var(--radius-outer);
  overflow-x: auto;
  margin-bottom: var(--space-6);
}

.card .table-wrap {
  border-radius: var(--radius-inner);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--separator);
}

th {
  color: var(--label-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

td.num,
.num {
  font-variant-numeric: tabular-nums;
}

.rank-cell {
  color: var(--label-secondary);
  width: 1%; /* keeps the rank column tight */
}

.model-cell {
  font-weight: 500;
}

.model-cell a {
  color: var(--label-primary);
  text-decoration: none;
}

.model-cell a:hover,
.model-cell a:focus-visible {
  text-decoration: underline;
}

.elo {
  font-weight: 600;
  font-size: 1.0625rem;
}

.dim-missing {
  color: var(--label-secondary);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-4);
  margin-block: var(--space-4) var(--space-6);
}

.stat {
  background: var(--bg-primary);
  border: 1px solid var(--separator);
  border-radius: var(--radius-outer);
  padding: var(--pad-card) var(--space-4);
}

.stat .label {
  display: block;
  color: var(--label-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: var(--space-2);
}

.stat .value {
  display: inline-block;
  background: var(--bg-secondary);
  border-radius: var(--radius-inner); /* inner = outer − padding */
  padding: var(--space-1) var(--space-2);
  font-size: 1.375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.notice {
  border: 1px solid var(--separator);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-inner);
  padding: var(--space-4);
  background: var(--bg-secondary);
  max-width: 68ch;
}

.notice p:last-child {
  margin-bottom: 0;
}

.prompt {
  margin: 0 0 var(--space-4);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--separator);
  border-radius: var(--radius-outer);
  white-space: pre-wrap;
  max-width: 72ch;
  font-size: 0.9375rem;
}

.muted {
  color: var(--label-secondary);
}

.meta-line {
  font-size: 0.875rem;
  color: var(--label-secondary);
  font-variant-numeric: tabular-nums;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9375rem;
}

.item-list {
  list-style: none;
  padding: 0;
  margin: var(--space-4) 0 var(--space-6);
  max-width: none;
}

.item-list li {
  border-bottom: 1px solid var(--separator);
  padding-block: var(--space-4);
}

.item-list li:last-child {
  border-bottom: none;
}

.item-list .item-title {
  font-weight: 600;
}

.item-list .item-meta {
  color: var(--label-secondary);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.item-list .item-brief {
  margin: var(--space-1) 0 0;
  max-width: 72ch;
}

.bar-track {
  display: inline-block;
  width: 7rem;
  height: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--separator);
  border-radius: var(--radius-inner);
  overflow: hidden;
  vertical-align: middle;
}

.bar-fill {
  display: block;
  height: 100%;
  background: var(--label-secondary);
}

.site-footer {
  border-top: 1px solid var(--separator);
  padding-block: var(--space-8);
  color: var(--label-secondary);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.site-footer p {
  max-width: 72ch;
}

/* The site barely animates; the only transition respects the user's setting */
@media (prefers-reduced-motion: no-preference) {
  a {
    transition: color 120ms ease;
  }
}
`;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

type NavKey = "leaderboard" | "methodology" | "demo";

function layout(options: {
  title: string;
  description: string;
  depth: number;
  nav: NavKey | null;
  content: string;
  footerNote: string;
}): string {
  const root = "../".repeat(options.depth);
  const navLink = (key: NavKey, href: string, label: string): string => {
    const current = options.nav === key ? ' aria-current="page"' : "";
    return `<a href="${root}${href}"${current}>${label}</a>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} — Code Taste Bench</title>
<meta name="description" content="${escapeHtml(options.description)}">
<link rel="stylesheet" href="${root}styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${root}index.html">Code Taste Bench</a>
    <nav aria-label="Site sections">
      ${navLink("leaderboard", "index.html", "Leaderboard")}
      ${navLink("methodology", "methodology.html", "Methodology")}
      ${navLink("demo", "demo/index.html", "Demo Items")}
    </nav>
  </div>
</header>
<main id="main" class="wrap">
${options.content}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>${options.footerNote}</p>
    <p>Public data only. <a href="https://github.com/dymoo/code-taste-bench">Source on GitHub</a>.</p>
  </div>
</footer>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

interface RawDetail {
  name: string;
  data: unknown;
}

interface Inputs {
  dataDir: string;
  leaderboard: Leaderboard;
  items: Item[];
  rawByItem: Record<string, RawDetail[]>;
  methodology: string | null;
}

function loadLeaderboard(dataDir: string): Leaderboard {
  const path = join(dataDir, "results", "results.json");
  if (!existsSync(path)) {
    throw new Error(
      `build-site: ${path} not found. Run the scoring step first, or point --data at a directory that contains results/results.json.`,
    );
  }
  const parsed = readJson(path);
  if (!isRecord(parsed) || !Array.isArray(parsed["models"])) {
    throw new Error(`build-site: ${path} does not contain a Leaderboard (missing models array).`);
  }
  return parsed as unknown as Leaderboard;
}

function loadItems(dataDir: string): Item[] {
  const dir = join(dataDir, "data", "items", "demo");
  if (!existsSync(dir)) return [];
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const entry of readdirSync(dir).sort(byCodepoint)) {
    if (!entry.endsWith(".json")) continue;
    const file = join(dir, entry);
    const parsed = readJson(file); // throws with the file path on invalid JSON
    let item: Item;
    try {
      item = validateItem(parsed);
    } catch (cause) {
      throw new Error(`build-site: ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if (item.tier !== "demo") {
      throw new Error(
        `build-site: ${file}: item ${JSON.stringify(item.id)} has tier ${JSON.stringify(item.tier)}; only demo-tier items may be published.`,
      );
    }
    if (item.license.redistribution !== "demo-eligible") {
      throw new Error(
        `build-site: ${file}: item ${JSON.stringify(item.id)} has license redistribution ${JSON.stringify(item.license.redistribution)}; only demo-eligible items may be published.`,
      );
    }
    if (seen.has(item.id)) {
      throw new Error(`build-site: duplicate item id ${JSON.stringify(item.id)} (${file}).`);
    }
    seen.add(item.id);
    items.push(item);
  }
  return items.sort((a, b) => byCodepoint(a.id, b.id));
}

function loadRawDetail(dataDir: string, items: Item[]): Record<string, RawDetail[]> {
  const byItem: Record<string, RawDetail[]> = {};
  const dir = join(dataDir, "results", "raw");
  if (!existsSync(dir) || items.length === 0) return byItem;
  const files = readdirSync(dir).sort(byCodepoint);
  for (const item of items) {
    const matches: RawDetail[] = [];
    for (const file of files) {
      if (!file.endsWith(".json") || !file.includes(item.id)) continue;
      try {
        matches.push({ name: file, data: readJson(join(dir, file)) });
      } catch {
        // Unparseable detail files are skipped silently; the page degrades.
      }
    }
    if (matches.length > 0) byItem[item.id] = matches;
  }
  return byItem;
}

function loadMethodology(dataDir: string): string | null {
  const path = join(dataDir, "docs", "methodology.md");
  if (!existsSync(path)) return null;
  return readText(path);
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function dimensionMean(model: ModelSummary, dimension: DimensionId): string {
  const stat = model.dimensions[dimension];
  if (!stat) return `<span class="dim-missing" title="Omitted for every artifact in this run">&mdash;</span>`;
  return fmt(stat.mean, 2);
}

function noulValue(value: unknown): number | null {
  return isRecord(value) && typeof value["noul"] === "number" ? value["noul"] : null;
}

function renderLeaderboardTable(models: ModelSummary[]): string {
  const header = [
    "Rank",
    "Model",
    "Taste Elo",
    ...DIMENSIONS.map((d) => {
      const label = DIMENSION_LABELS[d];
      return `<th scope="col">${escapeHtml(label)}</th>`;
    }),
    "Slop density",
    "Duels",
  ];

  const rows = models
    .map((model, index) => {
      const cells = DIMENSIONS.map(
        (dimension) => `<td class="num">${dimensionMean(model, dimension)}</td>`,
      ).join("");
      return `<tr>
<td class="num rank-cell">${index + 1}</td>
<td class="model-cell"><a href="models/${safePath(model.model)}.html">${escapeHtml(model.model_label)}</a></td>
<td class="num elo">${fmt(model.taste_elo, 1)}</td>
${cells}
<td class="num" title="${fmt(model.slop_density, 3)} raw">${fmtPercent(model.slop_density)}</td>
<td class="num">${model.duels}</td>
</tr>`;
    })
    .join("\n");

  return `<div class="table-wrap">
<table>
<caption class="sr-only">Models ranked by Taste Elo, with per-dimension rubric means, slop density, and duel counts</caption>
<thead>
<tr>${header.map((cell) => (cell.startsWith("<th") ? cell : `<th scope="col">${cell}</th>`)).join("")}</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
}

function renderIndex(leaderboard: Leaderboard): string {
  const models = [...leaderboard.models].sort(
    (a, b) => b.taste_elo - a.taste_elo || byCodepoint(a.model, b.model),
  );

  const table =
    models.length > 0
      ? renderLeaderboardTable(models)
      : `<div class="notice"><p><strong>No models are ranked yet.</strong> Rows appear after the first scoring run writes <code>results/results.json</code> with at least one model. The leaderboard is built from that file alone; nothing is ranked until duels have been judged and rated.</p></div>`;

  const reliability = leaderboard.reliability;
  const sealed = leaderboard.sealed_aggregates;

  return `<h1>Leaderboard</h1>
<p class="lede">Models ranked by Taste Elo from same-task duels, with mean rubric scores per dimension, slop density, and duel counts. Each model opens a page showing exactly how it was judged; the protocol is on the <a href="methodology.html">Methodology</a> page.</p>
${table}
<h2>Run details</h2>
<div class="stat-grid">
  <div class="stat"><span class="label">Judge</span><span class="value">${escapeHtml(leaderboard.judge_generation)}</span></div>
  <div class="stat"><span class="label">Swap agreement</span><span class="value">${fmtPercent(reliability.swap_agreement)}</span></div>
  <div class="stat"><span class="label">Repeat agreement</span><span class="value">${fmtPercent(reliability.repeat_agreement)}</span></div>
  <div class="stat"><span class="label">Duels judged</span><span class="value">${reliability.total_duels}</span></div>
</div>
<p class="meta-line">Swap and repeat agreement are judge reliability — how reproducible the judge is — not agreement with human raters. Repeat sample: ${reliability.repeat_sample} duels.</p>
<h2>Sealed tier, in aggregate</h2>
<p class="meta-line">${sealed.tasks} tasks &middot; ${sealed.items} items &middot; ${sealed.duels} duels. Sealed briefs, code, and prompts never enter this bundle; only these counts and the published score distributions ship publicly.</p>
<p class="meta-line">Generated ${escapeHtml(leaderboard.generated_at)} &middot; suite ${escapeHtml(leaderboard.suite_sha)}</p>`;
}

function renderModelPage(leaderboard: Leaderboard, model: ModelSummary, rank: number, items: Item[], raw: Record<string, RawDetail[]>): string {
  const modelItems = items.filter((item) => item.provenance.model === model.model);

  const dimensionRows = DIMENSIONS.map((dimension) => {
    const stat = model.dimensions[dimension];
    if (!stat) {
      return `<tr><th scope="row">${escapeHtml(DIMENSION_LABELS[dimension])}</th><td class="dim-missing" colspan="3">Omitted in this run</td></tr>`;
    }
    return `<tr>
<th scope="row">${escapeHtml(DIMENSION_LABELS[dimension])}</th>
<td class="num">${fmt(stat.mean, 2)}</td>
<td class="num">${fmt(stat.ci[0], 2)}&ndash;${fmt(stat.ci[1], 2)}</td>
<td class="num">${stat.n}</td>
</tr>`;
  }).join("\n");

  // Slop diagnostics for this model's published demo items, when raw judge detail exists.
  const profiles = modelItems
    .flatMap((item) => raw[item.id] ?? [])
    .map((detail) => detail.data)
    .filter((data): data is Record<string, unknown> => isRecord(data) && isRecord(data["slop"]));
  let slopSection: string;
  if (profiles.length > 0) {
    const rows = SLOP_IDS.map((id) => {
      const values = profiles
        .map((profile) => noulValue((profile["slop"] as Record<string, unknown>)[id]))
        .filter((value): value is number => value !== null);
      if (values.length === 0) return "";
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const width = Math.round(Math.min(1, Math.max(0, mean)) * 100);
      return `<tr>
<th scope="row">${escapeHtml(SLOP_LABELS[id])}</th>
<td class="num">${fmtPercent(mean)}</td>
<td><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${width}%"></span></span></td>
<td class="num muted">${values.length} item${values.length === 1 ? "" : "s"}</td>
</tr>`;
    }).join("\n");
    slopSection = `<p class="meta-line">Across ${profiles.length} published demo artifact${profiles.length === 1 ? "" : "s"} with raw judge detail. Whole-run slop density: <span class="num">${fmtPercent(model.slop_density)}</span> (${fmt(model.slop_density, 3)} raw).</p>
<div class="table-wrap">
<table>
<thead><tr><th scope="col">Diagnostic</th><th scope="col">Flagged</th><th scope="col">Share</th><th scope="col">Based on</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
  } else {
    slopSection = `<p class="meta-line">Whole-run slop density: <span class="num">${fmtPercent(model.slop_density)}</span> (${fmt(model.slop_density, 3)} raw), the mean of twelve binary diagnostics across this model's artifacts. Per-diagnostic detail appears here once raw judge output for this model's demo items is published under <code>results/raw/</code>.</p>`;
  }

  let provenance: string;
  if (modelItems.length > 0) {
    const harnesses = [...new Set(modelItems.map((item) => item.provenance.harness))].sort(byCodepoint);
    const versions = [...new Set(modelItems.map((item) => item.provenance.harness_version))].sort(byCodepoint);
    const temperatures = [...new Set(modelItems.map((item) => String(item.provenance.temperature)))].sort(byCodepoint);
    const generated = modelItems.map((item) => item.provenance.generated_at).sort(byCodepoint);
    const sources = [...new Set(modelItems.map((item) => item.provenance.source))].sort(byCodepoint);
    provenance = `<div class="table-wrap">
<table>
<tbody>
<tr><th scope="row">Harness</th><td class="mono">${escapeHtml(harnesses.join(", "))} ${escapeHtml(versions.join(", "))}</td></tr>
<tr><th scope="row">Temperature</th><td class="num">${escapeHtml(temperatures.join(", "))}</td></tr>
<tr><th scope="row">Generated</th><td class="num">${escapeHtml(generated[0] ?? "—")}${generated.length > 1 ? ` &ndash; ${escapeHtml(generated[generated.length - 1] ?? "")}` : ""}</td></tr>
<tr><th scope="row">Source</th><td>${escapeHtml(sources.join(", "))}</td></tr>
<tr><th scope="row">Published demo items</th><td class="num">${modelItems.length}</td></tr>
</tbody>
</table>
</div>`;
  } else {
    provenance = `<p class="meta-line">No demo items from this model are published yet. Harness provenance (harness version, temperature, generation time) appears here with its first public demo item.</p>`;
  }

  const snapshotRows = Object.keys(leaderboard.snapshots)
    .sort(byCodepoint)
    .map((key) => `<tr><th scope="row">${escapeHtml(key)}</th><td class="num">${escapeHtml(String(leaderboard.snapshots[key]))}</td></tr>`)
    .join("\n");

  const wlt = `${model.wins}&ndash;${model.losses}&ndash;${model.ties}`;

  const content = `<h1>${escapeHtml(model.model_label)}</h1>
<p class="lede mono">${escapeHtml(model.model)} &middot; Rank ${rank} of ${leaderboard.models.length}</p>
<div class="stat-grid">
  <div class="stat"><span class="label">Taste Elo</span><span class="value">${fmt(model.taste_elo, 1)}</span></div>
  <div class="stat"><span class="label">Duels (W&ndash;L&ndash;T)</span><span class="value">${model.duels} <span class="muted">${wlt}</span></span></div>
  <div class="stat"><span class="label">Slop density</span><span class="value">${fmtPercent(model.slop_density)}</span></div>
  <div class="stat"><span class="label">Artifacts judged</span><span class="value">${model.items}</span></div>
</div>
<h2>Rubric profile</h2>
<p class="meta-line">Mean score per dimension on the 0&ndash;4 level scale, with bootstrap confidence interval and sample size. Dimensions are omitted when no artifact qualifies (Communication without an explanation, Test taste when tests are out of scope); the composite renormalizes.</p>
<div class="table-wrap">
<table>
<thead><tr><th scope="col">Dimension</th><th scope="col">Mean</th><th scope="col">95% CI</th><th scope="col">n</th></tr></thead>
<tbody>
${dimensionRows}
</tbody>
</table>
</div>
<h2>Slop diagnostics</h2>
${slopSection}
<h2>Harness provenance</h2>
${provenance}
<h2>Judge</h2>
<p class="meta-line">Generation <span class="mono">${escapeHtml(leaderboard.judge_generation)}</span>, frozen for this run. Serving snapshot ids recorded per run:</p>
<div class="table-wrap">
<table>
<tbody>
${snapshotRows || '<tr><td class="muted">No snapshots recorded.</td></tr>'}
</tbody>
</table>
</div>
<p class="meta-line">How these numbers are produced is documented on the <a href="../methodology.html">Methodology</a> page.</p>`;

  return content;
}

function renderDemoIndex(items: Item[]): string {
  const list =
    items.length > 0
      ? `<ul class="item-list">
${items
  .map(
    (item) => `<li>
<span class="item-title"><a href="${safePath(item.id)}.html">${escapeHtml(item.id)}</a></span>
<span class="item-meta">${escapeHtml(item.provenance.model_label)} &middot; ${escapeHtml(item.task.kind)} &middot; ${escapeHtml(item.task.language)} &middot; ${escapeHtml(item.artifact.form)}</span>
<p class="item-brief">${escapeHtml(item.task.brief)}</p>
</li>`,
  )
  .join("\n")}
</ul>`
      : `<div class="notice"><p><strong>No demo items are published yet.</strong> A demo item appears here once the corpus has been generated and validated: each one carries the task brief, the model's artifact, the exact prompt, and the judge's outputs so anyone can spot-check the judging. Sealed items never appear on this page; they are documented in aggregate only on the <a href="../methodology.html">Methodology</a> page.</p></div>`;

  return `<h1>Demo Items</h1>
<p class="lede">The public tier of the test set, published in full: task, artifact, prompt, explanation, provenance, and judge detail for every item, so the judging can be verified item by item.</p>
${list}`;
}

function renderJudgeDetail(details: RawDetail[]): string {
  const blocks = details.map((detail) => {
    const data = detail.data;
    if (!isRecord(data)) {
      return `<p class="meta-line">${escapeHtml(detail.name)}: unstructured detail, shown as recorded.</p><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

    const sections: string[] = [];
    sections.push(`<p class="meta-line">Source: <span class="mono">${escapeHtml(detail.name)}</span></p>`);

    if (typeof data["composite"] === "number" || isRecord(data["dimensions"]) || isRecord(data["slop"])) {
      if (typeof data["composite"] === "number") {
        sections.push(`<p class="meta-line">Composite taste score: <span class="num">${fmt((data["composite"] as number) / 4 * 100, 1)}%</span> of the 0&ndash;4 scale (${fmt(data["composite"] as number, 2)} raw).</p>`);
      }
      if (isRecord(data["dimensions"])) {
        const dimensions = data["dimensions"];
        const rows = DIMENSIONS.filter((dimension) => dimensions[dimension] !== undefined)
          .map((dimension) => {
            const answer = dimensions[dimension];
            const score = isRecord(answer) && typeof answer["score"] === "number" ? answer["score"] : null;
            const confidence = isRecord(answer) && typeof answer["confidence"] === "number" ? answer["confidence"] : null;
            return `<tr><th scope="row">${escapeHtml(DIMENSION_LABELS[dimension])}</th><td class="num">${score !== null ? fmt(score, 2) : "—"}</td><td class="num">${confidence !== null ? fmtPercent(confidence) : "—"}</td></tr>`;
          })
          .join("\n");
        if (rows) {
          sections.push(`<div class="table-wrap"><table>
<thead><tr><th scope="col">Dimension</th><th scope="col">Score (0&ndash;4)</th><th scope="col">Confidence</th></tr></thead>
<tbody>${rows}</tbody></table></div>`);
        }
      }
      if (isRecord(data["slop"])) {
        const slop = data["slop"];
        const rows = SLOP_IDS.map((id) => {
          const value = noulValue(slop[id]);
          if (value === null) return "";
          const width = Math.round(Math.min(1, Math.max(0, value)) * 100);
          return `<tr><th scope="row">${escapeHtml(SLOP_LABELS[id])}</th><td class="num">${fmtPercent(value)}</td><td><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${width}%"></span></span></td></tr>`;
        }).join("\n");
        if (rows) {
          sections.push(`<div class="table-wrap"><table>
<thead><tr><th scope="col">Slop diagnostic</th><th scope="col">Flagged</th><th scope="col">&nbsp;</th></tr></thead>
<tbody>${rows}</tbody></table></div>`);
        }
      }
      const hasExplanation = noulValue(data["has_explanation"]);
      const hasTests = noulValue(data["has_tests"]);
      if (hasExplanation !== null || hasTests !== null) {
        const cells: string[] = [];
        if (hasExplanation !== null) cells.push(`Explanation present: ${fmtPercent(hasExplanation)}`);
        if (hasTests !== null) cells.push(`Tests present: ${fmtPercent(hasTests)}`);
        sections.push(`<p class="meta-line">${cells.join(" &middot; ")}</p>`);
      }
      if (sections.length === 1) {
        sections.push(`<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`);
      }
      return sections.join("\n");
    }

    if (isRecord(data["answers"])) {
      const answers = data["answers"];
      const rows = Object.keys(answers)
        .sort(byCodepoint)
        .map((key) => `<tr><th scope="row">${escapeHtml(key)}</th><td>${escapeHtml(JSON.stringify(answers[key]))}</td></tr>`)
        .join("\n");
      const judge = typeof data["model"] === "string" ? `<p class="meta-line">Judge call <span class="mono">${escapeHtml(typeof data["id"] === "string" ? data["id"] : detail.name)}</span> by <span class="mono">${escapeHtml(data["model"])}</span>.</p>` : "";
      return `${sections.join("\n")}${judge}<div class="table-wrap"><table><tbody>${rows}</tbody></table></div>`;
    }

    return `${sections.join("\n")}<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  });

  return `<h2>Judge detail</h2>
<p class="meta-line">Raw judge output recorded for this item, published so the scoring can be checked line by line.</p>
${blocks.join("\n")}`;
}

function renderItemPage(item: Item, details: RawDetail[] | undefined): string {
  const modelHref = `../models/${safePath(item.provenance.model)}.html`;

  const files = item.artifact.files
    .map(
      (file) => `<h3>${escapeHtml(file.path)}</h3>
<pre><code>${escapeHtml(file.content)}
</code></pre>`,
    )
    .join("\n");

  const explanation = item.context.explanation
    ? `<h2>Explanation</h2><p>${escapeHtml(item.context.explanation)}</p>`
    : `<h2>Explanation</h2><p class="muted">This artifact carries no explanation, so the Communication dimension is omitted for it and the composite renormalizes across the remaining dimensions.</p>`;

  const failure = item.generation_failed
    ? `<div class="notice"><p><strong>This generation failed.</strong> Failed or empty generations are recorded and excluded from duels.</p></div>`
    : "";

  const contamination = [
    item.contamination.public_since ? `Public since ${escapeHtml(item.contamination.public_since)}` : "Not previously public",
    item.contamination.viral ? "Viral exposure recorded" : "No viral exposure recorded",
  ].join(" &middot; ");

  const judgeSection =
    details !== undefined && details.length > 0
      ? renderJudgeDetail(details)
      : `<h2>Judge detail</h2><p class="muted">No raw judge output is published for this item yet. When it is, it lands under <code>results/raw/</code> and appears here verbatim; the rubric and protocol are already documented on the <a href="../methodology.html">Methodology</a> page.</p>`;

  const content = `<h1>${escapeHtml(item.id)}</h1>
<p class="lede">${escapeHtml(item.task.brief)}</p>
${failure}
<div class="table-wrap">
<table>
<tbody>
<tr><th scope="row">Model</th><td class="model-cell"><a href="${modelHref}">${escapeHtml(item.provenance.model_label)}</a> <span class="mono muted">${escapeHtml(item.provenance.model)}</span></td></tr>
<tr><th scope="row">Task</th><td>${escapeHtml(item.task.id)} &middot; ${escapeHtml(item.task.kind)} &middot; ${escapeHtml(item.task.language)} &middot; tests ${item.task.tests_expected ? "expected" : "out of scope"}</td></tr>
<tr><th scope="row">Harness</th><td class="mono">${escapeHtml(item.provenance.harness)} ${escapeHtml(item.provenance.harness_version)} at temperature ${escapeHtml(String(item.provenance.temperature))}</td></tr>
<tr><th scope="row">Generated</th><td class="num">${escapeHtml(item.provenance.generated_at)} (${escapeHtml(item.provenance.source)})</td></tr>
<tr><th scope="row">License</th><td>${escapeHtml(item.license.spdx)} &middot; ${escapeHtml(item.license.redistribution)}${item.license.notes ? ` &middot; ${escapeHtml(item.license.notes)}` : ""}</td></tr>
<tr><th scope="row">Contamination</th><td>${contamination}</td></tr>
</tbody>
</table>
</div>
<h2>Prompt</h2>
<blockquote class="prompt">${escapeHtml(item.context.prompt)}</blockquote>
<h2>Artifact</h2>
<p class="meta-line">Form: ${escapeHtml(item.artifact.form)}</p>
${files}
${explanation}
${judgeSection}`;

  return content;
}

function renderMethodology(markdown: string | null): string {
  if (markdown === null) {
    return `<h1>Methodology</h1>
<div class="notice">
<p><strong>The methodology source is not available in this build.</strong> This page renders <code>docs/methodology.md</code> from the repository; the page will show the full protocol once that file ships with the data directory. Until then, the leaderboard still publishes only aggregates, and no sealed material is included either way.</p>
</div>`;
  }

  let body = markdown.trimStart();
  // The layout owns the single h1; drop a leading H1 from the source.
  body = body.replace(/^#\s+[^\n]*\n+/, "");
  return `<h1>Methodology</h1>
<article class="prose">
${markdownToHtml(body)}
</article>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface CliOptions {
  dataDir: string;
  outDir: string;
}

function parseCli(argv: string[]): CliOptions {
  let dataDir = ".";
  let outDir = "site/dist";
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--data") {
      if (value === undefined) throw new Error("build-site: --data requires a directory argument.");
      dataDir = value;
      i += 1;
    } else if (flag === "--out") {
      if (value === undefined) throw new Error("build-site: --out requires a directory argument.");
      outDir = value;
      i += 1;
    } else {
      throw new Error(`build-site: unknown argument ${flag ?? ""}. Usage: --data <dir> --out <dir>`);
    }
  }
  return { dataDir: resolve(dataDir), outDir: resolve(outDir) };
}

function main(): void {
  refuseSealed(); // first statement: nothing may be read while a sealed path is configured

  const options = parseCli(process.argv.slice(2));
  const dataDir = options.dataDir;
  const outDir = options.outDir;

  const leaderboard = loadLeaderboard(dataDir);
  const items = loadItems(dataDir);
  const raw = loadRawDetail(dataDir, items);
  const methodology = loadMethodology(dataDir);

  const models = [...leaderboard.models].sort(
    (a, b) => b.taste_elo - a.taste_elo || byCodepoint(a.model, b.model),
  );

  const footerNote = `Generated ${leaderboard.generated_at} · judge ${leaderboard.judge_generation} · suite ${leaderboard.suite_sha}`;

  const inputs: Inputs = { dataDir, leaderboard, items, rawByItem: raw, methodology };

  const write = (relativePath: string, content: string): void => {
    if (relativePath === "" || isAbsolute(relativePath) || relativePath.includes("\\")) {
      throw new Error(`build-site: refusing to write ${JSON.stringify(relativePath)}: not a plain relative output path.`);
    }
    const target = join(outDir, relativePath);
    const lexical = relative(outDir, target);
    if (lexical === "" || lexical.startsWith("..") || isAbsolute(lexical)) {
      throw new Error(`build-site: refusing to write ${target}: it escapes the output root ${outDir}.`);
    }
    assertPublic(target);
    // Validate the deepest EXISTING ancestor before mkdir: creating directory
    // levels through a symlink planted inside --out would itself escape the
    // root. Resolve symlinks on both sides of the comparison.
    const rootStart = existsSync(outDir) ? outDir : existingAncestor(outDir);
    const dirStart = existingAncestor(dirname(target));
    const pre = relative(realpathSync(rootStart), realpathSync(dirStart));
    if (pre.startsWith("..") || isAbsolute(pre)) {
      throw new Error(
        `build-site: refusing to write ${target}: ${dirStart} resolves outside the output root ${rootStart} (symlink ancestor?).`,
      );
    }
    mkdirSync(dirname(target), { recursive: true });
    // Re-check after mkdir: the directory now exists, so resolve it directly.
    const rootReal = realpathSync(outDir);
    const dirReal = realpathSync(dirname(target));
    const resolved = relative(rootReal, dirReal);
    if (resolved.startsWith("..") || isAbsolute(resolved)) {
      throw new Error(
        `build-site: refusing to write ${target}: its directory resolves to ${dirReal}, outside the output root ${rootReal} (symlink ancestor?).`,
      );
    }
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
      throw new Error(`build-site: refusing to write ${target}: it is a symlink.`);
    }
    writeFileSync(target, content, "utf8");
  };

  write("styles.css", STYLESHEET);

  write(
    "index.html",
    layout({
      title: "Leaderboard",
      description: "Models ranked by Taste Elo, with per-dimension rubric means, slop density, and duel counts.",
      depth: 0,
      nav: "leaderboard",
      content: renderIndex(inputs.leaderboard),
      footerNote,
    }),
  );

  write(
    "methodology.html",
    layout({
      title: "Methodology",
      description: "How code-taste-bench measures taste: rubric, duels, Taste Elo, judge policy, and reliability.",
      depth: 0,
      nav: "methodology",
      content: renderMethodology(inputs.methodology),
      footerNote,
    }),
  );

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    if (model === undefined) continue;
    const relative = `models/${safePath(model.model)}.html`;
    const depth = model.model.split("/").length;
    write(
      relative,
      layout({
        title: model.model_label,
        description: `${model.model_label}: Taste Elo ${fmt(model.taste_elo, 1)}, rubric profile, slop diagnostics, harness provenance, and judge snapshots.`,
        depth,
        nav: null,
        content: renderModelPage(inputs.leaderboard, model, index + 1, inputs.items, inputs.rawByItem),
        footerNote,
      }),
    );
  }

  write(
    "demo/index.html",
    layout({
      title: "Demo Items",
      description: "Public demo items: task brief, artifact code, prompt, explanation, provenance, and judge detail.",
      depth: 1,
      nav: "demo",
      content: renderDemoIndex(inputs.items),
      footerNote,
    }),
  );

  for (const item of inputs.items) {
    const depth = 1 + item.id.split("/").length - 1;
    write(
      `demo/${safePath(item.id)}.html`,
      layout({
        title: item.id,
        description: `Demo item ${item.id}: ${item.task.brief}`,
        depth,
        nav: "demo",
        content: renderItemPage(item, inputs.rawByItem[item.id]),
        footerNote,
      }),
    );
  }

  const pageCount =
    2 + models.length + 1 + inputs.items.length; // index + methodology + models + demo index + items
  console.log(
    `build-site: wrote ${pageCount} pages and styles.css to ${outDir} ` +
      `(${models.length} model page${models.length === 1 ? "" : "s"}, ${inputs.items.length} demo item${inputs.items.length === 1 ? "" : "s"}).`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
