// Builds the results file for one run over one set: per document, per field, totals,
// false-Meets count and bound, tokens used and the reader version.
import { summarize } from "./score.ts";
import type { DocumentScore, Summary } from "./score.ts";

export interface RunDocument {
  score: DocumentScore;
  tokens: { input: number | null; output: number | null };
  error?: string;
}
export interface RunReport {
  set: string;
  run: number;
  date: string;
  reader: { name: string; version: string; uncommittedChanges: boolean };
  totals: Summary & { tokens: { input: number; output: number; documentsWithoutCounts: number } };
  documents: (DocumentScore & { tokens: RunDocument["tokens"]; error?: string })[];
}

export function buildReport(input: {
  set: string;
  run: number;
  date: string;
  reader: RunReport["reader"];
  documents: RunDocument[];
}): RunReport {
  const add = (pick: (tokens: RunDocument["tokens"]) => number | null) =>
    input.documents.reduce((total, item) => total + (pick(item.tokens) ?? 0), 0);
  return {
    set: input.set,
    run: input.run,
    date: input.date,
    reader: input.reader,
    totals: {
      ...summarize(input.documents.map((item) => item.score)),
      tokens: {
        input: add((tokens) => tokens.input),
        output: add((tokens) => tokens.output),
        documentsWithoutCounts: input.documents.filter((item) => item.tokens.input === null || item.tokens.output === null)
          .length,
      },
    },
    documents: input.documents.map((item) => ({
      ...item.score,
      tokens: item.tokens,
      ...(item.error ? { error: item.error } : {}),
    })),
  };
}

export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};

// Plain lines for the terminal.
export function describe(report: RunReport): string {
  const t = report.totals;
  const percent = (value: number | null) => (value === null ? "n/a" : `${(value * 100).toFixed(1)}%`);
  return [
    `${report.reader.name} on ${report.set} (run ${report.run}): ${t.documents} documents`,
    `Fields right: ${t.fields.correct} of ${t.fields.fields} (${percent(t.fields.accuracy)}); wrong ${t.fields.wrong}, guessed ${t.fields.guessed}, asked ${t.fields.asked}, missing ${t.fields.missing}`,
    `Month outcomes matching the answer: ${t.outcomesMatched} of ${t.months}`,
    `False Meets: ${t.falseMeets} of ${t.months} months${t.falseMeets ? ` (${t.falseMeetsDocuments.join(", ")})` : ""}`,
    `95% upper bound on the false-Meets rate: ${percent(t.falseMeetsUpperBound95)}`,
    `Tokens: ${t.tokens.input} in, ${t.tokens.output} out`,
  ].join("\n");
}
