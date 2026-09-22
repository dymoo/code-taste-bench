/**
 * Harvest internlm/WildClawBench-Trajectories into explicit private quarantine.
 *
 * HOSTILE-DATA POLICY (SPEC section 3): everything fetched here is DATA and is
 * never executed. Text-only extraction: dataset JSON is fetched with `fetch`
 * (datasets-server `rows` API for trajectories; Hugging Face API for metadata)
 * and agent-produced files are parsed statically in-process from the companion
 * raw archives (`resolve/<sha>/output_*.tar.gz|.zip`) with a hand-rolled tar
 * reader over `node:zlib` gunzip streams and a central-directory zip reader
 * over `node:zlib` inflate (the shell `bun` here is 1.2.x, which has no
 * global `DecompressionStream`).
 * No installs, no added dependencies, no dataset loader code, no
 * `trust_remote_code`, and no execution of harvested code, scripts, hooks or
 * examples — harvested bytes only ever become `ArtifactFile.content` strings.
 *
 * QUARANTINE-ONLY OUTPUT: harvests are rejected-evidence material, never
 * leaderboard material. An explicit `--out` directory OUTSIDE this public
 * checkout is required — there is no default destination, the run fails before
 * any network request without one, and this script never writes into
 * data/items/demo or otherwise auto-publishes into the repo.
 *
 * Bounded intake (defense in depth, not a guarantee): every fetch is HTTPS to
 * the huggingface.co allowlist with manual bounded-redirect hops, finite
 * timeouts and hard byte budgets; archives get entry/count/decompression caps,
 * symlink and special entries are skipped, and member paths never reach a
 * filesystem API — only slugified ids are written, contained in --out. See LIMITS.
 *
 * Usage: bun scripts/harvest-wildclaw.ts --out <dir> [--force]
 *   --out    required output directory outside the public checkout (quarantine)
 *   --force  rewrite item files that already exist (default: skip existing ids)
 *
 * Pilot scope: the first 5 task ids (sorted) whose agent-produced `task_output`
 * files across the model roster use a supported language
 * (typescript|javascript|python), x up to 12 models (one Item per (task, model)).
 * Tasks whose outputs are another language entirely are skipped and reported.
 *
 * Determinism for a given dataset revision: the revision sha is captured from
 * the Hugging Face API once per run; archive URLs and the repo file listing are
 * pinned to that sha. The datasets-server `rows` endpoint accepts no effective
 * revision parameter (verified: bogus revisions return the same rows), so row
 * data comes from the live index for that dataset.
 */

import { lstatSync, mkdirSync, realpathSync, writeFileSync, type Stats } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { createGunzip, inflateRawSync } from "node:zlib";
import { validateItem } from "../src/items/schema";
import type { Item, Language } from "../src/types";

// ---------------------------------------------------------------- constants

const DATASET = "internlm/WildClawBench-Trajectories";
const DATASET_URL = `https://huggingface.co/datasets/${DATASET}`;
const HF_API = `https://huggingface.co/api/datasets/${DATASET}`;
const ROWS_API = `https://datasets-server.huggingface.co/rows?dataset=${DATASET}&config=default&split=train`;
// The public checkout is never a valid destination; output must be an
// explicit --out directory outside it (see resolveOutputDir).
const CHECKOUT_ROOT = resolve(join(import.meta.dir, ".."));
const PILOT_TASKS = 5;
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 4;

// The harness writes its own execution log into task_output; it is not an
// agent-produced artifact (the dataset card lists execution logs separately
// from "all files the agent produced (task_output/)").
const HARNESS_LOG = /^openclaw-\d{4}-\d{2}-\d{2}\.log$/;

const CODE_EXT: Record<string, Language> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
};
// Deterministic tie-break when a task's files span several languages.
const LANG_PRIORITY: Language[] = ["typescript", "javascript", "python"];

// ------------------------------------------------------------ resource limits
// Every budget below fails loudly via fail() when exceeded — nothing is ever
// silently truncated. Byte counts are wire bytes unless the name says otherwise.

export interface Limits {
  maxResponseBytes: number; // one HTTP response body
  maxJsonBytes: number; // JSON API bodies (metadata, tree listing, rows)
  maxRedirectHops: number; // manual redirect hops followed per request
  requestTimeoutMs: number; // API/JSON request timeout (connect + headers + body)
  archiveTimeoutMs: number; // archive download + decompression timeout
  maxEntryBytes: number; // one archive member (tar entry or zip file)
  maxTarInflatedBytes: number; // cumulative gunzip output per tar.gz walk
  maxEntriesPerArchive: number; // members seen per archive
  maxNameBytes: number; // archive member path length
  maxRetainedZipBytes: number; // zips cached in memory between survey and extraction
}

export const LIMITS: Limits = {
  maxResponseBytes: 1024 ** 3, // 1073741824 (1 GiB)
  maxJsonBytes: 128 * 1024 ** 2, // 134217728 (128 MiB)
  maxRedirectHops: 5,
  requestTimeoutMs: 120_000,
  archiveTimeoutMs: 600_000,
  maxEntryBytes: 64 * 1024 ** 2, // 67108864 (64 MiB)
  maxTarInflatedBytes: 1024 ** 3, // 1073741824 (1 GiB) per walk
  maxEntriesPerArchive: 250_000,
  maxNameBytes: 4096,
  maxRetainedZipBytes: 2 * 1024 ** 3, // 2147483648 (2 GiB)
};

// Narrow HTTPS allowlist: huggingface.co and its subdomains — which include
// datasets-server.huggingface.co and the cdn-lfs data CDN. Generic internet
// hosts, IP literals, private/link-local addresses and odd ports are excluded
// by construction (defense in depth, not a guarantee against DNS tricks).
const REDIRECT_STATUSES: Record<number, true> = { 301: true, 302: true, 303: true, 307: true, 308: true };

// ------------------------------------------------------------------ helpers

const dec = new TextDecoder();
const utf8Fatal = new TextDecoder("utf-8", { fatal: true });

/** Async-iterate a fetch body's chunks (ReadableStream lacks async iteration on Bun 1.2). */
async function* webChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const bodyReader = body.getReader();
  for (;;) {
    const { value, done } = await bodyReader.read();
    if (done) return;
    yield value;
  }
}

function fail(message: string): never {
  throw new Error(`harvest-wildclaw: ${message}`);
}

/** Assert an HTTPS URL on the huggingface.co allowlist; reject everything
 * else (generic hosts, IP literals, userinfo tricks, odd ports, bad URLs). */
