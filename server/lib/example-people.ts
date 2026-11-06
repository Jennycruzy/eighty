import type { EvidenceFields } from "../../shared/evidence.ts";
import type { ScreenerAnswers } from "../../shared/screener.ts";
import { monthBounds, shiftMonth } from "../rules/dates.ts";
import type {
  ApplicabilityFacts,
  EducationFacts,
  ExceptionFacts,
  ExclusionFacts,
  HardshipFacts,
  SeasonalFacts,
  StateOptions,
} from "../rules/types.ts";

// Every person here is made up. No real member's facts are used.
export const EXAMPLE_PEOPLE = ["maria", "daniel", "rosa"] as const;
export type ExamplePerson = (typeof EXAMPLE_PEOPLE)[number];

export interface ExampleSeedLine {
  fields: EvidenceFields;
  confirm: boolean;
}
export interface ExampleFacts {
  applicability: ApplicabilityFacts;
  exclusions: ExclusionFacts;
  exceptions: ExceptionFacts;
  state: StateOptions;
  hardship: HardshipFacts;
  education: EducationFacts;
  seasonal: SeasonalFacts;
  householdWorkers: number;
  evidenceComplete: boolean;
}
export interface ExampleProfile {
  name: string;
  screener: ScreenerAnswers;
  facts: ExampleFacts;
  lines: (asOf: string) => ExampleSeedLine[];
}

const noExclusions: ExclusionFacts = {
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
};
const noExceptions: ExceptionFacts = {
  under19DuringMonth: false,
  medicareDuringMonth: false,
  mandatoryGroupDuringMonth: false,
  excludedDuringMonth: false,
  incarcerationPeriods: [],
};
// Made-up state choices. They are not a statement about Nebraska or Montana.
const stateChoices: StateOptions = {
  verified: true,
  incomeDerivedHours: false,
  disasterHardship: false,
  unemploymentHardship: false,
  inpatientHardship: false,
  medicalTravelHardship: false,
};
const adult = (age: number): ApplicabilityFacts => ({
  group: "expansion",
  age,
  pregnant: false,
  medicare: false,
  otherwiseEligible: false,
  mandatoryGroupEligibleAndEnrolled: false,
});
const baseFacts = (age: number): ExampleFacts => ({
  applicability: adult(age),
  exclusions: noExclusions,
  exceptions: noExceptions,
  state: stateChoices,
  hardship: { disasters: [] },
  education: { enrollment: "none" },
  seasonal: { qualifiesUnder45R: false },
  householdWorkers: 1,
  evidenceComplete: true,
});
const answers = (state: string, age: string, care: "yes" | "no") =>
  ({
    state,
    group: "expansion",
    age,
    pregnant: "no",
    medicare: "no",
    child: "no",
    care,
    indian: "no",
    veteran: "no",
    treatment: "no",
    snap: "no",
    foster: "no",
    health: "no",
    tanf: "no",
  }) satisfies ScreenerAnswers;

// Dates follow the current month. The rules never count a future date, so this
// month's lines run from the 1st to the day the copy is made.
export function exampleDates(asOf: string) {
  const month = asOf.slice(0, 7);
  const last = shiftMonth(month, -1);
  return {
    month,
    start: `${month}-01`,
    today: asOf,
    last,
    lastStart: `${last}-01`,
    lastEnd: monthBounds(last).end,
  };
}

export const MARIA = {
  delivery: "QuickDrop Delivery (made up)",
  pantry: "Westside Food Pantry (made up)",
  corner: "Corner Market (made up)",
  deliveryHours: 49,
  pantryHours: 12,
  // The sample earnings summary shows money paid by the app. Maria's own costs
  // for gas and her phone are not on it; she answers that question herself.
  sample: {
    deliveries: 112,
    deliveryPayCents: 63820,
    tipsCents: 18625,
    totalCents: 82445,
    costsCents: 20660,
    netCents: 61785,
  },
} as const;
export const DANIEL = {
  school: "Big Sky Community College (made up)",
  job: "Rimrock Hardware (made up)",
  credits: 6,
  jobHoursThisMonth: 5,
  jobHoursLastMonth: 20,
} as const;

