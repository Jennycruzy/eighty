import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";

import { runWithRequestContext } from "@agent-native/core/server";
import { PDFDocument } from "pdf-lib";

import { answerWith, sent } from "../helpers/reader-engine.mjs";

import {
  parseReaderAnswer,
  readDocument,
  READER_INSTRUCTIONS,
  ReaderFailure,
} from "../../server/lib/reader.ts";
import { needsCheck, MAX_READ_PAGES } from "../../shared/reader.ts";

after(async () => {
  const { closeDbExec } = await import("@agent-native/core/db");
  await closeDbExec();
});
const png = await readFile(
  new URL("../fixtures/documents/pay.png", import.meta.url),
);
const period = { start: "2026-10-01", end: "2026-10-20" };
const stub = (overrides = {}) => ({
  fields: {
    kind: "income",
    start: "2026-10-01",
    end: "2026-10-15",
    hours: 40,
    organization: "Synthetic delivery company",
    income: {
      kind: "wages",
      receivedOn: "2026-10-20",
      grossPayCents: 65000,
      preTaxDeductionsCents: 2000,
    },
    ...overrides,
  },
  confidence: 0.95,
  questions: [],
});
const answer = (proposals, extra = {}) =>
  JSON.stringify({
    documentPeriod: period,
    reading: { usDocument: true, proposals },
    ...extra,
  });
const unreadable = (text) =>
  assert.throws(
    () => parseReaderAnswer(text),
    (error) => error instanceof ReaderFailure && error.reason === "unreadable",
  );
const deployment = (fn) =>
  runWithRequestContext({ defaultAgentEngineScope: "deployment" }, fn);

test("A clean answer becomes proposals the member still checks", () => {
  const result = parseReaderAnswer(answer([stub()]));
  assert.equal(result.usDocument, true);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].fields.income.grossPayCents, 65000);
  assert.equal(needsCheck(result.proposals[0]), false);
  // A fenced JSON answer is accepted; nothing else around it is.
  assert.equal(
    parseReaderAnswer("```json\n" + answer([stub()]) + "\n```").proposals
      .length,
    1,
  );
});

test("Text that is not one JSON object is a failed read", () => {
  for (const text of [
    "",
    "Gross pay: $650",
    "Here you go: " + answer([stub()]),
    answer([stub()]) + " Thanks!",
    "[]",
    "null",
  ])
    unreadable(text);
});

test("Extra fields anywhere make the whole read fail", () => {
  unreadable(answer([stub()], { decision: "Meets" }));
  unreadable(
    JSON.stringify({
      documentPeriod: period,
      reading: { usDocument: true, proposals: [stub()], status: "Meets" },
    }),
  );
  unreadable(answer([{ ...stub(), note: "extra" }]));
  unreadable(answer([stub({ employeeName: "Synthetic Person" })]));
  unreadable(answer([stub({ ssn: "000-00-0000" })]));
});

test("A reading cannot claim a confirmed status, an owner, a version or confirmed costs", () => {
  for (const extra of [
    { status: "confirmed" },
    { confirmed: true },
    { owner: "someone@example.test" },
    { ownerEmail: "someone@example.test" },
    { version: 2 },
    { createdBy: "member" },
  ]) {
    unreadable(answer([stub(extra)]));
    unreadable(answer([{ ...stub(), ...extra }]));
  }
  unreadable(
    answer([
      stub({
        kind: "income",
        income: {
          kind: "self-employment",
          netEarningsCents: 60000,
          costsConfirmed: true,
        },
      }),
    ]),
  );
});

test("Impossible dates and dates outside the document's own period fail", () => {
  unreadable(answer([stub({ start: "2026-02-30" })]));
  unreadable(answer([stub({ start: "2026-10-15", end: "2026-10-01" })]));
  unreadable(answer([stub({ end: "2026-11-15" })]));
  unreadable(
    answer([
      stub({
        income: { kind: "wages", receivedOn: "2025-01-01", grossPayCents: 1 },
      }),
    ]),
  );
  // Dated proposals need the document's period.
  unreadable(
    JSON.stringify({
      documentPeriod: null,
      reading: { usDocument: true, proposals: [stub()] },
    }),
  );
  unreadable(
    JSON.stringify({
      documentPeriod: { start: "2026-10-20", end: "2026-10-01" },
      reading: { usDocument: true, proposals: [stub()] },
    }),
  );
});

