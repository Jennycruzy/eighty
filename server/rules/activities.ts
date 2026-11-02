import { all, finding, flag, result, units } from "./common.ts";
import type { Condition } from "./common.ts";
import { HOUR_SCALE, REQUIRED_HOURS } from "./constants.ts";
import { monthBounds, validDate, validMonth } from "./dates.ts";
import { educationHours } from "./education.ts";
import { incomeDerivedHours } from "./income.ts";
import type { EvidenceLine, MonthInput } from "./types.ts";

type ActivityInput = Pick<
  MonthInput,
  | "month"
  | "asOf"
  | "evidence"
  | "education"
  | "income"
  | "state"
  | "evidenceComplete"
>;

function activityQualifies(line: EvidenceLine): Condition {
  if (line.kind === "work") return { value: true, missing: [] };
  if (line.kind === "service") {
    const service = line.service;
    const checks = (
      [
        "unpaid",
        "directCommunityBenefit",
        "publicOrNonprofit",
        "structuredAndSupervised",
        "nonpartisan",
        "tracksDatesAndHours",
      ] as const
    ).map((key) => flag(service?.[key], `evidence.${line.id}.service.${key}`));
    checks.push({
      value:
        typeof service?.confirmationContact === "string" &&
        service.confirmationContact.trim().length > 0
          ? true
          : null,
      missing:
        typeof service?.confirmationContact === "string" &&
        service.confirmationContact.trim().length > 0
          ? []
          : [`evidence.${line.id}.service.confirmationContact`],
    });
    return all(checks);
  }
  if (line.kind === "work-program") {
    const program = line.program;
    if (program?.approvedType === "job-search")
      return { value: false, missing: [] };
    if (program?.approvedType === "state-approved") {
      const fraction = program.subsidiaryJobSearchFraction;
      if (
        typeof fraction !== "number" ||
        !Number.isFinite(fraction) ||
        fraction < 0 ||
        fraction > 1
      )
        return {
          value: null,
          missing: [`evidence.${line.id}.program.subsidiaryJobSearchFraction`],
        };
      return { value: fraction < 0.5, missing: [] };
    }
    if (
      ["wioa", "trade-act", "veterans", "snap-partnership"].includes(
        program?.approvedType as string,
      )
    )
      return { value: true, missing: [] };
    return {
      value: null,
      missing: [`evidence.${line.id}.program.approvedType`],
    };
  }
  return { value: null, missing: [`evidence.${line.id}.kind`] };
}

function periodKey(line: EvidenceLine): string {
  const organization = line.organization
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return organization
    ? JSON.stringify([line.kind, organization, line.start, line.end])
    : "";
}

