import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import test, { after } from "node:test";

import * as rules from "../../server/rules/index.ts";
import { cases } from "./cases.mjs";

const rows = [];
function freeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}
function check(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (key === "missingIncludes") {
      for (const field of value)
        assert(
          actual.missing.includes(field),
          `Missing field not named: ${field}`,
        );
    } else if (key === "citationIncludes") {
      for (const paragraph of value)
        assert(
          actual.citation.includes(paragraph),
          `Citation must include ${paragraph}`,
        );
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      assert(
        actual[key] && typeof actual[key] === "object",
        `Missing object: ${key}`,
      );
      check(actual[key], value);
    } else assert.deepEqual(actual[key], value, key);
  }
}
assert(cases.length >= 60);
assert.equal(
  new Set(cases.map((item) => item.id)).size,
  cases.length,
  "Answer case IDs must be unique",
);

for (const item of cases) {
  test(`${item.id}: ${item.title} [${item.citation}]`, () => {
    const args = freeze(structuredClone(item.args));
    const before = structuredClone(args);
    try {
      const actual = rules[item.rule](...args);
      assert.deepEqual(args, before, "Rules must not change their input");
      assert(
        ["Meets", "Exempt", "Deemed", "Short", "Not sure yet"].includes(
          actual.status,
        ),
      );
      assert.equal(typeof actual.basis, "string");
      assert(actual.basis.length > 0);
      assert(actual.citation.startsWith("42 CFR "));
      assert(Array.isArray(actual.missing));
      assert.doesNotThrow(() => JSON.stringify(actual));
      check(actual, item.expected);
      rows.push({ ...item, actual: actual.status, passed: true });
    } catch (error) {
      rows.push({ ...item, actual: "Failed", passed: false });
      throw error;
    }
  });
}

after(async () => {
  const directory = new URL("../../docs/tests/results/", import.meta.url);
  await mkdir(directory, { recursive: true });
  const passed = rows.filter((row) => row.passed).length;
  const lines = [
    "# Federal rules answer key",
    "",
    `Rule version: ${rules.RULE_VERSION}.`,
    "",
    `Result: **${passed} of ${cases.length} cases passed**.`,
    "",
    "Run `pnpm test:answer-key` to reproduce this report. Inputs and expected answers are in `tests/answer-key/cases.mjs`; those answers are not generated from the engine output.",
    "",
    "These synthetic cases check the federal rule and the app’s stated safety policies. They are not a legal review, a state approval, a document-reading test or a test with real members. Income cases use a confirmed Medicaid MAGI count unless the case explicitly tests pay-only uncertainty.",
    "",
    "Each case cites the paragraph it tests. The original official XML and source hashes are in `data/regulations/2026-10-29/`. Procedural helpers keep a grey status because they do not decide whether a month meets the rule.",
    "",
    "| Case | What is checked | Function | Paragraph | Expected status | Result |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    const section = row.citation.match(/(?:42 CFR )?(435\.\d+)/)[1];
    lines.push(
      `| ${row.id} | ${row.title} | ${row.rule} | [${row.citation}](https://www.ecfr.gov/current/title-42/section-${section}) | ${row.expected.status} | ${row.passed ? "Pass" : "Fail"} |`,
    );
  }
  await writeFile(new URL("answer-key.md", directory), `${lines.join("\n")}\n`);
});
