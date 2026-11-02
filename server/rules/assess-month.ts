import { combineHours } from "./activities.ts";
import { isApplicableIndividual } from "./applicability.ts";
import { result } from "./common.ts";
import { RULE_VERSION } from "./constants.ts";
import { validDate, validMonth } from "./dates.ts";
import { educationHours } from "./education.ts";
import { checkExclusions } from "./exclusions.ts";
import { checkHardship } from "./hardship.ts";
import { incomeTest, seasonalIncomeTest } from "./income.ts";
import { checkMandatoryExceptions } from "./mandatory.ts";
import type { MonthInput, RuleResult } from "./types.ts";

export function assessMonth(
  input: MonthInput,
): RuleResult & { ruleVersion: string } {
  const wrap = (value: RuleResult) => ({ ...value, ruleVersion: RULE_VERSION });
  if (!validMonth(input.month) || !validDate(input.asOf))
    return wrap(
      result(
        "Not sure yet",
        "Check the month and review date.",
        "42 CFR 435.552(a)",
        {},
        [!validMonth(input.month) ? "month" : "asOf"],
      ),
    );
  if (`${input.month}-01` > input.asOf)
    return wrap(
      result(
        "Not sure yet",
        "A future month is not yet proved.",
        "42 CFR 435.552(a)",
        {},
        ["month.future"],
      ),
    );
  const applicable = isApplicableIndividual(input.applicability);
  if (applicable.matched === false) return wrap(applicable);
  const exclusion = checkExclusions(input.exclusions);
  if (exclusion.matched === true) return wrap(exclusion);
  if (applicable.matched === null) return wrap(applicable);
  const mandatory = checkMandatoryExceptions(input.month, input.exceptions);
  if (mandatory.matched === true) return wrap(mandatory);
  const hardship = checkHardship(
    input.month,
    input.asOf,
    input.state,
    input.hardship,
  );
  if (hardship.matched === true) return wrap(hardship);
  const education = educationHours(input.month, input.asOf, input.education);
  const income = incomeTest(input.income);
  const seasonal = seasonalIncomeTest(input.month, input.seasonal);
  const activities = combineHours(input);
  for (const proof of [education, income, seasonal, activities]) {
    if (proof.status === "Meets") {
      // A possible exclusion must be checked later, without delaying verified compliance.
      return wrap({
        ...proof,
        math: {
          ...proof.math,
          exclusionFollowUp: exclusion.missing,
          exceptionFollowUp: mandatory.missing,
          hardshipFollowUp: hardship.missing,
          authority: "42 CFR 435.557(c)(3)",
        },
      });
    }
  }
  const missing = [
    ...exclusion.missing,
    ...mandatory.missing,
    ...hardship.missing,
    ...income.missing,
    ...seasonal.missing,
    ...activities.missing,
  ];
  if (missing.length)
    return wrap(
      result(
        "Not sure yet",
        "More facts are needed before this month can be decided.",
        "42 CFR 435.552–435.555",
        { ...activities.math, income: income.math },
        missing,
      ),
    );
  return wrap(
    result(
      "Short",
      "The confirmed hours and income are below the rule. Your state makes the decision.",
      "42 CFR 435.552(a), (e)–(g)",
      { ...activities.math, income: income.math },
    ),
  );
}
