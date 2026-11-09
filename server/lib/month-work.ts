import type { ActionRunContext } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { EvidenceFields } from "../../shared/evidence.ts";
import { getDb } from "../db/index.ts";
import { documents } from "../db/schema.ts";
import { assessMonth } from "../rules/assess-month.ts";
import { REQUIRED_HOURS, REQUIRED_INCOME_CENTS } from "../rules/constants.ts";
import { monthBounds, shiftMonth } from "../rules/dates.ts";
import {
  exampleMonth,
  requireExampleAccount,
  today,
} from "./example-accounts.ts";
import { isExampleEmail } from "./example-identity.ts";
import { EXAMPLE_PROFILES } from "./example-people.ts";
import { listEvidenceRecords, readerLinesFor } from "./evidence-records.ts";
import { extractEvidence, type ExtractOutcome } from "./extraction.ts";
import { ownMemberActor } from "./member-identity.ts";
import { checkMemberMonth, memberMonthFacts } from "./member-month.ts";
import { getMemberRecord } from "./member-records.ts";
import { monthInput, type MonthFacts, type SavedLine } from "./month-input.ts";
import { packetMonth } from "./proof-packet.ts";

export const MONTH_WORK_WIDGET = "eighty.month-work";
export const monthWorkInput = z.strictObject({
  /** Read files that have not been read yet. Off for a quick look. */
  read: z.boolean().optional(),
});

const DONE = new Set(["Meets", "Exempt", "Deemed"]);
const MAX_READS = 3;

type Line = SavedLine & {
  version: number;
  documentId: string | null;
  questions: string[];
  createdBy: string;
};

export interface MonthState {
  status: string;
  citation: string;
  hours: number | null;
  amountCents: number | null;
  missing: string[];
}
export interface PlanStep {
  kind: "work" | "service";
  organization: string;
  hours: number;
  /** Hours of one past shift there, when a one-day line shows it. */
  shiftHours: number | null;
  shifts: number | null;
}
export interface MonthWork {
  widget: typeof MONTH_WORK_WIDGET;
  example: boolean;
  month: string;
  asOf: string;
  monthEnd: string;
  targetHours: number;
  targetCents: number;
  now: MonthState;
  ifConfirmed: MonthState | null;
  read: { documentId: string; outcome: ExtractOutcome; lines: number }[];
  unread: number;
  waiting: {
    id: string;
    version: number;
    fields: EvidenceFields;
    fromDocument: boolean;
    questions: string[];
  }[];
  question: {
    key: string;
    lineId: string;
    version: number;
    organization?: string | null;
    grossPayCents?: number;
  } | null;
  plan: {
    hoursNeeded: number;
    payNeededCents: number | null;
    steps: PlanStep[];
  } | null;
  done: boolean;
  /** The latest finished month a proof packet can be made for. */
  packet: string | null;
}

const asConfirmed = (lines: SavedLine[]) =>
  lines.map((line) =>
    line.status === "proposed" ? { ...line, status: "confirmed" as const } : line,
  );

const lineMonth = (fields: EvidenceFields) =>
  (fields.end ?? fields.start ?? fields.income?.receivedOn ?? "").slice(0, 7);

/**
 * The hours plan. Each step is checked with the same rules: one more line of
 * that activity, for exactly the hours still needed, dated the last day of the
 * month, must turn the month to Meets. A step the rules do not accept is left out.
 */
export function planSteps(
  facts: MonthFacts,
  lines: SavedLine[],
  month: string,
  hoursNeeded: number,
): PlanStep[] {
  if (hoursNeeded <= 0) return [];
  const end = monthBounds(month).end;
  const recent = new Set([month, shiftMonth(month, -1)]);
  const seen = new Map<string, SavedLine>();
  for (const line of lines) {
    const f = line.fields;
    if (line.status !== "confirmed") continue;
    if ((f.kind !== "work" && f.kind !== "service") || !f.organization) continue;
    if (!recent.has(lineMonth(f))) continue;
    seen.set(`${f.kind}\u0000${f.organization}`, line);
  }
  const steps: PlanStep[] = [];
  for (const line of seen.values()) {
    const f = line.fields;
    const extra: SavedLine = {
      ...line,
      id: `plan-${steps.length}`,
      status: "confirmed",
      documentId: null,
      fields: { ...f, start: end, end, hours: hoursNeeded },
    } as SavedLine;
    const after = assessMonth(
      monthInput(facts, [...asConfirmed(lines), extra], month, end),
    );
    if (after.status !== "Meets") continue;
    const shifts = lines
      .filter(
        (other) =>
          other.status === "confirmed" &&
          other.fields.kind === f.kind &&
          other.fields.organization === f.organization &&
          other.fields.start &&
          other.fields.start === other.fields.end &&
          typeof other.fields.hours === "number" &&
          other.fields.hours > 0,
      )
      .map((other) => other.fields.hours as number)
      .sort((a, b) => a - b);
    const shiftHours = shifts.length
      ? shifts[Math.floor(shifts.length / 2)]!
      : null;
    steps.push({
      kind: f.kind as "work" | "service",
      organization: f.organization as string,
      hours: hoursNeeded,
      shiftHours,
      shifts: shiftHours ? Math.ceil(hoursNeeded / shiftHours) : null,
    });
  }
  return steps;
}

