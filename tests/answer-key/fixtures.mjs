export const applicability = (patch = {}) => ({
  group: "expansion",
  age: 34,
  pregnant: false,
  medicare: false,
  otherwiseEligible: false,
  ...patch,
});
export const exclusions = (patch = {}) => ({
  formerFosterYouthGroup: false,
  indianUnder44751: false,
  care: { role: "none" },
  veteran100Percent: false,
  medical: { verifiedCategories: [] },
  tanf407Compliant: false,
  snapHousehold: false,
  exemptFromSnapWorkRules: false,
  treatmentProgramQualifies: false,
  treatmentMeetsStateMinimum: false,
  inmate: false,
  pregnantOrPostpartum: false,
  ...patch,
});
export const exceptions = (patch = {}) => ({
  under19DuringMonth: false,
  medicareDuringMonth: false,
  mandatoryGroupDuringMonth: false,
  excludedDuringMonth: false,
  incarcerationPeriods: [],
  ...patch,
});
export const state = (patch = {}) => ({
  verified: true,
  incomeDerivedHours: false,
  disasterHardship: false,
  unemploymentHardship: false,
  inpatientHardship: false,
  medicalTravelHardship: false,
  ...patch,
});
export const income = (patch = {}) => ({
  amountCents: 0,
  confirmed: true,
  basis: "medicaid-magi",
  hoursDocumented: false,
  householdWorkers: 1,
  ...patch,
});
export const school = (patch = {}) => ({
  enrollment: "less-than-half",
  qualifyingProgram: true,
  confirmed: true,
  termStart: "2026-08-20",
  termEnd: "2026-12-15",
  usesCreditHours: true,
  credits: 6,
  ...patch,
});
export const care = (patch = {}) => ({
  role: "family-caregiver",
  dependentAge: 70,
  dependentReliesOnCare: false,
  dependentAdaDisability: true,
  relativeUnderDefinition: true,
  primarilyResidesTogether: true,
  primaryResponsibility: true,
  regularAssistance: true,
  solelyIncidental: false,
  significantRelationship: true,
  adultFamilyMember: true,
  monthlyAssistanceHours: 5,
  ...patch,
});
export const work = (patch = {}) => ({
  id: "work-1",
  version: 1,
  kind: "work",
  status: "confirmed",
  start: "2026-10-01",
  end: "2026-10-15",
  hours: 80,
  organization: "Workplace",
  ...patch,
});
export const service = (patch = {}) =>
  work({
    id: "service-1",
    kind: "service",
    organization: "Food pantry",
    service: {
      unpaid: true,
      directCommunityBenefit: true,
      publicOrNonprofit: true,
      structuredAndSupervised: true,
      nonpartisan: true,
      tracksDatesAndHours: true,
      confirmationContact: "supervisor@example.test",
    },
    ...patch,
  });
export const program = (patch = {}) =>
  work({
    id: "program-1",
    kind: "work-program",
    program: { approvedType: "wioa" },
    ...patch,
  });
export const disaster = (patch = {}) => ({
  declarationType: "DR",
  countyMatchesResidence: true,
  incidentStart: "2026-09-15",
  incidentEnd: "2026-10-02",
  cmsExtendedThrough: null,
  ...patch,
});
export const month = (patch = {}) => ({
  month: "2026-10",
  asOf: "2026-11-02",
  applicability: applicability(),
  exclusions: exclusions(),
  exceptions: exceptions(),
  state: state(),
  hardship: { disasters: [] },
  education: { enrollment: "none" },
  income: income(),
  seasonal: { qualifiesUnder45R: false },
  evidence: [],
  evidenceComplete: true,
  ...patch,
});
export const seasonal = (
  values = [58000, 58000, 58000, 58000, 58000, 58000],
  patch = {},
) => ({
  qualifiesUnder45R: true,
  months: [
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
  ].map((month, i) => ({
    month,
    amountCents: values[i],
    confirmed: true,
    basis: "medicaid-magi",
  })),
  ...patch,
});
