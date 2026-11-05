import type { EvidenceFields } from "../../shared/evidence.ts";
import { cents } from "../rules/common.ts";
import { monthBounds, validMonth } from "../rules/dates.ts";
import type {
  DerivedIncomeFacts,
  EducationFacts,
  EvidenceLine,
  MonthInput,
} from "../rules/types.ts";
export type MonthFacts = Omit<
  MonthInput,
  "month" | "asOf" | "income" | "evidence"
> & { householdWorkers: number | null };

export interface SavedLine {
  id: string;
  version: number;
  status: "proposed" | "confirmed" | "rejected";
  fields: EvidenceFields;
  documentId?: string | null;
}

function activityLines(lines: SavedLine[]): EvidenceLine[] {
  return lines
    .filter(
      (line) =>
        line.status !== "rejected" &&
        ["work", "service", "work-program"].includes(line.fields.kind),
    )
    .map((line) => ({
      id: line.id,
      version: line.version,
      kind: line.fields.kind as EvidenceLine["kind"],
      status: line.status,
      // A blank date stays invalid, so the rules ask for it.
      start: line.fields.start ?? "",
      end: line.fields.end ?? "",
      hours: line.fields.hours ?? null,
      organization: line.fields.organization ?? null,
      ...(line.fields.service
        ? {
            service: {
              unpaid: line.fields.service.unpaid ?? null,
              directCommunityBenefit:
                line.fields.service.directCommunityBenefit ?? null,
              publicOrNonprofit: line.fields.service.publicOrNonprofit ?? null,
              structuredAndSupervised:
                line.fields.service.structuredAndSupervised ?? null,
              nonpartisan: line.fields.service.nonpartisan ?? null,
              tracksDatesAndHours:
                line.fields.service.tracksDatesAndHours ?? null,
              confirmationContact:
                line.fields.service.confirmationContact ?? null,
            },
          }
        : {}),
      ...(line.fields.program
        ? {
            program: {
              approvedType: line.fields.program.approvedType ?? null,
              subsidiaryJobSearchFraction:
                line.fields.program.subsidiaryJobSearchFraction ?? null,
            },
          }
        : {}),
    }));
}

function educationFacts(
  lines: SavedLine[],
  month: string,
  fallback: EducationFacts,
): EducationFacts {
  if (!validMonth(month)) return fallback;
  const bounds = monthBounds(month);
  const school = lines.filter(
    (line) =>
      line.status !== "rejected" &&
      line.fields.kind === "education" &&
      line.fields.education &&
      (line.fields.education.termStart ?? line.fields.start ?? "") <=
        bounds.end,
  );
  // A line still waiting for review makes school "not confirmed" until it is.
  const waiting = school.filter((line) => line.status === "proposed");
  const chosen = waiting[waiting.length - 1] ?? school[school.length - 1];
  const record = chosen?.fields.education;
  if (!chosen || !record) return fallback;
  // Blank answers stay unknown (null), so the rules ask for them.
  return {
    enrollment: record.enrollment ?? null,
    qualifyingProgram: record.qualifyingProgram ?? null,
    confirmed: chosen.status === "confirmed",
    termStart: record.termStart ?? null,
    termEnd: record.termEnd ?? null,
    registeredForNextRegularTerm: record.registeredForNextRegularTerm ?? null,
    nextRegularTermStart: record.nextRegularTermStart ?? null,
    normalBreak: record.normalBreak ?? null,
    exitDate: record.exitDate ?? null,
    continuesInAnotherProgram: record.continuesInAnotherProgram ?? null,
    credits: record.credits ?? null,
    usesCreditHours: record.usesCreditHours ?? null,
    actualHours: record.actualHours ?? null,
  };
}

function payMonth(fields: EvidenceFields): string {
  return (fields.income?.receivedOn ?? fields.end ?? fields.start ?? "").slice(
    0,
    7,
  );
}

// Only a complete record can confirm zero income without pay lines.
export function incomeFacts(
  lines: SavedLine[],
  month: string,
  facts: Pick<MonthFacts, "evidenceComplete" | "householdWorkers">,
): DerivedIncomeFacts {
  const base = { householdWorkers: facts.householdWorkers };
  const pay = lines.filter(
    (line) =>
      line.status !== "rejected" &&
      line.fields.kind === "income" &&
      payMonth(line.fields) === month,
  );
  if (pay.some((line) => line.status === "proposed"))
    return { ...base, amountCents: null, confirmed: false, basis: null };
  if (!pay.length)
    return {
      ...base,
      amountCents: 0,
      confirmed: facts.evidenceComplete ? true : null,
      basis: "medicaid-magi",
    };
  const kinds = new Set(pay.map((line) => line.fields.income?.kind));
  const sum = (
    key: "grossPayCents" | "preTaxDeductionsCents" | "netEarningsCents",
  ) => {
    let total = 0;
    for (const line of pay) {
      const value = line.fields.income?.[key];
      if (!cents(value)) return null;
      total += value;
    }
    return Number.isSafeInteger(total) ? total : null;
  };
  if (kinds.size === 1 && kinds.has("self-employment"))
    return {
      ...base,
      basis: "self-employment",
      confirmed: true,
      netEarningsCents: sum("netEarningsCents"),
      costsConfirmed: pay.every(
        (line) => line.fields.income?.costsConfirmed === true,
      )
        ? true
        : null,
    };
  if (kinds.size === 1 && kinds.has("wages"))
    return {
      ...base,
      basis: "taxable-wages",
      confirmed: true,
      grossPayCents: sum("grossPayCents"),
      preTaxDeductionsCents: sum("preTaxDeductionsCents"),
    };
  // Mixed or unknown pay types are not combined here; the rules ask for the count.
  return { ...base, amountCents: null, confirmed: true, basis: null };
}

export function monthInput(
  facts: MonthFacts,
  lines: SavedLine[],
  month: string,
  asOf: string,
): MonthInput {
  return {
    month,
    asOf,
    applicability: facts.applicability,
    exclusions: facts.exclusions,
    exceptions: facts.exceptions,
    state: facts.state,
    hardship: facts.hardship,
    education: educationFacts(lines, month, facts.education),
    income: incomeFacts(lines, month, facts),
    seasonal: facts.seasonal,
    evidence: activityLines(lines),
    evidenceComplete: facts.evidenceComplete,
  };
}
