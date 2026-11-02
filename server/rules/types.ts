export type Flag = boolean | null;
export type Status = "Meets" | "Exempt" | "Deemed" | "Short" | "Not sure yet";
export interface RuleResult {
  status: Status;
  basis: string;
  citation: string;
  math: Record<string, unknown> | null;
  missing: string[];
}
export interface Finding extends RuleResult {
  matched: Flag;
}
export interface DateRange {
  start: string;
  end: string | null;
}
export interface ApplicabilityFacts {
  group?: "expansion" | "1115" | "other" | null;
  age?: number | null;
  pregnant?: Flag;
  medicare?: Flag;
  otherwiseEligible?: Flag;
  mandatoryGroupEligibleAndEnrolled?: Flag;
  minimumEssentialCoverage?: Flag;
}
export interface CareFacts {
  role?:
    | "none"
    | "parent"
    | "guardian"
    | "caretaker-relative"
    | "family-caregiver"
    | null;
  dependentAge?: number | null;
  dependentReliesOnCare?: Flag;
  dependentAdaDisability?: Flag;
  relativeUnderDefinition?: Flag;
  primarilyResidesTogether?: Flag;
  primaryResponsibility?: Flag;
  regularAssistance?: Flag;
  solelyIncidental?: Flag;
  significantRelationship?: Flag;
  adultFamilyMember?: Flag;
  monthlyAssistanceHours?: number | null;
}
export type MedicalCategory =
  | "ssa-blind-or-disabled"
  | "substance-use"
  | "disabling-mental-disorder"
  | "disability-affecting-daily-living"
  | "serious-or-complex";
export interface MedicalFacts {
  significantlyImpairsCompliance?: Flag;
  verifiedCategories?: MedicalCategory[] | null;
  stableRecoveryYears?: number | null;
}
export interface ExclusionFacts {
  formerFosterYouthGroup?: Flag;
  indianUnder44751?: Flag;
  care?: CareFacts | null;
  veteran100Percent?: Flag;
  medical?: MedicalFacts | null;
  tanf407Compliant?: Flag;
  snapHousehold?: Flag;
  exemptFromSnapWorkRules?: Flag;
  treatmentProgramQualifies?: Flag;
  treatmentMeetsStateMinimum?: Flag;
  inmate?: Flag;
  pregnantOrPostpartum?: Flag;
}
export interface ExceptionFacts {
  under19DuringMonth?: Flag;
  medicareDuringMonth?: Flag;
  mandatoryGroupDuringMonth?: Flag;
  excludedDuringMonth?: Flag;
  incarcerationPeriods?: DateRange[] | null;
}
export interface StateOptions {
  verified?: Flag;
  incomeDerivedHours?: Flag;
  disasterHardship?: Flag;
  unemploymentHardship?: Flag;
  inpatientHardship?: Flag;
  medicalTravelHardship?: Flag;
}
export interface DisasterFacts {
  declarationType?: "DR" | "EM" | "FM" | "NEA" | null;
  countyMatchesResidence?: Flag;
  incidentStart?: string | null;
  incidentEnd?: string | null;
  ongoing?: Flag;
  verifiedThrough?: string | null;
  cmsExtendedThrough?: string | null;
  neaAffectsCompliance?: Flag;
  stateNotifiedCms?: Flag;
}
export interface HardshipFacts {
  disasters?: DisasterFacts[] | null;
  unemployment?: {
    countyRate?: number | null;
    nationalRate?: number | null;
    appliesToMonth?: string | null;
    countyMatchesResidence?: Flag;
    cmsApprovedForMonth?: Flag;
  } | null;
  inpatient?: {
    qualifyingCareDuringMonth?: Flag;
    requestGranted?: Flag;
  } | null;
  medicalTravel?: {
    qualifyingTravelDuringMonth?: Flag;
    dependentTravels?: Flag;
    memberTravels?: Flag;
    leaveForDependentCareOrTravel?: Flag;
    requestGranted?: Flag;
  } | null;
}
export interface EducationFacts {
  enrollment?: "none" | "less-than-half" | "half-time" | "full-time" | null;
  qualifyingProgram?: Flag;
  confirmed?: Flag;
  termStart?: string | null;
  termEnd?: string | null;
  registeredForNextRegularTerm?: Flag;
  nextRegularTermStart?: string | null;
  normalBreak?: Flag;
  exitDate?: string | null;
  continuesInAnotherProgram?: Flag;
  credits?: number | null;
  usesCreditHours?: Flag;
  actualHours?: number | null;
}
export interface EvidenceLine {
  id: string;
  version: number;
  kind: "work" | "service" | "work-program" | "income";
  status: "proposed" | "confirmed" | "rejected";
  start: string;
  end: string;
  hours?: number | null;
  organization?: string | null;
  service?: {
    unpaid?: Flag;
    directCommunityBenefit?: Flag;
    publicOrNonprofit?: Flag;
    structuredAndSupervised?: Flag;
    nonpartisan?: Flag;
    tracksDatesAndHours?: Flag;
    confirmationContact?: string | null;
  };
  program?: {
    approvedType?:
      | "wioa"
      | "trade-act"
      | "state-approved"
      | "veterans"
      | "snap-partnership"
      | "job-search"
      | null;
    subsidiaryJobSearchFraction?: number | null;
  };
}
export interface IncomeFacts {
  amountCents?: number | null;
  confirmed?: Flag;
  basis?:
    | "medicaid-magi"
    | "pay-shown"
    | "taxable-wages"
    | "self-employment"
    | null;
  grossPayCents?: number | null;
  preTaxDeductionsCents?: number | null;
  netEarningsCents?: number | null;
  costsConfirmed?: Flag;
}
export interface SeasonalFacts {
  qualifiesUnder45R?: Flag;
  months?:
    | {
        month: string;
        amountCents: number | null;
        confirmed: Flag;
        basis?: IncomeFacts["basis"];
      }[]
    | null;
}
export interface DerivedIncomeFacts extends IncomeFacts {
  hoursDocumented?: Flag;
  householdWorkers?: number | null;
  stateAllocatedHours?: number | null;
  allocationVerified?: Flag;
}
export interface MonthInput {
  month: string;
  asOf: string;
  applicability: ApplicabilityFacts;
  exclusions: ExclusionFacts;
  exceptions: ExceptionFacts;
  state: StateOptions;
  hardship: HardshipFacts;
  education: EducationFacts;
  income: DerivedIncomeFacts;
  seasonal: SeasonalFacts;
  evidence: EvidenceLine[];
  evidenceComplete: Flag;
}