export function assertAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(`blocked invalid URL ${JSON.stringify(raw)}`);
  }
  if (url.protocol !== "https:") fail(`blocked non-HTTPS URL ${JSON.stringify(raw)}`);
  if (url.username !== "" || url.password !== "") fail(`blocked URL with userinfo ${JSON.stringify(raw)}`);
  if (url.port !== "" && url.port !== "443") fail(`blocked URL with non-default port ${url.port} on ${url.hostname}`);
  const host = url.hostname;
  if (host !== "huggingface.co" && !host.endsWith(".huggingface.co")) {
    fail(`blocked URL host ${JSON.stringify(host)} outside the huggingface.co allowlist`);
  }
  return url;
}

/** The revision sha is interpolated into tree/resolve URLs: 40 lowercase hex. */
export function validateSha(sha: string): string {
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
    fail(`dataset revision ${JSON.stringify(sha)} is not a 40-character lowercase sha`);
  }
  return sha;
}

/** Repo listing paths are interpolated into request URLs: accept only plain
 * relative paths of safe segments — no traversal, query or fragment shaping. */
export function validateTreePath(entry: unknown): string {
  if (typeof entry !== "object" || entry === null || !("path" in entry) || typeof entry.path !== "string") {
    fail("repo file listing entry is not { path: string }");
  }
  const path = entry.path;
  if (
    path === "" ||
    !/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(path) ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    fail(`repo file listing path ${JSON.stringify(path)} is not a plain relative path`);
  }
  return path;
}

/** Give a stream/transport error context unless it is already one of ours. */
function streamFail(label: string, error: unknown): never {
  if (error instanceof Error && error.message.startsWith("harvest-wildclaw:")) throw error;
  fail(`${label}: transport error (${error instanceof Error ? error.message : String(error)})`);
}

/** Async-iterate chunks while counting them against a hard byte cap. */
async function* countedChunks(chunks: AsyncGenerator<Uint8Array>, maxBytes: number, label: string): AsyncGenerator<Uint8Array> {
  let total = 0;
  for await (const chunk of chunks) {
    total += chunk.byteLength;
    if (total > maxBytes) fail(`${label}: body exceeds the ${maxBytes}-byte limit`);
    yield chunk;
  }
}

/** Buffer a response body under a hard cap: Content-Length is checked first,
 * then the streamed byte count — either way an oversize body fails loudly. */