export function combineHours(input: ActivityInput) {
  const citation = "42 CFR 435.552(a)(1)–(5), (b), (d)–(e)";
  if (!validMonth(input.month) || !validDate(input.asOf))
    return {
      ...finding(null, "Check the month and review date.", citation, [
        !validMonth(input.month) ? "month" : "asOf",
      ]),
      hours: null,
    };
  if (`${input.month}-01` > input.asOf)
    return {
      ...finding(
        null,
        "Future hours do not count as completed work.",
        citation,
        ["evidence.futureMonth"],
      ),
      hours: null,
    };
  const education = educationHours(input.month, input.asOf, input.education);
  if (education.halfTime && education.matched) return education;
  const bounds = monthBounds(input.month);
  const ids = new Map<string, number>();
  const periods = new Map<string, number>();
  for (const line of input.evidence) {
    if (line.status !== "confirmed" || line.kind === "income") continue;
    ids.set(line.id, (ids.get(line.id) ?? 0) + 1);
    const key = periodKey(line);
    if (key) periods.set(key, (periods.get(key) ?? 0) + 1);
  }
  const totals = { work: 0, service: 0, "work-program": 0 };
  const counted: {
    id: string;
    version: number;
    hours: number;
    citation: string;
  }[] = [];
  const excluded: string[] = [];
  const missing = [...education.missing];
  let documentedWork = input.income.hoursDocumented === true;
  for (const line of input.evidence) {
    if (line.status === "rejected" || line.kind === "income") continue;
    const prefix = `evidence.${line.id}`;
    if (
      !validDate(line.start) ||
      !validDate(line.end) ||
      line.end < line.start
    ) {
      missing.push(`${prefix}.dates`);
      continue;
    }
    if (line.end < bounds.start || line.start > bounds.end) continue;
    if (line.status !== "confirmed") {
      missing.push(`${prefix}.confirmed`);
      continue;
    }
    if (!line.id.trim()) {
      missing.push("evidence.id");
      continue;
    }
    if (!Number.isSafeInteger(line.version) || line.version < 1) {
      missing.push(`${prefix}.version`);
      continue;
    }
    if (line.start < bounds.start || line.end > bounds.end) {
      missing.push(`${prefix}.monthlySplit`);
      continue;
    }
    if (line.end > input.asOf) {
      missing.push(`${prefix}.completedDates`);
      continue;
    }
    if (
      (ids.get(line.id) as number) > 1 ||
      (periods.get(periodKey(line)) ?? 0) > 1
    ) {
      missing.push(`${prefix}.duplicate`);
      continue;
    }
    const value = units(line.hours, HOUR_SCALE);
    if (value === null) {
      missing.push(`${prefix}.hours`);
      continue;
    }
    if (line.kind === "work") documentedWork = true;
    const qualifies = activityQualifies(line);
    if (qualifies.value === false) {
      excluded.push(line.id);
      continue;
    }
    if (qualifies.value === null) {
      missing.push(...qualifies.missing);
      continue;
    }
    const kind = line.kind as keyof typeof totals;
    totals[kind] += value;
    counted.push({
      id: line.id,
      version: line.version,
      hours: value / HOUR_SCALE,
      citation: `42 CFR 435.552(a)(${kind === "work" ? 1 : kind === "service" ? 2 : 3}), (b)`,
    });
  }
  const derived = incomeDerivedHours(input.state, {
    ...input.income,
    hoursDocumented: documentedWork
      ? true
      : (input.income.hoursDocumented ?? null),
  });
  missing.push(...derived.missing);
  const derivedUnits = units(derived.hours, HOUR_SCALE) ?? 0;
  const educationUnits = units(education.hours, HOUR_SCALE) ?? 0;
  const total =
    totals.work +
    totals.service +
    totals["work-program"] +
    derivedUnits +
    educationUnits;
  if (!Number.isSafeInteger(total))
    return {
      ...finding(null, "The hour total needs review.", citation, [
        "evidence.totalHours",
      ]),
      hours: null,
    };
  const hours = total / HOUR_SCALE;
  const math = {
    work: totals.work / HOUR_SCALE,
    service: totals.service / HOUR_SCALE,
    workProgram: totals["work-program"] / HOUR_SCALE,
    education: educationUnits / HOUR_SCALE,
    incomeDerivedWork: derivedUnits / HOUR_SCALE,
    hours,
    targetHours: REQUIRED_HOURS,
    gapHours: Math.max(0, REQUIRED_HOURS - hours),
    counted,
    excluded,
  };
  if (hours >= REQUIRED_HOURS)
    return {
      ...result(
        "Meets",
        "Confirmed activities total at least 80 hours.",
        citation,
        math,
      ),
      matched: true,
      hours,
    };
  if (input.evidenceComplete !== true) missing.push("evidenceComplete");
  if (missing.length)
    return {
      ...finding(
        null,
        "Some hours or income facts still need proof.",
        citation,
        missing,
        math,
      ),
      hours,
    };
  return {
    ...result(
      "Short",
      "The confirmed total is below 80 hours.",
      citation,
      math,
    ),
    matched: false,
    hours,
  };
}
