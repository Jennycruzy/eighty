import {
  applicability,
  exclusions,
  exceptions,
  state,
  income,
  school,
  care,
  work,
  service,
  program,
  disaster,
  month,
  seasonal,
} from "./fixtures.mjs";
const U = "Not sure yet",
  M = "Meets",
  E = "Exempt",
  D = "Deemed",
  S = "Short";
export const cases = [];
const add = (id, rule, citation, title, args, expected) =>
  cases.push({ id, rule, citation, title, args, expected });

for (const [age, status, matched] of [
  [18, E, false],
  [19, U, true],
  [64, U, true],
  [65, E, false],
])
  add(
    `age-${age}`,
    "isApplicableIndividual",
    "42 CFR 435.551; 435.119(b)(1)",
    `Age boundary: ${age}`,
    [applicability({ age })],
    { status, matched },
  );
add(
  "other-group",
  "isApplicableIndividual",
  "42 CFR 435.551",
  "Other coverage group is outside this rule",
  [applicability({ group: "other" })],
  { status: E, matched: false },
);
for (const key of ["pregnant", "medicare"])
  add(
    `app-${key}`,
    "isApplicableIndividual",
    "42 CFR 435.119(b)(2)–(3)",
    `${key} prevents applicability`,
    [applicability({ [key]: true })],
    { status: E, matched: false },
  );
add(
  "1115-covered",
  "isApplicableIndividual",
  "42 CFR 435.551(b)(1)–(4)",
  "Qualifying demonstration coverage",
  [applicability({ group: "1115", minimumEssentialCoverage: true })],
  { status: U, matched: true },
);
add(
  "1115-no-mec",
  "isApplicableIndividual",
  "42 CFR 435.551(b)",
  "Demonstration without minimum essential coverage",
  [applicability({ group: "1115", minimumEssentialCoverage: false })],
  { status: E, matched: false },
);
add(
  "1115-other-eligible",
  "isApplicableIndividual",
  "42 CFR 435.551(b)(4)",
  "Other State plan eligibility excludes demonstration group",
  [applicability({ group: "1115", otherwiseEligible: true })],
  { status: E, matched: false },
);
add(
  "expansion-other-not-enrolled",
  "isApplicableIndividual",
  "42 CFR 435.119(b)(4)",
  "Eligibility alone does not equal enrollment in another mandatory group",
  [
    applicability({
      otherwiseEligible: true,
      mandatoryGroupEligibleAndEnrolled: false,
    }),
  ],
  { status: U, matched: true },
);
add(
  "expansion-mandatory-enrolled",
  "isApplicableIndividual",
  "42 CFR 435.119(b)(4)",
  "Other mandatory group eligibility and enrollment",
  [applicability({ mandatoryGroupEligibleAndEnrolled: true })],
  { status: E, matched: false },
);
for (const [key, value] of [
  ["age", null],
  ["age", -1],
  ["age", 19.5],
  ["group", null],
  ["pregnant", null],
  ["medicare", null],
])
  add(
    `app-missing-${key}-${value}`,
    "isApplicableIndividual",
    "42 CFR 435.551",
    "Unknown coverage fact stays unsure",
    [applicability({ [key]: value })],
    { status: U, matched: null, missingIncludes: [`applicability.${key}`] },
  );
add(
  "1115-unknown-mec",
  "isApplicableIndividual",
  "42 CFR 435.551(b)",
  "Unknown demonstration coverage",
  [applicability({ group: "1115" })],
  {
    status: U,
    matched: null,
    missingIncludes: ["applicability.minimumEssentialCoverage"],
  },
);
add(
  "1115-unknown-other",
  "isApplicableIndividual",
  "42 CFR 435.551(b)(4)",
  "Unknown other eligibility",
  [
    applicability({
      group: "1115",
      minimumEssentialCoverage: true,
      otherwiseEligible: null,
    }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["applicability.otherwiseEligible"],
  },
);
add(
  "expansion-unknown-enrollment",
  "isApplicableIndividual",
  "42 CFR 435.119(b)(4)",
  "Check other mandatory enrollment when other eligibility is known",
  [applicability({ otherwiseEligible: true })],
  {
    status: U,
    matched: null,
    missingIncludes: ["applicability.mandatoryGroupEligibleAndEnrolled"],
  },
);

add(
  "exclusions-none",
  "checkExclusions",
  "42 CFR 435.554(c)",
  "No listed exclusion in complete answers",
  [exclusions()],
  { status: U, matched: false, missing: [] },
);
for (const [key, paragraph] of [
  ["formerFosterYouthGroup", "1"],
  ["indianUnder44751", "2"],
  ["veteran100Percent", "4"],
  ["tanf407Compliant", "6"],
  ["inmate", "9"],
  ["pregnantOrPostpartum", "10"],
]) {
  add(
    `exclude-${key}`,
    "checkExclusions",
    `42 CFR 435.554(c)(${paragraph})`,
    `${key} qualifies`,
    [exclusions({ [key]: true })],
    { status: E, matched: true },
  );
  add(
    `exclude-unknown-${key}`,
    "checkExclusions",
    `42 CFR 435.554(c)(${paragraph})`,
    `${key} unknown`,
    [exclusions({ [key]: null })],
    { status: U, matched: null, missingIncludes: [`exclusions.${key}`] },
  );
}
add(
  "snap-subject",
  "checkExclusions",
  "42 CFR 435.554(c)(7)",
  "SNAP household and member subject to SNAP work rules",
  [exclusions({ snapHousehold: true, exemptFromSnapWorkRules: false })],
  { status: E, matched: true },
);
add(
  "snap-exempt",
  "checkExclusions",
  "42 CFR 435.554(c)(7)",
  "SNAP work exemption is not this exclusion",
  [exclusions({ snapHousehold: true, exemptFromSnapWorkRules: true })],
  { status: U, matched: false },
);
add(
  "snap-unknown",
  "checkExclusions",
  "42 CFR 435.554(c)(7)",
  "SNAP receipt alone is insufficient",
  [exclusions({ snapHousehold: true, exemptFromSnapWorkRules: null })],
  {
    status: U,
    matched: null,
    missingIncludes: ["exclusions.exemptFromSnapWorkRules"],
  },
);
add(
  "treatment-qualifies",
  "checkExclusions",
  "42 CFR 435.554(c)(8)",
  "Qualifying treatment meets the state minimum",
  [
    exclusions({
      treatmentProgramQualifies: true,
      treatmentMeetsStateMinimum: true,
    }),
  ],
  { status: E, matched: true },
);
add(
  "treatment-unknown-minimum",
  "checkExclusions",
  "42 CFR 435.554(c)(8)",
  "Treatment minimum is unknown",
  [
    exclusions({
      treatmentProgramQualifies: true,
      treatmentMeetsStateMinimum: null,
    }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["exclusions.treatmentMeetsStateMinimum"],
  },
);
add(
  "treatment-below-minimum",
  "checkExclusions",
  "42 CFR 435.554(c)(8)",
  "Known unmet treatment minimum",
  [
    exclusions({
      treatmentProgramQualifies: true,
      treatmentMeetsStateMinimum: false,
    }),
  ],
  { status: U, matched: false },
);
add(
  "care-none",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)",
  "No care role",
  [{ role: "none" }],
  { status: U, matched: false },
);
add(
  "care-missing",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)",
  "Missing care role",
  [null],
  { status: U, matched: null, missingIncludes: ["exclusions.care.role"] },
);
for (const role of ["parent", "guardian"]) {
  add(
    `care-${role}-13`,
    "caregiverExclusion",
    "42 CFR 435.554(a), (c)(3)",
    `${role} of a dependent aged 13`,
    [
      care({
        role,
        dependentAge: 13,
        dependentReliesOnCare: true,
        dependentAdaDisability: false,
      }),
    ],
    { status: E, matched: true },
  );
  add(
    `care-${role}-14`,
    "caregiverExclusion",
    "42 CFR 435.554(a), (c)(3)",
    `${role} of a nondisabled child aged 14`,
    [
      care({
        role,
        dependentAge: 14,
        dependentReliesOnCare: true,
        dependentAdaDisability: false,
      }),
    ],
    { status: U, matched: false },
  );
}
add(
  "care-child-no-reliance",
  "caregiverExclusion",
  "42 CFR 435.554(a)",
  "Child must rely on care",
  [
    care({
      role: "parent",
      dependentAge: 13,
      dependentReliesOnCare: false,
      dependentAdaDisability: false,
    }),
  ],
  { status: U, matched: false },
);
add(
  "care-parent-disabled-adult",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)",
  "Parent care of a disabled adult",
  [care({ role: "parent", dependentAge: 30 })],
  { status: E, matched: true },
);
add(
  "care-target-unknown",
  "caregiverExclusion",
  "42 CFR 435.554(a)",
  "Disability and age both unknown",
  [
    care({
      role: "parent",
      dependentAge: null,
      dependentReliesOnCare: true,
      dependentAdaDisability: null,
    }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: [
      "exclusions.care.dependentAge",
      "exclusions.care.dependentAdaDisability",
    ],
  },
);
add(
  "care-caretaker",
  "caregiverExclusion",
  "42 CFR 435.554(a), (c)(3)",
  "Caretaker relative lives with and has primary responsibility",
  [care({ role: "caretaker-relative" })],
  { status: E, matched: true },
);
add(
  "care-caretaker-fallback",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(B)",
  "Nonresident relative can meet the family caregiver test",
  [care({ role: "caretaker-relative", primarilyResidesTogether: false })],
  { status: E, matched: true, citationIncludes: ["(i)(B)"] },
);
add(
  "care-caretaker-not-primary",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(A)",
  "A resident relative without primary responsibility can still meet family test A",
  [care({ role: "caretaker-relative", primaryResponsibility: false })],
  { status: E, matched: true, citationIncludes: ["(i)(A)"] },
);
add(
  "care-caretaker-no-family",
  "caregiverExclusion",
  "42 CFR 435.554(a)",
  "No caretaker responsibility or family definition",
  [
    care({
      role: "caretaker-relative",
      primaryResponsibility: false,
      adultFamilyMember: false,
      significantRelationship: false,
    }),
  ],
  { status: U, matched: false },
);
add(
  "rosa-a",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(A)",
  "Rosa lives with her disabled mother; no 80-hour minimum for A",
  [care()],
  { status: E, matched: true, citationIncludes: ["(i)(A)"] },
);
add(
  "care-b",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(B)",
  "Nonresident relative gives regular nonincidental help",
  [care({ primarilyResidesTogether: false })],
  { status: E, matched: true, citationIncludes: ["(i)(B)"] },
);
add(
  "care-c-80",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(C)",
  "Nonresident nonrelative gives 80 hours",
  [
    care({
      primarilyResidesTogether: false,
      relativeUnderDefinition: false,
      monthlyAssistanceHours: 80,
    }),
  ],
  { status: E, matched: true, citationIncludes: ["(i)(C)"] },
);
add(
  "care-c-short",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(C)",
  "Nonresident nonrelative gives less than 80 hours",
  [
    care({
      primarilyResidesTogether: false,
      relativeUnderDefinition: false,
      monthlyAssistanceHours: 79.99,
    }),
  ],
  { status: U, matched: false },
);
add(
  "care-c-unknown",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(C)",
  "Nonresident nonrelative hours unknown",
  [
    care({
      primarilyResidesTogether: false,
      relativeUnderDefinition: false,
      monthlyAssistanceHours: null,
    }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["exclusions.care.monthlyAssistanceHours"],
  },
);
add(
  "care-incidental",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(A)",
  "Incidental help does not meet test A",
  [care({ solelyIncidental: true })],
  { status: U, matched: false },
);
add(
  "care-irregular",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)(i)(A)",
  "Resident help must be regular",
  [care({ regularAssistance: false })],
  { status: U, matched: false },
);
add(
  "care-adult-family",
  "caregiverExclusion",
  "42 CFR 435.554(a), (c)(3)(i)(A)",
  "An adult family member need not also prove a separate significant relationship",
  [care({ adultFamilyMember: true, significantRelationship: false })],
  { status: E, matched: true },
);
add(
  "care-role-invalid",
  "caregiverExclusion",
  "42 CFR 435.554(c)(3)",
  "Unknown role is not an automatic exemption",
  [care({ role: "friend-label" })],
  { status: U, matched: null, missingIncludes: ["exclusions.care.role"] },
);

for (const category of [
  "ssa-blind-or-disabled",
  "disabling-mental-disorder",
  "disability-affecting-daily-living",
  "serious-or-complex",
])
  add(
    `medical-${category}`,
    "medicalExclusion",
    "42 CFR 435.554(c)(5)(i)",
    `Confirmed ${category} significantly impairs compliance`,
    [{ significantlyImpairsCompliance: true, verifiedCategories: [category] }],
    { status: E, matched: true },
  );
for (const [years, status, matched] of [
  [0, E, true],
  [4.99, E, true],
  [5, U, false],
  [6, U, false],
])
  add(
    `medical-recovery-${years}`,
    "medicalExclusion",
    "42 CFR 435.554(c)(5)(i)(B)",
    "Stable recovery boundary",
    [
      {
        significantlyImpairsCompliance: true,
        verifiedCategories: ["substance-use"],
        stableRecoveryYears: years,
      },
    ],
    { status, matched },
  );
add(
  "medical-recovery-unknown",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)(i)(B)",
  "Unknown stable recovery period",
  [
    {
      significantlyImpairsCompliance: true,
      verifiedCategories: ["substance-use"],
    },
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["exclusions.medical.stableRecoveryYears"],
  },
);
add(
  "medical-no-impairment",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)(i)",
  "A condition alone does not establish significant impairment",
  [
    {
      significantlyImpairsCompliance: false,
      verifiedCategories: ["serious-or-complex"],
    },
  ],
  { status: U, matched: false },
);
add(
  "medical-unknown",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)",
  "Unknown health evidence",
  [null],
  { status: U, matched: null, missingIncludes: ["exclusions.medical"] },
);
add(
  "medical-no-category",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)(i)",
  "An unclassified condition needs review",
  [{ significantlyImpairsCompliance: true }],
  {
    status: U,
    matched: null,
    missingIncludes: ["exclusions.medical.verifiedCategories"],
  },
);
add(
  "medical-invalid-category",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)(i)",
  "Do not invent a medical category",
  [{ significantlyImpairsCompliance: true, verifiedCategories: ["made-up"] }],
  { status: U, matched: null },
);
add(
  "medical-empty",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)(i)",
  "No qualifying category",
  [{ verifiedCategories: [] }],
  { status: U, matched: false },
);
add(
  "medical-impairment-unknown",
  "medicalExclusion",
  "42 CFR 435.554(c)(5)(i)",
  "Unknown effect on compliance",
  [{ verifiedCategories: ["serious-or-complex"] }],
  {
    status: U,
    matched: null,
    missingIncludes: ["exclusions.medical.significantlyImpairsCompliance"],
  },
);
add(
  "medical-overall",
  "checkExclusions",
  "42 CFR 435.554(c)(5)",
  "Health criteria appear before activity tests",
  [
    exclusions({
      medical: {
        significantlyImpairsCompliance: true,
        verifiedCategories: ["serious-or-complex"],
      },
    }),
  ],
  { status: E, matched: true },
);

