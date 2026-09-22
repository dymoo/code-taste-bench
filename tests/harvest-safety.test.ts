/**
 * Offline safety regression tests for scripts/harvest-wildclaw.ts (F2/F4/F5
 * plus the quarantine-only output boundary).
 *
 * Everything is synthetic: archive bytes are built in-process, HTTP goes
 * through a fake fetch, and nothing downloads, executes, or touches corpus
 * data. Importing the harvester must be side-effect-free — the module main
 * guard means these helpers run without triggering a single request.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deflateRawSync, gzipSync } from "node:zlib";
import {
  LIMITS,
  assertAllowedUrl,
  ensureWritableOutput,
  extractArchive,
  getBytes,
  getJson,
  parseZip,
  prepareOutputDir,
  resolveOutputDir,
  surveyArchive,
  validateSha,
  validateTreePath,
  walkTarGz,
  zipEntryData,
  zipEntrySpecialReason,
  type Archive,
  type Entry,
  type ExtractCounters,
  type Limits,
} from "../scripts/harvest-wildclaw";

// ------------------------------------------------------------------ fixtures

const ENC = new TextDecoder();
const TEX = new TextEncoder();
const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error("Offline test attempted an unmocked network request");
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Install a fake fetch that never touches the network; returns a call counter. */
function installFetch(handler: (url: string, call: number) => unknown): () => number {
  let calls = 0;
  globalThis.fetch = (async (input: unknown) => {
    calls += 1;
    return handler(String(input), calls);
  }) as unknown as typeof fetch;
  return () => calls;
}

function redirectResponse(status: number, location: string | null): unknown {
  return { status, ok: false, headers: new Headers(location === null ? {} : { location }), body: null };
}

const SHA40 = "d2816016".repeat(5);
const HF = `https://huggingface.co/datasets/internlm/WildClawBench-Trajectories/resolve/${SHA40}`;

function tarArchive(): Archive {
  return { file: "output_test.tar.gz", kind: "tar.gz", key: "test", url: `${HF}/output_test.tar.gz` };
}

function zipArchive(): Archive {
  return { file: "output_test.zip", kind: "zip", key: "test", url: `${HF}/output_test.zip` };
}

