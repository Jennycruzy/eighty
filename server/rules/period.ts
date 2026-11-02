import { result } from "./common.ts";
import {
  monthBounds,
  monthsBetween,
  shiftMonth,
  validDate,
  validMonth,
} from "./dates.ts";
import type { Flag } from "./types.ts";

export interface LookbackInput {
  kind: "application" | "renewal" | "frequent-check" | "change";
  dueDate: string;
  startDate?: string | null;
  requiredMonths?: number | null;
  policyVerified?: Flag;
  selectedMonths?: string[] | null;
}

export function lookbackWindow(input: LookbackInput) {
  const citation = "42 CFR 435.556(a)–(b)";
  const unknown = (missing: string[], months: string[] = []) => ({
    ...result(
      "Not sure yet",
      "Check the state rule and dates for the months to show.",
      citation,
      {},
      missing,
    ),
    months,
    requiredCount: null as number | null,
    selectedMonths: null as string[] | null,
  });
  if (!validDate(input.dueDate)) return unknown(["lookback.dueDate"]);
  if (input.policyVerified !== true)
    return unknown(["lookback.policyVerified"]);
  const count = input.requiredMonths;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1)
    return unknown(["lookback.requiredMonths"]);
  let months: string[];
  let applied: string;
  if (input.kind === "application") {
    if (count > 3) return unknown(["lookback.requiredMonths"]);
    months = Array.from({ length: count }, (_, i) =>
      shiftMonth(input.dueDate.slice(0, 7), i - count),
    );
    applied = "42 CFR 435.556(a)(1)";
  } else if (["renewal", "frequent-check", "change"].includes(input.kind)) {
    const end =
      input.kind === "change"
        ? monthBounds(shiftMonth(input.dueDate.slice(0, 7), -1)).end
        : input.dueDate;
    if (!validDate(input.startDate) || input.startDate > end)
      return unknown(["lookback.startDate"]);
    months = monthsBetween(input.startDate, end);
    applied = `42 CFR 435.556(a)(2)(${input.kind === "renewal" ? "i" : input.kind === "frequent-check" ? "ii" : "iii"}), (b)`;
    if (count > months.length)
      return unknown(["lookback.requiredMonths"], months);
  } else return unknown(["lookback.kind"]);
  if (
    input.selectedMonths != null &&
    (input.selectedMonths.length !== count ||
      new Set(input.selectedMonths).size !== count ||
      input.selectedMonths.some(
        (month) => !validMonth(month) || !months.includes(month),
      ))
  )
    return unknown(["lookback.selectedMonths"], months);
  const selectedMonths =
    input.kind === "application" ? months : (input.selectedMonths ?? null);
  return {
    ...result(
      "Not sure yet",
      "These are the allowed months. Only the state-required number must qualify.",
      applied,
      {
        eligibleMonths: months,
        requiredCount: count,
        selectedMonths,
        consecutive: input.kind === "application",
      },
    ),
    months,
    requiredCount: count,
    selectedMonths,
  };
}
