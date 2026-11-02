import { all, any, finding, flag, negate, units } from "./common.ts";
import type { Condition } from "./common.ts";
import type { CareFacts, ExclusionFacts, MedicalFacts } from "./types.ts";

export function caregiverExclusion(care: CareFacts | null | undefined) {
  const citation = "42 CFR 435.554(c)(3)";
  if (!care || care.role == null)
    return finding(null, "Tell us whether you care for someone.", citation, [
      "exclusions.care.role",
    ]);
  if (care.role === "none")
    return finding(false, "No caregiver role was reported.", citation);
  const age = care.dependentAge;
  const child =
    typeof age === "number" && Number.isInteger(age) && age >= 0
      ? ({ value: age <= 13, missing: [] } as Condition)
      : ({
          value: null,
          missing: ["exclusions.care.dependentAge"],
        } as Condition);
  const dependent = any([
    all([
      child,
      flag(care.dependentReliesOnCare, "exclusions.care.dependentReliesOnCare"),
    ]),
    flag(care.dependentAdaDisability, "exclusions.care.dependentAdaDisability"),
  ]);
  const resides = flag(
    care.primarilyResidesTogether,
    "exclusions.care.primarilyResidesTogether",
  );
  const relative = flag(
    care.relativeUnderDefinition,
    "exclusions.care.relativeUnderDefinition",
  );
  const substantial = negate(
    flag(care.solelyIncidental, "exclusions.care.solelyIncidental"),
  );
  const regular = flag(
    care.regularAssistance,
    "exclusions.care.regularAssistance",
  );
  const hours = units(care.monthlyAssistanceHours, 1_000_000);
  const enoughHours: Condition =
    hours === null
      ? { value: null, missing: ["exclusions.care.monthlyAssistanceHours"] }
      : { value: hours >= 80_000_000, missing: [] };
  const a = all([resides, regular, substantial]);
  const b = all([negate(resides), relative, regular, substantial]);
  const c = all([negate(resides), negate(relative), enoughHours, substantial]);
  const definition = any([
    flag(care.adultFamilyMember, "exclusions.care.adultFamilyMember"),
    flag(
      care.significantRelationship,
      "exclusions.care.significantRelationship",
    ),
  ]);
  const family = all([dependent, definition, any([a, b, c])]);
  let test: Condition;
  let applied = citation;
  let familyApplies = false;
  if (care.role === "parent" || care.role === "guardian") {
    test = dependent;
  } else if (care.role === "caretaker-relative") {
    const caretaker = all([
      dependent,
      relative,
      resides,
      flag(care.primaryResponsibility, "exclusions.care.primaryResponsibility"),
    ]);
    test = any([caretaker, family]);
    familyApplies = caretaker.value !== true && family.value === true;
  } else if (care.role === "family-caregiver") {
    test = family;
    familyApplies = family.value === true;
  } else {
    return finding(null, "Check the legal caregiver role.", citation, [
      "exclusions.care.role",
    ]);
  }
  if (familyApplies)
    applied = `${citation}(i)(${a.value === true ? "A" : b.value === true ? "B" : "C"})`;
  return finding(
    test.value,
    test.value === true
      ? "Your care role meets the exclusion test."
      : "Check the care facts that this test needs.",
    applied,
    test.missing,
    { childAgeLimit: 13, nonresidentNonrelativeHours: 80 },
    "Exempt",
  );
}

