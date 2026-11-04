import assert from "node:assert/strict";
import test from "node:test";

import { checkTryMonth, tryFieldsFromReading } from "../../shared/try-month.ts";

const line = (fields, questions = [], confidence = 0.95) => ({
  fields,
  confidence,
  questions,
});
const stub = (receivedOn, gross, deductions, hours) =>
  line({
    kind: "income",
    start: `${receivedOn.slice(0, 8)}01`,
    end: receivedOn,
    hours,
    income: {
      kind: "wages",
      receivedOn,
      grossPayCents: gross,
      preTaxDeductionsCents: deductions,
    },
  });

test("Two stubs paid in one month fill the month's totals", () => {
  const fill = tryFieldsFromReading({
    usDocument: true,
    proposals: [
      stub("2026-10-10", 30000, 1000, 20),
      stub("2026-10-24", 31000, 1000, 21.5),
    ],
  });
  assert.deepEqual(fill, {
    month: "2026-10",
    kind: "wages",
    gross: "610.00",
    deductions: "20.00",
    net: "",
    hours: "41.5",
    unsure: [],
  });
});

test("An unsure or missing amount stays blank instead of being guessed", () => {
  const unsure = stub("2026-10-10", null, 1000, 20);
  unsure.questions = ["gross-pay", "hours"];
  unsure.fields.hours = null;
  const fill = tryFieldsFromReading({
    usDocument: true,
    proposals: [unsure, stub("2026-10-24", 31000, null, 21)],
  });
  assert.equal(fill.gross, "");
  assert.equal(fill.deductions, "");
  assert.equal(fill.hours, "");
  assert.deepEqual(fill.unsure, ["gross", "deductions", "hours"]);
});

test("Stubs from different months leave the month for the visitor to choose", () => {
  const fill = tryFieldsFromReading({
    usDocument: true,
    proposals: [stub("2026-09-30", 100, 0, 1), stub("2026-10-01", 100, 0, 1)],
  });
  assert.equal(fill.month, "");
  assert(fill.unsure.includes("month"));
});

test("Gig pay fills net earnings; costs stay for the visitor to confirm", () => {
  const fill = tryFieldsFromReading({
    usDocument: true,
    proposals: [
      line({
        kind: "income",
        income: {
          kind: "self-employment",
          receivedOn: "2026-10-31",
          netEarningsCents: 70000,
        },
      }),
    ],
  });
  assert.equal(fill.kind, "gig");
  assert.equal(fill.net, "700.00");
});

test("A filled form still needs the visitor's own check before any answer", () => {
  const fill = tryFieldsFromReading({
    usDocument: true,
    proposals: [stub("2026-10-24", 61000, 0, 90)],
  });
  const form = {
    month: fill.month,
    asOf: "2026-11-04",
    kind: fill.kind,
    gross: fill.gross,
    deductions: fill.deductions,
    net: fill.net,
    costsConfirmed: false,
    hours: fill.hours,
    confirmed: false,
  };
  assert.equal(checkTryMonth(form).status, "Not sure yet");
  assert.deepEqual(checkTryMonth(form).missing, ["confirmation"]);
  assert.equal(checkTryMonth({ ...form, confirmed: true }).status, "Meets");
});