async function readBody(res: Response, maxBytes: number, label: string): Promise<Uint8Array> {
  const declared = res.headers.get("content-length");
  if (declared !== null && declared.trim() !== "") {
    if (!/^\d+$/.test(declared.trim())) fail(`${label}: invalid Content-Length ${JSON.stringify(declared)}`);
    const n = Number(declared.trim());
    if (n > maxBytes) fail(`${label}: Content-Length ${n} exceeds the ${maxBytes}-byte limit`);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (res.body !== null) {
    try {
      for await (const chunk of countedChunks(webChunks(res.body), maxBytes, label)) {
        chunks.push(chunk);
        total += chunk.byteLength;
      }
    } catch (error) {
      streamFail(label, error);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** fetch with manual redirects: every hop must stay on the HTTPS allowlist,
 * the hop count is bounded, and each hop gets a finite timeout. */
async function fetchAllowlisted(rawUrl: string, timeoutMs: number, limits: Limits): Promise<Response> {
  let url = assertAllowedUrl(rawUrl);
  for (let hop = 0; ; hop++) {
    if (hop > limits.maxRedirectHops) fail(`GET ${rawUrl}: more than ${limits.maxRedirectHops} redirects`);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) }).catch((error: unknown) =>
      streamFail(`GET ${url}`, error),
    );
    if (REDIRECT_STATUSES[res.status]) {
      const location = res.headers.get("location");
      try {
        await res.body?.cancel();
      } catch {
        /* intermediate redirect bodies are discarded unread */
      }
      if (location === null) fail(`GET ${url}: HTTP ${res.status} without a Location header`);
      url = assertAllowedUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) fail(`GET ${url}: HTTP ${res.status}`);
    return res;
  }
}

export async function getJson<T>(url: string, limits: Limits = LIMITS): Promise<T> {
  const res = await fetchAllowlisted(url, limits.requestTimeoutMs, limits);
  const bytes = await readBody(res, Math.min(limits.maxJsonBytes, limits.maxResponseBytes), `GET ${url}`);
  try {
    return JSON.parse(dec.decode(bytes)) as T;
  } catch (error) {
    return fail(`GET ${url}: response is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

export async function getBytes(url: string, limits: Limits = LIMITS): Promise<Uint8Array> {
  const res = await fetchAllowlisted(url, limits.archiveTimeoutMs, limits);
  return readBody(res, limits.maxResponseBytes, `GET ${url}`);
}

/** Run `worker` over `items` with bounded concurrency; results keep input order. */
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Lowercase + strip every non-alphanumeric: "Qwen3.8-27B (vLLM)" -> "qwen3827bvllm". */
function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Slug for ids: "01_Productivity_Flow_task_10_pdf_digest" -> "01-productivity-flow-task-10-pdf-digest". */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** model_label: display names already containing spaces are human enough. */
function humanizeModel(name: string): string {
  if (/\s/.test(name)) return name;
  return name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------- output boundary
// Quarantine-only harvests: an explicit --out outside the public checkout is
// required, every written path stays contained in it, and symlinks (or
// non-regular files) are refused rather than followed.

function isOutside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === ".." || rel.startsWith(`..${sep}`);
}

function assertOutsideCheckout(candidate: string, what: string): void {
  if (!isOutside(CHECKOUT_ROOT, resolve(candidate))) {
    fail(`${what} must be outside the public checkout: ${resolve(candidate)}`);
  }
}

/** Parse `--out <dir>` (or `--out=<dir>`): required, and it must resolve
 * outside this public checkout. Pure path logic — no filesystem access. */
export function resolveOutputDir(argv: string[]): string {
  let raw: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail("--out requires a directory argument");
      raw = value;
    } else if (arg.startsWith("--out=")) {
      raw = arg.slice("--out=".length);
    }
  }
  if (raw === null || raw.trim() === "") {
    fail(
      "usage: bun scripts/harvest-wildclaw.ts --out <dir> [--force] — an explicit output " +
        "directory outside the public checkout is required (quarantine-only; no default demo writes)",
    );
  }
  const outDir = resolve(raw);
  assertOutsideCheckout(outDir, "output directory");
  return outDir;
}

/** Create the output directory and return its canonical path, re-checked
 * against the checkout AFTER symlink resolution (a symlinked --out pointing
 * back into the repo is refused). */
export function prepareOutputDir(outDir: string): string {
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (error) {
    return fail(`cannot create output directory ${outDir}: ${error instanceof Error ? error.message : String(error)}`);
  }
  let real: string;
  try {
    real = realpathSync(outDir);
  } catch (error) {
    return fail(`cannot resolve output directory ${outDir}: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertOutsideCheckout(real, "output directory (after resolving symlinks)");
  return real;
}

/** Contain `${id}.json` in the output directory — refuse anything that escapes. */
function outputFilePath(outDir: string, id: string): string {
  const file = join(outDir, `${id}.json`);
  const rel = relative(outDir, file);
  if (rel === "" || isAbsolute(rel) || isOutside(outDir, file)) {
    fail(`output file for id ${JSON.stringify(id)} escapes the output directory`);
  }
  return file;
}

function lstatMaybe(file: string): Stats | null {
  try {
    return lstatSync(file);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return null;
    return fail(`cannot inspect output file ${file}: ${code ?? (error instanceof Error ? error.message : String(error))}`);
  }
}

/** True when `file` already exists and may be overwritten: absent = false;
 * an existing regular file = true; a symlink or non-regular entry = refused. */
export function ensureWritableOutput(file: string): boolean {
  const stat = lstatMaybe(file);
  if (stat === null) return false;
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`refusing to overwrite a symlink or non-regular file: ${file}`);
  return true;
}

// -------------------------------------------------------------- archive I/O

export interface Archive {
  file: string; // repo-relative file name, e.g. output_glm52.tar.gz
  kind: "tar.gz" | "zip";
  key: string; // normalizeKey of the model-name part
  url: string;
}

export interface Entry {
  name: string; // full path inside the archive
  typeflag: string; // tar type flag ("0" regular); zip uses "0" for files
  data: Uint8Array; // file bytes (tar: a view into the read buffer — use synchronously)
}

/** Parse a ustar/gnu size field: 12 bytes, octal, space/NUL padded. Base-256
 * (high bit set) and non-octal garbage are rejected explicitly. */
function tarSizeField(hdr: Uint8Array): number {
  if ((hdr[124] & 0x80) !== 0) fail("base-256 tar size field not supported");
  const field = dec.decode(hdr.subarray(124, 136)).replace(/\0/g, " ").trim();
  if (field === "") return 0;
  if (!/^[0-7]+$/.test(field)) fail(`tar: invalid size field ${JSON.stringify(field)}`);
  return Number.parseInt(field, 8);
}

/** Parse a pax extended header's byte-length-prefixed records. Framing errors
 * fail loudly; record values are checked by the caller. */
function paxRecords(data: Uint8Array): Array<{ key: string; value: string }> {
  const records: Array<{ key: string; value: string }> = [];
  let pos = 0;
  while (pos < data.length) {
    let space = pos;
    while (space < data.length && data[space] !== 0x20) space++;
    if (space === pos || space >= data.length) fail("tar: malformed pax extended header (missing length)");
    let len = 0;
    for (let i = pos; i < space; i++) {
      const digit = data[i] - 0x30;
      if (digit < 0 || digit > 9) fail("tar: malformed pax extended header (non-decimal length)");
      len = len * 10 + digit;
    }
    if (!Number.isSafeInteger(len) || len <= space - pos + 1 || pos + len > data.length || data[pos + len - 1] !== 0x0a) {
      fail("tar: malformed pax extended header (bad record length)");
    }
    const record = dec.decode(data.subarray(space + 1, pos + len - 1));
    const eq = record.indexOf("=");
    if (eq < 0) fail("tar: malformed pax extended header (missing '=')");
    records.push({ key: record.slice(0, eq), value: record.slice(eq + 1) });
    pos += len;
  }
  return records;
}

/** The `path=` value of a pax extended header, or null when it carries none. */
function paxPath(data: Uint8Array): string | null {
  let path: string | null = null;
  for (const record of paxRecords(data)) {
    if (record.key === "path") path = record.value;
  }
  return path;
}

/**
 * Stream a .tar.gz and hand every regular-file entry to `visit` (synchronously;
 * `data` is a view into the rotating read buffer — use it synchronously).
 * Supports ustar names, GNU long names ('L') and pax path headers ('x');
 * global pax path/linkpath records are rejected as unsupported, directories are
 * reported with type flag '5', and symlinks/special entries with their own type
 * flags. Every budget in `limits` fails loudly rather than truncating, a
 * non-zero leftover after the stream ends is reported as truncation, and no
 * member path ever reaches a filesystem API. Nothing is ever executed.
 */
export async function walkTarGz(url: string, visit: (entry: Entry) => void, limits: Limits = LIMITS): Promise<void> {
  const res = await fetchAllowlisted(url, limits.archiveTimeoutMs, limits);
  if (res.body === null) fail(`GET ${url}: archive response has no body`);
  // node:zlib gunzip over the fetched body, adapted to the reader API below
  // (works on Bun 1.2.x where DecompressionStream does not exist). The wire
  // side is counted against maxResponseBytes before it reaches the inflater.
  const source = Readable.from(countedChunks(webChunks(res.body), limits.maxResponseBytes, `GET ${url}`));
  const gunzip = source.pipe(createGunzip());
  // pipe() drops source errors — forward them so truncation/aborts surface.
  source.on("error", (error: Error) => gunzip.destroy(error));
  const gunzipIterator = gunzip[Symbol.asyncIterator]();
  const reader = {
    read: async (): Promise<{ done: boolean; value: Uint8Array }> => {
      try {
        const next = await gunzipIterator.next();
        return next.done ? { done: true, value: undefined as unknown as Uint8Array } : { done: false, value: next.value as Uint8Array };
      } catch (error) {
        streamFail(`GET ${url}`, error);
      }
    },
    cancel: async () => {
      await gunzipIterator.return?.();
    },
  };
  const ascii = (u8: Uint8Array, start: number, len: number): string => {
    let end = start;
    while (end < start + len && u8[end] !== 0) end++;
    return dec.decode(u8.subarray(start, end));
  };
  let buf = new Uint8Array(0);
  let pendingLong: string | null = null;
  let pendingPax: string | null = null;
  let headers = 0;
  let inflated = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      inflated += value.byteLength;
      if (inflated > limits.maxTarInflatedBytes) {
        fail(`tar: inflated output exceeds the ${limits.maxTarInflatedBytes}-byte limit (${url})`);
      }
      const grown = new Uint8Array(buf.byteLength + value.byteLength);
      grown.set(buf);
      grown.set(value, buf.byteLength);
      buf = grown;
      for (;;) {
        if (buf.byteLength < 512) break;
        const hdr = buf.subarray(0, 512);
        let zero = true;
        for (let i = 0; i < 512; i++)
          if (hdr[i] !== 0) {
            zero = false;
            break;
          }
        if (zero) {
          buf = buf.subarray(512);
          continue;
        }
        if (++headers > limits.maxEntriesPerArchive) fail(`tar: more than ${limits.maxEntriesPerArchive} entries (${url})`);
        const rawName = ascii(hdr, 0, 100);
        const size = tarSizeField(hdr);
        if (size > limits.maxEntryBytes) {
          fail(`tar: entry ${JSON.stringify(rawName)} declares ${size} bytes, over the ${limits.maxEntryBytes}-byte entry limit`);
        }
        const typeflag = String.fromCharCode(hdr[156] || 0x30);
        const prefix = ascii(hdr, 345, 155);
        const blocks = Math.ceil(size / 512) * 512;
        if (buf.byteLength < 512 + blocks) break; // wait for the full entry
        const data = buf.subarray(512, 512 + size);
        if (typeflag === "L") {
          if (size > limits.maxNameBytes) fail(`tar: long name exceeds the ${limits.maxNameBytes}-byte limit`);
          pendingLong = dec.decode(data).replace(/\0+$/, "");
        } else if (typeflag === "x") {
          pendingPax = paxPath(data) ?? pendingPax;
        } else if (typeflag === "g") {
          for (const record of paxRecords(data)) {
            if (record.key === "path" || record.key === "linkpath") {
              fail(`tar: global pax header key ${JSON.stringify(record.key)} is not supported`);
            }
          }
        } else {
          const name = pendingLong ?? pendingPax ?? (prefix ? `${prefix}/${rawName}` : rawName);
          pendingLong = null;
          pendingPax = null;
          if (name.length > limits.maxNameBytes) fail(`tar: entry path exceeds the ${limits.maxNameBytes}-byte limit`);
          if (name.includes("\0")) fail("tar: entry path contains a NUL byte");
          visit({ name, typeflag, data });
        }
        buf = buf.subarray(512 + blocks);
      }
    }
    // A complete tar ends in zero-block padding; non-zero leftover = truncation.
    for (let i = 0; i < buf.byteLength; i++) {
      if (buf[i] !== 0) fail(`tar: truncated archive (${buf.byteLength} unconsumed bytes after the last complete entry, ${url})`);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* stream already closed */
    }
  }
}

