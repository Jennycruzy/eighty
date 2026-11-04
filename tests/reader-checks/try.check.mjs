import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { closeDbExec, getDbExec } from "@agent-native/core/db";
import { runWithRequestContext } from "@agent-native/core/server";

import { getDb } from "../../server/db/index.ts";
import { aiLedger } from "../../server/db/schema.ts";
import { tryLimits, tryReadDocument } from "../../server/lib/try-reading.ts";
import migrate from "../../server/plugins/db.ts";
import { answerWith, pendingAnswers, sent } from "../helpers/reader-engine.mjs";

// The launcher sets EIGHTY_TRY_READS_PER_VISITOR=2 and EIGHTY_TRY_READS_PER_DAY=3.
const png = await readFile(
  new URL("../fixtures/documents/pay.png", import.meta.url),
);
const data = png.toString("base64");
const page = (address) => ({
  caller: "frontend",
  requestHeaders: new Headers({
    "sec-fetch-site": "same-origin",
    "x-forwarded-for": `${address}, 10.0.0.1`,
  }),
});
// A signed-out visitor: no identity in the request.
const visit = (context, input = { data, rotation: 0, language: "en" }) =>
  runWithRequestContext({}, () => tryReadDocument(input, context));
const reading = JSON.stringify({
  documentPeriod: { start: "2026-10-01", end: "2026-10-20" },
  reading: {
    usDocument: true,
    proposals: [
      {
        fields: {
          kind: "income",
          start: "2026-10-01",
          end: "2026-10-15",
          hours: 38.25,
          organization: "Synthetic delivery company",
          income: {
            kind: "wages",
            receivedOn: "2026-10-20",
            grossPayCents: 61234,
            preTaxDeductionsCents: 1111,
          },
        },
        confidence: 0.91,
        questions: [],
      },
    ],
  },
});
async function rowCounts() {
  const { rows } = await getDbExec().execute(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  const counts = {};
  for (const { table_name: name } of rows) {
    const result = await getDbExec().execute(
      `SELECT COUNT(*) AS n FROM "${name}"`,
    );
    counts[name] = Number(result.rows[0].n);
  }
  return counts;
}
const logged = [];
before(async () => {
  await migrate();
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level];
    console[level] = (...args) => {
      logged.push(args.map(String).join(" "));
      original.apply(console, args);
    };
  }
});
after(closeDbExec);

test("Only this site's own page can send a try document", async () => {
  for (const context of [
    undefined,
    { caller: "http", requestHeaders: page("198.51.100.1").requestHeaders },
    { caller: "tool", requestHeaders: page("198.51.100.1").requestHeaders },
    { caller: "frontend", requestHeaders: new Headers() },
    {
      caller: "frontend",
      requestHeaders: new Headers({ "sec-fetch-site": "cross-site" }),
    },
  ])
    await assert.rejects(visit(context), { statusCode: 403 });
  assert.equal(sent.length, 0);
});

test("A try reads in memory, fills the form and writes only that a try happened", async () => {
  // Warm the framework's own settings tables so only this read is compared.
  answerWith(reading);
  await visit(page("203.0.113.9"));
  const before = await rowCounts();
  sent.length = 0;
  answerWith(reading, { inputTokens: 2100, outputTokens: 180 });
  const result = await visit(page("203.0.113.10"));
  assert.equal(sent.length, 1);
  assert.equal(result.outcome, "read");
  assert.deepEqual(result.fill, {
    month: "2026-10",
    kind: "wages",
    gross: "612.34",
    deductions: "11.11",
    net: "",
    hours: "38.25",
    unsure: [],
  });
  assert.match(result.deletedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  const afterCounts = await rowCounts();
  for (const [table, count] of Object.entries(afterCounts))
    assert.equal(
      count,
      table === "eighty_ai_ledger" ? before[table] + 1 : before[table],
      `${table} must not change`,
    );
  const rows = await getDb().select().from(aiLedger);
  const last = rows.find((row) => row.inputTokens === 2100);
  assert.equal(last.purpose, "try");
  assert.equal(last.memberId, null);
  assert.equal(last.action, "try_read_document");
  assert.equal(last.outputTokens, 180);
  // Logs keep no document numbers or names.
  for (const line of logged)
    assert.doesNotMatch(line, /61234|612\.34|1111|Synthetic delivery/);
});

test("Each visitor gets a few tries a day; then reading says so and typing still works", async () => {
  assert.deepEqual(tryLimits(), { perVisitor: 2, perDay: 3 });
  sent.length = 0;
  // 203.0.113.10 has used one try above.
  answerWith(reading);
  assert.equal((await visit(page("203.0.113.10"))).outcome, "read");
  const before = (await getDb().select().from(aiLedger)).length;
  const limited = await visit(page("203.0.113.10"));
  assert.equal(limited.outcome, "visitor-limit");
  assert.equal(limited.fill, undefined);
  assert.equal(sent.length, 1, "No model call past the visitor limit");
  assert.equal((await getDb().select().from(aiLedger)).length, before);
});

test("The daily budget stops reading for everyone once used", async () => {
  sent.length = 0;
  // Three tries are recorded today: the daily budget is used.
  const used = await visit(page("192.0.2.77"));
  assert.equal(used.outcome, "budget-used");
  assert.equal(sent.length, 0);
  const rows = await getDb().select().from(aiLedger);
  assert.equal(rows.filter((row) => row.purpose === "try").length, 3);
});

test("A file the upload checks refuse is never read or counted", async () => {
  await assert.rejects(
    visit(page("192.0.2.80"), {
      data: Buffer.from("not a document").toString("base64"),
      rotation: 0,
    }),
    { statusCode: 422 },
  );
  assert.equal(sent.length, 0);
  assert.equal(pendingAnswers(), 0);
});
