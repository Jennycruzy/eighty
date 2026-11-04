import type { ReaderResult } from "./evidence.ts";

/** Pages read from one PDF. Later pages are not read; the screen says so. */
export const MAX_READ_PAGES = 10;
/** A proposal below this confidence is shown as "Check this", questions first. */
export const CHECK_THIS_BELOW = 0.85;
export type ReaderQuestion =
  ReaderResult["proposals"][number]["questions"][number];
/** The value each question stands in for. A question always leaves it blank. */
export const questionPaths: Record<ReaderQuestion, string> = {
  start: "start",
  end: "end",
  hours: "hours",
  "gross-pay": "income.grossPayCents",
  "pay-date": "income.receivedOn",
  "pre-tax-deductions": "income.preTaxDeductionsCents",
  "net-earnings": "income.netEarningsCents",
  "business-costs": "income.costsConfirmed",
  organization: "organization",
  "school-status": "education.enrollment",
  "school-credits": "education.credits",
  "service-contact": "service.confirmationContact",
};
export function needsCheck(line: {
  confidence: number | null;
  questions: readonly string[];
}): boolean {
  return (
    line.questions.length > 0 ||
    (line.confidence !== null && line.confidence < CHECK_THIS_BELOW)
  );
}
