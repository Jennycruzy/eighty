import { finding, flag } from "./common.ts";
import {
  monthBounds,
  overlaps,
  shiftMonth,
  validMonth,
  validRange,
} from "./dates.ts";
import type { ExceptionFacts } from "./types.ts";

export function checkMandatoryExceptions(month: string, facts: ExceptionFacts) {
  const citation = "42 CFR 435.553";
  if (!validMonth(month))
    return finding(null, "Check the month.", citation, ["month"]);
  const checks = [
    [
      "under19DuringMonth",
      "(a)(1)",
      "You were under 19 for part of this month.",
    ],
    [
      "medicareDuringMonth",
      "(a)(2)",
      "You had Medicare for part of this month.",
    ],
    [
      "mandatoryGroupDuringMonth",
      "(a)(3)",
      "You were in a mandatory coverage group for part of this month.",
    ],
    [
      "excludedDuringMonth",
      "(a)(4)",
      "You met an exclusion for part of this month.",
    ],
  ] as const;
  for (const [key, paragraph, basis] of checks)
    if (facts[key] === true)
      return finding(true, basis, `${citation}${paragraph}`, [], {}, "Deemed");
  const missing = checks.flatMap(
    ([key]) => flag(facts[key], `exceptions.${key}`).missing,
  );
  const { start } = monthBounds(month);
  const lookbackStart = `${shiftMonth(month, -3)}-01`;
  if (!Array.isArray(facts.incarcerationPeriods))
    missing.push("exceptions.incarcerationPeriods");
  else
    for (const period of facts.incarcerationPeriods) {
      if (!validRange(period))
        missing.push("exceptions.incarcerationPeriods.dates");
      else if (overlaps(period, lookbackStart, start))
        return finding(
          true,
          "You were in a public institution during the three-month window.",
          `${citation}(b)`,
          [],
          { lookbackStart, lookbackEnd: start },
          "Deemed",
        );
    }
  return finding(
    missing.length ? null : false,
    "No mandatory exception has been established.",
    citation,
    missing,
    { lookbackStart, lookbackEnd: start },
  );
}
