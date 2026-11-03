import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  screenerResult,
  presentScreenerResult,
} from "../../shared/screener-result.ts";
import { screenAnswers } from "../../shared/screener.ts";
const allNo = {
  state: "NE",
  age: "34",
  pregnant: "no",
  medicare: "no",
  child: "no",
  care: "no",
  indian: "no",
  veteran: "no",
  treatment: "no",
  snap: "no",
  foster: "no",
  health: "no",
  tanf: "no",
};
test("A fully answered initial screener stays conditional about missing coverage facts", () => {
  const result = screenerResult(allNo);
  assert.equal(result.outcome, "conditional");
  assert.equal(result.rule.status, "Not sure yet");
  assert(result.rule.missing.includes("applicability.group"));
});
test("Specific exclusions keep their reasons and citations", () => {
  for (const [key, reason, paragraph] of [
    ["child", "child", "435.554(c)(3)"],
    ["foster", "foster", "435.554(c)(1)"],
    ["veteran", "veteran", "435.554(c)(4)"],
    ["indian", "indian", "435.554(c)(2)"],
    ["tanf", "tanf", "435.554(c)(6)"],
    ["pregnant", "pregnant", "435.554(c)(10)"],
    ["medicare", "medicare", "435.551"],
  ]) {
    const result = screenerResult({ ...allNo, [key]: "yes" });
    assert.equal(result.outcome, "excluded");
    assert.equal(result.reason, reason);
    assert(result.rule.citation.includes(paragraph));
  }
  assert.equal(screenerResult({ ...allNo, age: "18" }).reason, "age");
  assert.equal(screenerResult({ ...allNo, age: "65" }).reason, "age");
});
test("Skipped, care, health, SNAP and treatment answers name an unknown result", () => {
  assert.equal(screenerResult({}).outcome, "unknown");
  for (const key of ["care", "health", "snap", "treatment"]) {
    const result = screenerResult({ ...allNo, [key]: "yes" });
    assert.equal(result.outcome, "unknown");
    assert.equal(result.reason, key);
  }
});
test("Both languages cover every J1 question, reason and proof checklist", async () => {
  const en = JSON.parse(
    await readFile(
      new URL("../../locales/en-US.json", import.meta.url),
      "utf8",
    ),
  ).screener;
  const es = JSON.parse(
    await readFile(
      new URL("../../locales/es-US.json", import.meta.url),
      "utf8",
    ),
  ).screener;
  assert.equal(en.questions.length, 13);
  assert.deepEqual(
    en.questions.map((q) => q.key),
    Object.keys(allNo),
  );
  assert.deepEqual(
    en.questions.map((q) => q.key),
    es.questions.map((q) => q.key),
  );
  assert.deepEqual(Object.keys(en.reasons), Object.keys(es.reasons));
  for (const copy of [en, es])
    for (const value of Object.values(copy.reasons)) {
      assert(value.reason.length > 10);
      assert(value.proof.length > 10);
    }
});
test("The displayed reason follows the rule order when several answers exclude a person", () => {
  assert.equal(
    screenerResult({ ...allNo, age: "18", medicare: "yes" }).reason,
    "age",
  );
  assert.equal(
    screenerResult({ ...allNo, group: "other", medicare: "yes" }).reason,
    "group",
  );
});

test("A generic exclusion with null math does not point at an unproved reason", () => {
  const rule = {
    status: "Exempt",
    basis: "An exclusion was reported without its reason.",
    citation: "42 CFR 435.551; 435.119(b)",
    math: null,
    missing: [],
  };
  const view = presentScreenerResult(allNo, rule);
  assert.equal(view.reason, "unknown");
  assert.equal(view.outcome, "unknown");
  assert.equal(view.status, "Not sure yet");
});

const nullMathCases = [
  ["missing answers", {}, "unknown", "unknown"],
  ["coverage not established", allNo, "conditional", "conditional"],
  ...["care", "health", "snap", "treatment"].map((key) => [
    key,
    { ...allNo, [key]: "yes" },
    key,
    "unknown",
  ]),
  ...["foster", "indian", "child", "veteran", "tanf", "pregnant"].map((key) => [
    key,
    { ...allNo, [key]: "yes" },
    key,
    "excluded",
  ]),
  [
    "Medicare without explanation metadata",
    { ...allNo, medicare: "yes" },
    "unknown",
    "unknown",
  ],
  [
    "under 19 without explanation metadata",
    { ...allNo, age: "18" },
    "unknown",
    "unknown",
  ],
  [
    "65 or older without explanation metadata",
    { ...allNo, age: "65" },
    "unknown",
    "unknown",
  ],
  [
    "other group without explanation metadata",
    { ...allNo, group: "other" },
    "unknown",
    "unknown",
  ],
];
for (const [name, answers, reason, outcome] of nullMathCases)
  test(`Null math: ${name}`, () => {
    const rule = { ...screenAnswers(answers), math: null };
    const view = presentScreenerResult(answers, rule);
    assert.equal(view.reason, reason);
    assert.equal(view.outcome, outcome);
    assert.equal(
      view.status,
      outcome === "excluded" ? "Exempt" : "Not sure yet",
    );
    assert.equal(
      view.rule,
      rule,
      "Presentation must keep the original rule result available.",
    );
  });
test("An unspecified caregiver exclusion does not invent a child-care answer", () => {
  const view = presentScreenerResult(
    { ...allNo, care: "yes" },
    {
      status: "Exempt",
      basis: "Caregiver exclusion",
      citation: "42 CFR 435.554(c)(3)(i)(A)",
      math: null,
      missing: [],
    },
  );
  assert.equal(view.reason, "unknown");
  assert.equal(view.outcome, "unknown");
  assert.equal(view.status, "Not sure yet");
});
test("An unrecognized exclusion never falls through to Medicare", () => {
  const view = presentScreenerResult(allNo, {
    status: "Exempt",
    basis: "Unknown exclusion",
    citation: "42 CFR 435.554(c)(9)",
    math: {},
    missing: [],
  });
  assert.equal(view.reason, "unknown");
  assert.equal(view.outcome, "unknown");
  assert.equal(view.status, "Not sure yet");
});

test("An unknown rule citation cannot borrow a Medicare answer", () => {
  const view = presentScreenerResult(
    { ...allNo, medicare: "yes" },
    {
      status: "Exempt",
      basis: "Unspecified reason",
      citation: "42 CFR 435.553",
      math: {},
      missing: [],
    },
  );
  assert.equal(view.reason, "unknown");
  assert.equal(view.status, "Not sure yet");
  assert.equal(view.outcome, "unknown");
});
