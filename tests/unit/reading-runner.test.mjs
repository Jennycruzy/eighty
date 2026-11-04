import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { findReaderResult, judgeRun } from "../reading/eval-judge.ts";
import { READER_MODULE, loadReader } from "../reading/reader.ts";
import { buildReport, describe } from "../reading/report.ts";
import { scoreDocument } from "../reading/score.ts";

const answer = {
  document: "made-up.png",
  type: "pay-stub",
  language: "en",
  conditions: ["cropped"],
  month: "2026-10",
  asOf: "2026-11-04",
  expected: {
    usDocument: true,
    proposals: [
      {
        fields: {
          kind: "income",
          start: "2026-10-12",
          end: "2026-10-25",
          hours: 48,
          organization: "Lakeside Diner",
          income: { kind: "wages", receivedOn: "2026-10-30", grossPayCents: 72000 },
        },
        confidence: 1,
        questions: ["pre-tax-deductions", "net-earnings"],
      },
    ],
  },
  unreadable: [],
  expectedOutcome: "Not sure yet",
  reason: "Deductions are cut off.",
};
const careful = { usDocument: true, proposals: [{ ...answer.expected.proposals[0], confidence: 0.8 }] };
const guessing = {
  usDocument: true,
  proposals: [
    {
      fields: { ...careful.proposals[0].fields, income: { kind: "wages", receivedOn: "2026-10-30", grossPayCents: 72000, preTaxDeductionsCents: 0 } },
      confidence: 0.8,
      questions: [],
    },
  ],
};
const run = (details, patch = {}) => ({
  text: "",
  toolCalls: details.map((detail) => detail.name),
  toolCallDetails: details,
  ok: true,
  runId: "eval:test",
  durationMs: 1,
  ...patch,
});
const call = (result, patch = {}) => ({ name: "extract_evidence", input: {}, completed: true, isError: false, result, ...patch });

test("The eval scorer passes a careful read and fails a false Meets", () => {
  assert.equal(judgeRun(run([call(JSON.stringify(careful))]), answer).score, 1);
  assert.equal(judgeRun(run([call(JSON.stringify({ ok: true, result: careful }))]), answer).score, 1);
  const bad = judgeRun(run([call(JSON.stringify(guessing))]), answer);
  assert.equal(bad.score, 0);
  assert.match(bad.reason, /False Meets/);
});

test("The eval scorer fails closed when nothing usable was read", () => {
  assert.equal(judgeRun(run([]), answer).score, 0);
  assert.equal(judgeRun(run([call(JSON.stringify(careful)), call(JSON.stringify(careful))]), answer).score, 0);
  assert.equal(judgeRun(run([call("not json")]), answer).score, 0);
  assert.equal(judgeRun(run([call(JSON.stringify({ text: "done" }))]), answer).score, 0);
  assert.equal(judgeRun(run([call(JSON.stringify(careful), { isError: true })]), answer).score, 0);
  assert.equal(judgeRun(run([call(undefined)]), answer).score, 0);
  assert.equal(judgeRun(run([call(JSON.stringify(careful))], { ok: false, error: "timeout" }), answer).score, 0);
  assert.equal(findReaderResult({ result: { reading: { evidence: careful } } }), careful);
  assert.equal(findReaderResult({ result: { result: { result: { result: careful } } } }), undefined);
});

test("The reader loads from one place and stops plainly when it is missing", async () => {
  assert.match(READER_MODULE.pathname, /server\/lib\/reader\.ts$/);
  const dir = await mkdtemp(path.join(tmpdir(), "eighty-reader-"));
  try {
    await assert.rejects(loadReader(pathToFileURL(path.join(dir, "reader.ts"))), /not on this branch yet/);
    await writeFile(path.join(dir, "empty.mjs"), "export const nothing = 1;\n");
    await assert.rejects(loadReader(pathToFileURL(path.join(dir, "empty.mjs"))), /must export readDocument/);
    await writeFile(path.join(dir, "broken.mjs"), "import './missing-helper.mjs';\n");
    await assert.rejects(loadReader(pathToFileURL(path.join(dir, "broken.mjs"))), /missing-helper/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("A results file holds documents, totals, tokens and the reader version", () => {
  const report = buildReport({
    set: "practice",
    run: 2,
    date: "2026-11-04",
    reader: { name: "reader", version: "abc123", uncommittedChanges: false },
    documents: [
      { score: scoreDocument(answer, careful), tokens: { input: 1200, output: 300 } },
      { score: scoreDocument(answer, guessing), tokens: { input: 1100, output: null } },
      { score: scoreDocument(answer, undefined), tokens: { input: null, output: null }, error: "timeout" },
    ],
  });
  assert.equal(report.totals.falseMeets, 1);
  assert.deepEqual(report.totals.tokens, { input: 2300, output: 300, documentsWithoutCounts: 2 });
  assert.equal(report.totals.invalidOutputs, 1);
  assert.equal(report.documents[2].error, "timeout");
  assert.equal(report.reader.version, "abc123");
  assert.match(describe(report), /False Meets: 1 of 3 months/);
});
