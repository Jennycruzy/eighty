import { monthBounds, validMonth, validDate } from "../server/rules/dates.ts";
import { combineHours, incomeTest } from "../server/rules/index.ts";
import type { IncomeFacts, RuleResult } from "../server/rules/types.ts";
import type { ReaderResult } from "./evidence.ts";
export function moneyCents(value: string): number | null {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().replace("-", "").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount)
    ? value.trim().startsWith("-")
      ? -amount
      : amount
    : null;
}
export interface TryInput {
  month: string;
  asOf: string;
  kind: string;
  gross: string;
  deductions: string;
  net: string;
  costsConfirmed: boolean;
  hours: string;
  confirmed: boolean;
}
export function checkTryMonth(input: TryInput): RuleResult {
  const uncertain = (missing: string[]) => ({
    status: "Not sure yet" as const,
    basis: "Check the missing fields.",
    citation: "42 CFR 435.552(a)",
    math: {},
    missing,
  });
  if (!input.confirmed) return uncertain(["confirmation"]);
  if (
    !validMonth(input.month) ||
    !validDate(input.asOf) ||
    `${input.month}-01` > input.asOf
  )
    return uncertain(["month"]);
  let facts: IncomeFacts;
  if (input.kind === "wages")
    facts = {
      basis: "taxable-wages",
      confirmed: true,
      grossPayCents: moneyCents(input.gross),
      preTaxDeductionsCents: moneyCents(input.deductions),
    };
  else if (input.kind === "gig")
    facts = {
      basis: "self-employment",
      confirmed: true,
      netEarningsCents: moneyCents(input.net),
      costsConfirmed: input.costsConfirmed,
    };
  else facts = { basis: "pay-shown", amountCents: null, confirmed: true };
  const pay = incomeTest(facts);
  if (pay.status === "Meets") return pay;
  if (!input.hours.trim()) return pay;
  const { start, end } = monthBounds(input.month);
  const hours = Number(input.hours);
  if (!Number.isFinite(hours) || hours < 0) return uncertain(["hours"]);
  const activity = combineHours({
    month: input.month,
    asOf: input.asOf,
    evidence: [
      {
        id: "typed-work",
        version: 1,
        kind: "work",
        status: "confirmed",
        start,
        end: end > input.asOf ? input.asOf : end,
        hours,
      },
    ],
    evidenceComplete: true,
    education: { enrollment: "none" },
    state: { verified: true, incomeDerivedHours: false },
    income: { hoursDocumented: true },
  });
  return activity.status === "Meets"
    ? activity
    : pay.status === "Short"
      ? {
          ...activity,
          math: { ...activity.math, income: pay.math },
          missing: pay.missing,
        }
      : { ...pay, math: { ...pay.math, work: activity.math } };
}

export interface TryFill {
  month: string;
  kind: "wages" | "gig" | "";
  gross: string;
  deductions: string;
  net: string;
  hours: string;
  /** Facts the reader was not sure of or could not add up. They stay blank. */
  unsure: Array<"month" | "gross" | "deductions" | "net" | "hours">;
}
type Proposal = ReaderResult["proposals"][number];
const dollars = (cents: number) => (cents / 100).toFixed(2);
function sumOf(
  proposals: Proposal[],
  value: (proposal: Proposal) => number | null | undefined,
): number | null {
  if (!proposals.length) return null;
  let total = 0;
  for (const proposal of proposals) {
    const amount = value(proposal);
    if (typeof amount !== "number") return null;
    total += amount;
  }
  // Cents must stay whole; hours may have decimals.
  return Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER
    ? total
    : null;
}
/**
 * Turns a reading into suggestions for the try form. A value is filled only
 * when every line that should carry it does; anything else stays blank and is
 * named so the visitor checks it. The visitor still confirms before the month
 * is worked out.
 */
export function tryFieldsFromReading(result: ReaderResult): TryFill {
  const fill: TryFill = {
    month: "",
    kind: "",
    gross: "",
    deductions: "",
    net: "",
    hours: "",
    unsure: [],
  };
  const pay = result.proposals.filter((p) => p.fields.income);
  const gig = pay.some((p) => p.fields.income?.kind === "self-employment");
  const months = new Set(
    result.proposals
      .map((p) => p.fields.income?.receivedOn ?? p.fields.end ?? null)
      .filter((value): value is string => !!value)
      .map((value) => value.slice(0, 7)),
  );
  if (months.size === 1) fill.month = [...months][0]!;
  else if (result.proposals.length) fill.unsure.push("month");
  if (pay.length) {
    fill.kind = gig ? "gig" : "wages";
    if (gig) {
      const net = sumOf(pay, (p) => p.fields.income?.netEarningsCents);
      if (net === null) fill.unsure.push("net");
      else fill.net = dollars(net);
    } else {
      const gross = sumOf(pay, (p) => p.fields.income?.grossPayCents);
      const deductions = sumOf(
        pay,
        (p) => p.fields.income?.preTaxDeductionsCents,
      );
      if (gross === null) fill.unsure.push("gross");
      else fill.gross = dollars(gross);
      if (deductions === null) fill.unsure.push("deductions");
      else fill.deductions = dollars(deductions);
    }
  }
  const worked = result.proposals.filter(
    (p) =>
      p.fields.kind === "work" ||
      p.fields.kind === "income" ||
      p.questions.includes("hours"),
  );
  const hours = sumOf(worked, (p) =>
    p.questions.includes("hours") ? null : (p.fields.hours ?? null),
  );
  if (hours !== null) fill.hours = String(Math.round(hours * 100) / 100);
  else if (
    worked.some((p) => p.fields.hours != null || p.questions.includes("hours"))
  )
    fill.unsure.push("hours");
  return fill;
}