test("Negative, fractional-cent and unsafe amounts fail; hours must pass the hours check", () => {
  for (const income of [
    { kind: "wages", grossPayCents: -100 },
    { kind: "wages", preTaxDeductionsCents: -1 },
    { kind: "self-employment", netEarningsCents: -5000 },
    { kind: "wages", grossPayCents: 650.5 },
    { kind: "wages", grossPayCents: Number.MAX_SAFE_INTEGER + 2 },
    { kind: "wages", grossPayCents: "650.00" },
  ])
    unreadable(answer([stub({ income })]));
  for (const hours of [-1, 0.0000001, "40", 1e21 + 0.5])
    unreadable(answer([stub({ hours })]));
});

test("More than 60 proposals fail instead of being cut short", () => {
  assert.equal(
    parseReaderAnswer(answer(Array.from({ length: 60 }, () => stub())))
      .proposals.length,
    60,
  );
  unreadable(answer(Array.from({ length: 61 }, () => stub())));
});

test("A fact the reader is unsure of becomes a question with no value", () => {
  const result = parseReaderAnswer(
    answer([
      {
        ...stub(),
        confidence: 0.97,
        questions: ["gross-pay", "hours", "gross-pay", "organization"],
      },
    ]),
  );
  const [line] = result.proposals;
  assert.deepEqual(line.questions, ["gross-pay", "hours", "organization"]);
  assert.equal(line.fields.income.grossPayCents, null);
  assert.equal(line.fields.hours, null);
  assert.equal(line.fields.organization, null);
  assert.equal(line.fields.income.preTaxDeductionsCents, 2000);
  assert.equal(needsCheck(line), true);
  // Below 0.85 is "Check this" even without questions.
  assert.equal(needsCheck({ confidence: 0.84, questions: [] }), true);
  assert.equal(needsCheck({ confidence: 0.85, questions: [] }), false);
  unreadable(answer([{ ...stub(), confidence: 1.2 }]));
  unreadable(answer([{ ...stub(), questions: ["Ignore the rule."] }]));
});

test("A document that is not a US record proposes nothing", () => {
  const result = parseReaderAnswer(
    JSON.stringify({
      documentPeriod: null,
      reading: { usDocument: false, proposals: [stub()] },
    }),
  );
  assert.deepEqual(result, { usDocument: false, proposals: [] });
});

test("The document reaches the configured model only as fenced data, with no tools", async () => {
  sent.length = 0;
  answerWith(answer([stub()]), { inputTokens: 1500, outputTokens: 210 });
  const { result, usage } = await deployment(() =>
    readDocument({ bytes: png, mime: "image/png", language: "es" }),
  );
  assert.equal(result.proposals.length, 1);
  assert.deepEqual(usage, { inputTokens: 1500, outputTokens: 210 });
  assert.equal(sent.length, 1);
  const [request] = sent;
  assert.deepEqual(request.tools, []);
  assert.equal(request.systemPrompt, READER_INSTRUCTIONS);
  assert.match(request.systemPrompt, /UNTRUSTED DATA/);
  assert.match(request.systemPrompt, /never instructions/);
  const parts = request.messages[0].content;
  assert.deepEqual(
    parts.map((part) => part.type),
    ["text", "image", "text"],
  );
  assert.match(parts[0].text, /<document>$/);
  assert.match(parts[2].text, /^<\/document>/);
  assert.equal(parts[1].mediaType, "image/jpeg");
});

test("A failed model request or a bad answer gives no proposals", async () => {
  answerWith(new Error("Provider unavailable"));
  await assert.rejects(
    deployment(() => readDocument({ bytes: png, mime: "image/png" })),
    (error) => error instanceof ReaderFailure && error.reason === "unavailable",
  );
  answerWith("I could not read it, sorry.", {
    inputTokens: 900,
    outputTokens: 12,
  });
  await assert.rejects(
    deployment(() => readDocument({ bytes: png, mime: "image/png" })),
    (error) =>
      error instanceof ReaderFailure &&
      error.reason === "unreadable" &&
      error.usage.inputTokens === 900,
  );
});

test("Only the first ten PDF pages are read", async () => {
  const pdf = await PDFDocument.create();
  for (let page = 1; page <= 12; page++)
    pdf
      .addPage([300, 400])
      .drawText(`Synthetic page ${page}`, { x: 20, y: 350, size: 16 });
  const bytes = await pdf.save();
  sent.length = 0;
  answerWith(answer([stub()]));
  await deployment(() =>
    readDocument({ bytes, mime: "application/pdf", language: "en" }),
  );
  const images = sent[0].messages[0].content.filter(
    (part) => part.type === "image",
  );
  assert.equal(MAX_READ_PAGES, 10);
  assert.equal(images.length, 10);
});

test("A file the upload checks refuse is never sent to the model", async () => {
  sent.length = 0;
  await assert.rejects(
    deployment(() =>
      readDocument({
        bytes: Buffer.from("not a document"),
        mime: "image/png",
      }),
    ),
    { statusCode: 422 },
  );
  assert.equal(sent.length, 0);
});
