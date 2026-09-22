import { describe, expect, test } from "bun:test";
import { verdictRule } from "../src/judge/duel";
import type { ChoiceAnswer } from "../src/types";

function answer(choice: string, confidence: number): ChoiceAnswer {
  const rest = (1 - confidence) / 2;
  return {
    type: "choice",
    choice,
    confidence,
    probabilities: {
      candidate_a: choice === "candidate_a" ? confidence : rest,
      candidate_b: choice === "candidate_b" ? confidence : rest,
      too_close_to_call: choice === "too_close_to_call" ? confidence : rest,
    },
  };
}

describe("verdictRule", () => {
  test("both orderings pick candidate a -> a wins", () => {
    expect(verdictRule(answer("candidate_a", 0.9), answer("candidate_a", 0.8))).toBe("a");
  });

  test("both orderings pick candidate b -> b wins", () => {
    expect(verdictRule(answer("candidate_b", 0.95), answer("candidate_b", 0.7))).toBe("b");
  });

  test("both orderings too close to call -> tie", () => {
    expect(verdictRule(answer("too_close_to_call", 0.9), answer("too_close_to_call", 0.85))).toBe("tie");
  });

  test("split verdicts -> tie", () => {
    expect(verdictRule(answer("candidate_a", 0.95), answer("candidate_b", 0.95))).toBe("tie");
    expect(verdictRule(answer("candidate_b", 0.95), answer("candidate_a", 0.95))).toBe("tie");
  });

  test("one decisive, one close -> tie", () => {
    expect(verdictRule(answer("candidate_a", 0.9), answer("too_close_to_call", 0.9))).toBe("tie");
  });

  test("decisive but below the default 0.55 confidence floor -> tie", () => {
    expect(verdictRule(answer("candidate_a", 0.9), answer("candidate_a", 0.5))).toBe("tie");
    expect(verdictRule(answer("candidate_b", 0.4), answer("candidate_b", 0.9))).toBe("tie");
    expect(verdictRule(answer("candidate_a", 0.55), answer("candidate_a", 0.6))).toBe("a");
  });

  test("explicit minConfidence overrides the default floor", () => {
    expect(verdictRule(answer("candidate_b", 0.6), answer("candidate_b", 0.6), 0.7)).toBe("tie");
    expect(verdictRule(answer("candidate_b", 0.6), answer("candidate_b", 0.6), 0.6)).toBe("b");
  });
});