for (const [key, paragraph] of [
  ["under19DuringMonth", "1"],
  ["medicareDuringMonth", "2"],
  ["mandatoryGroupDuringMonth", "3"],
  ["excludedDuringMonth", "4"],
])
  add(
    `exception-${key}`,
    "checkMandatoryExceptions",
    `42 CFR 435.553(a)(${paragraph})`,
    "Part of the month is enough",
    ["2026-10", exceptions({ [key]: true })],
    { status: D, matched: true },
  );
for (const [start, end, status, matched] of [
  ["2026-07-01", "2026-07-01", D, true],
  ["2026-06-30", "2026-06-30", U, false],
  ["2026-06-01", "2026-07-01", D, true],
  ["2026-10-01", "2026-10-01", D, true],
  ["2026-10-02", "2026-10-02", U, false],
  ["2026-06-01", null, D, true],
])
  add(
    `inmate-${start}-${end}`,
    "checkMandatoryExceptions",
    "42 CFR 435.553(b)",
    "Three-month period includes its first and last day",
    ["2026-10", exceptions({ incarcerationPeriods: [{ start, end }] })],
    {
      status,
      matched,
      math: { lookbackStart: "2026-07-01", lookbackEnd: "2026-10-01" },
    },
  );
add(
  "inmate-december-window",
  "checkMandatoryExceptions",
  "42 CFR 435.553(b)",
  "Lookback crosses a year boundary",
  [
    "2027-01",
    exceptions({
      incarcerationPeriods: [{ start: "2026-10-01", end: "2026-10-01" }],
    }),
  ],
  { status: D, matched: true, math: { lookbackStart: "2026-10-01" } },
);
add(
  "exceptions-unknown",
  "checkMandatoryExceptions",
  "42 CFR 435.553",
  "Unknown past status stays unsure",
  ["2026-10", {}],
  {
    status: U,
    matched: null,
    missingIncludes: ["exceptions.incarcerationPeriods"],
  },
);
add(
  "exceptions-bad-month",
  "checkMandatoryExceptions",
  "42 CFR 435.553",
  "Invalid assessment month",
  ["2026-13", exceptions()],
  { status: U, matched: null, missing: ["month"] },
);
add(
  "inmate-invalid-period",
  "checkMandatoryExceptions",
  "42 CFR 435.553(b)",
  "Invalid institution date needs review",
  [
    "2026-10",
    exceptions({
      incarcerationPeriods: [{ start: "2026-09-31", end: "2026-10-01" }],
    }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["exceptions.incarcerationPeriods.dates"],
  },
);
add(
  "inmate-reversed-period",
  "checkMandatoryExceptions",
  "42 CFR 435.553(b)",
  "Reversed institution dates need review",
  [
    "2026-10",
    exceptions({
      incarcerationPeriods: [{ start: "2026-09-20", end: "2026-09-01" }],
    }),
  ],
  { status: U, matched: null },
);

for (const [credits, hours, status, matched] of [
  [0, 0, U, false],
  [0.5, 6.495, U, false],
  [6, 77.94, U, false],
  [6.1585, 79.998915, U, false],
  [6.1586, 80.000214, M, true],
])
  add(
    `credits-${credits}`,
    "educationHours",
    "42 CFR 435.552(d)(1)(i)–(ii)",
    "Exact credit math without rounding up to 80",
    ["2026-10", "2026-11-02", school({ credits })],
    {
      status,
      matched,
      hours,
      math: { credits, hoursPerCredit: 3, weeks: 4.33, hours },
    },
  );
for (const enrollment of ["half-time", "full-time"])
  add(
    `school-${enrollment}`,
    "educationHours",
    "42 CFR 435.552(a)(4), (c)",
    "School sets the status; half-time meets on its own",
    ["2026-10", "2026-11-02", school({ enrollment, credits: 1 })],
    { status: M, matched: true, hours: null, halfTime: true },
  );
add(
  "school-none",
  "educationHours",
  "42 CFR 435.552(c)",
  "Not enrolled",
  ["2026-10", "2026-11-02", { enrollment: "none" }],
  { status: U, matched: false, hours: 0 },
);
add(
  "school-unapproved",
  "educationHours",
  "42 CFR 435.552(b)",
  "Nonqualifying educational program",
  ["2026-10", "2026-11-02", school({ qualifyingProgram: false })],
  { status: U, matched: false, hours: 0 },
);
add(
  "school-unknown-status",
  "educationHours",
  "42 CFR 435.552(c)",
  "Do not infer half-time from credit count",
  ["2026-10", "2026-11-02", school({ enrollment: null, credits: 12 })],
  { status: U, matched: null, missingIncludes: ["education.enrollment"] },
);
add(
  "school-noncredit",
  "educationHours",
  "42 CFR 435.552(d)(2)",
  "Actual noncredit class and activity hours",
  [
    "2026-10",
    "2026-11-02",
    school({ usesCreditHours: false, actualHours: 80 }),
  ],
  { status: M, matched: true, hours: 80 },
);
add(
  "school-noncredit-short",
  "educationHours",
  "42 CFR 435.552(d)(2)",
  "Noncredit hours below 80",
  [
    "2026-10",
    "2026-11-02",
    school({ usesCreditHours: false, actualHours: 79.5 }),
  ],
  { status: U, matched: false, hours: 79.5 },
);
add(
  "school-break",
  "educationHours",
  "42 CFR 435.552(c)(2)–(3)",
  "Normal break continues prior status when registered for next regular term",
  [
    "2027-01",
    "2027-01-31",
    school({
      enrollment: "half-time",
      registeredForNextRegularTerm: true,
      normalBreak: true,
      nextRegularTermStart: "2027-02-01",
    }),
  ],
  { status: M, matched: true },
);
add(
  "school-term-end",
  "educationHours",
  "42 CFR 435.552(c)(3)",
  "Status continues through the term-end month",
  [
    "2026-12",
    "2026-12-31",
    school({ enrollment: "half-time", registeredForNextRegularTerm: false }),
  ],
  { status: M, matched: true },
);
add(
  "school-no-next-term",
  "educationHours",
  "42 CFR 435.552(c)(3)",
  "Not registered for next regular term",
  ["2027-01", "2027-01-31", school({ registeredForNextRegularTerm: false })],
  { status: U, matched: false, hours: 0 },
);
add(
  "school-not-normal-break",
  "educationHours",
  "42 CFR 435.552(c)(2)",
  "No normal break status",
  [
    "2027-01",
    "2027-01-31",
    school({ registeredForNextRegularTerm: true, normalBreak: false }),
  ],
  { status: U, matched: false },
);
add(
  "school-break-unknown",
  "educationHours",
  "42 CFR 435.552(c)(2)–(3)",
  "Unknown next regular term",
  ["2027-01", "2027-01-31", school()],
  {
    status: U,
    matched: null,
    missingIncludes: [
      "education.registeredForNextRegularTerm",
      "education.normalBreak",
    ],
  },
);
add(
  "school-break-date-unknown",
  "educationHours",
  "42 CFR 435.552(c)(2)–(3)",
  "A break needs the next regular term date",
  [
    "2027-01",
    "2027-01-31",
    school({ registeredForNextRegularTerm: true, normalBreak: true }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["education.nextRegularTermStart"],
  },
);
add(
  "school-stale-break",
  "educationHours",
  "42 CFR 435.552(c)(1)–(3)",
  "A prior break does not establish enrollment after the new term",
  [
    "2027-03",
    "2027-03-31",
    school({
      registeredForNextRegularTerm: true,
      normalBreak: true,
      nextRegularTermStart: "2027-02-01",
    }),
  ],
  { status: U, matched: null, missingIncludes: ["education.currentProgram"] },
);
add(
  "school-exit-month",
  "educationHours",
  "42 CFR 435.552(c)(3)",
  "Withdrawal keeps status through the exit month",
  [
    "2026-10",
    "2026-11-02",
    school({
      enrollment: "half-time",
      exitDate: "2026-10-10",
      continuesInAnotherProgram: false,
    }),
  ],
  { status: M, matched: true },
);
add(
  "school-after-exit",
  "educationHours",
  "42 CFR 435.552(c)(3)",
  "No carry after exit month",
  [
    "2026-11",
    "2026-11-30",
    school({ exitDate: "2026-10-10", continuesInAnotherProgram: false }),
  ],
  { status: U, matched: false, hours: 0 },
);
add(
  "school-other-program",
  "educationHours",
  "42 CFR 435.552(c)(3)",
  "Another program needs its own school record",
  [
    "2026-11",
    "2026-11-30",
    school({ exitDate: "2026-10-10", continuesInAnotherProgram: true }),
  ],
  { status: U, matched: null, missingIncludes: ["education.currentProgram"] },
);
add(
  "school-unknown-after-exit",
  "educationHours",
  "42 CFR 435.552(c)(3)",
  "Unknown continuation after graduation or exit",
  ["2026-11", "2026-11-30", school({ exitDate: "2026-10-10" })],
  {
    status: U,
    matched: null,
    missingIncludes: ["education.continuesInAnotherProgram"],
  },
);
add(
  "school-before-start",
  "educationHours",
  "42 CFR 435.552(c)(1)",
  "A registration is not enrollment before term starts",
  ["2026-07", "2026-11-02", school()],
  { status: U, matched: false, hours: 0 },
);
add(
  "school-start-later-this-month",
  "educationHours",
  "42 CFR 435.552(c)(1)",
  "A future term within the current month has not started",
  ["2026-10", "2026-10-02", school({ termStart: "2026-10-15" })],
  { status: U, matched: false, hours: 0 },
);
for (const [key, value] of [
  ["confirmed", false],
  ["qualifyingProgram", null],
  ["termStart", "bad"],
  ["termEnd", "2026-07-01"],
  ["exitDate", "bad"],
  ["usesCreditHours", null],
  ["credits", null],
  ["credits", -1],
  ["credits", 0.00001],
])
  add(
    `school-invalid-${key}-${value}`,
    "educationHours",
    "42 CFR 435.552(c)–(d)",
    "Unconfirmed or invalid school facts stay unsure",
    ["2026-10", "2026-11-02", school({ [key]: value })],
    { status: U, matched: null, missingIncludes: [`education.${key}`] },
  );
add(
  "school-actual-missing",
  "educationHours",
  "42 CFR 435.552(d)(2)",
  "Unknown noncredit hours",
  ["2026-10", "2026-11-02", school({ usesCreditHours: false })],
  { status: U, matched: null, missingIncludes: ["education.actualHours"] },
);
add(
  "school-future-month",
  "educationHours",
  "42 CFR 435.552(c)(1)",
  "Future school month not proved",
  ["2027-02", "2026-11-02", school()],
  { status: U, matched: null, missingIncludes: ["education.futureMonth"] },
);
add(
  "school-bad-date",
  "educationHours",
  "42 CFR 435.552(c)",
  "Invalid review date",
  ["2026-10", "bad", school()],
  { status: U, matched: null, missing: ["asOf"] },
);
add(
  "school-bad-month",
  "educationHours",
  "42 CFR 435.552(c)",
  "Invalid school month",
  ["bad", "2026-11-02", school()],
  { status: U, matched: null, missing: ["month"] },
);

for (const [amountCents, status, matched] of [
  [57999, S, false],
  [58000, M, true],
  [58001, M, true],
  [0, S, false],
  [-10000, S, false],
])
  add(
    `income-${amountCents}`,
    "incomeTest",
    "42 CFR 435.552(a)(6), (f)",
    "Income comparison uses exact cents",
    [income({ amountCents })],
    {
      status,
      matched,
      math: {
        amountCents,
        thresholdCents: 58000,
        hourlyWageCents: 725,
        hours: 80,
      },
    },
  );
add(
  "income-unconfirmed",
  "incomeTest",
  "42 CFR 435.552(f)(2)",
  "Unconfirmed income cannot produce Meets",
  [income({ amountCents: 999999, confirmed: false })],
  { status: U, matched: null, missingIncludes: ["income.confirmed"] },
);
add(
  "income-pay-only",
  "incomeTest",
  "42 CFR 435.552(f)(2)",
  "Pay shown is not silently treated as the Medicaid MAGI count",
  [income({ amountCents: 214000, basis: "pay-shown" })],
  {
    status: U,
    matched: null,
    missingIncludes: ["income.medicaidMagiCount"],
    math: { payShownCents: 214000, payAtOrAboveThreshold: true },
  },
);
for (const [key, value] of [
  ["amountCents", null],
  ["amountCents", 58000.5],
  ["basis", null],
])
  add(
    `income-invalid-${key}-${value}`,
    "incomeTest",
    "42 CFR 435.552(f)(2)",
    "Missing or invalid income count",
    [income({ [key]: value })],
    { status: U, matched: null, missingIncludes: [`income.${key}`] },
  );
add(
  "seasonal-exact",
  "seasonalIncomeTest",
  "42 CFR 435.552(a)(7), (g)",
  "Six prior months average exactly $580",
  ["2026-10", seasonal()],
  {
    status: M,
    matched: true,
    math: { totalCents: 348000, averageCents: 58000 },
  },
);
add(
  "seasonal-zero-months",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "A seasonal worker can have zero-income months",
  ["2026-10", seasonal([0, 0, 0, 116000, 116000, 116000])],
  { status: M, matched: true, math: { totalCents: 348000 } },
);
add(
  "seasonal-one-cent-short",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "Do not round a six-month average up",
  ["2026-10", seasonal([58000, 58000, 58000, 58000, 58000, 57999])],
  { status: S, matched: false, math: { totalCents: 347999 } },
);
add(
  "seasonal-not-qualified",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)(1)",
  "High past income does not prove seasonal status",
  ["2026-10", { qualifiesUnder45R: false }],
  { status: U, matched: false },
);
add(
  "seasonal-unknown-status",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)(1)",
  "Seasonal classification needs proof",
  ["2026-10", seasonal(undefined, { qualifiesUnder45R: null })],
  { status: U, matched: null, missingIncludes: ["seasonal.qualifiesUnder45R"] },
);
add(
  "seasonal-missing-month",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "All six months, not five",
  ["2026-10", seasonal(undefined, { months: seasonal().months.slice(1) })],
  { status: U, matched: null, missingIncludes: ["seasonal.months.2026-04"] },
);
add(
  "seasonal-duplicate-month",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "Duplicate income month must be resolved",
  [
    "2026-10",
    seasonal(undefined, {
      months: [...seasonal().months, seasonal().months[0]],
    }),
  ],
  { status: U, matched: null, missingIncludes: ["seasonal.months.2026-04"] },
);
add(
  "seasonal-no-records",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "No income history",
  ["2026-10", { qualifiesUnder45R: true }],
  { status: U, matched: null },
);
add(
  "seasonal-unconfirmed-month",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "An unconfirmed prior month cannot support an average",
  [
    "2026-10",
    seasonal(undefined, {
      months: seasonal().months.map((record, i) =>
        i === 0 ? { ...record, confirmed: false } : record,
      ),
    }),
  ],
  { status: U, matched: null, missingIncludes: ["seasonal.months.2026-04"] },
);
add(
  "seasonal-bad-month",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)",
  "Invalid reference month",
  ["bad", seasonal()],
  { status: U, matched: null, missing: ["month"] },
);
for (const [amountCents, hours] of [
  [0, 0],
  [7250, 10],
  [14500, 20],
  [29000, 40],
  [57999, 79.99862],
])
  add(
    `derived-${amountCents}`,
    "incomeDerivedHours",
    "42 CFR 435.552(e)(2)(i)–(ii)",
    "Income-derived hours use the federal wage and do not round up",
    [state({ incomeDerivedHours: true }), income({ amountCents })],
    { status: S, matched: true, hours },
  );