function freshCounters(): ExtractCounters {
  return { harnessLogs: 0, binaries: 0, unsafePaths: 0, specialEntries: 0 };
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function u16le(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32le(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

// ------------------------------------------------------------- tar fixtures

interface TarSpecEntry {
  name: string;
  data?: Uint8Array;
  typeflag?: string; // default "0" (regular file)
  prefix?: string;
  declaredSize?: number; // lie about the size field
  headerOnly?: boolean; // emit only the 512-byte header
  cutStream?: boolean; // stop right after this data: no padding, no terminator
}

function tarHeader(name: string, size: number, typeflag: string, prefix: string): Uint8Array {
  const header = new Uint8Array(512);
  const put = (text: string, offset: number, length: number): void => {
    for (let i = 0; i < text.length && i < length; i++) header[offset + i] = text.charCodeAt(i);
  };
  put(name, 0, 100);
  put("0000644\0", 100, 8);
  put("0000000\0", 108, 8);
  put("0000000\0", 116, 8);
  put(`${size.toString(8).padStart(11, "0")}\0`, 124, 12);
  put("00000000000\0", 136, 12);
  for (let i = 148; i < 156; i++) header[i] = 0x20; // checksum computed over blanks
  header[156] = typeflag.charCodeAt(0);
  put("ustar", 257, 6); // header[262] stays 0 → "ustar\0"
  put("00", 263, 2);
  put(prefix, 345, 155);
  let sum = 0;
  for (const byte of header) sum += byte;
  put(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

function buildTar(entries: TarSpecEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    const data = entry.data ?? new Uint8Array(0);
    const declared = entry.declaredSize ?? data.byteLength;
    chunks.push(tarHeader(entry.name, declared, entry.typeflag ?? "0", entry.prefix ?? ""));
    if (entry.headerOnly) continue;
    if (entry.cutStream) {
      chunks.push(data);
      return concatBytes(chunks);
    }
    const padded = new Uint8Array(Math.ceil(data.byteLength / 512) * 512);
    padded.set(data);
    chunks.push(padded);
  }
  chunks.push(new Uint8Array(1024)); // two zero blocks: end-of-archive
  return concatBytes(chunks);
}

/** Length-prefixed pax record ("<len> <key>=<value>\n"), byte-accurate. */
function paxRecord(key: string, value: string): Uint8Array {
  let length = key.length + value.length + 4;
  for (;;) {
    const text = `${length} ${key}=${value}\n`;
    if (text.length === length) return TEX.encode(text);
    length = text.length;
  }
}

async function walkTar(tar: Uint8Array, limits?: Limits): Promise<Entry[]> {
  const entries: Entry[] = [];
  installFetch(() => new Response(gzipSync(tar)));
  await walkTarGz(tarArchive().url, (entry) => entries.push({ ...entry, data: entry.data.slice() }), limits);
  return entries;
}

// ------------------------------------------------------------- zip fixtures

interface ZipSpec {
  name: string;
  data: Uint8Array;
  method?: number; // 0 stored (default), 8 deflate
  unixMode?: number; // external-attributes high word (0 = not unix-made)
  flags?: number;
  centralSizes?: { compressed?: number; uncompressed?: number }; // lie in the central directory
}

function buildZip(specs: ZipSpec[], options: { eocdCountOverride?: number } = {}): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let localSize = 0;
  for (const spec of specs) {
    const method = spec.method ?? 0;
    const payload = method === 8 ? deflateRawSync(spec.data) : spec.data;
    const flags = spec.flags ?? 0;
    const nameBytes = asciiBytes(spec.name);
    const localOffset = localSize;
    const localHeader = concatBytes([
      u32le(0x04034b50),
      u16le(20),
      u16le(flags),
      u16le(method),
      u16le(0),
      u16le(0),
      u32le(0),
      u32le(payload.byteLength),
      u32le(spec.data.byteLength),
      u16le(nameBytes.length),
      u16le(0),
      nameBytes,
    ]);
    locals.push(localHeader, payload);
    localSize += localHeader.byteLength + payload.byteLength;
    central.push(
      concatBytes([
        u32le(0x02014b50),
        u16le((20 << 8) | (spec.unixMode ? 3 : 0)), // version made by: host = unix when a mode is set
        u16le(20),
        u16le(flags),
        u16le(method),
        u16le(0),
        u16le(0),
        u32le(0),
        u32le(spec.centralSizes?.compressed ?? payload.byteLength),
        u32le(spec.centralSizes?.uncompressed ?? spec.data.byteLength),
        u16le(nameBytes.length),
        u16le(0),
        u16le(0),
        u16le(0),
        u16le(0),
        u32le(((spec.unixMode ?? 0) << 16) | 0x20),
        u32le(localOffset),
        nameBytes,
      ]),
    );
  }
  const cdOffset = localSize;
  const cd = concatBytes(central);
  const count = options.eocdCountOverride ?? specs.length;
  const eocd = concatBytes([
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(count),
    u16le(count),
    u32le(cd.byteLength),
    u32le(cdOffset),
    u16le(0),
  ]);
  return concatBytes([...locals, cd, eocd]);
}

// ------------------------------------------------------------ HTTP budgets

describe("HTTP budgets", () => {
  test("refuses a streamed body over maxResponseBytes", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200));
        controller.enqueue(new Uint8Array(200));
        controller.close();
      },
    });
    installFetch(() => new Response(stream));
    const limits: Limits = { ...LIMITS, maxResponseBytes: 64 };
    await expect(getBytes("https://huggingface.co/archive.bin", limits)).rejects.toThrow(/body exceeds the 64-byte limit/);
  });

  test("refuses an oversized Content-Length before reading the body", async () => {
    installFetch(() => ({ status: 200, ok: true, headers: new Headers({ "content-length": "999999999" }), body: null }));
    const limits: Limits = { ...LIMITS, maxResponseBytes: 1024, maxJsonBytes: 1024 };
    await expect(getJson("https://huggingface.co/api/x", limits)).rejects.toThrow(/Content-Length 999999999 exceeds the 1024-byte limit/);
  });

  test("parses JSON bodies and rejects malformed JSON clearly", async () => {
    installFetch(() => new Response('{"ok": true}'));
    expect(await getJson<{ ok: boolean }>("https://huggingface.co/api/x")).toEqual({ ok: true });
    installFetch(() => new Response("<html>not json</html>"));
    await expect(getJson("https://huggingface.co/api/x")).rejects.toThrow(/not valid JSON/);
  });
});

// ------------------------------------------------ redirects and URL allowlist

