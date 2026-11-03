import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { confirmInput } from "../../shared/evidence-review.ts";
test("A separate-line choice must name unique versioned lines and an explicit member choice", () => {
  const target = { id: randomUUID(), version: 1 };
  const compared = [{ id: randomUUID(), version: 2 }];
  assert.deepEqual(
    confirmInput.parse({
      ...target,
      duplicateChoice: { choice: "these-are-separate", compared },
    }).duplicateChoice.compared,
    compared,
  );
  for (const invalid of [
    { choice: "these-are-separate", compared: [] },
    { choice: "these-are-separate", compared: [...compared, ...compared] },
    { choice: "these-are-separate", compared: [{ id: compared[0].id }] },
    {
      choice: "these-are-separate",
      compared: [{ ...compared[0], version: 0 }],
    },
    { choice: "ignore", compared },
    { choice: "these-are-separate", compared, approved: true },
  ])
    assert.throws(() =>
      confirmInput.parse({ ...target, duplicateChoice: invalid }),
    );
});
