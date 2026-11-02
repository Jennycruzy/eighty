import { monthBounds, validMonth, validDate } from "../server/rules/dates.ts";
import { combineHours, incomeTest } from "../server/rules/index.ts";
import type { IncomeFacts, RuleResult } from "../server/rules/types.ts";
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