describe("redirects and URL allowlist", () => {
  test("follows bounded redirects within the allowlist and returns the final body", async () => {
    const calls = installFetch((_url, call) => {
      if (call === 1) return redirectResponse(302, "https://huggingface.co/step-2");
      if (call === 2) return redirectResponse(301, "https://cdn-lfs.huggingface.co/final");
      return new Response(TEX.encode("payload-bytes"));
    });
    const bytes = await getBytes("https://huggingface.co/start");
    expect(ENC.decode(bytes)).toBe("payload-bytes");
    expect(calls()).toBe(3);
  });

  test("refuses a redirect to a host outside the allowlist before fetching it", async () => {
    const calls = installFetch(() => redirectResponse(302, "https://evil.example/collect"));
    await expect(getBytes("https://huggingface.co/start")).rejects.toThrow(/evil\.example/);
    expect(calls()).toBe(1);
  });

  test("fails once the redirect hop budget is exhausted", async () => {
    const calls = installFetch(() => redirectResponse(302, "https://huggingface.co/loop"));
    await expect(getBytes("https://huggingface.co/start")).rejects.toThrow(new RegExp(`more than ${LIMITS.maxRedirectHops} redirects`));
    expect(calls()).toBe(LIMITS.maxRedirectHops + 1);
  });

  test("fails a redirect that carries no Location header", async () => {
    installFetch(() => redirectResponse(302, null));
    await expect(getBytes("https://huggingface.co/start")).rejects.toThrow(/without a Location header/);
  });

  test("accepts only HTTPS huggingface.co hosts", () => {
    expect(assertAllowedUrl("https://huggingface.co/api/x").hostname).toBe("huggingface.co");
    expect(assertAllowedUrl("https://datasets-server.huggingface.co/rows?x=1").hostname).toBe("datasets-server.huggingface.co");
    expect(assertAllowedUrl("https://cdn-lfs.huggingface.co/resolve/abc/f").hostname).toBe("cdn-lfs.huggingface.co");
    const blocked = [
      "http://huggingface.co/x",
      "https://evil.example/x",
      "https://huggingface.co.evil.example/x",
      "https://hf.co@evil.example/x",
      "https://user@huggingface.co/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.1/x",
      "https://huggingface.co:8443/x",
      "file:///etc/passwd",
      "ftp://huggingface.co/x",
      "not a url at all",
    ];
    for (const raw of blocked) expect(() => assertAllowedUrl(raw), raw).toThrow(/blocked/);
  });

  test("validates the revision sha before it is interpolated into URLs", () => {
    expect(validateSha(SHA40)).toBe(SHA40);
    for (const bad of ["", "d2816016", "g".repeat(40), "D2816016".repeat(5), `${"a".repeat(38)}?x`, `${"a".repeat(38)}/x`]) {
      expect(() => validateSha(bad), JSON.stringify(bad)).toThrow(/40-character lowercase sha/);
    }
  });

  test("validates repo listing paths before they shape requests", () => {
    expect(validateTreePath({ path: "output_glm52.tar.gz" })).toBe("output_glm52.tar.gz");
    expect(validateTreePath({ path: "sessions/tenant/task-alpha.jsonl" })).toBe("sessions/tenant/task-alpha.jsonl");
    for (const bad of ["", "../etc/passwd", "/abs/path", "a/../b", "a//b", "./x", "file?query=1", "file#frag", "file%2f"]) {
      expect(() => validateTreePath({ path: bad }), JSON.stringify(bad)).toThrow(/not a plain relative path/);
    }
    for (const bad of [null, "str", 42, {}, { path: 42 }, { nope: "x" }]) {
      expect(() => validateTreePath(bad), JSON.stringify(bad)).toThrow(/not \{ path/);
    }
  });
});

// ------------------------------------------- output boundary (quarantine --out)

describe("output boundary (quarantine-only --out)", () => {
  test("requires an explicit --out argument", () => {
    expect(() => resolveOutputDir(["bun", "harvest-wildclaw.ts"])).toThrow(/explicit output directory outside the public checkout/);
    expect(() => resolveOutputDir(["bun", "harvest-wildclaw.ts", "--out"])).toThrow(/requires a directory argument/);
    expect(() => resolveOutputDir(["--out", "--force"])).toThrow(/requires a directory argument/);
  });

  test("rejects --out inside the public checkout in both argument forms", () => {
    const inside = join(import.meta.dir, "..", "data", "items", "demo");
    expect(() => resolveOutputDir(["--out", inside])).toThrow(/must be outside the public checkout/);
    expect(() => resolveOutputDir([`--out=${inside}`])).toThrow(/must be outside the public checkout/);
  });

  test("accepts --out outside the checkout", () => {
    const outside = join(import.meta.dir, "..", "..", "ctb-quarantine-smoke");
    expect(resolveOutputDir(["--out", outside])).toBe(resolve(outside));
    expect(resolveOutputDir([`--out=${outside}`])).toBe(resolve(outside));
  });

  test("refuses an --out symlink that resolves back into the checkout", () => {
    const tmp = mkdtempSync(join(tmpdir(), "harvest-safety-"));
    try {
      const link = join(tmp, "link-out");
      symlinkSync(import.meta.dir, link); // target: this checkout's tests/ directory
      expect(() => prepareOutputDir(link)).toThrow(/must be outside the public checkout/);
      const prepared = prepareOutputDir(join(tmp, "real-out"));
      expect(prepared).toContain("real-out");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("refuses to overwrite symlinks or non-regular files", () => {
    const tmp = mkdtempSync(join(tmpdir(), "harvest-safety-"));
    try {
      expect(ensureWritableOutput(join(tmp, "new.json"))).toBe(false);
      const real = join(tmp, "real.json");
      writeFileSync(real, "{}");
      expect(ensureWritableOutput(real)).toBe(true);
      const link = join(tmp, "link.json");
      symlinkSync(real, link);
      expect(() => ensureWritableOutput(link)).toThrow(/symlink or non-regular file/);
      const directory = join(tmp, "adir");
      mkdirSync(directory);
      expect(() => ensureWritableOutput(directory)).toThrow(/symlink or non-regular file/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------- zip safety (synthetic)

describe("zip safety (synthetic bytes)", () => {
  test("round-trips ordinary stored and deflate members", async () => {
    const stored = TEX.encode("plain stored bytes");
    const deflated = TEX.encode("deflate me ".repeat(40));
    const zip = buildZip([
      { name: "task-alpha/run1/task_output/a.txt", data: stored },
      { name: "task-alpha/run1/task_output/b.ts", data: deflated, method: 8 },
      { name: "unix-made.txt", data: TEX.encode("hi"), unixMode: 0x81a4 },
    ]);
    const entries = parseZip(zip);
    expect(entries.map((e) => e.name)).toEqual([
      "task-alpha/run1/task_output/a.txt",
      "task-alpha/run1/task_output/b.ts",
      "unix-made.txt",
    ]);
    expect(new Uint8Array(await zipEntryData(zip, entries[0]))).toEqual(stored);
    expect(new Uint8Array(await zipEntryData(zip, entries[1]))).toEqual(deflated);
    expect(entries.every((e) => zipEntrySpecialReason(e) === null)).toBe(true);
  });

  test("rejects a missing end-of-central-directory record", () => {
    expect(() => parseZip(new Uint8Array(100))).toThrow(/end-of-central-directory/);
  });

  test("rejects zip64 archives explicitly", () => {
    const zip = buildZip([{ name: "a.txt", data: TEX.encode("x") }], { eocdCountOverride: 0xffff });
    expect(() => parseZip(zip)).toThrow(/zip64 archives are not supported/);
  });

  test("enforces the per-archive entry-count budget", () => {
    const zip = buildZip(
      ["a", "b", "c", "d", "e"].map((n) => ({ name: `task/run/task_output/${n}.ts`, data: TEX.encode(n) })),
    );
    expect(() => parseZip(zip, { ...LIMITS, maxEntriesPerArchive: 4 })).toThrow(/more than 4 entries/);
    expect(parseZip(zip)).toHaveLength(5); // within budget: parses normally
  });

  test("rejects over-long entry paths", () => {
    const zip = buildZip([{ name: "a".repeat(5000), data: TEX.encode("x") }]);
    expect(() => parseZip(zip)).toThrow(new RegExp(`entry path exceeds the ${LIMITS.maxNameBytes}-byte limit`));
  });

  test("rejects member data that extends past the central directory", () => {
    const zip = buildZip([{ name: "short.txt", data: TEX.encode("0123456789"), centralSizes: { compressed: 100_000, uncompressed: 100_000 } }]);
    expect(() => parseZip(zip)).toThrow(/member data extends past.*truncated/);
  });

  test("rejects encrypted entries at the point of decompression", async () => {
    const zip = buildZip([{ name: "secret.txt", data: TEX.encode("hunter2"), flags: 0x1 }]);
    const entries = parseZip(zip); // parsing names is fine; reading the member is not
    expect(zipEntrySpecialReason(entries[0])).toBe("encrypted");
    await expect(zipEntryData(zip, entries[0])).rejects.toThrow(/encrypted entries are not ingestible/);
  });

  test("rejects unsupported compression methods", async () => {
    const zip = buildZip([{ name: "weird.dat", data: TEX.encode("payload"), method: 14 }]);
    const entries = parseZip(zip);
    await expect(zipEntryData(zip, entries[0])).rejects.toThrow(/unsupported compression method 14/);
  });

  test("caps deflate inflation to the declared size before inflating", async () => {
    const zeros = new Uint8Array(256 * 1024); // tiny deflate stream, large expansion
    const zip = buildZip([{ name: "bomb.bin", data: zeros, method: 8, centralSizes: { uncompressed: 100 } }]);
    const entries = parseZip(zip);
    await expect(zipEntryData(zip, entries[0])).rejects.toThrow(/inflate failed|central directory declares 100/);
  });

  test("rejects a stored member whose declared sizes disagree with its data", async () => {
    const zip = buildZip([{ name: "liar.txt", data: TEX.encode("0123456789"), centralSizes: { compressed: 10, uncompressed: 20 } }]);
    const entries = parseZip(zip);
    await expect(zipEntryData(zip, entries[0])).rejects.toThrow(/stored data is 10 bytes but the central directory declares 20/);
  });

  test("classifies unix symlink entries as special and regular files as ordinary", () => {
    const zip = buildZip([
      { name: "link", data: TEX.encode("/etc/passwd"), unixMode: 0xa1ff },
      { name: "file.txt", data: TEX.encode("hi"), unixMode: 0x81a4 },
      { name: "dos.txt", data: TEX.encode("hi") }, // no unix mode: ordinary for DOS-made zips
    ]);
    const entries = parseZip(zip);
    expect(zipEntrySpecialReason(entries[0])).toBe("symlink");
    expect(zipEntrySpecialReason(entries[1])).toBeNull();
    expect(zipEntrySpecialReason(entries[2])).toBeNull();
  });

  test("survey+extract skips symlinks, ingests regular files, and releases the cache", async () => {
    const zip = buildZip([
      { name: "task-alpha/run1/task_output/good.ts", data: TEX.encode("export const x = 1;") },
      { name: "task-alpha/run1/task_output/link.ts", data: TEX.encode("/etc/passwd"), unixMode: 0xa1ff },
      { name: "task-beta/run2/task_output/other.ts", data: TEX.encode("const y = 2;") },
    ]);
    const calls = installFetch(() => new Response(zip));
    const archive = zipArchive();
    const survey = await surveyArchive(archive, new Set(["task-alpha", "task-beta"]));
    expect(survey.taskIds.has("task-alpha")).toBe(true);
    expect(survey.codeLangsByTask.get("task-alpha")?.has("typescript")).toBe(true);

    const counters = freshCounters();
    const extracted = await extractArchive(archive, new Set(["task-alpha"]), counters);
    const files = extracted.get("task-alpha") ?? [];
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ runDir: "run1", path: "good.ts", content: "export const x = 1;" });
    expect(counters.specialEntries).toBe(1);
    expect(calls()).toBe(1); // extraction used the cache — no second download

    // The cached archive must be released once extraction is done.
    await expect(extractArchive(archive, new Set(["task-alpha"]), freshCounters())).rejects.toThrow(/zip bytes missing/);
  });

  test("refuses to retain cached zips over the total budget", async () => {
    const zip = buildZip([{ name: "task-alpha/run1/task_output/a.ts", data: TEX.encode("x") }]);
    installFetch(() => new Response(zip));
    const limits: Limits = { ...LIMITS, maxRetainedZipBytes: 8 };
    await expect(surveyArchive(zipArchive(), new Set(["task-alpha"]), limits)).rejects.toThrow(/would exceed the 8-byte budget/);
  });
});

// ---------------------------------------------------- tar safety (synthetic)

describe("tar safety (synthetic bytes)", () => {
  test("walks ordinary files, directories, and symlinks with their type flags", async () => {
    const tar = buildTar([
      { name: "task-alpha/run1/task_output/main.ts", data: TEX.encode("hello world") },
      { name: "task-alpha/run1/task_output/", typeflag: "5" },
      { name: "task-alpha/run1/task_output/link.ts", data: TEX.encode("/etc/passwd"), typeflag: "2" },
    ]);
    const entries = await walkTar(tar);
    expect(entries.map((e) => e.typeflag)).toEqual(["0", "5", "2"]);
    expect(entries[0].name).toBe("task-alpha/run1/task_output/main.ts");
    expect(ENC.decode(entries[0].data)).toBe("hello world");
  });

  test("refuses an entry declaring more than the entry budget", async () => {
    const tar = buildTar([{ name: "huge.bin", declaredSize: 100 * 1024 * 1024, headerOnly: true }]);
    await expect(walkTar(tar)).rejects.toThrow(/declares 104857600 bytes, over the \d+-byte entry limit/);
  });

  test("refuses cumulative gunzip output over the per-walk budget", async () => {
    const tar = buildTar([
      { name: "task-alpha/f1", data: new Uint8Array(700) },
      { name: "task-alpha/f2", data: new Uint8Array(700) },
      { name: "task-alpha/f3", data: new Uint8Array(700) },
    ]);
    const limits: Limits = { ...LIMITS, maxTarInflatedBytes: 1024 };
    await expect(walkTar(tar, limits)).rejects.toThrow(/inflated output exceeds the 1024-byte limit/);
  });

  test("refuses archives over the per-archive entry-count budget", async () => {
    const tar = buildTar([
      { name: "task-alpha/a", data: TEX.encode("a") },
      { name: "task-alpha/b", data: TEX.encode("b") },
      { name: "task-alpha/c", data: TEX.encode("c") },
    ]);
    const limits: Limits = { ...LIMITS, maxEntriesPerArchive: 2 };
    await expect(walkTar(tar, limits)).rejects.toThrow(/more than 2 entries/);
  });

  test("reports a truncated stream instead of accepting a partial archive", async () => {
    const tar = buildTar([{ name: "task-alpha/cut.txt", data: new Uint8Array(600), declaredSize: 1000, cutStream: true }]);
    await expect(walkTar(tar)).rejects.toThrow(/tar: truncated archive/);
  });

  test("refuses archive downloads over the response byte budget", async () => {
    installFetch(() => new Response(gzipSync(new Uint8Array(64))));
    const limits: Limits = { ...LIMITS, maxResponseBytes: 10 };
    const tar = buildTar([{ name: "task-alpha/a", data: TEX.encode("x") }]);
    await expect(walkTar(tar, limits)).rejects.toThrow(/body exceeds the 10-byte limit/);
  });

  test("applies pax path records to the next entry", async () => {
    const tar = buildTar([
      { name: "PaxHeaders/0", typeflag: "x", data: paxRecord("path", "task-alpha/run1/task_output/from-pax.ts") },
      { name: "ignored.ts", data: TEX.encode("body-data") },
    ]);
    const entries = await walkTar(tar);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("task-alpha/run1/task_output/from-pax.ts");
    expect(ENC.decode(entries[0].data)).toBe("body-data");
  });

  test("ignores benign global pax headers but rejects global path records", async () => {
    const benign = buildTar([
      { name: "PaxHeaders/0", typeflag: "g", data: paxRecord("mtime", "1700000000.0") },
      { name: "task-alpha/keep.ts", data: TEX.encode("kept") },
    ]);
    const entries = await walkTar(benign);
    expect(entries.map((e) => e.name)).toEqual(["task-alpha/keep.ts"]);

    const hostile = buildTar([{ name: "PaxHeaders/0", typeflag: "g", data: paxRecord("path", "x") }]);
    await expect(walkTar(hostile)).rejects.toThrow(/global pax header key "path" is not supported/);
  });

  test("extract drops traversal paths and counts special entries — nothing reaches disk", async () => {
    const tar = buildTar([
      { name: "task-alpha/run1/task_output/../../evil.ts", data: TEX.encode("pwned") },
      { name: "task-alpha/run1/task_output/link.ts", data: TEX.encode("/etc/passwd"), typeflag: "2" },
      { name: "task-alpha/run1/task_output/fine.ts", data: TEX.encode("kept()") },
    ]);
    installFetch(() => new Response(gzipSync(tar)));
    const counters = freshCounters();
    const extracted = await extractArchive(tarArchive(), new Set(["task-alpha"]), counters);
    const files = extracted.get("task-alpha") ?? [];
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: "fine.ts", content: "kept()" });
    expect(counters.unsafePaths).toBe(1);
    expect(counters.specialEntries).toBe(1);
  });
});
