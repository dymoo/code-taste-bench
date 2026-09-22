// One-call rubric profile for a single item: all independent JEV questions
// over one state, per the Decisions contract.

import { itemProfileQuestions } from "./questions";
import type {
  Answers,
  DimensionId,
  Item,
  ItemProfile,
  Judge,
  JudgeCall,
  NoulAnswer,
  Questions,
  ScoreAnswer,
  SlopId,
} from "../types";

const DIMENSIONS: DimensionId[] = ["clarity", "idiom", "signal", "comms", "tests"];
const SLOPS: SlopId[] = [
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

function noulAnswer(answers: Answers, id: string): NoulAnswer {
  const answer = answers[id];
  if (!answer || answer.type !== "noul") throw new Error(`profileItem: expected a noul answer for \`${id}\``);
  return answer;
}

/**
 * Scores one item in a single `judge.ask` call. Gating:
 * - `comms` is left out of the request when the item carries no explanation at
 *   all, and dropped from the result when the judge's `has_explanation` noul
 *   lands below 0.5 (an explanation that exists but is a stub earns no comms
 *   dimension);
 * - `tests` is left out of the request when `task.tests_expected` is false.
 *
 * `composite` is the plain mean of the answered dimension scores on the
 * rubric's 0..4 expected-level scale (publication divides by 4); gated or
 * unanswered dimensions are excluded, which renormalizes the mean.
 */
export async function profileItem(judge: Judge, item: Item): Promise<ItemProfile> {
  const all = itemProfileQuestions();
  const hasLocalExplanation = (item.context.explanation ?? "").trim().length > 0;

  const questions: Questions = {};
  for (const [id, question] of Object.entries(all)) {
    if (id === "comms" && !hasLocalExplanation) continue;
    if (id === "tests" && !item.task.tests_expected) continue;
    questions[id] = question;
  }

  const call = await judge.ask({ task: item.task, artifact: item.artifact, context: item.context }, questions);

  const has_explanation = noulAnswer(call.answers, "has_explanation");
  const has_tests = noulAnswer(call.answers, "has_tests");

  const dimensions: Partial<Record<DimensionId, ScoreAnswer>> = {};
  let scoreSum = 0;
  let scored = 0;
  for (const id of DIMENSIONS) {
    if (!(id in questions)) continue; // gated out of this request
    if (id === "comms" && has_explanation.noul < 0.5) continue;
    const answer = call.answers[id];
    if (!answer || answer.type !== "score") throw new Error(`profileItem: expected a score answer for \`${id}\``);
    dimensions[id] = answer;
    scoreSum += answer.score;
    scored += 1;
  }

  const slop = {} as Record<SlopId, NoulAnswer>;
  for (const id of SLOPS) slop[id] = noulAnswer(call.answers, id);

  return {
    item_id: item.id,
    dimensions,
    has_explanation,
    has_tests,
    slop,
    composite: scored === 0 ? 0 : scoreSum / scored,
    calls: [call] as JudgeCall[],
  };
}
