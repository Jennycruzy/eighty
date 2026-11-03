import assert from "node:assert/strict";
import test from "node:test";

import {
  mightDuplicate,
  missingDuplicateKeys,
} from "../../shared/evidence-duplicates.ts";
const shift = {
  kind: "service",
  organization: "Food Pantry",
  start: "2026-11-01",
  end: "2026-11-07",
  hours: 8,
};
test("overlapping records from the same organization require review, despite spacing or changed hours", () => {
  assert.equal(
    mightDuplicate(shift, {
      ...shift,
      organization: "  FOOD   pantry ",
      start: "2026-11-07",
      hours: 16,
    }),
    true,
  );
  assert.equal(
    mightDuplicate(shift, { ...shift, start: "2026-11-08", end: "2026-11-14" }),
    false,
  );
  assert.equal(
    mightDuplicate(shift, { ...shift, organization: "Other pantry" }),
    false,
  );
});
test("the same pay date is a duplicate even if the work period, amount or record kind changed", () => {
  const a = {
    ...shift,
    kind: "work",
    income: { kind: "wages", receivedOn: "2026-11-09", grossPayCents: 20000 },
  };
  const b = {
    kind: "income",
    organization: "Food Pantry",
    income: { kind: "wages", receivedOn: "2026-11-09", grossPayCents: 30000 },
  };
  assert.equal(mightDuplicate(a, b), true);
  assert.equal(
    mightDuplicate(a, {
      ...b,
      income: { ...b.income, receivedOn: "2026-11-16" },
    }),
    false,
  );
});
test("missing dates and organizations cannot silently bypass duplicate checks", () => {
  assert.deepEqual(missingDuplicateKeys({ kind: "work" }), [
    "organization",
    "start",
    "end",
  ]);
  assert.deepEqual(
    missingDuplicateKeys({ kind: "income", organization: "Work" }),
    ["pay-date"],
  );
  assert.deepEqual(
    missingDuplicateKeys({
      kind: "income",
      organization: "Work",
      income: { kind: "wages", receivedOn: "2026-11-01" },
    }),
    [],
  );
  assert.deepEqual(missingDuplicateKeys(shift), []);
});
