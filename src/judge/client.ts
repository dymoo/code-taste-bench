// JEV Decisions API client: POST /api/alpha/decisions with retry and cost capture.
// The API key lives only in this module's closure and goes out as the Bearer
// header; it is never logged and never appears in error messages.

import type { Answers, Judge, JudgeCall, Questions } from "../types";

export interface CreateJudgeOptions {
  apiKey: string;
  /** Pinned judge model. Only `typesafe/jev-1.13` is accepted — any other
   * value is rejected at construction, before any fetch. Defaults to the pin. */
  model?: string;
  /** OpenRouter origin; the /api/alpha/decisions path is appended. */
  baseUrl?: string;
}

/**
 * A Decisions API failure. `status` is the HTTP status; 0 means no response was
 * ever produced (network failure) or the 2xx payload was malformed.
 */
export class JudgeApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "JudgeApiError";
    this.status = status;
  }
}

const DEFAULT_MODEL = "typesafe/jev-1.13";
const DEFAULT_BASE_URL = "https://openrouter.ai";
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 250;
const BACKOFF_CAP_MS = 4000;

/** Retry set: rate limits, server errors, and overload (529). */
const isRetryableStatus = (status: number): boolean =>
  status === 429 || status === 529 || (status >= 500 && status < 600);

function errorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string" && parsed.error.message) return parsed.error.message;
  } catch {
    // not JSON; fall through to the raw body
  }
  return raw.slice(0, 300) || "no error body";
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) out[key] = entry;
  }
  return out;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function malformed(message: string): JudgeApiError {
  return new JudgeApiError(`malformed decisions response: ${message}`);
}

/**
 * Map the wire `answers` record onto the typed Answers contract, failing loudly
 * on anything a consumer could silently mis-score. Optional `confidence` falls
 * back to 0 (the safe side of every confidence floor) when absent.
 */
function parseAnswers(raw: unknown): Answers {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw malformed("`answers` is not an object");
  }
  const answers: Answers = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw malformed(`answer \`${id}\` is not an object`);
    }
    const a = entry as Record<string, unknown>;
    switch (a.type) {
      case "noul": {
        if (typeof a.noul !== "number" || !Number.isFinite(a.noul)) {
          throw malformed(`answer \`${id}\` has no finite noul`);
        }
        answers[id] = { type: "noul", noul: a.noul };
        break;
      }
      case "score": {
        if (typeof a.score !== "number" || !Number.isFinite(a.score)) {
          throw malformed(`answer \`${id}\` has no finite score`);
        }
        answers[id] = {
          type: "score",
          score: a.score,
          legend: asStringRecord(a.legend),
          probabilities: asNumberRecord(a.probabilities),
          confidence: typeof a.confidence === "number" && Number.isFinite(a.confidence) ? a.confidence : 0,
        };
        break;
      }
      case "choice": {
        if (typeof a.choice !== "string" || a.choice === "") {
          throw malformed(`answer \`${id}\` has no choice label`);
        }
        answers[id] = {
          type: "choice",
          choice: a.choice,
          probabilities: asNumberRecord(a.probabilities),
          confidence: typeof a.confidence === "number" && Number.isFinite(a.confidence) ? a.confidence : 0,
        };
        break;
      }
      default:
        throw malformed(`answer \`${id}\` has unknown type ${JSON.stringify(a.type)}`);
    }
  }
  return answers;
}

/**
 * Map a 2xx Decisions payload into a JudgeCall. `model` is taken verbatim from
 * the response — that is the serving snapshot the run must record — never from
 * the request.
 */
function mapResponse(payload: unknown): JudgeCall {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw malformed("body is not an object");
  }
  const response = payload as Record<string, unknown>;
  if (typeof response.id !== "string" || response.id === "") throw malformed("missing `id`");
  if (typeof response.model !== "string" || response.model === "") throw malformed("missing `model` serving snapshot");
  const answers = parseAnswers(response.answers);
  if (typeof response.usage !== "object" || response.usage === null || Array.isArray(response.usage)) {
    throw malformed("missing `usage`");
  }
  const usage = response.usage as Record<string, unknown>;
  const usageField = (key: "input_tokens" | "output_tokens" | "cost"): number => {
    const value = usage[key];
    if (typeof value !== "number" || !Number.isFinite(value)) throw malformed(`usage.${key} is not a finite number`);
    return value;
  };
  return {
    id: response.id,
    model: response.model,
    answers,
    usage: {
      input_tokens: usageField("input_tokens"),
      output_tokens: usageField("output_tokens"),
      cost: usageField("cost"),
    },
  };
}

export function createJudge(opts: CreateJudgeOptions): Judge {
  const model = opts.model ?? DEFAULT_MODEL;
  if (model !== DEFAULT_MODEL) {
    throw new Error(
      `judge: model ${JSON.stringify(model)} is not the pinned judge — only JEV judging is allowed (pinned ${DEFAULT_MODEL}); this call was rejected before any fetch`,
    );
  }
  const url = `${(opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")}/api/alpha/decisions`;

  return {
    async ask(state: unknown, questions: Questions): Promise<JudgeCall> {
      const body = JSON.stringify({ model, state, questions });
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt > 1) await Bun.sleep(Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 2), BACKOFF_CAP_MS));

        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
            body,
          });
        } catch (cause) {
          throw new JudgeApiError(`Decisions API network error: ${cause instanceof Error ? cause.message : String(cause)}`);
        }

        if (res.ok) {
          let payload: unknown;
          try {
            payload = await res.json();
          } catch {
            throw new JudgeApiError("Decisions API returned a non-JSON 2xx body", res.status);
          }
          return mapResponse(payload);
        }

        const status = res.status;
        if (isRetryableStatus(status) && attempt < MAX_ATTEMPTS) continue;
        const detail = errorDetail(await res.text().catch(() => ""));
        throw new JudgeApiError(`Decisions API error (HTTP ${status}): ${detail}`, status);
      }
      throw new JudgeApiError(`Decisions API error: no successful response after ${MAX_ATTEMPTS} attempts`);
    },
  };
}
