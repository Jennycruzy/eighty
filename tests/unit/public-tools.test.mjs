import assert from "node:assert/strict";
import test from "node:test";

import { screenAnswers } from "../../shared/screener.ts";
import { checkTryMonth, moneyCents } from "../../shared/try-month.ts";
const input = (patch = {}) => ({
  month: "2026-10",
  asOf: "2026-11-02",
  kind: "wages",
  gross: "680",
  deductions: "100",
  net: "",
  costsConfirmed: false,
  hours: "",
  confirmed: true,
  ...patch,
});
test("Manual wages use the same after-deduction test as confirmed stubs", () => {
  const result = checkTryMonth(input());
  assert.equal(result.status, "Meets");
  assert.equal(result.math.amountCents, 58000);
  assert(result.citation.includes("435.603"));
});
test("Unknown deductions and unconfirmed numbers cannot meet", () => {
  assert.equal(checkTryMonth(input({ deductions: "" })).status, "Not sure yet");
  assert.equal(
    checkTryMonth(input({ confirmed: false })).status,
    "Not sure yet",
  );
});
test("Gig pay needs confirmed net earnings after costs", () => {
  assert.equal(
    checkTryMonth(input({ kind: "gig", net: "600" })).status,
    "Not sure yet",
  );
  assert.equal(
    checkTryMonth(input({ kind: "gig", net: "600", costsConfirmed: true }))
      .status,
    "Meets",
  );
});
test("Recorded hours can establish work separately from unknown pay", () => {
  assert.equal(
    checkTryMonth(input({ kind: "none", hours: "80" })).status,
    "Meets",
  );
  assert.equal(
    checkTryMonth(input({ kind: "none", hours: "79" })).status,
    "Not sure yet",
  );
});
test("Future months and invalid work hours need review", () => {
  assert.equal(
    checkTryMonth(input({ month: "2026-12" })).status,
    "Not sure yet",
  );
  assert.equal(
    checkTryMonth(input({ gross: "0", deductions: "0", hours: "-1" })).status,
    "Not sure yet",
  );
  assert.equal(
    checkTryMonth(input({ gross: "0", deductions: "0", hours: "no" })).status,
    "Not sure yet",
  );
});
test("Money entry never rounds up a fraction of a cent", () => {
  assert.equal(moneyCents("579.999"), null);
  assert.equal(moneyCents("579.99"), 57999);
  assert.equal(moneyCents("0"), 0);
  assert.equal(moneyCents("-100.20"), -10020);
  assert.equal(moneyCents("9007199254740993"), null);
});
test("Skipped screener answers remain unknown", () => {
  assert.equal(screenAnswers({}).status, "Not sure yet");
});
test("A qualifying child caregiver and Medicare are identified", () => {
  assert.equal(screenAnswers({ child: "yes" }).status, "Exempt");
  assert.equal(screenAnswers({ medicare: "yes" }).status, "Exempt");
});
test("Caregiving or SNAP alone does not invent qualifying facts", () => {
  assert.equal(screenAnswers({ care: "yes" }).status, "Not sure yet");
  assert.equal(screenAnswers({ snap: "yes" }).status, "Not sure yet");
});