add(
  "derived-no-option",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "State declined income-derived hours",
  [state(), income({ amountCents: 29000 })],
  { status: U, matched: false, hours: 0 },
);
add(
  "derived-hours-recorded",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Do not replace or add to documented work hours",
  [
    state({ incomeDerivedHours: true }),
    income({ amountCents: 29000, hoursDocumented: true }),
  ],
  { status: U, matched: false, hours: 0 },
);
add(
  "derived-income-580",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "At $580 use the income test instead",
  [state({ incomeDerivedHours: true }), income({ amountCents: 58000 })],
  { status: U, matched: false, hours: 0 },
);
add(
  "derived-policy-unverified",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "A draft state option cannot enable hours",
  [
    state({ verified: false, incomeDerivedHours: true }),
    income({ amountCents: 29000 }),
  ],
  { status: U, matched: null, missingIncludes: ["state.verified"] },
);
add(
  "derived-option-unknown",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Unknown state option",
  [state({ incomeDerivedHours: null }), income({ amountCents: 29000 })],
  { status: U, matched: null, missingIncludes: ["state.incomeDerivedHours"] },
);
add(
  "derived-records-unknown",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Unknown hours documentation",
  [
    state({ incomeDerivedHours: true }),
    income({ amountCents: 29000, hoursDocumented: null }),
  ],
  { status: U, matched: null, missingIncludes: ["income.hoursDocumented"] },
);
add(
  "derived-household-unknown",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Unknown household worker allocation",
  [
    state({ incomeDerivedHours: true }),
    income({ amountCents: 29000, householdWorkers: null }),
  ],
  { status: U, matched: null, missingIncludes: ["income.householdWorkers"] },
);
add(
  "derived-household-needs-split",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Do not assign all household hours to one member",
  [
    state({ incomeDerivedHours: true }),
    income({ amountCents: 29000, householdWorkers: 2 }),
  ],
  { status: U, matched: null, missingIncludes: ["income.stateAllocation"] },
);
add(
  "derived-household-approved",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Use a state-verified reasonable allocation",
  [
    state({ incomeDerivedHours: true }),
    income({
      amountCents: 29000,
      householdWorkers: 2,
      stateAllocatedHours: 20,
      allocationVerified: true,
    }),
  ],
  { status: S, matched: true, hours: 20 },
);
add(
  "derived-household-excess",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)",
  "Allocation cannot exceed household-derived total",
  [
    state({ incomeDerivedHours: true }),
    income({
      amountCents: 29000,
      householdWorkers: 2,
      stateAllocatedHours: 41,
      allocationVerified: true,
    }),
  ],
  { status: U, matched: null },
);
add(
  "derived-loss",
  "incomeDerivedHours",
  "42 CFR 435.552(e)(2)(i)–(ii)",
  "A negative income count cannot establish positive hours",
  [state({ incomeDerivedHours: true }), income({ amountCents: -100 })],
  { status: U, matched: null, missingIncludes: ["income.actualHours"] },
);

