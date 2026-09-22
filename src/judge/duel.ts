// Swapped-placement duels: two JEV choice calls over one two-candidate state,
// plus the pure verdict rule both calls feed.

import rubric from "../../rubric/rubric.json";
import { duelQuestions } from "./questions";
import type { ChoiceAnswer, DuelResult, Item, Judge, JudgeCall, Task, Verdict } from "../types";

const WINNER_QUESTION = "winner";
const TOO_CLOSE = "too_close_to_call";
const CANDIDATE_A = "candidate_a";
const CANDIDATE_B = "candidate_b";
const DEFAULT_MIN_CONFIDENCE = 0.55;

/**
 * Canonical verdict from the two swapped calls. Both answers are in canonical
 * a/b space: `ab` was judged with physical a shown as `candidate_a`, and `ba`
 * has been remapped from its flipped placement. Same candidate in both
 * orderings wins — but only when the decisive choice's confidence clears the
 * floor in both calls. Both `too_close_to_call`, split verdicts, a close/decisive
 * mix, or low confidence: tie.
 */
export function verdictRule(ab: ChoiceAnswer, ba: ChoiceAnswer, minConfidence = DEFAULT_MIN_CONFIDENCE): Verdict {
  if (ab.choice !== ba.choice) return "tie";
  if (ab.choice === TOO_CLOSE) return "tie";
  if (ab.choice !== CANDIDATE_A && ab.choice !== CANDIDATE_B) return "tie";
  if (Math.min(ab.confidence, ba.confidence) < minConfidence) return "tie";
  return ab.choice === CANDIDATE_A ? "a" : "b";
}

function winnerAnswer(call: JudgeCall): ChoiceAnswer {
  const answer = call.answers[WINNER_QUESTION];
  if (!answer || answer.type !== "choice") throw new Error(`duel: expected a choice answer for \`winner\``);
  return answer;
}

/** The flipped turn shows physical b as `candidate_a`; swap labels back to canonical a/b. */
function toCanonicalPlacement(answer: ChoiceAnswer): ChoiceAnswer {
  const flip = (label: string): string =>
    label === CANDIDATE_A ? CANDIDATE_B : label === CANDIDATE_B ? CANDIDATE_A : label;
  const probabilities: Record<string, number> = {};
  for (const [label, p] of Object.entries(answer.probabilities)) probabilities[flip(label)] = p;
  return { type: "choice", choice: flip(answer.choice), probabilities, confidence: answer.confidence };
}

/** What the judge sees: code and communication only — never id, tier, or model. */
function candidate(item: Item): { artifact: Item["artifact"]; context: Item["context"] } {
  return { artifact: item.artifact, context: item.context };
}

/**
 * Runs a duel: one state `{ task, taste_definition, candidate_a, candidate_b }`,
 * two `winner` choice calls with A/B and B/A placement (the flipped answer is
 * remapped to canonical a/b before the verdict). Both raw JudgeCalls come back
 * in `swaps`; `repeat`/`consistent` are the reliability layer's to fill.
 */
export async function duel(judge: Judge, task: Task, a: Item, b: Item): Promise<DuelResult> {
  const questions = duelQuestions();
  const base = { task, taste_definition: rubric.taste_definition };

  const [ab, ba] = await Promise.all([
    judge.ask({ ...base, candidate_a: candidate(a), candidate_b: candidate(b) }, questions),
    judge.ask({ ...base, candidate_a: candidate(b), candidate_b: candidate(a) }, questions),
  ]);

  const verdict = verdictRule(winnerAnswer(ab), toCanonicalPlacement(winnerAnswer(ba)));

  return {
    task_id: task.id,
    a_item: a.id,
    b_item: b.id,
    a_model: a.provenance.model,
    b_model: b.provenance.model,
    verdict,
    swaps: { ab, ba },
  };
}