/**
 * The month's paperwork in one pass: read files not read yet, list the lines
 * waiting for the member, ask the one question that blocks the month, and lay
 * out a plan the rules accept. It proposes and plans; it never confirms.
 */
export async function doMonth(
  input: z.infer<typeof monthWorkInput>,
  context: ActionRunContext | undefined,
): Promise<MonthWork> {
  const { read = true } = monthWorkInput.parse(input ?? {});
  const actor = await ownMemberActor(context);
  const member = await getMemberRecord(actor);
  const example = isExampleEmail(actor.email);
  const facts: MonthFacts = example
    ? EXAMPLE_PROFILES[(await requireExampleAccount(context)).person].facts
    : memberMonthFacts(member.screener);

  const files = await getDb()
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.memberId, member.id), eq(documents.ownerEmail, actor.email)),
    )
    .orderBy(documents.createdAt);
  const unreadIds: string[] = [];
  for (const file of files)
    if (!(await readerLinesFor(actor, member, file.id)).length)
      unreadIds.push(file.id);
  const done: MonthWork["read"] = [];
  if (read)
    for (const documentId of unreadIds.slice(0, MAX_READS)) {
      const reading = await extractEvidence({ documentId }, context);
      done.push({
        documentId,
        outcome: reading.outcome,
        lines: reading.lines?.length ?? 0,
      });
      if (reading.outcome === "budget-used" || reading.outcome === "unavailable")
        break;
    }

  const lines = (await listEvidenceRecords(context)) as unknown as Line[];
  const asOf = today();
  const month = asOf.slice(0, 7);
  // The same month the member's page shows, from the same code.
  const shown = example
    ? (await exampleMonth(context)).thisMonth
    : (await checkMemberMonth(undefined, context)).months[0]!;
  const pick = (value: {
    status: string;
    citation: string;
    hours: number | null;
    amountCents: number | null;
    missing?: string[];
  }): MonthState => ({
    status: value.status,
    citation: value.citation,
    hours: value.hours,
    amountCents: value.amountCents,
    missing: value.missing ?? [],
  });
  const now = pick(shown);
  const waitingLines = lines.filter((line) => line.status === "proposed");
  const projected = shown.ifConfirmed
    ? pick({ ...shown, ...shown.ifConfirmed })
    : null;
  const best = projected ?? now;

  const costs = waitingLines.find(
    (line) =>
      line.fields.kind === "income" &&
      line.fields.income?.kind === "self-employment" &&
      line.fields.income.costsConfirmed !== true &&
      typeof line.fields.income.grossPayCents === "number",
  );
  const asked = waitingLines.find((line) => line.questions?.length);
  const question: MonthWork["question"] = costs
    ? {
        key: "business-costs",
        lineId: costs.id,
        version: costs.version,
        organization: costs.fields.organization ?? null,
        grossPayCents: costs.fields.income!.grossPayCents as number,
      }
    : asked
      ? { key: asked.questions[0]!, lineId: asked.id, version: asked.version }
      : null;

  const isDone = DONE.has(now.status);
  const hoursNeeded = Math.max(0, REQUIRED_HOURS - (best.hours ?? 0));
  const plan =
    isDone || DONE.has(best.status)
      ? null
      : {
          hoursNeeded,
          payNeededCents:
            best.amountCents === null
              ? null
              : Math.max(0, REQUIRED_INCOME_CENTS - best.amountCents),
          steps: planSteps(facts, lines, month, hoursNeeded),
        };

  return {
    widget: MONTH_WORK_WIDGET,
    example,
    month,
    asOf,
    monthEnd: monthBounds(month).end,
    targetHours: REQUIRED_HOURS,
    targetCents: REQUIRED_INCOME_CENTS,
    now,
    ifConfirmed: projected,
    read: done,
    unread: unreadIds.length - done.length,
    waiting: waitingLines.map((line) => ({
      id: line.id,
      version: line.version,
      fields: line.fields,
      fromDocument: Boolean(line.documentId),
      questions: line.questions ?? [],
    })),
    question,
    plan,
    done: isDone,
    packet: await packetMonth(context),
  };
}
