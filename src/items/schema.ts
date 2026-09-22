// Item validation against src/types.ts. Every failure is a descriptive throw;
// nothing is coerced or defaulted.

import type { Item } from "../types";

const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const TASK_KINDS = ["web-app", "utility", "refactor", "fix"] as const;
const LANGUAGES = ["typescript", "javascript", "python"] as const;
const TIERS = ["demo", "sealed"] as const;
const FORMS = ["single-file", "tree", "diff"] as const;
const HARNESS = "openrouter-chat-completions";
const SOURCES = ["generated", "harvested"] as const;
const REDISTRIBUTIONS = ["demo-eligible", "sealed-only"] as const;

function fail(path: string, message: string): never {
  throw new Error(`validateItem: ${path}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "expected an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(path, "expected a non-empty string");
  return value;
}

function optionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string") fail(path, "expected a string when present");
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(path, `expected one of ${allowed.map((option) => JSON.stringify(option)).join(", ")}, got ${JSON.stringify(value)}`);
  }
  return value as T;
}

function slug(value: unknown, path: string): string {
  const id = string(value, path);
  if (!SLUG.test(id)) fail(path, `expected a slug (lowercase letters, digits, hyphens), got ${JSON.stringify(id)}`);
  return id;
}

export function validateItem(x: unknown): Item {
  const item = object(x, "item");

  slug(item.id, "id");
  oneOf(item.tier, "tier", TIERS);
  if (item.generation_failed !== undefined) boolean(item.generation_failed, "generation_failed");

  // task
  const task = object(item.task, "task");
  slug(task.id, "task.id");
  oneOf(task.kind, "task.kind", TASK_KINDS);
  string(task.brief, "task.brief");
  oneOf(task.language, "task.language", LANGUAGES);
  boolean(task.tests_expected, "task.tests_expected");
  if (task.seed !== undefined) {
    const seed = object(task.seed, "task.seed");
    string(seed.path, "task.seed.path");
    if (typeof seed.content !== "string") fail("task.seed.content", "expected a string");
  }

  // artifact: shape, file integrity, and form/file consistency
  const artifact = object(item.artifact, "artifact");
  const form = oneOf(artifact.form, "artifact.form", FORMS);
  if (!Array.isArray(artifact.files)) fail("artifact.files", "expected an array");
  const files: unknown[] = artifact.files;
  const paths = new Set<string>();
  files.forEach((file, index) => {
    const entry = object(file, `artifact.files[${index}]`);
    const path = string(entry.path, `artifact.files[${index}].path`);
    if (path.startsWith("/") || path.split("/").includes("..")) {
      fail(`artifact.files[${index}].path`, `expected a relative path, got ${JSON.stringify(path)}`);
    }
    if (paths.has(path)) fail(`artifact.files[${index}].path`, `duplicate file path ${JSON.stringify(path)}`);
    paths.add(path);
    if (typeof entry.content !== "string") fail(`artifact.files[${index}].content`, "expected a string");
  });
  if (item.generation_failed === true) {
    if (files.length !== 0) fail("artifact.files", "expected no files when generation_failed is true");
  } else if (form === "single-file") {
    if (files.length !== 1) fail("artifact.form", `single-file must hold exactly one file, got ${files.length}`);
  } else if (form === "tree") {
    if (files.length < 2) fail("artifact.form", `tree must hold at least two files, got ${files.length}`);
  } else if (files.length < 1) {
    fail("artifact.form", "diff must hold at least one file");
  }

  // context
  const context = object(item.context, "context");
  string(context.prompt, "context.prompt");
  optionalString(context.explanation, "context.explanation");

  // provenance
  const provenance = object(item.provenance, "provenance");
  string(provenance.model, "provenance.model");
  string(provenance.model_label, "provenance.model_label");
  if (provenance.harness !== HARNESS) {
    fail("provenance.harness", `expected ${JSON.stringify(HARNESS)}, got ${JSON.stringify(provenance.harness)}`);
  }
  string(provenance.harness_version, "provenance.harness_version");
  if (typeof provenance.temperature !== "number" || !Number.isFinite(provenance.temperature)) {
    fail("provenance.temperature", "expected a finite number");
  }
  const generatedAt = string(provenance.generated_at, "provenance.generated_at");
  if (Number.isNaN(Date.parse(generatedAt))) {
    fail("provenance.generated_at", `expected a parseable timestamp, got ${JSON.stringify(generatedAt)}`);
  }
  oneOf(provenance.source, "provenance.source", SOURCES);
  optionalString(provenance.source_url, "provenance.source_url");

  // license
  const license = object(item.license, "license");
  string(license.spdx, "license.spdx");
  oneOf(license.redistribution, "license.redistribution", REDISTRIBUTIONS);
  optionalString(license.notes, "license.notes");

  // contamination
  const contamination = object(item.contamination, "contamination");
  boolean(contamination.viral, "contamination.viral");
  optionalString(contamination.public_since, "contamination.public_since");

  return item as unknown as Item;
}
