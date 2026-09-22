// Shared contracts for the code-taste-bench suite. Authoritative alongside SPEC.md.
// All modules code against these types; extend only by updating SPEC.md first.

export type Tier = "demo" | "sealed";
export type TaskKind = "web-app" | "utility" | "refactor" | "fix";
export type Language = "typescript" | "javascript" | "python";

export interface Task {
  id: string;
  kind: TaskKind;
  brief: string;
  language: Language;
  tests_expected: boolean;
  seed?: { path: string; content: string };
}

export interface ArtifactFile {
  path: string;
  content: string;
}

export interface Artifact {
  form: "single-file" | "tree" | "diff";
  files: ArtifactFile[];
}

export interface Provenance {
  model: string;
  model_label: string;
  harness: "openrouter-chat-completions";
  harness_version: string;
  temperature: number;
  generated_at: string;
  source: "generated" | "harvested";
  source_url?: string;
}

export interface LicenseInfo {
  spdx: string;
  redistribution: "demo-eligible" | "sealed-only";
  notes?: string;
}

export interface Contamination {
  public_since?: string;
  viral: boolean;
}

export interface Item {
  id: string;
  tier: Tier;
  task: Task;
  artifact: Artifact;
  context: { prompt: string; explanation?: string };
  provenance: Provenance;
  license: LicenseInfo;
  contamination: Contamination;
  generation_failed?: boolean;
}

export type DimensionId = "clarity" | "idiom" | "signal" | "comms" | "tests";

export type SlopId =
  | "type_laundering"
  | "unvalidated_boundary"
  | "accumulating_copy"
  | "eager_pipeline"
  | "comment_slop"
  | "emoji_marketing"
  | "inflated_prose"
  | "swallowed_errors"
  | "placeholder_residue"
  | "ceremony_structure"
  | "self_proving_tests"
  | "silencing_tells";

// JEV Decisions API (POST https://openrouter.ai/api/alpha/decisions)

// Wire shapes verified live against /api/alpha/decisions: `score` accepts an ordered
// string[] of level descriptions; `choice` REQUIRES a record { optionKey: description }
// (arrays are rejected with `expected record`); `noul` takes no criteria.
export type Question =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type Questions = Record<string, Question>;

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;
export type Answers = Record<string, Answer>;

export interface JudgeCall {
  id: string;
  model: string;
  answers: Answers;
  usage: { input_tokens: number; output_tokens: number; cost: number };
}

export interface Judge {
  ask(state: unknown, questions: Questions): Promise<JudgeCall>;
}

export interface ItemProfile {
  item_id: string;
  dimensions: Partial<Record<DimensionId, ScoreAnswer>>;
  has_explanation: NoulAnswer;
  has_tests: NoulAnswer;
  slop: Record<SlopId, NoulAnswer>;
  composite: number; // mean of answered dimension scores on the 0..4 level scale (published as composite/4)
  calls: JudgeCall[];
}

export type Verdict = "a" | "b" | "tie";

export interface DuelResult {
  task_id: string;
  a_item: string;
  b_item: string;
  a_model: string;
  b_model: string;
  verdict: Verdict;
  swaps: { ab: JudgeCall; ba: JudgeCall };
  repeat?: JudgeCall;
  consistent?: boolean;
}

export interface WinRecord {
  model: string;
  opponent: string;
  outcome: 1 | 0 | 0.5;
}

export interface BTResult {
  theta: Record<string, number>;
  iterations: number;
  converged: boolean;
}

export interface DimensionStat {
  mean: number;
  ci: [number, number];
  n: number;
}

export interface ModelSummary {
  model: string;
  model_label: string;
  taste_elo: number;
  duels: number;
  wins: number;
  losses: number;
  ties: number;
  dimensions: Partial<Record<DimensionId, DimensionStat>>;
  slop_density: number;
  items: number;
}

export interface Leaderboard {
  generated_at: string;
  judge_generation: string;
  snapshots: Record<string, number>;
  suite_sha: string;
  models: ModelSummary[];
  reliability: {
    swap_agreement: number;
    repeat_agreement: number;
    total_duels: number;
    repeat_sample: number;
  };
  sealed_aggregates: {
    tasks: number;
    items: number;
    duels: number;
    distributions: Record<string, number[]>;
  };
}
