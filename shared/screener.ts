import {
  isApplicableIndividual,
  checkExclusions,
} from "../server/rules/index.ts";
import type {
  Flag,
  ExclusionFacts,
  RuleResult,
} from "../server/rules/types.ts";
export type ScreenerAnswers = Record<string, string>;
const flag = (value: string | undefined): Flag =>
  value === "yes" ? true : value === "no" ? false : null;
export function screenAnswers(answers: ScreenerAnswers): RuleResult {
  const pregnant = flag(answers.pregnant);
  const facts: ExclusionFacts = {
    formerFosterYouthGroup: flag(answers.foster),
    indianUnder44751: flag(answers.indian),
    care:
      answers.child === "yes"
        ? { role: "parent", dependentAge: 13, dependentReliesOnCare: true }
        : answers.care === "no" && answers.child === "no"
          ? { role: "none" }
          : null,
    veteran100Percent: flag(answers.veteran),
    medical:
      answers.health === "no"
        ? { verifiedCategories: [], significantlyImpairsCompliance: false }
        : null,
    tanf407Compliant: flag(answers.tanf),
    snapHousehold: flag(answers.snap),
    treatmentProgramQualifies: answers.treatment === "no" ? false : null,
    inmate: null,
    pregnantOrPostpartum: pregnant,
  };
  const exclusion = checkExclusions(facts);
  if (exclusion.matched === true) return exclusion;
  const applicable = isApplicableIndividual({
    group:
      answers.group === "expansion"
        ? "expansion"
        : answers.group === "1115"
          ? "1115"
          : answers.group === "other"
            ? "other"
            : null,
    age: answers.age?.trim() ? Number(answers.age) : null,
    pregnant,
    medicare: flag(answers.medicare),
  });
  if (applicable.matched === false) return applicable;
  return {
    status: "Not sure yet",
    basis:
      "Ask your state which coverage group you are in and whether an exclusion applies.",
    citation: "42 CFR 435.551; 435.554",
    math: {},
    missing: [...applicable.missing, ...exclusion.missing],
  };
}
