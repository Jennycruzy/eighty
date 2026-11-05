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
export const coverageFacts = {
  "applicability.group": "group",
  "applicability.mandatoryGroupEligibleAndEnrolled": "otherGroup",
  "applicability.otherwiseEligible": "otherwiseEligible",
  "applicability.minimumEssentialCoverage": "fullCoverage",
} as const;
export function visibleQuestions<T extends { key: string }>(
  questions: T[],
  answers: ScreenerAnswers,
): T[] {
  return questions.filter((question) =>
    question.key === "otherGroup"
      ? answers.group === "expansion"
      : ["otherwiseEligible", "fullCoverage"].includes(question.key)
        ? answers.group === "1115"
        : true,
  );
}
export function coverageAnswers<
  T extends {
    group?: string | undefined;
    otherGroup?: string | undefined;
    otherwiseEligible?: string | undefined;
    fullCoverage?: string | undefined;
  },
>(answers: T): T {
  const clean = { ...answers };
  if (clean.group !== "expansion") delete clean.otherGroup;
  if (clean.group !== "1115") {
    delete clean.otherwiseEligible;
    delete clean.fullCoverage;
  }
  return clean;
}
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
    mandatoryGroupEligibleAndEnrolled:
      answers.group === "expansion" ? flag(answers.otherGroup) : null,
    otherwiseEligible:
      answers.group === "1115" ? flag(answers.otherwiseEligible) : null,
    minimumEssentialCoverage:
      answers.group === "1115" ? flag(answers.fullCoverage) : null,
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