const pantryService = {
  unpaid: true,
  directCommunityBenefit: true,
  publicOrNonprofit: true,
  structuredAndSupervised: true,
  nonpartisan: true,
  tracksDatesAndHours: true,
  confirmationContact: "Pantry lead, Ana (made up), 402-555-0148",
};

export const EXAMPLE_PROFILES: Record<ExamplePerson, ExampleProfile> = {
  maria: {
    name: "Maria",
    screener: answers("NE", "34", "no"),
    facts: baseFacts(34),
    lines(asOf) {
      const d = exampleDates(asOf);
      return [
        {
          confirm: true,
          fields: {
            kind: "work",
            organization: MARIA.delivery,
            start: d.lastStart,
            end: d.lastEnd,
            hours: 64,
          },
        },
        {
          confirm: true,
          fields: {
            kind: "service",
            organization: MARIA.pantry,
            start: d.lastStart,
            end: d.lastEnd,
            hours: 20,
            service: pantryService,
          },
        },
        {
          confirm: false,
          fields: {
            kind: "work",
            organization: MARIA.corner,
            start: `${d.last}-20`,
            end: `${d.last}-20`,
            hours: 6,
          },
        },
        {
          confirm: true,
          fields: {
            kind: "work",
            organization: MARIA.delivery,
            start: d.start,
            end: d.today,
            hours: MARIA.deliveryHours,
          },
        },
        {
          confirm: true,
          fields: {
            kind: "service",
            organization: MARIA.pantry,
            start: d.start,
            end: d.today,
            hours: MARIA.pantryHours,
            service: pantryService,
          },
        },
      ];
    },
  },
  daniel: {
    name: "Daniel",
    screener: answers("MT", "22", "no"),
    facts: baseFacts(22),
    lines(asOf) {
      const d = exampleDates(asOf);
      const termStart = `${shiftMonth(d.month, -2)}-24`;
      const termEnd = `${shiftMonth(d.month, 1)}-15`;
      return [
        {
          confirm: true,
          fields: {
            kind: "education",
            organization: DANIEL.school,
            start: termStart,
            end: termEnd,
            education: {
              enrollment: "less-than-half",
              qualifyingProgram: true,
              termStart,
              termEnd,
              usesCreditHours: true,
              credits: DANIEL.credits,
            },
          },
        },
        {
          confirm: true,
          fields: {
            kind: "work",
            organization: DANIEL.job,
            start: d.lastStart,
            end: d.lastEnd,
            hours: DANIEL.jobHoursLastMonth,
          },
        },
        {
          confirm: true,
          fields: {
            kind: "work",
            organization: DANIEL.job,
            start: d.start,
            end: d.today,
            hours: DANIEL.jobHoursThisMonth,
          },
        },
      ];
    },
  },
  rosa: {
    name: "Rosa",
    screener: answers("NE", "51", "yes"),
    facts: {
      ...baseFacts(51),
      // Rosa's mother has dementia and lives with her. Rosa helps her every day.
      exclusions: {
        ...noExclusions,
        care: {
          role: "family-caregiver",
          dependentAge: 78,
          dependentReliesOnCare: true,
          dependentAdaDisability: true,
          relativeUnderDefinition: true,
          primarilyResidesTogether: true,
          primaryResponsibility: true,
          regularAssistance: true,
          solelyIncidental: false,
          significantRelationship: true,
          adultFamilyMember: true,
          monthlyAssistanceHours: null,
        },
      },
    },
    lines: () => [],
  },
};

// The facts Maria would type from the sample earnings summary, once she has
// answered the business-costs question.
export function mariaSampleFields(asOf: string): EvidenceFields {
  const d = exampleDates(asOf);
  return {
    kind: "income",
    organization: MARIA.delivery,
    start: d.start,
    end: d.today,
    income: {
      kind: "self-employment",
      receivedOn: d.today,
      grossPayCents: MARIA.sample.totalCents,
      netEarningsCents: MARIA.sample.netCents,
      costsConfirmed: true,
    },
  };
}