const hardshipArgs = (
  policy = {},
  facts = {},
  m = "2026-10",
  asOf = "2026-11-02",
) => [m, asOf, state(policy), facts];
add(
  "hardship-not-elected",
  "checkHardship",
  "42 CFR 435.555(a)",
  "A disaster alone cannot elect a state hardship",
  hardshipArgs({}, { disasters: [disaster()] }),
  { status: U, matched: false },
);
add(
  "hardship-unverified",
  "checkHardship",
  "42 CFR 435.555(a)",
  "Draft state policy cannot grant a hardship",
  hardshipArgs(
    { verified: false, disasterHardship: true },
    { disasters: [disaster()] },
  ),
  { status: U, matched: null, missingIncludes: ["state.verified"] },
);
for (const declarationType of ["DR", "EM"])
  add(
    `disaster-${declarationType}`,
    "checkHardship",
    "42 CFR 435.555(d)(2)(iv), (e)",
    "Presidential declaration covers every incident month",
    hardshipArgs(
      { disasterHardship: true },
      { disasters: [disaster({ declarationType })] },
    ),
    { status: D, matched: true },
  );
add(
  "disaster-fm",
  "checkHardship",
  "42 CFR 435.555(d)(2)",
  "Fire management declaration is not DR or EM",
  hardshipArgs(
    { disasterHardship: true },
    { disasters: [disaster({ declarationType: "FM" })] },
  ),
  { status: U, matched: false },
);
add(
  "disaster-other-county",
  "checkHardship",
  "42 CFR 435.555(d)(2)",
  "County must match residence",
  hardshipArgs(
    { disasterHardship: true },
    { disasters: [disaster({ countyMatchesResidence: false })] },
  ),
  { status: U, matched: false },
);
add(
  "disaster-before-start",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "No incident in an earlier month",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({ incidentStart: "2026-11-01", incidentEnd: "2026-11-02" }),
      ],
    },
  ),
  { status: U, matched: false },
);
add(
  "disaster-end-month",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "One incident day includes its whole end month",
  hardshipArgs(
    { disasterHardship: true },
    { disasters: [disaster({ incidentEnd: "2026-10-01" })] },
  ),
  { status: D, matched: true },
);
add(
  "disaster-after-end",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "No automatic month after the incident end",
  hardshipArgs(
    { disasterHardship: true },
    { disasters: [disaster({ incidentEnd: "2026-09-30" })] },
  ),
  { status: U, matched: false },
);
add(
  "disaster-extension",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "CMS-approved extension can cover a later month",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({
          incidentEnd: "2026-09-30",
          cmsExtendedThrough: "2026-10-15",
        }),
      ],
    },
  ),
  { status: D, matched: true },
);
add(
  "disaster-expired-extension",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "An extension is limited to its approved months",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({
          incidentEnd: "2026-09-20",
          cmsExtendedThrough: "2026-09-30",
        }),
      ],
    },
  ),
  { status: U, matched: false },
);
add(
  "disaster-open",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "Ongoing incident verified in the assessment month",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({
          incidentEnd: null,
          ongoing: true,
          verifiedThrough: "2026-10-15",
        }),
      ],
    },
  ),
  { status: D, matched: true },
);
add(
  "disaster-stale-open",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "Old open-incident data does not prove a new month",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({
          incidentEnd: null,
          ongoing: true,
          verifiedThrough: "2026-09-30",
        }),
      ],
    },
  ),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.disaster.verifiedThrough"],
  },
);
add(
  "disaster-nea",
  "checkHardship",
  "42 CFR 435.555(d)(2)(i)–(iii)",
  "National emergency must affect compliance and be notified to CMS",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({
          declarationType: "NEA",
          neaAffectsCompliance: true,
          stateNotifiedCms: true,
        }),
      ],
    },
  ),
  { status: D, matched: true },
);
add(
  "disaster-nea-unaffected",
  "checkHardship",
  "42 CFR 435.555(d)(2)(i)",
  "National declaration alone is not enough",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({
          declarationType: "NEA",
          neaAffectsCompliance: false,
          stateNotifiedCms: true,
        }),
      ],
    },
  ),
  { status: U, matched: false },
);
add(
  "disaster-nea-notice-unknown",
  "checkHardship",
  "42 CFR 435.555(d)(2)(ii)",
  "Unknown state notice to CMS",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({ declarationType: "NEA", neaAffectsCompliance: true }),
      ],
    },
  ),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.disaster.stateNotifiedCms"],
  },
);
for (const [key, value] of [
  ["declarationType", null],
  ["countyMatchesResidence", null],
  ["incidentStart", "bad"],
  ["incidentEnd", "bad"],
])
  add(
    `disaster-missing-${key}`,
    "checkHardship",
    "42 CFR 435.555(d)(2)",
    "Unknown disaster fact",
    hardshipArgs(
      { disasterHardship: true },
      { disasters: [disaster({ [key]: value })] },
    ),
    { status: U, matched: null, missingIncludes: [`hardship.disaster.${key}`] },
  );
