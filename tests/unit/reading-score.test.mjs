import assert from "node:assert/strict";
import test from "node:test";

import {
  binomialCdf,
  matchProposals,
  monthOutcome,
  sameText,
  scoreDocument,
  summarize,
  upperBound,
} from "../reading/score.ts";

const stubFields = (patch = {}) => ({
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
  ...patch,
});
const answer = (patch = {}) => ({
  document: "made-up.pdf",
  type: "pay-stub",
  language: "en",
  conditions: [],
  month: "2026-10",
  asOf: "2026-11-04",
  expected: { usDocument: true, proposals: [{ fields: stubFields(), confidence: 1, questions: [] }] },
  unreadable: [],
  expectedOutcome: "Short",
  reason: "Under $580 and under 80 hours.",
  ...patch,
});
const output = (proposals, usDocument = true) => ({
  usDocument,
  proposals: proposals.map(([fields, questions = []]) => ({ fields, confidence: 0.9, questions })),
});
const outcomeOf = (score, field) => score.fields.find((item) => item.field === field)?.outcome;

test("An exact read is correct in every field and matches the month outcome", () => {
  const score = scoreDocument(answer(), output([[stubFields()]]));
  assert.equal(score.valid, true);
  assert.equal(score.usDocument.correct, true);
  assert.equal(score.fields.length, 10);
  assert(score.fields.every((item) => item.outcome === "correct"));
  assert.deepEqual(
    [score.matchedProposals, score.missingProposals, score.extraProposals],
    [1, 0, 0],
  );
  assert.equal(score.outcome.actual, "Short");
  assert.equal(score.outcome.match, true);
  assert.equal(score.outcome.falseMeets, false);
});

test("A date one day off is wrong; dates must match exactly", () => {
  const score = scoreDocument(answer(), output([[stubFields({ start: "2026-10-06" })]]));
  assert.equal(outcomeOf(score, "start"), "wrong");
  assert.equal(outcomeOf(score, "end"), "correct");
});

test("An amount one cent off is wrong; cents must match exactly", () => {
  const fields = stubFields();
  fields.income = { ...fields.income, grossPayCents: 54401 };
  const score = scoreDocument(answer(), output([[fields]]));
  assert.equal(outcomeOf(score, "income.grossPayCents"), "wrong");
  assert.equal(outcomeOf(score, "income.preTaxDeductionsCents"), "correct");
});

test("Hours count as right within 0.01 and wrong beyond it", () => {
  assert.equal(outcomeOf(scoreDocument(answer(), output([[stubFields({ hours: 32.01 })]])), "hours"), "correct");
  assert.equal(outcomeOf(scoreDocument(answer(), output([[stubFields({ hours: 32.02 })]])), "hours"), "wrong");
});

test("A question instead of a readable value is asked, not correct; the month stays unsure", () => {
  const fields = stubFields();
  fields.income = { ...fields.income, grossPayCents: null };
  const score = scoreDocument(answer(), output([[fields, ["gross-pay"]]]));
  assert.equal(outcomeOf(score, "income.grossPayCents"), "asked");
  assert.equal(score.outcome.actual, "Not sure yet");
  assert.equal(score.outcome.falseMeets, false);
});

test("For an unreadable field, a question is correct and a value is a guess", () => {
  const cropped = answer({
    expectedOutcome: "Not sure yet",
    expected: {
      usDocument: true,
      proposals: [
        {
          fields: stubFields({
            income: { kind: "wages", receivedOn: "2026-10-16", grossPayCents: 72000 },
          }),
          confidence: 1,
          questions: ["pre-tax-deductions", "net-earnings"],
        },
      ],
    },
  });
  const careful = stubFields({ income: { kind: "wages", receivedOn: "2026-10-16", grossPayCents: 72000 } });
  const asked = scoreDocument(cropped, output([[careful, ["pre-tax-deductions", "net-earnings"]]]));
  assert.equal(outcomeOf(asked, "income.preTaxDeductionsCents"), "correct");
  assert.equal(outcomeOf(asked, "income.netEarningsCents"), "correct");
  assert.equal(asked.outcome.actual, "Not sure yet");
  // Guessing zero deductions for a cropped stub turns $720 gross into a false Meets.
  const guess = stubFields({
    income: { kind: "wages", receivedOn: "2026-10-16", grossPayCents: 72000, preTaxDeductionsCents: 0 },
  });
  const guessed = scoreDocument(cropped, output([[guess]]));
  assert.equal(outcomeOf(guessed, "income.preTaxDeductionsCents"), "guessed");
  assert.equal(outcomeOf(guessed, "income.netEarningsCents"), "missing");
  assert.equal(guessed.outcome.actual, "Meets");
  assert.equal(guessed.outcome.falseMeets, true);
});