export interface ZipEntry {
  name: string;
  method: number; // compression method: 0 stored, 8 deflate
  encrypted: boolean; // general-purpose flag bit 0
  compressedSize: number;
  uncompressedSize: number; // declared in the central directory
  localOffset: number;
  unixMode: number; // external attributes >> 16 (0 when not unix-made)
}

const ZIP_SPECIAL_NAMES: Record<number, string> = {
  0x1000: "fifo",
  0x2000: "character device",
  0x4000: "directory",
  0x6000: "block device",
  0xa000: "symlink",
  0xc000: "socket",
};

/** Why an entry cannot be ingested as a regular text file (null = regular).
 * Mirrors the tar branch's typeflag filter: unix symlink/special modes and
 * encrypted entries are never decompressed or read. */
export function zipEntrySpecialReason(entry: ZipEntry): string | null {
  if (entry.encrypted) return "encrypted";
  const type = entry.unixMode & 0xf000;
  if (type === 0 || type === 0x8000) return null; // not unix-made, or S_IFREG
  return ZIP_SPECIAL_NAMES[type] ?? `file type ${(type >>> 12).toString(8)}`;
}

/** Parse a zip central directory (end-of-central-directory scan + entries).
 * ZIP64 and multi-disk archives are rejected explicitly; every offset/length
 * is bounds-checked against the buffer so truncation fails loudly. */
export function parseZip(bytes: Uint8Array, limits: Limits = LIMITS): ZipEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.byteLength - 22; i >= 0 && i >= bytes.byteLength - 22 - 65535; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("zip: end-of-central-directory record not found (truncated or not a zip)");
  const count = dv.getUint16(eocd + 10, true);
  if (count === 0xffff || dv.getUint16(eocd + 8, true) !== count) {
    if (count === 0xffff || dv.getUint32(eocd + 16, true) === 0xffffffff || dv.getUint32(eocd + 12, true) === 0xffffffff) {
      fail("zip: zip64 archives are not supported");
    }
    fail("zip: multi-disk archives are not supported");
  }
  if (dv.getUint16(eocd + 4, true) !== 0 || dv.getUint16(eocd + 6, true) !== 0) fail("zip: multi-disk archives are not supported");
  if (count > limits.maxEntriesPerArchive) fail(`zip: more than ${limits.maxEntriesPerArchive} entries (central directory declares ${count})`);
  let off = dv.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (off + 46 > bytes.byteLength) fail(`zip: central directory truncated at entry ${i}`);
    if (dv.getUint32(off, true) !== 0x02014b50) fail("zip: corrupt central directory entry");
    const flags = dv.getUint16(off + 8, true);
    const method = dv.getUint16(off + 10, true);
    const compressedSize = dv.getUint32(off + 20, true);
    const uncompressedSize = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const unixMode = dv.getUint32(off + 38, true) >>> 16;
    const localOffset = dv.getUint32(off + 42, true);
    if (off + 46 + nameLen + extraLen + commentLen > bytes.byteLength) {
      fail(`zip: central directory entry ${i} extends past the end of the file`);
    }
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    if (name.length > limits.maxNameBytes) fail(`zip: entry path exceeds the ${limits.maxNameBytes}-byte limit`);
    entries.push({ name, method, encrypted: (flags & 0x1) !== 0, compressedSize, uncompressedSize, localOffset, unixMode });
    off += 46 + nameLen + extraLen + commentLen;
  }
  // Validate every local header and member range against the next region
  // (the next local header, else the central directory): truncated or
  // overlapping members are rejected here instead of silently clamping.
  const cdStart = dv.getUint32(eocd + 16, true);
  if (cdStart > bytes.byteLength) fail("zip: central directory offset extends past the end of the file");
  const localOrder = [...entries].sort((a, b) => a.localOffset - b.localOffset);
  for (let i = 0; i < localOrder.length; i++) {
    const entry = localOrder[i];
    const bound = i + 1 < localOrder.length ? localOrder[i + 1].localOffset : cdStart;
    if (entry.localOffset + 30 > bound) fail(`zip: ${entry.name}: local header is truncated or overlaps the next member`);
    const localNameLen = dv.getUint16(entry.localOffset + 26, true);
    const localExtraLen = dv.getUint16(entry.localOffset + 28, true);
    const dataEnd = entry.localOffset + 30 + localNameLen + localExtraLen + entry.compressedSize;
    if (dataEnd > bound) fail(`zip: ${entry.name}: member data extends past the next local header or the central directory (truncated)`);
  }
  return entries;
}

