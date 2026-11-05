import type { ActionRunContext } from "@agent-native/core/action";
import { createError } from "h3";

import type { MemberProfile } from "../../shared/member-profile.ts";
import { assessMonth } from "../rules/assess-month.ts";
import { combineHours } from "../rules/activities.ts";
import { educationHours } from "../rules/education.ts";
import { incomeTest } from "../rules/income.ts";
import { shiftMonth, validMonth, monthsBetween } from "../rules/dates.ts";
import { listEvidenceRecords } from "./evidence-records.ts";
import { memberActor, reviewedMemberActor } from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";
import { isDemoEmail } from "./demo-identity.ts";
import { monthInput, type MonthFacts, type SavedLine } from "./month-input.ts";

export function memberMonthFacts(
  answers: MemberProfile["screener"],
): MonthFacts {
  const flag = (value: string | undefined) =>
    value === "yes" ? true : value === "no" ? false : null;
  return {
    applicability: {
      group: answers.group || null,
      age: answers.age ? Number(answers.age) : null,
      pregnant: flag(answers.pregnant),
      medicare: flag(answers.medicare),
      otherwiseEligible:
        answers.group === "1115" ? flag(answers.otherwiseEligible) : null,
      mandatoryGroupEligibleAndEnrolled:
        answers.group === "expansion" ? flag(answers.otherGroup) : null,
      minimumEssentialCoverage:
        answers.group === "1115" ? flag(answers.fullCoverage) : null,
    },
    exclusions: {
      formerFosterYouthGroup: flag(answers.foster),
      indianUnder44751: flag(answers.indian),
      care:
        answers.child === "no" && answers.care === "no"
          ? { role: "none" }
          : null,
      veteran100Percent: flag(answers.veteran),
      medical: answers.health === "no" ? { verifiedCategories: [] } : null,
      tanf407Compliant: flag(answers.tanf),
      snapHousehold: flag(answers.snap),
      exemptFromSnapWorkRules: null,
      treatmentProgramQualifies: answers.treatment === "no" ? false : null,
      treatmentMeetsStateMinimum: null,
      inmate: null,
      pregnantOrPostpartum: flag(answers.pregnant),
    },
    exceptions: {
      under19DuringMonth: null,
      medicareDuringMonth: null,
      mandatoryGroupDuringMonth: null,
      excludedDuringMonth: null,
      incarcerationPeriods: null,
    },
    // A state name alone does not verify its choices for this month.
    state: {
      verified: null,
      incomeDerivedHours: null,
      disasterHardship: null,
      unemploymentHardship: null,
      inpatientHardship: null,
      medicalTravelHardship: null,
    },
    hardship: {
      disasters: null,
      unemployment: null,
      inpatient: null,
      medicalTravel: null,
    },
    education: {
      enrollment: null,
      qualifyingProgram: null,
      confirmed: null,
      termStart: null,
      termEnd: null,
      registeredForNextRegularTerm: null,
      nextRegularTermStart: null,
      normalBreak: null,
      exitDate: null,
      continuesInAnotherProgram: null,
      credits: null,
      usesCreditHours: null,
      actualHours: null,
    },
    seasonal: { qualifiesUnder45R: null, months: null },
    householdWorkers: null,
    evidenceComplete: null,
  };
}

export function memberMonthResult(
  facts: MonthFacts,
  lines: SavedLine[],
  month: string,
  asOf: string,
) {
  const confirmed = lines.filter((line) => line.status === "confirmed");
  const input = monthInput(facts, confirmed, month, asOf);
  const result = assessMonth(input);
  const activities = combineHours(input);
  const income = incomeTest(input.income);
  const counted = (activities.math?.counted ?? []) as {
    id: string;
    hours: number;
  }[];
  const payUsed =
    validMonth(month) &&
    `${month}-01` <= asOf &&
    typeof income.math?.amountCents === "number";
  const school = educationHours(month, asOf, input.education);
  const schoolLine = [...confirmed]
    .reverse()
    .find(
      (line) =>
        line.fields.kind === "education" &&
        line.fields.education?.termStart === input.education.termStart,
    );
  const schoolCounts = school.halfTime === true || (school.hours ?? 0) > 0;
  const sources = confirmed.filter(
    (line) =>
      counted.some((item) => item.id === line.id) ||
      (schoolCounts && line.id === schoolLine?.id) ||
      (payUsed &&
        line.fields.kind === "income" &&
        (
          line.fields.income?.receivedOn ??
          line.fields.end ??
          line.fields.start ??
          ""
        ).slice(0, 7) === month),
  );
  return {
    month,
    ...result,
    hours: activities.hours ?? null,
    targetHours: 80,
    amountCents: payUsed ? (income.math!.amountCents as number) : null,
    counted,
    educationHours: schoolCounts ? school.hours : null,
    educationCredits:
      schoolCounts && typeof school.math?.credits === "number"
        ? school.math.credits
        : null,
    lines: sources.map((line) => ({
      id: line.id,
      fields: line.fields,
      fromDocument: Boolean(line.documentId),
    })),
  };
}

export async function checkMemberMonth(
  month: string | undefined,
  context: ActionRunContext | undefined,
) {
  await reviewedMemberActor(context);
  const actor = await memberActor(context);
  if (isDemoEmail(actor.email))
    throw createError({
      statusCode: 403,
      statusMessage: "Open the demo month",
    });
  const member = await getMemberRecord(actor);
  const lines = await listEvidenceRecords(context);
  const asOf = new Date().toISOString().slice(0, 10);
  const current = asOf.slice(0, 7);
  const facts = memberMonthFacts(member.screener);
  const months = new Set([current, shiftMonth(current, -1)]);
  const oldest = shiftMonth(current, -23);
  for (const line of lines) {
    if (line.status !== "confirmed") continue;
    const start = (
      line.fields.education?.termStart ??
      line.fields.start ??
      line.fields.income?.receivedOn ??
      ""
    ).slice(0, 7);
    const end = (
      line.fields.education?.termEnd ??
      line.fields.end ??
      line.fields.income?.receivedOn ??
      ""
    ).slice(0, 7);
    if (validMonth(start) && validMonth(end) && start <= end) {
      // Show at most two years of past months for one line.
      const from = start < oldest ? oldest : start;
      const to = end < current ? end : current;
      if (from <= to)
        for (const value of monthsBetween(from, to)) months.add(value);
    }
    const paid = line.fields.income?.receivedOn?.slice(0, 7) ?? "";
    if (validMonth(paid) && paid <= current) months.add(paid);
  }
  return {
    asOf,
    stateCode: member.stateCode,
    waiting: lines.filter((line) => line.status === "proposed").length,
    months: [...months]
      .sort()
      .reverse()
      .map((value) => memberMonthResult(facts, lines, value, asOf)),
    selected:
      month === undefined ? null : memberMonthResult(facts, lines, month, asOf),
  };
}