add(
  "disaster-extension-unknown",
  "checkHardship",
  "42 CFR 435.555(d)(2)(iv)",
  "Do not assume a CMS extension",
  hardshipArgs(
    { disasterHardship: true },
    {
      disasters: [
        disaster({ incidentEnd: "2026-09-30", cmsExtendedThrough: undefined }),
      ],
    },
  ),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.disaster.cmsExtendedThrough"],
  },
);
add(
  "disaster-no-feed",
  "checkHardship",
  "42 CFR 435.555(d)(2)",
  "Failed county lookup stays unsure",
  hardshipArgs({ disasterHardship: true }),
  { status: U, matched: null, missingIncludes: ["hardship.disasters"] },
);
const rates = (patch = {}) => ({
  countyRate: 6,
  nationalRate: 4,
  appliesToMonth: "2026-10",
  countyMatchesResidence: true,
  cmsApprovedForMonth: true,
  ...patch,
});
for (const [countyRate, nationalRate, status, matched, thresholdPercent] of [
  [6, 4, D, true, 6],
  [5.99, 4, U, false, 6],
  [8, 6, D, true, 8],
  [7.99, 6, U, false, 8],
  [6.15, 4.1, D, true, 6.15],
])
  add(
    `unemployment-${countyRate}-${nationalRate}`,
    "checkHardship",
    "42 CFR 435.555(d)(3)(i)–(ii)",
    "Rate is compared with the lesser threshold",
    hardshipArgs(
      { unemploymentHardship: true },
      { unemployment: rates({ countyRate, nationalRate }) },
    ),
    { status, matched, ...(matched ? { math: { thresholdPercent } } : {}) },
  );
add(
  "unemployment-approval-needed",
  "checkHardship",
  "42 CFR 435.555(d)(3)",
  "High unemployment is not itself CMS approval",
  hardshipArgs(
    { unemploymentHardship: true },
    { unemployment: rates({ cmsApprovedForMonth: false }) },
  ),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.unemployment.cmsApprovedForMonth"],
  },
);
for (const [key, value] of [
  ["countyRate", null],
  ["nationalRate", null],
  ["countyRate", 101],
  ["appliesToMonth", "2026-09"],
  ["countyMatchesResidence", null],
])
  add(
    `unemployment-missing-${key}-${value}`,
    "checkHardship",
    "42 CFR 435.555(d)(3)",
    "Rate, period and residence must be established",
    hardshipArgs(
      { unemploymentHardship: true },
      { unemployment: rates({ [key]: value }) },
    ),
    {
      status: U,
      matched: null,
      missingIncludes: [`hardship.unemployment.${key}`],
    },
  );
add(
  "unemployment-other-county",
  "checkHardship",
  "42 CFR 435.555(d)(3)",
  "Wrong county rate does not apply",
  hardshipArgs(
    { unemploymentHardship: true },
    { unemployment: rates({ countyMatchesResidence: false }) },
  ),
  { status: U, matched: false },
);
add(
  "unemployment-no-feed",
  "checkHardship",
  "42 CFR 435.555(d)(3)",
  "Missing rate lookup",
  hardshipArgs({ unemploymentHardship: true }),
  { status: U, matched: null, missingIncludes: ["hardship.unemployment"] },
);
add(
  "inpatient-granted",
  "checkHardship",
  "42 CFR 435.555(d)(1)",
  "Requested care exception granted by state",
  hardshipArgs(
    { inpatientHardship: true },
    { inpatient: { qualifyingCareDuringMonth: true, requestGranted: true } },
  ),
  { status: D, matched: true },
);
add(
  "inpatient-pending",
  "checkHardship",
  "42 CFR 435.555(d)(1)",
  "A care event without a granted request stays unsure",
  hardshipArgs(
    { inpatientHardship: true },
    { inpatient: { qualifyingCareDuringMonth: true, requestGranted: false } },
  ),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.inpatient.requestGranted"],
  },
);
add(
  "inpatient-no-event",
  "checkHardship",
  "42 CFR 435.555(d)(1)",
  "No qualifying care event",
  hardshipArgs(
    { inpatientHardship: true },
    { inpatient: { qualifyingCareDuringMonth: false } },
  ),
  { status: U, matched: false },
);
add(
  "inpatient-unknown",
  "checkHardship",
  "42 CFR 435.555(d)(1)",
  "Unknown qualifying care",
  hardshipArgs({ inpatientHardship: true }),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.inpatient.qualifyingCareDuringMonth"],
  },
);
const travel = (patch = {}) => ({
  qualifyingTravelDuringMonth: true,
  memberTravels: true,
  dependentTravels: false,
  leaveForDependentCareOrTravel: false,
  requestGranted: true,
  ...patch,
});
add(
  "travel-member",
  "checkHardship",
  "42 CFR 435.555(d)(4)",
  "Member must travel for qualifying care",
  hardshipArgs({ medicalTravelHardship: true }, { medicalTravel: travel() }),
  { status: D, matched: true },
);
add(
  "travel-dependent-no-member",
  "checkHardship",
  "42 CFR 435.555(d)(4)(i)",
  "Dependent travels while member takes related leave",
  hardshipArgs(
    { medicalTravelHardship: true },
    {
      medicalTravel: travel({
        memberTravels: false,
        dependentTravels: true,
        leaveForDependentCareOrTravel: true,
      }),
    },
  ),
  { status: D, matched: true },
);
add(
  "travel-dependent-no-leave",
  "checkHardship",
  "42 CFR 435.555(d)(4)(i)",
  "Nontraveling member must show leave or absence",
  hardshipArgs(
    { medicalTravelHardship: true },
    { medicalTravel: travel({ memberTravels: false, dependentTravels: true }) },
  ),
  { status: U, matched: false },
);
add(
  "travel-pending",
  "checkHardship",
  "42 CFR 435.555(d)(4)",
  "Travel request not yet granted",
  hardshipArgs(
    { medicalTravelHardship: true },
    { medicalTravel: travel({ requestGranted: false }) },
  ),
  {
    status: U,
    matched: null,
    missingIncludes: ["hardship.medicalTravel.requestGranted"],
  },
);
add(
  "travel-unknown",
  "checkHardship",
  "42 CFR 435.555(d)(4)",
  "Unknown medical travel facts",
  hardshipArgs({ medicalTravelHardship: true }),
  { status: U, matched: null },
);
add(
  "hardship-option-unknown",
  "checkHardship",
  "42 CFR 435.555(a)",
  "Unknown elected option",
  hardshipArgs({ disasterHardship: null }),
  { status: U, matched: null, missingIncludes: ["state.disasterHardship"] },
);
add(
  "hardship-future",
  "checkHardship",
  "42 CFR 435.555(a)",
  "Future hardship month not proved",
  hardshipArgs({}, {}, "2026-12"),
  { status: U, matched: null, missingIncludes: ["hardship.futureMonth"] },
);
add(
  "hardship-bad-month",
  "checkHardship",
  "42 CFR 435.555(a)",
  "Invalid hardship month",
  hardshipArgs({}, {}, "bad"),
  { status: U, matched: null, missing: ["month"] },
);
add(
  "hardship-bad-date",
  "checkHardship",
  "42 CFR 435.555(a)",
  "Invalid hardship review date",
  hardshipArgs({}, {}, "2026-10", "bad"),
  { status: U, matched: null, missing: ["asOf"] },
);

