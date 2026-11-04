// Scores what a document reader proposed against the answer file written before any reader run.
// Pure code: no files, no network, no clock. The month outcome uses the real rules in server/rules.
import { assessMonth } from "../../server/rules/index.ts";
import type { EducationFacts, EvidenceLine, IncomeFacts, MonthInput, RuleResult, Status } from "../../server/rules/types.ts";
import { readerResult } from "../../shared/evidence.ts";
import type { EvidenceFields, ReaderResult } from "../../shared/evidence.ts";

export type Question =
  | "start"
  | "end"
  | "hours"
  | "gross-pay"
  | "pay-date"
  | "pre-tax-deductions"
  | "net-earnings"
  | "business-costs"
  | "organization"
  | "school-status"
  | "school-credits"
  | "service-contact";

export interface Answer {
  document: string;
  type: string;
  language: "en" | "es";
  conditions: string[];
  month: string;
  asOf: string;
  expected: ReaderResult;
  unreadable: { proposal: number; question: Question }[];
  expectedOutcome: Status;
  reason: string;
}

type Compare = "date" | "cents" | "exact" | "hours" | "text";
// Every field the answers can hold, and how it is compared.
export const FIELDS: { name: string; path: string[]; compare: Compare; question?: Question }[] = [
  { name: "kind", path: ["kind"], compare: "exact" },
  { name: "start", path: ["start"], compare: "date", question: "start" },
  { name: "end", path: ["end"], compare: "date", question: "end" },
  { name: "hours", path: ["hours"], compare: "hours", question: "hours" },
  { name: "organization", path: ["organization"], compare: "text", question: "organization" },
  { name: "income.kind", path: ["income", "kind"], compare: "exact" },
  { name: "income.receivedOn", path: ["income", "receivedOn"], compare: "date", question: "pay-date" },
  { name: "income.grossPayCents", path: ["income", "grossPayCents"], compare: "cents", question: "gross-pay" },
  {
    name: "income.preTaxDeductionsCents",
    path: ["income", "preTaxDeductionsCents"],
    compare: "cents",
    question: "pre-tax-deductions",
  },
  { name: "income.netEarningsCents", path: ["income", "netEarningsCents"], compare: "cents", question: "net-earnings" },
  { name: "education.enrollment", path: ["education", "enrollment"], compare: "exact", question: "school-status" },
  { name: "education.qualifyingProgram", path: ["education", "qualifyingProgram"], compare: "exact" },
  { name: "education.termStart", path: ["education", "termStart"], compare: "date" },
  { name: "education.termEnd", path: ["education", "termEnd"], compare: "date" },
  { name: "education.credits", path: ["education", "credits"], compare: "hours", question: "school-credits" },
  { name: "education.usesCreditHours", path: ["education", "usesCreditHours"], compare: "exact" },
  {
    name: "service.confirmationContact",
    path: ["service", "confirmationContact"],
    compare: "text",
    question: "service-contact",
  },
];

// correct: right value, or a question where the answer says the field cannot be read.
// wrong: a different value. guessed: a value where the answer says the field cannot be read.
// asked: a question about a field that can be read (safe, but not right). missing: neither value nor question.
export type FieldOutcome = "correct" | "wrong" | "guessed" | "asked" | "missing";
export interface FieldResult {
  proposal: number;
  field: string;
  expected: unknown;
  actual: unknown;
  outcome: FieldOutcome;
}
export interface DocumentScore {
  document: string;
  type: string;
  language: string;
  conditions: string[];
  valid: boolean;
  invalidReason?: string;
  usDocument: { expected: boolean; actual: boolean | null; correct: boolean };
  fields: FieldResult[];
  matchedProposals: number;
  missingProposals: number;
  extraProposals: number;
  outcome: {
    expected: Status;
    actual: Status;
    match: boolean;
    falseMeets: boolean;
    basis: string;
    missing: string[];
  };
}

const read = (fields: EvidenceFields, path: string[]): unknown => {
  let value: unknown = fields;
  for (const key of path) value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  return value ?? null;
};