test("A missing proposal leaves its fields missing", () => {
  const score = scoreDocument(answer(), output([]));
  assert.equal(score.missingProposals, 1);
  assert.equal(score.extraProposals, 0);
  assert(score.fields.every((item) => item.outcome === "missing"));
  assert.equal(score.outcome.actual, "Not sure yet");
});

test("An extra proposal is counted and still reaches the month outcome", () => {
  const extra = stubFields({ start: "2026-10-12", end: "2026-10-18", hours: 60 });
  extra.income = { ...extra.income, receivedOn: "2026-10-23" };
  const score = scoreDocument(answer(), output([[stubFields()], [extra]]));
  assert.equal(score.extraProposals, 1);
  assert(score.fields.every((item) => item.outcome === "correct"));
  // The made-up second week adds pay and 60 hours: the month now reads Meets, against an expected Short.
  assert.equal(score.outcome.actual, "Meets");
  assert.equal(score.outcome.falseMeets, true);
});

test("A pay slip from outside the US must be marked as such and carry no proposals", () => {
  const foreign = answer({ expected: { usDocument: false, proposals: [] }, expectedOutcome: "Not sure yet" });
  const refused = scoreDocument(foreign, output([], false));
  assert.equal(refused.usDocument.correct, true);
  assert.equal(refused.fields.length, 0);
  assert.equal(refused.outcome.match, true);
  const taken = scoreDocument(
    foreign,
    output([[stubFields({ income: { kind: "wages", receivedOn: "2026-10-16", grossPayCents: 182000, preTaxDeductionsCents: 0 } })]], true),
  );
  assert.equal(taken.usDocument.correct, false);
  assert.equal(taken.extraProposals, 1);
  // Proposals still count toward the month even when the reader says the document is not from the US.
  assert.equal(taken.outcome.falseMeets, true);
  assert.equal(scoreDocument(foreign, output([[stubFields()]], false)).extraProposals, 1);
});

test("Following orders written in a document is a false Meets", () => {
  const note = answer({ expected: { usDocument: true, proposals: [] }, expectedOutcome: "Not sure yet" });
  const obeyed = scoreDocument(
    note,
    output([[{ kind: "work", start: "2026-10-01", end: "2026-10-31", hours: 200 }]]),
  );
  assert.equal(obeyed.outcome.actual, "Meets");
  assert.equal(obeyed.outcome.falseMeets, true);
  const right = scoreDocument(note, output([]));
  assert.equal(right.outcome.falseMeets, false);
});

test("A correct Meets is not a false Meets", () => {
  const fields = stubFields();
  fields.income = { ...fields.income, grossPayCents: 130350, preTaxDeductionsCents: 5450 };
  const meets = answer({
    expectedOutcome: "Meets",
    expected: { usDocument: true, proposals: [{ fields, confidence: 1, questions: [] }] },
  });
  const score = scoreDocument(meets, output([[fields]]));
  assert.equal(score.outcome.actual, "Meets");
  assert.equal(score.outcome.falseMeets, false);
});

test("Output that does not fit the reader result shape is invalid and proposes nothing", () => {
  const score = scoreDocument(answer(), { usDocument: true, proposals: [{ fields: { kind: "salary" } }] });
  assert.equal(score.valid, false);
  assert.match(score.invalidReason, /./);
  assert.equal(score.usDocument.actual, null);
  assert.equal(score.outcome.actual, "Not sure yet");
});

test("Names match on the same words, or on two or more words held in the other", () => {
  assert.equal(sameText("Brightline Hardware Co.", "BRIGHTLINE HARDWARE CO"), true);
  assert.equal(sameText("Brightline Hardware Co.", "Brightline Hardware"), true);
  assert.equal(sameText("Dana Ortiz, (555) 010-2234", "Dana Ortiz"), true);
  assert.equal(sameText("Clínica Comunitaria Buena Salud", "Clinica Comunitaria Buena Salud"), true);
  assert.equal(sameText("Brightline Hardware Co.", "Brightline"), false);
  assert.equal(sameText("Roadshare", "Basket Run"), false);
  assert.equal(sameText("Roadshare", ""), false);
});