const activity = (patch = {}) => month(patch);
add(
  "work-80",
  "combineHours",
  "42 CFR 435.552(a)(1), (b)",
  "Confirmed paid, in-kind or unpaid work hours count",
  [activity({ evidence: [work()] })],
  { status: M, matched: true, hours: 80 },
);
add(
  "work-unpaid",
  "combineHours",
  "42 CFR 435.552(b)",
  "Unpaid work outside community service may count",
  [activity({ evidence: [work({ organization: null })] })],
  { status: M, hours: 80 },
);
add(
  "work-short",
  "combineHours",
  "42 CFR 435.552(e)(4)",
  "A confirmed complete total can be Short",
  [activity({ evidence: [work({ hours: 61 })] })],
  { status: S, hours: 61, math: { gapHours: 19 } },
);
add(
  "work-proposed",
  "combineHours",
  "42 CFR 435.557(b)(2)",
  "App policy: proposed hours do not count",
  [activity({ evidence: [work({ status: "proposed" })] })],
  {
    status: U,
    matched: null,
    hours: 0,
    missingIncludes: ["evidence.work-1.confirmed"],
  },
);
add(
  "work-rejected",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Rejected app evidence is not counted",
  [activity({ evidence: [work({ status: "rejected" })] })],
  { status: S, hours: 0 },
);
add(
  "income-not-activity",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "An income line is not an extra set of work hours",
  [activity({ evidence: [work({ kind: "income" })] })],
  { status: S, hours: 0 },
);
add(
  "activity-other-month",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Hours belong to the month worked",
  [activity({ evidence: [work({ start: "2026-09-01", end: "2026-09-30" })] })],
  { status: S, hours: 0 },
);
add(
  "activity-next-month",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Hours from a later month are not this month",
  [activity({ evidence: [work({ start: "2026-11-01", end: "2026-11-02" })] })],
  { status: S, hours: 0 },
);
add(
  "activity-cross-month",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "No invented split of cross-month hours",
  [activity({ evidence: [work({ start: "2026-09-30" })] })],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.monthlySplit"] },
);
add(
  "activity-future",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Future scheduled hours are not completed hours",
  [activity({ asOf: "2026-10-10", evidence: [work()] })],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.completedDates"] },
);
add(
  "activity-duplicate-id",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Repeated versions cannot double count hours",
  [
    activity({
      evidence: [work({ hours: 40 }), work({ hours: 40, version: 2 })],
    }),
  ],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.duplicate"] },
);
add(
  "activity-duplicate-period",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Same employer and period needs a duplicate review",
  [
    activity({
      evidence: [
        work({ hours: 40 }),
        work({ id: "work-2", hours: 40, organization: " workplace " }),
      ],
    }),
  ],
  { status: U, hours: 0, missingIncludes: ["evidence.work-2.duplicate"] },
);
add(
  "activity-separate-organizations",
  "combineHours",
  "42 CFR 435.552(e)(4)",
  "Separate confirmed work may be added",
  [
    activity({
      evidence: [
        work({ hours: 40 }),
        work({ id: "work-2", organization: "Other workplace", hours: 40 }),
      ],
    }),
  ],
  { status: M, hours: 80 },
);
add(
  "activity-incomplete",
  "combineHours",
  "42 CFR 435.557(b)(2)",
  "Missing evidence is not a known Short total",
  [activity({ evidenceComplete: false })],
  { status: U, matched: null, missingIncludes: ["evidenceComplete"] },
);
add(
  "activity-no-hours",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Unknown work hours do not become zero-confirmed hours",
  [activity({ evidence: [work({ hours: null })] })],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.hours"] },
);
add(
  "activity-negative-hours",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Negative work hours need correction",
  [activity({ evidence: [work({ hours: -1 })] })],
  { status: U, hours: 0 },
);
add(
  "activity-bad-dates",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Bad activity dates need correction",
  [activity({ evidence: [work({ end: "2026-02-30" })] })],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.dates"] },
);
add(
  "activity-bad-version",
  "combineHours",
  "42 CFR 435.557(b)(2)",
  "Unversioned evidence needs review",
  [activity({ evidence: [work({ version: 0 })] })],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.version"] },
);
add(
  "service-80",
  "combineHours",
  "42 CFR 435.552(a)(2), (b)",
  "Structured confirmed community service counts",
  [activity({ evidence: [service()] })],
  { status: M, hours: 80 },
);
for (const field of [
  "unpaid",
  "directCommunityBenefit",
  "publicOrNonprofit",
  "structuredAndSupervised",
  "nonpartisan",
  "tracksDatesAndHours",
]) {
  add(
    `service-not-${field}`,
    "combineHours",
    "42 CFR 435.552(b)",
    `Community service must be ${field}`,
    [
      activity({
        evidence: [
          service({ service: { ...service().service, [field]: false } }),
        ],
      }),
    ],
    { status: S, hours: 0, math: { excluded: ["service-1"] } },
  );
  add(
    `service-unknown-${field}`,
    "combineHours",
    "42 CFR 435.552(b)",
    `Unknown community service fact: ${field}`,
    [
      activity({
        evidence: [
          service({ service: { ...service().service, [field]: null } }),
        ],
      }),
    ],
    {
      status: U,
      hours: 0,
      missingIncludes: [`evidence.service-1.service.${field}`],
    },
  );
}
add(
  "service-no-contact",
  "combineHours",
  "42 CFR 435.552(b)",
  "A confirmation contact is required",
  [
    activity({
      evidence: [
        service({ service: { ...service().service, confirmationContact: "" } }),
      ],
    }),
  ],
  {
    status: U,
    hours: 0,
    missingIncludes: ["evidence.service-1.service.confirmationContact"],
  },
);
for (const approvedType of [
  "wioa",
  "trade-act",
  "veterans",
  "snap-partnership",
])
  add(
    `program-${approvedType}`,
    "combineHours",
    "42 CFR 435.552(b)",
    `Approved work program: ${approvedType}`,
    [activity({ evidence: [program({ program: { approvedType } })] })],
    { status: M, hours: 80 },
  );
add(
  "job-search-no",
  "combineHours",
  "42 CFR 435.552(b)",
  "Standalone job search does not count",
  [
    activity({
      evidence: [program({ program: { approvedType: "job-search" } })],
    }),
  ],
  { status: S, hours: 0 },
);
for (const [fraction, status, hours] of [
  [0, M, 80],
  [0.49, M, 80],
  [0.5, S, 0],
  [1, S, 0],
])
  add(
    `program-subsidiary-${fraction}`,
    "combineHours",
    "42 CFR 435.552(b)",
    "State-approved subsidiary job search must be less than half",
    [
      activity({
        evidence: [
          program({
            program: {
              approvedType: "state-approved",
              subsidiaryJobSearchFraction: fraction,
            },
          }),
        ],
      }),
    ],
    { status, hours },
  );
for (const fraction of [null, -1, 2])
  add(
    `program-ratio-invalid-${fraction}`,
    "combineHours",
    "42 CFR 435.552(b)",
    "Unknown or invalid program composition",
    [
      activity({
        evidence: [
          program({
            program: {
              approvedType: "state-approved",
              subsidiaryJobSearchFraction: fraction,
            },
          }),
        ],
      }),
    ],
    { status: U, hours: 0 },
  );
add(
  "program-unknown",
  "combineHours",
  "42 CFR 435.552(b)",
  "A program label is not proof of an approved type",
  [activity({ evidence: [program({ program: { approvedType: null } })] })],
  {
    status: U,
    hours: 0,
    missingIncludes: ["evidence.program-1.program.approvedType"],
  },
);
add(
  "daniel-combined",
  "combineHours",
  "42 CFR 435.552(d)(1), (e)(4)",
  "Daniel: six credits and 20 work hours",
  [activity({ education: school(), evidence: [work({ hours: 20 })] })],
  { status: M, hours: 97.94, math: { education: 77.94, work: 20 } },
);
add(
  "education-half-no-combine",
  "combineHours",
  "42 CFR 435.552(a)(4)–(5), (e)(1)",
  "Half-time status meets independently, with no invented 80 school hours",
  [
    activity({
      education: school({ enrollment: "half-time" }),
      evidence: [work({ hours: 20 })],
    }),
  ],
  { status: M, halfTime: true, hours: null },
);
add(
  "derived-plus-service",
  "combineHours",
  "42 CFR 435.552(e)(2), (e)(4)",
  "State-derived work and community service can combine",
  [
    activity({
      state: state({ incomeDerivedHours: true }),
      income: income({ amountCents: 29000 }),
      evidence: [service({ hours: 40 })],
    }),
  ],
  { status: M, hours: 80, math: { incomeDerivedWork: 40, service: 40 } },
);
add(
  "derived-not-plus-recorded-work",
  "combineHours",
  "42 CFR 435.552(e)(2)(i)",
  "Recorded work hours prevent adding hours from the same income",
  [
    activity({
      state: state({ incomeDerivedHours: true }),
      income: income({ amountCents: 29000 }),
      evidence: [work({ hours: 40 })],
    }),
  ],
  { status: S, hours: 40, math: { incomeDerivedWork: 0, work: 40 } },
);
add(
  "activity-future-month",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Future activity month not proved",
  [activity({ month: "2027-01" })],
  { status: U, hours: null, missingIncludes: ["evidence.futureMonth"] },
);
add(
  "activity-bad-month",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Invalid activity month",
  [activity({ month: "bad" })],
  { status: U, hours: null, missing: ["month"] },
);
add(
  "activity-bad-review-date",
  "combineHours",
  "42 CFR 435.552(e)(2)",
  "Invalid activity review date",
  [activity({ asOf: "bad" })],
  { status: U, hours: null, missing: ["asOf"] },
);

for (const [requiredMonths, months] of [
  [1, ["2026-12"]],
  [2, ["2026-11", "2026-12"]],
  [3, ["2026-10", "2026-11", "2026-12"]],
])
  add(
    `application-lookback-${requiredMonths}`,
    "lookbackWindow",
    "42 CFR 435.556(a)(1)",
    "Application needs consecutive months immediately before application",
    [
      {
        kind: "application",
        dueDate: "2027-01-10",
        requiredMonths,
        policyVerified: true,
      },
    ],
    {
      status: U,
      months,
      requiredCount: requiredMonths,
      selectedMonths: months,
    },
  );
for (const count of [0, 4, 1.5, null])
  add(
    `application-invalid-${count}`,
    "lookbackWindow",
    "42 CFR 435.556(a)(1)",
    "State application option is bounded by federal law",
    [
      {
        kind: "application",
        dueDate: "2027-01-10",
        requiredMonths: count,
        policyVerified: true,
      },
    ],
    {
      status: U,
      requiredCount: null,
      missingIncludes: ["lookback.requiredMonths"],
    },
  );