/** Decompress one zip member (stored or deflate) without executing anything.
 * Bounds are checked against the buffer (no clamped subarrays — truncation
 * fails), declared sizes must match the data, and deflate output is capped
 * via maxOutputLength BEFORE inflation so a bomb cannot allocate past the
 * declared size (which parse-time checks bound by limits.maxEntryBytes). */
export async function zipEntryData(bytes: Uint8Array, entry: ZipEntry, limits: Limits = LIMITS): Promise<Uint8Array> {
  const special = zipEntrySpecialReason(entry);
  if (special !== null) fail(`zip: ${entry.name}: ${special} entries are not ingestible`);
  if (entry.method !== 0 && entry.method !== 8) fail(`zip: ${entry.name}: unsupported compression method ${entry.method}`);
  if (entry.uncompressedSize > limits.maxEntryBytes) {
    fail(`zip: ${entry.name}: declares ${entry.uncompressedSize} bytes, over the ${limits.maxEntryBytes}-byte entry limit`);
  }
  if (entry.localOffset + 30 > bytes.byteLength) fail(`zip: ${entry.name}: local header extends past the end of the file`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(entry.localOffset, true) !== 0x04034b50) fail(`zip: bad local header for ${entry.name}`);
  const nameLen = dv.getUint16(entry.localOffset + 26, true);
  const extraLen = dv.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  if (start > bytes.byteLength || entry.compressedSize > bytes.byteLength - start) {
    fail(`zip: ${entry.name}: entry data extends past the end of the file (truncated)`);
  }
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.uncompressedSize) {
      fail(`zip: ${entry.name}: stored data is ${entry.compressedSize} bytes but the central directory declares ${entry.uncompressedSize}`);
    }
    return raw.slice();
  }
  let out: Uint8Array;
  try {
    out = inflateRawSync(raw, { maxOutputLength: Math.max(1, entry.uncompressedSize) });
  } catch (error) {
    return fail(`zip: ${entry.name}: inflate failed (${error instanceof Error ? error.message : String(error)})`);
  }
  if (out.byteLength !== entry.uncompressedSize) {
    fail(`zip: ${entry.name}: inflated to ${out.byteLength} bytes but the central directory declares ${entry.uncompressedSize}`);
  }
  return out;
}

/** Zip payloads retained in memory from survey to extraction (avoids a second
 * download), bounded by limits.maxRetainedZipBytes and released per archive. */
const zipBytes = new Map<string, Uint8Array>();
let retainedZipBytes = 0;

function retainZip(file: string, bytes: Uint8Array, limits: Limits): void {
  if (retainedZipBytes + bytes.byteLength > limits.maxRetainedZipBytes) {
    fail(`zip retention: caching ${file} (${bytes.byteLength} bytes) would exceed the ${limits.maxRetainedZipBytes}-byte budget`);
  }
  zipBytes.set(file, bytes);
  retainedZipBytes += bytes.byteLength;
}

function releaseZip(file: string): void {
  const bytes = zipBytes.get(file);
  if (bytes === undefined) return;
  zipBytes.delete(file);
  retainedZipBytes -= bytes.byteLength;
}

function releaseAllZips(): void {
  zipBytes.clear();
  retainedZipBytes = 0;
}

// ------------------------------------------------------------ task scanning

interface ArchiveSurvey {
  archive: Archive;
  bytes?: number; // zips are downloaded once and retained for the extract pass
  codeLangsByTask: Map<string, Set<Language>>;
  taskIds: Set<string>;
  modelDisplay?: string;
}

function extOf(fileName: string): string {
  const m = fileName.match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}

/** Which task-id path segment (from the repo task list) owns this entry? */
function taskSegment(segments: string[], knownTasks: Set<string>): string | null {
  for (const seg of segments) if (knownTasks.has(seg)) return seg;
  return null;
}

export async function surveyArchive(archive: Archive, knownTasks: Set<string>, limits: Limits = LIMITS): Promise<ArchiveSurvey> {
  const survey: ArchiveSurvey = {
    archive,
    codeLangsByTask: new Map(),
    taskIds: new Set(),
  };
  const record = (name: string, isDir: boolean): void => {
    if (isDir) return;
    const segments = name.split("/");
    const taskId = taskSegment(segments, knownTasks);
    if (taskId === null || !segments.includes("task_output")) return;
    survey.taskIds.add(taskId);
    const lang = CODE_EXT[extOf(segments[segments.length - 1])];
    if (lang === undefined) return;
    let set = survey.codeLangsByTask.get(taskId);
    if (!set) survey.codeLangsByTask.set(taskId, (set = new Set()));
    set.add(lang);
  };

  if (archive.kind === "zip") {
    const bytes = await getBytes(archive.url, limits);
    survey.bytes = bytes.byteLength;
    for (const entry of parseZip(bytes, limits)) {
      if (entry.name.endsWith("/")) continue;
      if (zipEntrySpecialReason(entry) !== null) continue; // symlink/special: never ingested
      record(entry.name, false);
    }
    retainZip(archive.file, bytes, limits);
  } else {
    await walkTarGz(archive.url, ({ name, typeflag, data }) => {
      if (typeflag === "0" && name.endsWith("PACKAGE_MANIFEST.json") && !survey.modelDisplay) {
        // Root manifest documents the archive's model display name (when present).
        try {
          survey.modelDisplay = (JSON.parse(dec.decode(data)) as { model?: { display_name?: string } }).model?.display_name;
        } catch {
          /* manifest is informational only */
        }
      }
      record(name, typeflag === "5");
    }, limits);
  }
  console.log(
    `surveyed ${archive.file}: ${survey.taskIds.size} tasks, ` +
      `${[...survey.codeLangsByTask.keys()].length} with code files${survey.bytes ? `, ${survey.bytes} bytes (zip, retained)` : ""}`,
  );
  return survey;
}

// -------------------------------------------------------------- extraction

export interface ExtractedFile {
  runDir: string; // directory under the task segment, e.g. claude-fable-5_20260717_0131_720a3c
  path: string; // path relative to task_output/
  content: string;
}

export interface ExtractCounters {
  harnessLogs: number;
  binaries: number;
  unsafePaths: number;
  specialEntries: number;
}

