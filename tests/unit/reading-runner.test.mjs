import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

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
test("The reader loads from one place and stops plainly when it is missing", async () => {
  assert.match(READER_MODULE.pathname, /server\/lib\/reader\.ts$/);
  const dir = await mkdtemp(path.join(tmpdir(), "eighty-reader-"));
  try {
    await assert.rejects(loadReader(pathToFileURL(path.join(dir, "reader.ts"))), /document reader is missing/);
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