add(
  "renewal-one-not-all",
  "lookbackWindow",
  "42 CFR 435.556(a)(2)(i), (b)",
  "One required month does not make every candidate month mandatory",
  [
    {
      kind: "renewal",
      startDate: "2026-07-01",
      dueDate: "2026-12-31",
      requiredMonths: 1,
      policyVerified: true,
    },
  ],
  {
    status: U,
    requiredCount: 1,
    months: ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"],
    selectedMonths: null,
  },
);
add(
  "renewal-nonconsecutive",
  "lookbackWindow",
  "42 CFR 435.556(a)(2)(i)",
  "State-selected renewal months need not be consecutive",
  [
    {
      kind: "renewal",
      startDate: "2026-07-01",
      dueDate: "2026-12-31",
      requiredMonths: 2,
      policyVerified: true,
      selectedMonths: ["2026-07", "2026-12"],
    },
  ],
  { status: U, requiredCount: 2, selectedMonths: ["2026-07", "2026-12"] },
);
add(
  "frequent-check-window",
  "lookbackWindow",
  "42 CFR 435.556(a)(2)(ii), (b)",
  "More frequent check cannot reach before last demonstration",
  [
    {
      kind: "frequent-check",
      startDate: "2026-10-01",
      dueDate: "2026-11-30",
      requiredMonths: 1,
      policyVerified: true,
    },
  ],
  { status: U, months: ["2026-10", "2026-11"], requiredCount: 1 },
);
add(
  "change-window",
  "lookbackWindow",
  "42 CFR 435.556(a)(2)(iii)",
  "Change window ends before the month applicability begins",
  [
    {
      kind: "change",
      startDate: "2026-07-01",
      dueDate: "2026-10-12",
      requiredMonths: 1,
      policyVerified: true,
    },
  ],
  { status: U, months: ["2026-07", "2026-08", "2026-09"] },
);
add(
  "lookback-unknown-policy",
  "lookbackWindow",
  "42 CFR 435.556(a)",
  "Unknown state choice cannot be guessed",
  [{ kind: "application", dueDate: "2027-01-01", requiredMonths: 1 }],
  { status: U, requiredCount: null, missing: ["lookback.policyVerified"] },
);
add(
  "lookback-too-many",
  "lookbackWindow",
  "42 CFR 435.556(b)",
  "State cannot require more months than the enrollment period",
  [
    {
      kind: "renewal",
      dueDate: "2026-10-31",
      startDate: "2026-10-01",
      requiredMonths: 2,
      policyVerified: true,
    },
  ],
  {
    status: U,
    requiredCount: null,
    missingIncludes: ["lookback.requiredMonths"],
  },
);
add(
  "lookback-outside-month",
  "lookbackWindow",
  "42 CFR 435.556(b)",
  "Selected month must be inside the period",
  [
    {
      kind: "renewal",
      dueDate: "2026-10-31",
      startDate: "2026-10-01",
      requiredMonths: 1,
      policyVerified: true,
      selectedMonths: ["2026-09"],
    },
  ],
  {
    status: U,
    requiredCount: null,
    missingIncludes: ["lookback.selectedMonths"],
  },
);
add(
  "lookback-bad-start",
  "lookbackWindow",
  "42 CFR 435.556(b)",
  "Period cannot run backwards",
  [
    {
      kind: "renewal",
      dueDate: "2026-10-31",
      startDate: "2026-11-01",
      requiredMonths: 1,
      policyVerified: true,
    },
  ],
  { status: U, requiredCount: null, missingIncludes: ["lookback.startDate"] },
);
add(
  "lookback-bad-due",
  "lookbackWindow",
  "42 CFR 435.556(a)",
  "Invalid due date",
  [
    {
      kind: "renewal",
      dueDate: "bad",
      requiredMonths: 1,
      policyVerified: true,
    },
  ],
  { status: U, requiredCount: null, missing: ["lookback.dueDate"] },
);
add(
  "lookback-bad-kind",
  "lookbackWindow",
  "42 CFR 435.556(a)",
  "Unknown window kind",
  [
    {
      kind: "invented",
      dueDate: "2026-10-31",
      requiredMonths: 1,
      policyVerified: true,
    },
  ],
  { status: U, requiredCount: null, missing: ["lookback.kind"] },
);

for (const [date, available, policy] of [
  ["2027-12-31", true, "documentation-or-other-information"],
  ["2028-01-01", true, "documentation-required"],
  ["2028-01-01", false, "other-information-must-be-accepted"],
])
  add(
    `documentation-${date}-${available}`,
    "documentationEra",
    "42 CFR 435.557(b)(2)(i)–(iii)",
    "Documentation transition and unavailable-document protection",
    [
      {
        date,
        kind: "general",
        reliableStateData: false,
        reasonablyAvailable: available,
      },
    ],
    { status: U, policy },
  );
add(
  "documentation-state-data",
  "documentationEra",
  "42 CFR 435.557(b), (c)(1)(i)",
  "Check state data before asking member for documents",
  [{ date: "2028-01-01", kind: "general", reliableStateData: true }],
  { status: U, policy: "state-data-first" },
);
add(
  "documentation-unknown-data",
  "documentationEra",
  "42 CFR 435.557(b)",
  "Unknown state data availability",
  [{ date: "2028-01-01", kind: "general" }],
  { status: U, policy: null, missing: ["documentation.reliableStateData"] },
);
add(
  "documentation-unknown-availability",
  "documentationEra",
  "42 CFR 435.557(b)(2)(ii)–(iii)",
  "Do not assume documents exist",
  [{ date: "2028-01-01", kind: "general", reliableStateData: false }],
  { status: U, policy: null, missing: ["documentation.reasonablyAvailable"] },
);
add(
  "documentation-medical-before",
  "documentationEra",
  "42 CFR 435.557(f)(1)(i)",
  "Before 2028 a state may accept a sworn health statement at each check",
  [{ date: "2027-12-31", kind: "medical-frailty", reliableStateData: false }],
  { status: U, policy: "medical-statement-option-each-check" },
);
add(
  "documentation-medical-once",
  "documentationEra",
  "42 CFR 435.557(f)(1)(ii)",
  "From 2028 the statement option is once per enrollment",
  [
    {
      date: "2028-01-01",
      kind: "medical-frailty",
      reliableStateData: false,
      medicalStatementUsedThisEnrollment: false,
      firstRenewalAfterMedicalStatement: false,
    },
  ],
  { status: U, policy: "medical-statement-option-once" },
);
for (const [key, paragraph] of [
  ["medicalStatementUsedThisEnrollment", "B"],
  ["firstRenewalAfterMedicalStatement", "A"],
])
  add(
    `documentation-medical-${key}`,
    "documentationEra",
    `42 CFR 435.557(f)(1)(ii)(${paragraph})`,
    "Follow-up health verification requires data or documents",
    [
      {
        date: "2028-01-01",
        kind: "medical-frailty",
        reliableStateData: false,
        [key]: true,
      },
    ],
    { status: U, policy: "medical-data-or-documentation" },
  );
add(
  "documentation-medical-unknown",
  "documentationEra",
  "42 CFR 435.557(f)(1)(ii)",
  "Unknown prior use of a sworn statement",
  [{ date: "2028-01-01", kind: "medical-frailty", reliableStateData: false }],
  {
    status: U,
    policy: null,
    missing: ["documentation.medicalStatementHistory"],
  },
);
add(
  "documentation-bad-kind",
  "documentationEra",
  "42 CFR 435.557(b)(2)",
  "Unknown documentation path",
  [{ date: "2028-01-01", kind: "invented", reliableStateData: false }],
  { status: U, policy: null, missing: ["documentation.kind"] },
);
add(
  "documentation-bad-date",
  "documentationEra",
  "42 CFR 435.557(b)(2)",
  "Invalid date cannot choose an era",
  [{ date: "2028-02-30", kind: "general" }],
  { status: U, policy: null, missing: ["documentation.date"] },
);

for (const [printedDate, received, deadline] of [
  ["2026-11-27", "2026-12-02", "2027-01-01"],
  ["2028-02-25", "2028-03-01", "2028-03-31"],
  ["2026-12-31", "2027-01-05", "2027-02-04"],
  ["2026-02-01", "2026-02-06", "2026-03-08"],
])
  add(
    `notice-${printedDate}`,
    "noticeDeadline",
    "42 CFR 435.558(a)(2), (c)(4)",
    "Printed date plus five days, then 30 calendar days",
    [printedDate],
    {
      status: U,
      countedAsReceived: received,
      deadline,
      reminderDeadline: deadline,
      missing: [],
    },
  );
add(
  "notice-late-reported",
  "noticeDeadline",
  "42 CFR 435.558(c)(4)",
  "Reported late arrival shows a possible date but keeps earlier reminder",
  ["2026-11-01", "2026-11-12"],
  {
    status: U,
    countedAsReceived: "2026-11-06",
    deadline: "2026-12-06",
    possibleLaterDeadline: "2026-12-12",
    reminderDeadline: "2026-12-06",
    laterArrivalNeedsProof: true,
    missing: ["proofOfLaterArrival"],
  },
);
add(
  "notice-late-proved",
  "noticeDeadline",
  "42 CFR 435.558(c)(4)",
  "Accepted proof uses later receipt but preserves earlier reminder",
  ["2026-11-01", "2026-11-12", true],
  {
    status: U,
    countedAsReceived: "2026-11-12",
    deadline: "2026-12-12",
    reminderDeadline: "2026-12-06",
    laterArrivalNeedsProof: false,
    missing: [],
  },
);
add(
  "notice-early",
  "noticeDeadline",
  "42 CFR 435.558(c)(4)",
  "Early delivery does not shorten the assumed five days",
  ["2026-11-01", "2026-11-02"],
  { status: U, countedAsReceived: "2026-11-06", deadline: "2026-12-06" },
);
add(
  "notice-arrived-before-print",
  "noticeDeadline",
  "42 CFR 435.558(c)(4)",
  "Contradictory arrival date needs review",
  ["2026-11-01", "2026-10-31"],
  { status: U, deadline: null, missing: ["reportedArrival"] },
);
add(
  "notice-bad-arrival",
  "noticeDeadline",
  "42 CFR 435.558(c)(4)",
  "Impossible reported date",
  ["2026-11-01", "2026-11-31"],
  { status: U, deadline: null, missing: ["reportedArrival"] },
);
add(
  "notice-date-overflow",
  "noticeDeadline",
  "42 CFR 435.558(a)(2)",
  "Out-of-range reply date must not wrap into an earlier year",
  ["9999-12-31"],
  { status: U, deadline: null, missing: ["printedDate"] },
);
add(
  "notice-arrival-overflow",
  "noticeDeadline",
  "42 CFR 435.558(c)(4)",
  "Out-of-range later deadline needs review",
  ["9999-10-01", "9999-12-31"],
  { status: U, deadline: null, missing: ["reportedArrival"] },
);

