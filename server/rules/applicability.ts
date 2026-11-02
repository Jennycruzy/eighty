import { finding } from "./common.ts";
import type { ApplicabilityFacts } from "./types.ts";

export function isApplicableIndividual(facts: ApplicabilityFacts) {
  const citation = "42 CFR 435.551; 435.119(b)";
  const outside = (
    basis: string,
    applied = citation,
    math: Record<string, unknown> = {},
  ) => ({
    ...finding(false, basis, applied, [], math),
    status: "Exempt" as const,
  });
  if (facts.group === "other")
    return outside("This coverage group is outside this federal rule.");
  if (
    typeof facts.age === "number" &&
    Number.isInteger(facts.age) &&
    facts.age >= 0 &&
    (facts.age < 19 || facts.age >= 65)
  )
    return outside("The rule covers ages 19 through 64.", citation, {
      age: facts.age,
    });
  if (facts.pregnant === true || facts.medicare === true)
    return outside("Pregnancy or Medicare puts you outside this rule.");
  if (facts.group === "1115" && facts.otherwiseEligible === true)
    return outside(
      "Another State plan eligibility group puts you outside this demonstration rule.",
      "42 CFR 435.551(b)(4)",
    );
  if (
    facts.group === "expansion" &&
    facts.mandatoryGroupEligibleAndEnrolled === true
  )
    return outside(
      "You are eligible for and enrolled in another mandatory coverage group.",
      "42 CFR 435.119(b)(4)",
    );
  if (facts.group === "1115" && facts.minimumEssentialCoverage === false)
    return outside(
      "This demonstration does not provide the coverage this rule covers.",
      "42 CFR 435.551(b)",
    );
  const missing: string[] = [];
  if (facts.group !== "expansion" && facts.group !== "1115")
    missing.push("applicability.group");
  if (
    typeof facts.age !== "number" ||
    !Number.isInteger(facts.age) ||
    facts.age < 0
  )
    missing.push("applicability.age");
  for (const key of ["pregnant", "medicare"] as const)
    if (typeof facts[key] !== "boolean") missing.push(`applicability.${key}`);
  if (facts.group === "1115" && typeof facts.otherwiseEligible !== "boolean")
    missing.push("applicability.otherwiseEligible");
  if (
    facts.group === "expansion" &&
    facts.otherwiseEligible !== false &&
    facts.mandatoryGroupEligibleAndEnrolled !== false
  )
    missing.push("applicability.mandatoryGroupEligibleAndEnrolled");
  if (facts.group === "1115" && facts.minimumEssentialCoverage !== true)
    missing.push("applicability.minimumEssentialCoverage");
  return finding(
    missing.length ? null : true,
    missing.length
      ? "Check the missing coverage facts."
      : "This coverage group is subject to the rule unless an exclusion applies.",
    citation,
    missing,
  );
}