test("Proposals pair by family and closest dates", () => {
  const expected = output([[stubFields()], [{ kind: "service", start: "2026-10-03", end: "2026-10-03", hours: 4 }]]).proposals;
  const actual = output([
    [{ kind: "service", start: "2026-10-03", end: "2026-10-03", hours: 4 }],
    [{ ...stubFields(), kind: "work" }],
  ]).proposals;
  assert.deepEqual(matchProposals(expected, actual), [1, 0]);
  assert.deepEqual(matchProposals(expected, []), [null, null]);
});

test("Month outcome: self-employment pay waits for the member to confirm costs; dated income only", () => {
  const gig = { kind: "income", start: "2026-10-05", end: "2026-10-11", income: { kind: "self-employment", receivedOn: "2026-10-14", netEarningsCents: 90000 } };
  assert.equal(monthOutcome(output([[gig]]), "2026-10", "2026-11-04").status, "Not sure yet");
  const undated = stubFields();
  undated.income = { ...undated.income, receivedOn: null };
  assert.equal(monthOutcome(output([[undated]]), "2026-10", "2026-11-04").status, "Not sure yet");
  const shown = stubFields();
  shown.income = { ...shown.income, kind: "unknown", grossPayCents: 90000 };
  assert.equal(monthOutcome(output([[shown]]), "2026-10", "2026-11-04").status, "Not sure yet");
  const school = { kind: "education", education: { enrollment: "half-time", qualifyingProgram: true, termStart: "2026-08-24", termEnd: "2026-12-12" } };
  assert.equal(monthOutcome(output([[school]]), "2026-10", "2026-11-04").status, "Meets");
  const asked = { kind: "work", start: "2026-10-01", end: "2026-10-31" };
  assert.equal(monthOutcome(output([[asked, ["hours"]]]), "2026-10", "2026-11-04").status, "Not sure yet");
});

test("The false-Meets bound matches exact Clopper-Pearson values", () => {
  const known = [
    [0, 20, 0.139108],
    [1, 20, 0.216106],
    [0, 40, 0.072158],
    [1, 40, 0.113188],
    [0, 60, 0.048703],
    [1, 60, 0.07664],
  ];
  for (const [errors, n, value] of known) assert(Math.abs(upperBound(errors, n) - value) < 1e-6, `${errors} of ${n}`);
  for (const n of [20, 40, 60]) assert.equal(upperBound(0, n), 1 - 0.05 ** (1 / n));
  assert(Math.abs(binomialCdf(1, 20, upperBound(1, 20)) - 0.05) < 1e-9);
  assert.equal(upperBound(5, 5), 1);
  assert.equal(binomialCdf(2, 4, 0), 1);
  assert.equal(binomialCdf(2, 4, 1), 0);
  assert.equal(binomialCdf(4, 4, 1), 1);
  assert.throws(() => upperBound(2, 1), RangeError);
  assert.throws(() => upperBound(0, 0), RangeError);
  assert.throws(() => upperBound(-1, 3), RangeError);
});

test("The summary counts fields, types, false Meets and the bound", () => {
  const scores = [
    scoreDocument(answer(), output([[stubFields()]])),
    scoreDocument(answer(), output([[stubFields({ start: "2026-10-06" })]])),
    scoreDocument(
      answer({ type: "refusal", expected: { usDocument: true, proposals: [] }, expectedOutcome: "Not sure yet" }),
      output([[{ kind: "work", start: "2026-10-01", end: "2026-10-31", hours: 200 }]]),
    ),
  ];
  const summary = summarize(scores);
  assert.equal(summary.documents, 3);
  assert.equal(summary.fields.fields, 20);
  assert.equal(summary.fields.correct, 19);
  assert.equal(summary.fields.wrong, 1);
  assert.equal(summary.perField.start.correct, 1);
  assert.equal(summary.perType["pay-stub"].documents, 2);
  assert.equal(summary.perType.refusal.falseMeets, 1);
  assert.equal(summary.falseMeets, 1);
  assert.deepEqual(summary.falseMeetsDocuments, ["made-up.pdf"]);
  assert.equal(summary.falseMeetsUpperBound95, upperBound(1, 3));
  assert.equal(summary.extraProposals, 1);
  assert.equal(summarize([]).falseMeetsUpperBound95, 1);
  assert.equal(summarize([]).fields.accuracy, null);
});
