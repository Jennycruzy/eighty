import assert from "node:assert/strict";
import test from "node:test";

import { datesIn, numbersIn, readByText, readText } from "../reading/baseline.ts";

test("The baseline reads US, Spanish and day-first dates", () => {
  assert.deepEqual(datesIn("10/05/2026 - 10/11/2026"), ["2026-10-05", "2026-10-11"]);
  assert.deepEqual(datesIn("05/10/2026", true), ["2026-10-05"]);
  assert.deepEqual(datesIn("Oct 3, 2026 and August 24, 2026"), ["2026-10-03", "2026-08-24"]);
  assert.deepEqual(datesIn("28 sep 2026 - 11 oct 2026"), ["2026-09-28", "2026-10-11"]);
  assert.deepEqual(datesIn("del 31 de agosto de 2026 al 19 de diciembre de 2026"), ["2026-08-31", "2026-12-19"]);
  assert.deepEqual(datesIn("13/45/2026 and Foo 3, 2026"), []);
});

test("The baseline reads money and hours but not dates, IDs or phone area codes", () => {
  assert.deepEqual(numbersIn("Gross pay  32.00  544.00  22,304.00"), [32, 544, 22304]);
  assert.deepEqual(numbersIn("Net payout  $1,405.65"), [1405.65]);
  assert.deepEqual(numbersIn("Employee ID: BH-20417  Pay date: 10/16/2026  (555)"), []);
});

test("The baseline proposes pay from a pay stub's text and nothing from a foreign slip or a picture", async () => {
  const stub = [
    "SAMPLE - made up",
    "Brightline Hardware Co.  EARNINGS STATEMENT",
    "Employee  Pay period",
    "Jordan Avery  10/05/2026 - 10/11/2026",
    "Employee ID: BH-20417  Pay date: 10/16/2026",
    "Gross pay  32.00  544.00  22,304.00",
    "Total pre-tax deductions  42.20  1,730.20",
    "Gross pay  Net pay (this period)  Year to date",
    "$544.00  $458.12  $18,782.92",
  ].join("\n");
  assert.deepEqual(readText(stub), {
    usDocument: true,
    proposals: [
      {
        fields: {
          kind: "income",
          start: "2026-10-05",
          end: "2026-10-11",
          hours: 32,
          organization: "Brightline Hardware Co.",
          income: {
            kind: "wages",
            receivedOn: "2026-10-16",
            grossPayCents: 54400,
            preTaxDeductionsCents: 4220,
            netEarningsCents: 45812,
          },
        },
        confidence: 0.5,
        questions: [],
      },
    ],
  });
  assert.deepEqual(readText("Payslip\nPay period Month 6\nNational Insurance  £69.40"), { usDocument: false, proposals: [] });
  assert.deepEqual(readText("Greenleaf Market\nTOTAL  44.30"), { usDocument: true, proposals: [] });
  assert.deepEqual(await readByText({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png" }), { usDocument: true, proposals: [] });
});
