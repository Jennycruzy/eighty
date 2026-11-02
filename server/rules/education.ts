import { finding, units } from "./common.ts";
import { HOUR_SCALE, REQUIRED_HOURS } from "./constants.ts";
import { monthBounds, validDate, validMonth } from "./dates.ts";
import type { EducationFacts } from "./types.ts";

export function educationHours(
  month: string,
  asOf: string,
  facts: EducationFacts,
) {
  const citation = "42 CFR 435.552(c)–(d)";
  const finish = (
    matched: boolean | null,
    hours: number | null,
    basis: string,
    missing: string[] = [],
    applied = citation,
    halfTime = false,
  ) => ({
    ...finding(matched, basis, applied, missing, { hours, halfTime }, "Meets"),
    hours,
    halfTime,
  });
  if (!validMonth(month))
    return finish(null, null, "Check the month.", ["month"]);
  if (!validDate(asOf))
    return finish(null, null, "Check the review date.", ["asOf"]);
  if (`${month}-01` > asOf)
    return finish(null, null, "A future school month is not yet proved.", [
      "education.futureMonth",
    ]);
  if (facts.enrollment === "none")
    return finish(false, 0, "No school hours were reported.");
  if (
    !["less-than-half", "half-time", "full-time"].includes(
      facts.enrollment as string,
    )
  )
    return finish(null, null, "The school must set your enrollment status.", [
      "education.enrollment",
    ]);
  if (facts.qualifyingProgram === false)
    return finish(
      false,
      0,
      "This program is outside the education definition.",
      [],
      "42 CFR 435.552(b)",
    );
  const missing: string[] = [];
  if (facts.qualifyingProgram !== true)
    missing.push("education.qualifyingProgram");
  if (facts.confirmed !== true) missing.push("education.confirmed");
  if (!validDate(facts.termStart)) missing.push("education.termStart");
  if (
    !validDate(facts.termEnd) ||
    (validDate(facts.termStart) && facts.termEnd < facts.termStart)
  )
    missing.push("education.termEnd");
  if (
    facts.exitDate != null &&
    (!validDate(facts.exitDate) ||
      (validDate(facts.termStart) && facts.exitDate < facts.termStart))
  )
    missing.push("education.exitDate");
  if (missing.length)
    return finish(
      null,
      null,
      "Confirm the school record and term dates.",
      missing,
    );
  const bounds = monthBounds(month);
  const start = facts.termStart as string;
  const end = facts.termEnd as string;
  if (start > bounds.end || start > asOf)
    return finish(
      false,
      0,
      "School has not started for this month.",
      [],
      "42 CFR 435.552(c)(1)",
    );
  if (facts.exitDate && facts.exitDate.slice(0, 7) < month)
    return finish(
      facts.continuesInAnotherProgram === false ? false : null,
      facts.continuesInAnotherProgram === false ? 0 : null,
      "School status ends after the exit month. A new program needs its own record.",
      facts.continuesInAnotherProgram === false
        ? []
        : [
            facts.continuesInAnotherProgram === true
              ? "education.currentProgram"
              : "education.continuesInAnotherProgram",
          ],
      "42 CFR 435.552(c)(3)",
    );
  if (month > end.slice(0, 7)) {
    if (
      facts.registeredForNextRegularTerm === false ||
      facts.normalBreak === false
    )
      return finish(
        false,
        0,
        "School status ended after the last term.",
        [],
        "42 CFR 435.552(c)(3)",
      );
    if (
      facts.registeredForNextRegularTerm !== true ||
      facts.normalBreak !== true
    )
      return finish(
        null,
        null,
        "Confirm the normal break and next regular term.",
        (["registeredForNextRegularTerm", "normalBreak"] as const)
          .filter((key) => facts[key] !== true)
          .map((key) => `education.${key}`),
        "42 CFR 435.552(c)(2)–(3)",
      );
    if (
      !validDate(facts.nextRegularTermStart) ||
      facts.nextRegularTermStart <= end
    )
      return finish(
        null,
        null,
        "Check the next regular term start.",
        ["education.nextRegularTermStart"],
        "42 CFR 435.552(c)(2)–(3)",
      );
    if (month > facts.nextRegularTermStart.slice(0, 7))
      return finish(
        null,
        null,
        "Use the school record for the new term.",
        ["education.currentProgram"],
        "42 CFR 435.552(c)(1)–(3)",
      );
  }
  if (facts.enrollment === "half-time" || facts.enrollment === "full-time")
    return finish(
      true,
      null,
      "School at half-time or more meets the rule on its own.",
      [],
      "42 CFR 435.552(a)(4), (c)",
      true,
    );
  if (facts.usesCreditHours === true) {
    const credits = units(facts.credits, 10_000);
    if (credits === null || !Number.isSafeInteger(credits * 1299))
      return finish(null, null, "Check the credit hours.", [
        "education.credits",
      ]);
    const hours = (credits * 1299) / HOUR_SCALE;
    return {
      ...finish(
        hours >= REQUIRED_HOURS,
        hours,
        "Credits count as education hours.",
        [],
        "42 CFR 435.552(d)(1)(i)–(ii)",
      ),
      math: {
        credits: facts.credits,
        hoursPerCredit: 3,
        weeks: 4.33,
        hours,
        halfTime: false,
      },
    };
  }
  if (facts.usesCreditHours !== false)
    return finish(null, null, "Does this program use credit hours?", [
      "education.usesCreditHours",
    ]);
  const actual = units(facts.actualHours, HOUR_SCALE);
  if (actual === null)
    return finish(null, null, "Check the class and education activity hours.", [
      "education.actualHours",
    ]);
  const hours = actual / HOUR_SCALE;
  return finish(
    hours >= REQUIRED_HOURS,
    hours,
    "Class and education activity hours count.",
    [],
    "42 CFR 435.552(d)(2)",
  );
}