export function medicalExclusion(medical: MedicalFacts | null | undefined) {
  const citation = "42 CFR 435.554(c)(5)(i)–(ii)";
  if (!medical)
    return finding(
      null,
      "A health exclusion may need more proof. We do not diagnose.",
      citation,
      ["exclusions.medical"],
    );
  if (
    medical.significantlyImpairsCompliance === false ||
    medical.verifiedCategories?.length === 0
  )
    return finding(
      false,
      "No qualifying health facts were confirmed.",
      citation,
    );
  const categoryTests: Condition[] = [];
  if (!Array.isArray(medical.verifiedCategories))
    categoryTests.push({
      value: null,
      missing: ["exclusions.medical.verifiedCategories"],
    });
  else
    for (const category of medical.verifiedCategories) {
      if (
        [
          "ssa-blind-or-disabled",
          "disabling-mental-disorder",
          "disability-affecting-daily-living",
          "serious-or-complex",
        ].includes(category)
      )
        categoryTests.push({ value: true, missing: [] });
      else if (category === "substance-use") {
        const years = medical.stableRecoveryYears;
        categoryTests.push(
          typeof years === "number" && Number.isFinite(years) && years >= 0
            ? { value: years < 5, missing: [] }
            : {
                value: null,
                missing: ["exclusions.medical.stableRecoveryYears"],
              },
        );
      } else
        categoryTests.push({
          value: null,
          missing: ["exclusions.medical.verifiedCategories"],
        });
    }
  const test = all([
    flag(
      medical.significantlyImpairsCompliance,
      "exclusions.medical.significantlyImpairsCompliance",
    ),
    any(categoryTests),
  ]);
  return finding(
    test.value,
    test.value === true
      ? "The confirmed health facts meet a listed category. Keep proof."
      : "Ask for a health review. We do not diagnose.",
    citation,
    test.missing,
    {
      stableRecoveryYears: 5,
      stateMustPublishList: true,
      mayRequestReviewOutsideStateList: true,
    },
    "Exempt",
  );
}

export function checkExclusions(facts: ExclusionFacts) {
  const care = caregiverExclusion(facts.care);
  const medical = medicalExclusion(facts.medical);
  const snap = all([
    flag(facts.snapHousehold, "exclusions.snapHousehold"),
    negate(
      flag(facts.exemptFromSnapWorkRules, "exclusions.exemptFromSnapWorkRules"),
    ),
  ]);
  const treatment = all([
    flag(
      facts.treatmentProgramQualifies,
      "exclusions.treatmentProgramQualifies",
    ),
    flag(
      facts.treatmentMeetsStateMinimum,
      "exclusions.treatmentMeetsStateMinimum",
    ),
  ]);
  const checks = [
    finding(
      flag(facts.formerFosterYouthGroup, "exclusions.formerFosterYouthGroup")
        .value,
      "You meet the former foster youth group definition.",
      "42 CFR 435.554(c)(1)",
      flag(facts.formerFosterYouthGroup, "exclusions.formerFosterYouthGroup")
        .missing,
    ),
    finding(
      flag(facts.indianUnder44751, "exclusions.indianUnder44751").value,
      "You meet the Indian definition in the rule.",
      "42 CFR 435.554(c)(2)",
      flag(facts.indianUnder44751, "exclusions.indianUnder44751").missing,
    ),
    care,
    finding(
      flag(facts.veteran100Percent, "exclusions.veteran100Percent").value,
      "Your VA disability rating is 100 percent.",
      "42 CFR 435.554(c)(4)",
      flag(facts.veteran100Percent, "exclusions.veteran100Percent").missing,
    ),
    medical,
    finding(
      flag(facts.tanf407Compliant, "exclusions.tanf407Compliant").value,
      "You meet the TANF section 407 rules.",
      "42 CFR 435.554(c)(6)",
      flag(facts.tanf407Compliant, "exclusions.tanf407Compliant").missing,
    ),
    finding(
      snap.value,
      "Your SNAP household status meets this exclusion.",
      "42 CFR 435.554(c)(7)",
      snap.missing,
    ),
    finding(
      treatment.value,
      "Your treatment program meets this exclusion.",
      "42 CFR 435.554(c)(8)",
      treatment.missing,
    ),
    finding(
      flag(facts.inmate, "exclusions.inmate").value,
      "You are in a public institution covered by this rule.",
      "42 CFR 435.554(c)(9)",
      flag(facts.inmate, "exclusions.inmate").missing,
    ),
    finding(
      flag(facts.pregnantOrPostpartum, "exclusions.pregnantOrPostpartum").value,
      "Pregnancy or covered postpartum care excludes you.",
      "42 CFR 435.554(c)(10)",
      flag(facts.pregnantOrPostpartum, "exclusions.pregnantOrPostpartum")
        .missing,
    ),
  ];
  const match = checks.find((check) => check.matched === true);
  if (match) return { ...match, status: "Exempt" as const };
  const missing = checks.flatMap((check) => check.missing);
  return finding(
    missing.length ? null : false,
    missing.length
      ? "More facts are needed to check exclusions."
      : "These answers show no listed exclusion.",
    "42 CFR 435.554(c)(1)–(10)",
    missing,
  );
}