/** Archive -> taskId -> agent-produced text files under task_output/. */
export async function extractArchive(
  archive: Archive,
  selected: Set<string>,
  counters: ExtractCounters,
  limits: Limits = LIMITS,
): Promise<Map<string, ExtractedFile[]>> {
  const byTask = new Map<string, ExtractedFile[]>();

  // Archive member paths are data, never filesystem paths: traversal is
  // counted and dropped here, and only slugified ids are ever written (main).
  const accept = (name: string, data: Uint8Array, runDir: string): void => {
    const segments = name.split("/");
    const taskId = taskSegment(segments, selected);
    if (taskId === null) return;
    const outIdx = segments.indexOf("task_output");
    if (outIdx === -1 || outIdx + 1 >= segments.length) return;
    const rel = segments.slice(outIdx + 1).join("/");
    const last = segments[segments.length - 1];
    if (HARNESS_LOG.test(last)) {
      counters.harnessLogs++;
      return;
    }
    if (rel.startsWith("/") || rel.split("/").includes("..") || rel === "") {
      counters.unsafePaths++;
      return;
    }
    let content: string;
    try {
      content = utf8Fatal.decode(data);
    } catch {
      counters.binaries++; // schema requires string content; binary artifacts are not ingestible
      return;
    }
    let files = byTask.get(taskId);
    if (!files) byTask.set(taskId, (files = []));
    files.push({ runDir, path: rel, content });
  };

  if (archive.kind === "zip") {
    const bytes = zipBytes.get(archive.file);
    if (!bytes) fail(`zip bytes missing for ${archive.file}`);
    try {
      const entries = parseZip(bytes, limits).filter((e) => !e.name.endsWith("/"));
      for (const entry of entries) {
        if (zipEntrySpecialReason(entry) !== null) {
          counters.specialEntries++; // symlink/special/encrypted: skipped like the tar typeflag check
          continue;
        }
        const segments = entry.name.split("/");
        const taskId = taskSegment(segments, selected);
        if (taskId === null) continue; // not a selected task: skip without decompressing
        const data = await zipEntryData(bytes, entry, limits);
        const tIdx = segments.findIndex((s) => s === taskId);
        accept(entry.name, data, tIdx + 1 < segments.length ? segments[tIdx + 1] : "");
      }
    } finally {
      releaseZip(archive.file); // extraction is done with this cached archive
    }
  } else {
    await walkTarGz(archive.url, ({ name, typeflag, data }) => {
      if (typeflag !== "0") {
        if (typeflag !== "5") counters.specialEntries++;
        return;
      }
      const segments = name.split("/");
      const taskId = taskSegment(segments, selected);
      if (taskId === null) return;
      const tIdx = segments.findIndex((s) => s === taskId);
      accept(name, data, tIdx + 1 < segments.length ? segments[tIdx + 1] : "");
    }, limits);
  }
  for (const [taskId, files] of byTask) {
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
  console.log(`extracted ${archive.file}: ${[...byTask.values()].reduce((n, f) => n + f.length, 0)} text files for ${byTask.size} selected tasks`);
  return byTask;
}

// ------------------------------------------------------- rows (trajectories)

interface Row {
  task_id: string;
  model_name: string;
  trajectory: string;
}

async function loadRows(selected: Set<string>): Promise<Map<string, Row[]>> {
  const pages: Row[][] = [];
  const offsets: number[] = [];
  for (let offset = 0; offset < 720; offset += 100) offsets.push(offset);
  const fetched = await mapLimit(offsets, 4, async (offset) => {
    const body = (await getJson<{ rows?: { row: Row }[] }>(`${ROWS_API}&offset=${offset}&length=100`)).rows;
    if (!body) fail(`rows page at offset ${offset} returned no rows`);
    return body.map((r) => r.row);
  });
  for (const page of fetched) pages.push(...page);
  const byTask = new Map<string, Row[]>();
  for (const row of pages) {
    if (!selected.has(row.task_id)) continue;
    let list = byTask.get(row.task_id);
    if (!list) byTask.set(row.task_id, (list = []));
    list.push(row);
  }
  console.log(`rows: ${pages.length} total, ${[...byTask.values()].reduce((n, l) => n + l.length, 0)} in selected tasks`);
  return byTask;
}

// ----------------------------------------------------- trajectory text rules

/** First user message text — the task statement as given to the model. */
function firstUserText(traj: unknown[]): string | null {
  const msg = traj.find((m) => (m as { role?: string }).role === "user") as { content?: unknown } | undefined;
  if (!msg) return null;
  return contentText(msg.content);
}

function contentText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .filter((b): b is { type: string; text?: string } => typeof b === "object" && b !== null)
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

/** Strip the harness preamble line ("[<weekday> <date>] You are an expert in a
 * restricted, non-interactive environment…"), leaving the problem statement. */
function problemStatement(firstUser: string): string {
  const lines = firstUser.split("\n", 2);
  if (lines.length >= 2 && /^\[[^\]]+\]/.test(lines[0]) && lines[0].includes("restricted, non-interactive environment")) {
    return firstUser.slice(firstUser.indexOf("\n") + 1).trim();
  }
  return firstUser.trim();
}

/** Final assistant message text, only when the trajectory ends on one. */
function finalAssistantText(traj: unknown[]): string | null {
  const last = traj[traj.length - 1] as { role?: string; content?: unknown } | undefined;
  if (!last || last.role !== "assistant") return null;
  const text = contentText(last.content);
  return text !== null && text.trim() !== "" ? text : null;
}

// -------------------------------------------------- run-dir disambiguation

/** "claude-fable-5_20260717_0131_720a3c" -> epoch ms (UTC), or null. */
function parseRunTimestamp(runDir: string): number | null {
  const m = runDir.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})_[0-9a-f]+$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

/** "[Fri 2026-07-17 08:31 UTC] …" -> epoch ms (UTC), or null. */
function parsePromptTimestamp(text: string): number | null {
  const m = text.match(/^\[[^\]]*?(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (?:UTC|GMT)\]/);
  if (!m) return null;
  const [y, mo, d] = m[1].split("-").map(Number);
  const [h, mi] = m[2].split(":").map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
}

/**
 * Pick the run directory that matches the row's trajectory. Run directories are
 * stamped in evaluation-local time while the prompt is stamped UTC, so match on
 * the smallest circular distance within 24h; ties (or missing timestamps) fall
 * back to the lexicographically smallest run dir. Deterministic either way.
 */