add(
  "month-maria-income",
  "assessMonth",
  "42 CFR 435.552(a)(6), (f)",
  "Maria: a confirmed Medicaid income count of $612 meets",
  [month({ income: income({ amountCents: 61200 }) })],
  { status: M, math: { amountCents: 61200, thresholdCents: 58000 } },
);
add(
  "month-daniel",
  "assessMonth",
  "42 CFR 435.552(d)(1), (e)",
  "Daniel: less-than-half-time school and work",
  [month({ education: school(), evidence: [work({ hours: 20 })] })],
  { status: M, math: { hours: 97.94 } },
);
add(
  "month-rosa",
  "assessMonth",
  "42 CFR 435.554(c)(3)(i)(A)",
  "Rosa: caregiver exclusion wins before activity or income",
  [
    month({
      exclusions: exclusions({ care: care() }),
      evidence: [work()],
      income: income({ amountCents: 61200 }),
    }),
  ],
  { status: E, citationIncludes: ["(i)(A)"] },
);
add(
  "month-short-19",
  "assessMonth",
  "42 CFR 435.552(e)(4)",
  "Complete confirmed facts leave 19 hours",
  [month({ evidence: [work({ hours: 61 })] })],
  { status: S, math: { hours: 61, gapHours: 19 } },
);
add(
  "month-empty-known",
  "assessMonth",
  "42 CFR 435.552(a)",
  "Confirmed no activity and no income",
  [month()],
  { status: S, math: { hours: 0, gapHours: 80 } },
);
add(
  "month-unknown-applicability",
  "assessMonth",
  "42 CFR 435.551",
  "Even 80 hours does not establish unknown coverage scope",
  [month({ applicability: applicability({ age: null }), evidence: [work()] })],
  { status: U, missingIncludes: ["applicability.age"] },
);
add(
  "month-definite-exclusion-unknown-age",
  "assessMonth",
  "42 CFR 435.554(c)(4)",
  "A proven exclusion does not need every other coverage answer",
  [
    month({
      applicability: applicability({ age: null }),
      exclusions: exclusions({ veteran100Percent: true }),
    }),
  ],
  { status: E },
);
add(
  "month-outside",
  "assessMonth",
  "42 CFR 435.551",
  "Outside coverage group needs no hour proof",
  [month({ applicability: applicability({ group: "other" }) })],
  { status: E },
);
add(
  "month-deemed",
  "assessMonth",
  "42 CFR 435.553(a)(1)",
  "Turned 19 during month, despite no activities",
  [
    month({
      applicability: applicability({ age: 19 }),
      exceptions: exceptions({ under19DuringMonth: true }),
    }),
  ],
  { status: D },
);
add(
  "month-hardship",
  "assessMonth",
  "42 CFR 435.555(d)(2)",
  "Elected county disaster deems month",
  [
    month({
      state: state({ disasterHardship: true }),
      hardship: { disasters: [disaster()] },
    }),
  ],
  { status: D },
);
add(
  "month-half-time",
  "assessMonth",
  "42 CFR 435.552(a)(4)",
  "Half-time school meets independently",
  [month({ education: school({ enrollment: "half-time" }) })],
  { status: M, math: { halfTime: true, hours: null } },
);
add(
  "month-seasonal",
  "assessMonth",
  "42 CFR 435.552(a)(7), (g)",
  "Seasonal average qualifies a low-income month",
  [month({ seasonal: seasonal() })],
  { status: M, math: { averageCents: 58000 } },
);
add(
  "month-proposed-not-green",
  "assessMonth",
  "42 CFR 435.552(e)(2)",
  "App policy: an unconfirmed 80-hour proposal cannot make Meets",
  [month({ evidence: [work({ status: "proposed" })] })],
  { status: U, missingIncludes: ["evidence.work-1.confirmed"] },
);
add(
  "month-unknown-exclusion",
  "assessMonth",
  "42 CFR 435.554(c)",
  "Unknown exclusion is not a known Short result",
  [month({ exclusions: exclusions({ formerFosterYouthGroup: null }) })],
  { status: U, missingIncludes: ["exclusions.formerFosterYouthGroup"] },
);
add(
  "month-proven-compliance-followup",
  "assessMonth",
  "42 CFR 435.557(c)(3)",
  "Proven compliance does not wait for an uncertain exclusion",
  [
    month({
      exclusions: exclusions({ formerFosterYouthGroup: null }),
      evidence: [work()],
    }),
  ],
  {
    status: M,
    math: { exclusionFollowUp: ["exclusions.formerFosterYouthGroup"] },
  },
);
add(
  "month-pay-only",
  "assessMonth",
  "42 CFR 435.552(f)(2)",
  "Gross pay is not silently labeled as a verified Medicaid count",
  [month({ income: income({ amountCents: 214000, basis: "pay-shown" }) })],
  { status: U, missingIncludes: ["income.medicaidMagiCount"] },
);
add(
  "month-future",
  "assessMonth",
  "42 CFR 435.552(a)",
  "Future month cannot be confirmed now",
  [month({ month: "2027-01", evidence: [work()] })],
  { status: U, missing: ["month.future"] },
);
add(
  "month-invalid",
  "assessMonth",
  "42 CFR 435.552(a)",
  "Malformed month is not a status decision",
  [month({ month: "bad" })],
  { status: U, missing: ["month"] },
);
add(
  "month-invalid-review",
  "assessMonth",
  "42 CFR 435.552(a)",
  "Malformed review date is not a status decision",
  [month({ asOf: "bad" })],
  { status: U, missing: ["asOf"] },
);

add(
  "seasonal-pay-only",
  "seasonalIncomeTest",
  "42 CFR 435.552(g)(2)",
  "Seasonal averages also require Medicaid income counts",
  [
    "2026-10",
    seasonal(undefined, {
      months: seasonal().months.map((record, i) =>
        i === 0 ? { ...record, basis: "pay-shown" } : record,
      ),
    }),
  ],
  {
    status: U,
    matched: null,
    missingIncludes: ["seasonal.months.2026-04.medicaidMagiCount"],
  },
);
for (const value of [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])
  add(
    `seasonal-overflow-${value}`,
    "seasonalIncomeTest",
    "42 CFR 435.552(g)(2)",
    "An unrepresentable total needs review rather than an unsafe sum",
    ["2026-10", seasonal([value, value, value, value, value, value])],
    { status: U, matched: null, missingIncludes: ["seasonal.totalIncome"] },
  );
add(
  "activity-unknown-kind",
  "combineHours",
  "42 CFR 435.552(b)",
  "Unrecognized evidence type cannot count as work",
  [activity({ evidence: [work({ kind: "invented" })] })],
  { status: U, hours: 0, missingIncludes: ["evidence.work-1.kind"] },
);
add(
  "activity-empty-id",
  "combineHours",
  "42 CFR 435.557(b)(2)",
  "Counted evidence must have a source identifier",
  [activity({ evidence: [work({ id: " " })] })],
  { status: U, hours: 0, missingIncludes: ["evidence.id"] },
);
add(
  "activity-overflow-total",
  "combineHours",
  "42 CFR 435.552(e)(4)",
  "An unsafe hour sum needs review, never Meets",
  [
    activity({
      evidence: [
        work({ hours: 9000000000 }),
        work({ id: "work-2", organization: "Other", hours: 9000000000 }),
      ],
    }),
  ],
  { status: U, hours: null, missingIncludes: ["evidence.totalHours"] },
);
add(
  "activity-service-missing-metadata",
  "combineHours",
  "42 CFR 435.552(b)",
  "Volunteer title alone does not prove the service definition",
  [activity({ evidence: [work({ kind: "service" })] })],
  {
    status: U,
    hours: 0,
    missingIncludes: ["evidence.work-1.service.confirmationContact"],
  },
);
add(
  "activity-program-missing-metadata",
  "combineHours",
  "42 CFR 435.552(b)",
  "Program title alone does not prove an approved program",
  [activity({ evidence: [work({ kind: "work-program" })] })],
  {
    status: U,
    hours: 0,
    missingIncludes: ["evidence.work-1.program.approvedType"],
  },
);

const incompleteIncome = income();
delete incompleteIncome.hoursDocumented;
add(
  "activity-unknown-school-and-hours-record",
  "combineHours",
  "42 CFR 435.552(c), (e)(2)(i)",
  "Unknown school and work-record facts are not a confirmed zero",
  [
    activity({
      education: { enrollment: null },
      state: state({ incomeDerivedHours: true }),
      income: incompleteIncome,
    }),
  ],
  {
    status: U,
    hours: 0,
    missingIncludes: ["education.enrollment", "income.hoursDocumented"],
  },
);

import { confirmedIncomeCases } from "./confirmed-income.mjs";
cases.push(...confirmedIncomeCases);
