import { describe, expect, test } from "bun:test";
import { validateItem } from "../src/items/schema";
import type { Item } from "../src/types";

function sampleItem(): Item {
  return {
    id: "d1-fishpond--openai-gpt-6-astra",
    tier: "demo",
    task: {
      id: "d1-fishpond",
      kind: "web-app",
      brief: "Build a single-file HTML koi pond game where fish follow the cursor.",
      language: "javascript",
      tests_expected: false,
    },
    artifact: {
      form: "single-file",
      files: [{ path: "index.html", content: "<!doctype html>\n<title>Koi Pond</title>" }],
    },
    context: {
      prompt: "Build a single-file HTML koi pond game...",
      explanation: "I kept one rAF loop and steered each fish with velocity smoothing.",
    },
    provenance: {
      model: "openai/gpt-6-astra",
      model_label: "GPT-6 Astra (OpenAI)",
      harness: "openrouter-chat-completions",
      harness_version: "openrouter-chat-2026-09-22",
      temperature: 0.3,
      generated_at: "2026-09-22T12:00:00.000Z",
      source: "generated",
    },
    license: { spdx: "MIT", redistribution: "demo-eligible" },
    contamination: { viral: false },
  };
}

describe("validateItem", () => {
  test("round-trips a full valid item", () => {
    const item = sampleItem();
    expect(validateItem(JSON.parse(JSON.stringify(item)))).toEqual(item);
  });

  test("rejects a missing provenance block", () => {
    const item = sampleItem() as unknown as Record<string, unknown>;
    delete item.provenance;
    expect(() => validateItem(item)).toThrow(/provenance/);
  });

  test("rejects a single-file artifact holding two files", () => {
    const item = sampleItem();
    item.artifact.files = [...item.artifact.files, { path: "app.css", content: "body { margin: 0; }" }];
    expect(() => validateItem(item)).toThrow(/single-file/);
  });

  test("rejects a tree artifact holding a single file", () => {
    const item = sampleItem();
    item.artifact.form = "tree";
    expect(() => validateItem(item)).toThrow(/tree/);
  });

  test("rejects an empty artifact unless generation failed", () => {
    const item = sampleItem();
    item.artifact.files = [];
    expect(() => validateItem(item)).toThrow(/single-file/);
    item.generation_failed = true;
    expect(() => validateItem(item)).not.toThrow();
  });
});
