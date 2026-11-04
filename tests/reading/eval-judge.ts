// Judges one agent run for the eval suite in evals/reading.eval.ts.
// The run must call extract_evidence once without an error, and its result must be a reader result.
// That result is scored like any other read; a false Meets scores 0, anything else that was read scores 1.
// No usable result also scores 0: a run that read nothing cannot show the month is safe.
import type { AgentRunOutput } from "@agent-native/core/eval";

import { readerResult } from "../../shared/evidence.ts";
import { scoreDocument } from "./score.ts";
import type { Answer, DocumentScore } from "./score.ts";

export const READ_TOOL = "extract_evidence";

export interface Judgement {
  score: number;
  reason: string;
  detail?: DocumentScore;
}

// Finds a reader result in a tool result: the result itself, or under "result", "reading" or "evidence".
export function findReaderResult(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || typeof value !== "object") return undefined;
  if (readerResult.safeParse(value).success) return value;
  for (const key of ["result", "reading", "evidence"]) {
    const found = findReaderResult((value as Record<string, unknown>)[key], depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function judgeRun(run: AgentRunOutput, answer: Answer): Judgement {
  const calls = (run.toolCallDetails ?? []).filter((call) => call.name === READ_TOOL);
  if (!run.ok) return { score: 0, reason: `The agent run failed: ${run.error ?? "no reason given"}.` };
  if (calls.length !== 1) return { score: 0, reason: `Expected one ${READ_TOOL} call, saw ${calls.length}.` };
  const call = calls[0];
  if (!call || call.isError || call.completed === false || typeof call.result !== "string")
    return { score: 0, reason: `${READ_TOOL} did not finish without an error.` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(call.result);
  } catch {
    return { score: 0, reason: `${READ_TOOL} did not return JSON.` };
  }
  const found = findReaderResult(parsed);
  if (!found) return { score: 0, reason: `${READ_TOOL} returned no reader result.` };
  const detail = scoreDocument(answer, found);
  return detail.outcome.falseMeets
    ? { score: 0, reason: `False Meets: the month reads Meets, but the answer is ${answer.expectedOutcome}.`, detail }
    : {
        score: 1,
        reason: `Month reads ${detail.outcome.actual}; the answer is ${answer.expectedOutcome}.`,
        detail,
      };
}