const words = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Names and contacts match when they are the same words, or when one holds the other and the shorter has two words or more.
export function sameText(expected: string, actual: string): boolean {
  const a = words(expected);
  const b = words(actual);
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.split(" ").length >= 2 && ` ${longer} `.includes(` ${shorter} `);
}

export function sameValue(compare: Compare, expected: unknown, actual: unknown): boolean {
  if (actual === null || actual === undefined) return false;
  if (compare === "hours")
    return typeof expected === "number" && typeof actual === "number" && Math.abs(expected - actual) <= 0.01 + 1e-9;
  if (compare === "text") return typeof expected === "string" && typeof actual === "string" && sameText(expected, actual);
  // Dates, cents, kinds and yes/no answers must be exactly equal.
  return expected === actual;
}

const FAMILY: Record<string, string> = {
  income: "pay",
  work: "pay",
  service: "service",
  "work-program": "program",
  education: "education",
};

// Pairs each expected proposal with the closest unclaimed reader proposal of the same family.
export function matchProposals(expected: ReaderResult["proposals"], actual: ReaderResult["proposals"]): (number | null)[] {
  const taken = new Set<number>();
  const keys: [string[], Compare][] = [
    [["start"], "date"],
    [["end"], "date"],
    [["income", "receivedOn"], "date"],
    [["education", "termStart"], "date"],
    [["organization"], "text"],
  ];
  return expected.map((want) => {
    let best: number | null = null;
    let bestScore = -1;
    actual.forEach((have, index) => {
      if (taken.has(index) || FAMILY[have.fields.kind] !== FAMILY[want.fields.kind]) return;
      const score = keys.filter(([path, compare]) => {
        const value = read(want.fields, path);
        return value !== null && sameValue(compare, value, read(have.fields, path));
      }).length;
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    if (best !== null) taken.add(best);
    return best;
  });
}

const BASE: Omit<MonthInput, "month" | "asOf" | "education" | "income" | "evidence"> = {
  applicability: { group: "expansion", age: 34, pregnant: false, medicare: false, otherwiseEligible: false },
  exclusions: {
    formerFosterYouthGroup: false,
    indianUnder44751: false,
    care: { role: "none" },
    veteran100Percent: false,
    medical: { verifiedCategories: [] },
    tanf407Compliant: false,
    snapHousehold: false,
    exemptFromSnapWorkRules: false,
    treatmentProgramQualifies: false,
    treatmentMeetsStateMinimum: false,
    inmate: false,
    pregnantOrPostpartum: false,
  },
  exceptions: {
    under19DuringMonth: false,
    medicareDuringMonth: false,
    mandatoryGroupDuringMonth: false,
    excludedDuringMonth: false,
    incarcerationPeriods: [],
  },
  state: {
    verified: true,
    incomeDerivedHours: false,
    disasterHardship: false,
    unemploymentHardship: false,
    inpatientHardship: false,
    medicalTravelHardship: false,
  },
  hardship: {},
  seasonal: { qualifiesUnder45R: false },
  evidenceComplete: true,
};

const sum = (values: (number | null | undefined)[]) =>
  values.some((value) => typeof value !== "number") ? null : (values as number[]).reduce((total, value) => total + value, 0);

// The month as the member would see it after confirming every value the reader gave and answering no question.
// The person is otherwise a plain expansion adult with nothing else to report, so only this document decides the month.
export function buildMonth(result: ReaderResult, month: string, asOf: string): MonthInput {
  const proposals = result.proposals;
  const paid = proposals.filter((item) => item.fields.income);
  const undated = paid.some((item) => !item.fields.income?.receivedOn);
  const inMonth = paid.filter((item) => item.fields.income?.receivedOn?.slice(0, 7) === month);
  let income: IncomeFacts = {};
  if (!undated && inMonth.length) {
    const kinds = new Set(inMonth.map((item) => item.fields.income?.kind));
    if (kinds.size === 1 && kinds.has("wages"))
      income = {
        basis: "taxable-wages",
        confirmed: true,
        grossPayCents: sum(inMonth.map((item) => item.fields.income?.grossPayCents)),
        preTaxDeductionsCents: sum(inMonth.map((item) => item.fields.income?.preTaxDeductionsCents)),
      };
    else if (kinds.size === 1 && kinds.has("self-employment"))
      income = {
        basis: "self-employment",
        confirmed: true,
        netEarningsCents: sum(inMonth.map((item) => item.fields.income?.netEarningsCents)),
        // Only the member can confirm business costs, so a reader's value never counts here.
        costsConfirmed: null,
      };
    else
      income = {
        basis: "pay-shown",
        confirmed: true,
        amountCents: sum(inMonth.map((item) => item.fields.income?.grossPayCents)),
      };
  }
  const evidence: EvidenceLine[] = [];
  proposals.forEach((item, index) => {
    const fields = item.fields;
    if (fields.kind === "education") return;
    if (fields.hours == null && !item.questions.includes("hours")) return;
    evidence.push({
      id: `proposal-${index}`,
      version: 1,
      kind: fields.kind === "income" ? "work" : fields.kind,
      status: "confirmed",
      start: fields.start ?? "",
      end: fields.end ?? "",
      hours: fields.hours ?? null,
      organization: fields.organization ?? null,
      ...(fields.service ? { service: fields.service } : {}),
      ...(fields.program ? { program: fields.program } : {}),
    });
  });
  const school = proposals.find((item) => item.fields.kind === "education")?.fields.education;
  const education: EducationFacts = school ? { ...school, confirmed: true } : { enrollment: "none" };
  return { ...BASE, month, asOf, education, income, evidence };
}

export function monthOutcome(result: ReaderResult, month: string, asOf: string): RuleResult {
  return assessMonth(buildMonth(result, month, asOf));
}

const EMPTY: ReaderResult = { usDocument: true, proposals: [] };

export function scoreDocument(answer: Answer, output: unknown): DocumentScore {
  const parsed = readerResult.safeParse(output);
  const actual = parsed.success ? parsed.data : EMPTY;
  const fields: FieldResult[] = [];
  const pairs = matchProposals(answer.expected.proposals, actual.proposals);
  answer.expected.proposals.forEach((want, index) => {
    const pair = pairs[index];
    const have = pair === null ? null : actual.proposals[pair];
    for (const field of FIELDS) {
      const expected = read(want.fields, field.path);
      const unreadable = field.question ? want.questions.includes(field.question) : false;
      if (expected === null && !unreadable) continue;
      const value = have ? read(have.fields, field.path) : null;
      const asked = Boolean(have && field.question && have.questions.includes(field.question));
      let outcome: FieldOutcome;
      if (unreadable) outcome = asked ? "correct" : value !== null ? "guessed" : "missing";
      else if (sameValue(field.compare, expected, value)) outcome = "correct";
      else if (asked) outcome = "asked";
      else outcome = value === null ? "missing" : "wrong";
      fields.push({ proposal: index, field: field.name, expected: unreadable ? "question" : expected, actual: value, outcome });
    }
  });
  const matched = pairs.filter((pair) => pair !== null).length;
  const rule = monthOutcome(actual, answer.month, answer.asOf);
  const falseMeets = rule.status === "Meets" && answer.expectedOutcome !== "Meets";
  return {
    document: answer.document,
    type: answer.type,
    language: answer.language,
    conditions: answer.conditions,
    valid: parsed.success,
    ...(parsed.success ? {} : { invalidReason: parsed.error.issues.map((issue) => issue.message).join("; ") }),
    usDocument: {
      expected: answer.expected.usDocument,
      actual: parsed.success ? actual.usDocument : null,
      correct: parsed.success && actual.usDocument === answer.expected.usDocument,
    },
    fields,
    matchedProposals: matched,
    missingProposals: answer.expected.proposals.length - matched,
    extraProposals: actual.proposals.length - matched,
    outcome: {
      expected: answer.expectedOutcome,
      actual: rule.status,
      match: rule.status === answer.expectedOutcome,
      falseMeets,
      basis: rule.basis,
      missing: rule.missing,
    },
  };
}

function logBinomialTerm(n: number, i: number, p: number): number {
  let logChoose = 0;
  for (let j = 1; j <= i; j++) logChoose += Math.log(n - i + j) - Math.log(j);
  return logChoose + (i ? i * Math.log(p) : 0) + (n - i ? (n - i) * Math.log1p(-p) : 0);
}
export function binomialCdf(k: number, n: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  let total = 0;
  for (let i = 0; i <= k; i++) total += Math.exp(logBinomialTerm(n, i, p));
  return Math.min(1, total);
}

// Exact (Clopper-Pearson) one-sided upper bound on a rate after `errors` in `n` tries.
// It is the rate p at which seeing `errors` or fewer would happen only (1 - confidence) of the time:
//   sum over i = 0..errors of C(n, i) p^i (1 - p)^(n - i) = 1 - confidence,
// the same as the `confidence` quantile of Beta(errors + 1, n - errors).
// With 0 errors this is exactly 1 - (1 - confidence)^(1/n), about 3/n at 95%.
export function upperBound(errors: number, n: number, confidence = 0.95): number {
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(errors) || errors < 0 || errors > n)
    throw new RangeError("Use whole numbers with 0 <= errors <= n and n >= 1.");
  if (errors === n) return 1;
  const alpha = 1 - confidence;
  if (errors === 0) return 1 - alpha ** (1 / n);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 200; step++) {
    const middle = (low + high) / 2;
    if (binomialCdf(errors, n, middle) > alpha) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export interface Tally {
  fields: number;
  correct: number;
  wrong: number;
  guessed: number;
  asked: number;
  missing: number;
  accuracy: number | null;
}
function tally(results: FieldResult[]): Tally {
  const count = (outcome: FieldOutcome) => results.filter((item) => item.outcome === outcome).length;
  return {
    fields: results.length,
    correct: count("correct"),
    wrong: count("wrong"),
    guessed: count("guessed"),
    asked: count("asked"),
    missing: count("missing"),
    accuracy: results.length ? count("correct") / results.length : null,
  };
}
export interface Summary {
  documents: number;
  invalidOutputs: number;
  usDocumentCorrect: number;
  fields: Tally;
  perField: Record<string, Tally>;
  perType: Record<
    string,
    { documents: number; fields: Tally; outcomesMatched: number; falseMeets: number }
  >;
  months: number;
  outcomesMatched: number;
  falseMeets: number;
  falseMeetsDocuments: string[];
  falseMeetsUpperBound95: number;
  missingProposals: number;
  extraProposals: number;
}
export function summarize(scores: DocumentScore[]): Summary {
  const all = scores.flatMap((score) => score.fields);
  const perField: Summary["perField"] = {};
  for (const name of new Set(all.map((item) => item.field)))
    perField[name] = tally(all.filter((item) => item.field === name));
  const perType: Summary["perType"] = {};
  for (const type of new Set(scores.map((score) => score.type))) {
    const group = scores.filter((score) => score.type === type);
    perType[type] = {
      documents: group.length,
      fields: tally(group.flatMap((score) => score.fields)),
      outcomesMatched: group.filter((score) => score.outcome.match).length,
      falseMeets: group.filter((score) => score.outcome.falseMeets).length,
    };
  }
  const falseMeets = scores.filter((score) => score.outcome.falseMeets);
  return {
    documents: scores.length,
    invalidOutputs: scores.filter((score) => !score.valid).length,
    usDocumentCorrect: scores.filter((score) => score.usDocument.correct).length,
    fields: tally(all),
    perField,
    perType,
    months: scores.length,
    outcomesMatched: scores.filter((score) => score.outcome.match).length,
    falseMeets: falseMeets.length,
    falseMeetsDocuments: falseMeets.map((score) => score.document),
    falseMeetsUpperBound95: scores.length ? upperBound(falseMeets.length, scores.length) : 1,
    missingProposals: scores.reduce((total, score) => total + score.missingProposals, 0),
    extraProposals: scores.reduce((total, score) => total + score.extraProposals, 0),
  };
}
