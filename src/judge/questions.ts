// JEV question builders, derived from the authoritative rubric JSON.

import rubric from "../../rubric/rubric.json";
import type { DimensionId, Questions, SlopId } from "../types";

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
const PRESENCE = ["has_explanation", "has_tests"] as const;

/**
 * One item's profile questions: 5 score questions (criteria = the rubric's five
 * ordered level texts per dimension), 12 slop noul diagnostics, 2 presence noul
 * questions. Question ids are the DimensionId / SlopId / presence keys exactly.
 */
export function itemProfileQuestions(): Questions {
  const questions: Questions = {};
  for (const id of DIMENSIONS) {
    const dimension = rubric.dimensions[id];
    questions[id] = { type: "score", instructions: dimension.instructions, criteria: [...dimension.levels] };
  }
  for (const id of SLOPS) {
    questions[id] = { type: "noul", instructions: rubric.slop_diagnostics[id].instructions };
  }
  for (const id of PRESENCE) {
    questions[id] = { type: "noul", instructions: rubric.presence[id].instructions };
  }
  return questions;
}

/** The single choice JEV question every duel turn is judged with. */
export function duelQuestions(): Questions {
  return {
    winner: {
      type: "choice",
      instructions: rubric.duel_instructions,
      criteria: { ...rubric.duel_criteria },
    },
  };
}