function chooseRun(runDirs: string[], promptEpoch: number | null): string {
  if (runDirs.length === 1) return runDirs[0];
  const sorted = [...runDirs].sort();
  if (promptEpoch === null) return sorted[0];
  let best: string | null = null;
  let bestDist = Infinity;
  for (const rd of [...runDirs].sort()) {
    const ts = parseRunTimestamp(rd);
    if (ts === null) continue;
    const diff = promptEpoch - ts;
    const circular = Math.abs((((diff + 12 * 3600_000) % 86_400_000) + 86_400_000) % 86_400_000 - 12 * 3600_000);
    if (circular < bestDist) {
      bestDist = circular;
      best = rd;
    }
  }
  return best ?? sorted[0];
}

// ----------------------------------------------------------------- main run

async function main(): Promise<void> {
  const started = Date.now();

  // 0. Output boundary first: a misconfigured run must fail before any network.
  const outDir = prepareOutputDir(resolveOutputDir(process.argv));
  console.log(`output directory: ${outDir} (outside the public checkout)`);

  // 1. Metadata: revision sha + published date + repo file listing (sha-pinned).
  //    The sha and every listing path are validated before URL interpolation.
  const meta = await getJson<{ sha: string; createdAt: string }>(HF_API);
  validateSha(meta.sha);
  const tree = await getJson<unknown>(`${HF_API}/tree/${meta.sha}?recursive=true`);
  if (!Array.isArray(tree)) fail("repo file listing did not return an array");
  const paths = tree.map((entry) => validateTreePath(entry));
  console.log(`dataset ${DATASET} @ ${meta.sha} (published ${meta.createdAt})`);

  const knownTasks = new Set<string>();
  for (const path of paths) {
    const m = path.match(/^sessions\/[^/]+\/(.+)\.jsonl$/);
    if (m) knownTasks.add(m[1]);
  }
  const sortedTasks = [...knownTasks].sort();
  if (sortedTasks.length === 0) fail("no task ids found in sessions/ file listing");
  console.log(`task list: ${sortedTasks.length} tasks from sessions/ listing`);

  const archives: Archive[] = paths
    .map((path) => path.match(/^output_(.+)\.(tar\.gz|zip)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m): Archive => {
      // The model segment is interpolated into the resolve URL: plain name
      // characters only, no '..' path shaping, no nested paths.
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(m[1]) || m[1].includes("..")) {
        fail(`archive file name ${JSON.stringify(m[0])} has unsupported characters`);
      }
      return {
        file: m[0],
        kind: m[2] === "zip" ? ("zip" as const) : ("tar.gz" as const),
        key: normalizeKey(m[1]),
        url: `${DATASET_URL}/resolve/${meta.sha}/${m[0]}`,
      };
    })
    .sort((a, b) => (a.file < b.file ? -1 : 1));
  console.log(`archives: ${archives.length} (${archives.filter((a) => a.kind === "zip").length} zip, rest tar.gz)`);

  // 2. Survey every archive (names only; zips retained in memory for extraction)
  //    to learn which tasks have agent-produced typescript/javascript/python.
  const surveys = await mapLimit(archives, CONCURRENCY, (a) => surveyArchive(a, knownTasks));
  const codeByTask = new Map<string, Set<Language>>();
  const surveyTaskIds = new Set<string>();
  for (const s of surveys) {
    for (const t of s.taskIds) surveyTaskIds.add(t);
    for (const [taskId, langs] of s.codeLangsByTask) {
      let set = codeByTask.get(taskId);
      if (!set) codeByTask.set(taskId, (set = new Set()));
      for (const l of langs) set.add(l);
    }
  }
  for (const t of sortedTasks) if (!surveyTaskIds.has(t)) console.log(`warn: task ${t} absent from every archive survey`);

  // 3. Deterministic selection: first PILOT_TASKS sorted task ids with code files.
  const validTasks = sortedTasks.filter((taskId) => codeByTask.has(taskId));
  const selectedList = validTasks.slice(0, PILOT_TASKS);
  const selected = new Set(selectedList);
  for (const taskId of selectedList) {
    console.log(`selected task: ${taskId} (code langs: ${[...codeByTask.get(taskId)!].join(",")})`);
  }
  const skippedTasks: { id: string; reason: string }[] = [];
  for (const taskId of sortedTasks) {
    if (selected.has(taskId)) continue;
    const reason = codeByTask.has(taskId)
      ? `valid code task beyond the first ${PILOT_TASKS} sorted ids (pilot scope)`
      : "no typescript/javascript/python files in any model's task_output";
    skippedTasks.push({ id: taskId, reason });
    console.log(`skipped task: ${taskId} — ${reason}`);
  }
  if (selectedList.length === 0) fail("no task in the dataset has agent-produced code files; nothing to harvest");

  // 4. Rows for the selected tasks (parallel with extraction).
  const extracted = new Map<string, Map<string, ExtractedFile[]>>(); // archive.file -> taskId -> files
  const counters: ExtractCounters = { harnessLogs: 0, binaries: 0, unsafePaths: 0, specialEntries: 0 };
  const [rowsByTask] = await Promise.all([
    loadRows(selected),
    mapLimit(archives, CONCURRENCY, async (a) => {
      const byTask = await extractArchive(a, selected, counters);
      extracted.set(a.file, byTask);
    }),
  ]);

  // 5. Row model_name -> archive, by normalized-key bijection (verified).
  const models = [...new Set([...rowsByTask.values()].flat().map((r) => r.model_name))].sort();
  const archiveByKey = new Map<string, Archive>();
  for (const a of archives) {
    if (archiveByKey.has(a.key)) fail(`two archives normalize to key ${a.key}`);
    archiveByKey.set(a.key, a);
  }
  const modelToArchive = new Map<string, Archive>();
  for (const model of models) {
    const archive = archiveByKey.get(normalizeKey(model));
    if (!archive) fail(`no archive matches model_name ${JSON.stringify(model)}`);
    modelToArchive.set(model, archive);
  }
  const matched = new Set([...modelToArchive.values()].map((a) => a.file));
  if (modelToArchive.size !== archives.length || matched.size !== archives.length) {
    fail(`model/archive bijection failed: ${modelToArchive.size} models, ${matched.size}/${archives.length} archives matched`);
  }
  // Root PACKAGE_MANIFEST display names (when present) must agree with the mapping.
  for (const survey of surveys) {
    if (survey.modelDisplay && normalizeKey(survey.modelDisplay) !== survey.archive.key) {
      fail(`manifest display ${JSON.stringify(survey.modelDisplay)} in ${survey.archive.file} does not match its file name`);
    }
  }
  console.log(`model mapping verified: ${models.length} display names <-> ${archives.length} archives`);

  // 6. Build, validate, write (contained in outDir; see step 0).
  const seenIds = new Set<string>();
  let written = 0;
  let skippedExisting = 0;
  const skippedRows: { key: string; reason: string }[] = [];

  for (const taskId of selectedList) {
    const rows = (rowsByTask.get(taskId) ?? []).sort((a, b) => (a.model_name < b.model_name ? -1 : a.model_name > b.model_name ? 1 : 0));
    if (rows.length === 0) {
      skippedRows.push({ key: taskId, reason: "no rows returned for task" });
      continue;
    }

    // Per-row file sets (run directory resolved against the row's trajectory).
    interface Prepared {
      row: Row;
      traj: unknown[];
      firstUser: string;
      files: ExtractedFile[];
    }
    const prepared: Prepared[] = [];
    for (const row of rows) {
      const key = `${taskId} / ${row.model_name}`;
      const archive = modelToArchive.get(row.model_name);
      const taskFiles = archive ? extracted.get(archive.file)?.get(taskId) : undefined;
      if (!taskFiles || taskFiles.length === 0) {
        skippedRows.push({ key, reason: "no task_output files in archive" });
        continue;
      }
      let traj: unknown[];
      try {
        traj = JSON.parse(row.trajectory) as unknown[];
      } catch {
        skippedRows.push({ key, reason: "trajectory is not valid JSON" });
        continue;
      }
      if (!Array.isArray(traj) || traj.length === 0) {
        skippedRows.push({ key, reason: "trajectory empty or not an array" });
        continue;
      }
      const firstUser = firstUserText(traj);
      if (firstUser === null || firstUser.trim() === "") {
        skippedRows.push({ key, reason: "no first user message (task statement) in trajectory" });
        continue;
      }
      const promptEpoch = parsePromptTimestamp(firstUser);
      const runDirs = [...new Set(taskFiles.map((f) => f.runDir))];
      const run = chooseRun(runDirs, promptEpoch);
      if (runDirs.length > 1) console.log(`note: ${key} has ${runDirs.length} run dirs; chose ${run}`);
      const uniquePaths = new Set<string>();
      const files = taskFiles.filter((f) => f.runDir === run).filter((f) => (uniquePaths.has(f.path) ? false : (uniquePaths.add(f.path), true)));
      if (files.length === 0) {
        skippedRows.push({ key, reason: `chosen run ${run} produced no ingestible text files` });
        continue;
      }
      prepared.push({ row, traj, firstUser, files });
    }

    // Task-level language from every prepared row's artifact files (majority,
    // ties broken by typescript > javascript > python).
    const langCounts = new Map<Language, number>();
    for (const p of prepared) {
      for (const f of p.files) {
        const lang = CODE_EXT[extOf(f.path)];
        if (lang) langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
      }
    }
    if (langCounts.size === 0) {
      // Survey saw code files but none survived extraction — drop loudly.
      skippedTasks.push({ id: taskId, reason: "no code files survived extraction (unexpected; survey/extraction diverged)" });
      console.log(`dropped task ${taskId}: no code files survived extraction`);
      continue;
    }
    let language: Language = LANG_PRIORITY[0];
    let bestCount = -1;
    for (const lang of LANG_PRIORITY) {
      const count = langCounts.get(lang) ?? 0;
      if (count > bestCount) {
        bestCount = count;
        language = lang;
      }
    }

    for (const { row, traj, firstUser, files } of prepared) {
      const taskSlug = slugify(taskId);
      const modelSlug = slugify(row.model_name);
      const id = `wc-${taskSlug}--${modelSlug}`;
      if (seenIds.has(id)) fail(`duplicate item id ${id}`);
      seenIds.add(id);

      const brief = problemStatement(firstUser);
      if (brief === "") {
        skippedRows.push({ key: `${taskId} / ${row.model_name}`, reason: "empty problem statement after preamble strip" });
        continue;
      }
      const explanation = finalAssistantText(traj);

      const item: Item = {
        id,
        tier: "demo",
        task: {
          id: `wc-${taskSlug}`,
          kind: "fix",
          brief,
          language,
          tests_expected: true,
        },
        artifact: {
          form: files.length === 1 ? "single-file" : "tree",
          files: files.map((f) => ({ path: f.path, content: f.content })),
        },
        context: {
          prompt: firstUser, // verbatim first user message (no dedicated prompt field in the dataset)
          ...(explanation !== null ? { explanation } : {}),
        },
        provenance: {
          model: row.model_name,
          model_label: humanizeModel(row.model_name),
          harness: "wildclaw-agent",
          harness_version: `${DATASET}@${meta.sha}`,
          generated_at: meta.createdAt, // dataset published date; rows carry no timestamp field
          source: "harvested",
          source_url: DATASET_URL,
        },
        license: {
          spdx: "MIT",
          redistribution: "demo-eligible",
          notes: "Source dataset MIT; artifact produced by the named model on the WildClawBench task",
        },
        contamination: {
          viral: false,
          public_since: meta.createdAt.slice(0, 10),
        },
      };

      try {
        validateItem(item);
      } catch (e) {
        fail(`validateItem rejected mapping for ${id}: ${(e as Error).message}`);
      }

      const file = outputFilePath(outDir, id);
      if (ensureWritableOutput(file) && !FORCE) {
        skippedExisting++;
        console.log(`skip existing ${id}.json (use --force to rewrite)`);
        continue;
      }
      writeFileSync(file, `${JSON.stringify(item, null, 2)}\n`);
      written++;
      console.log(`wrote ${id}.json — task ${taskId} / ${row.model_name} / ${files.length} files / ${language}`);
    }
  }

  // 7. Summary.
  console.log("--- summary ---");
  console.log(`dataset revision: ${DATASET}@${meta.sha}`);
  console.log(`selected tasks: ${selectedList.length} (${selectedList.join(", ")})`);
  console.log(`skipped tasks: ${skippedTasks.length}`);
  for (const s of skippedTasks) console.log(`  - ${s.id}: ${s.reason}`);
  console.log(`items written: ${written}, skipped existing: ${skippedExisting}`);
  console.log(`rows skipped: ${skippedRows.length}`);
  for (const s of skippedRows) console.log(`  - ${s.key}: ${s.reason}`);
  console.log(
    `excluded during extraction: ${counters.harnessLogs} harness logs, ${counters.binaries} non-UTF-8 binary files, ` +
      `${counters.unsafePaths} unsafe paths, ${counters.specialEntries} non-regular entries`,
  );
  console.log(`elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

// Importing this module (tests, tooling) must never start a download: run the
// harvest only when this file is the entry script, and release any cached
// archives either way.
if (import.meta.main) {
  try {
    await main();
  } finally {
    releaseAllZips();
  }
}
