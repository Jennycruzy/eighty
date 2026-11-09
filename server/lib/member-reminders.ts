import { eq } from "drizzle-orm";
import { createError } from "h3";

import { ruleUrl, type Lang } from "../../shared/telegram-words.ts";
import { getDb } from "../db/index.ts";
import { members, telegramLinks } from "../db/schema.ts";
import { addDays, validDate } from "../rules/dates.ts";
import { noticeDeadline } from "../rules/notice-deadline.ts";

/** The days before the reply date when the daily check-in reminds the member. */
export const NOTICE_REMINDER_DAYS = [7, 1] as const;

/** Whole days from one ISO date to another. */
export function daysFrom(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * A date as a person types it: 2026-11-03, 11/3, 11/3/2026 or 11/3/26. A date
 * without a year is the most recent one on or before today.
 */
export function parseTypedDate(value: string, today: string): string | null {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validDate(text) ? text : null;
  const parts = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (!parts) return null;
  const month = Number(parts[1]), day = Number(parts[2]);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (parts[3]) {
    const year = parts[3].length === 2 ? 2000 + Number(parts[3]) : Number(parts[3]);
    const date = `${year}-${pad(month)}-${pad(day)}`;
    return validDate(date) ? date : null;
  }
  const year = Number(today.slice(0, 4));
  for (const y of [year, year - 1]) {
    const date = `${y}-${pad(month)}-${pad(day)}`;
    if (validDate(date) && date <= today) return date;
  }
  return null;
}

/** The member's notice and its dates, from the notice rule. */
export function noticeDates(printed: string, arrived: string | null) {
  return noticeDeadline(printed, arrived);
}

/** Saves the letter's printed date and, if it came late, when it came. */
export async function saveNotice(
  memberId: string,
  printed: string,
  arrived: string | null,
  today: string,
) {
  if (!validDate(printed) || printed > today)
    throw createError({ statusCode: 422, statusMessage: "Use the date printed on the letter" });
  if (arrived !== null && (!validDate(arrived) || arrived < printed || arrived > today))
    throw createError({ statusCode: 422, statusMessage: "Use the date the letter came" });
  await getDb()
    .update(members)
    .set({ noticePrinted: printed, noticeArrived: arrived, updatedAt: new Date() })
    .where(eq(members.id, memberId));
  return noticeDates(printed, arrived);
}

export async function clearNotice(memberId: string) {
  await getDb()
    .update(members)
    .set({ noticePrinted: null, noticeArrived: null, updatedAt: new Date() })
    .where(eq(members.id, memberId));
}

/** Turns the daily check-in on or off for the member's linked chat. */
export async function setCheckins(memberId: string, on: boolean) {
  const rows = await getDb()
    .update(telegramLinks)
    .set({ checkins: on })
    .where(eq(telegramLinks.memberId, memberId))
    .returning({ chatId: telegramLinks.chatId });
  return rows.length > 0;
}

const day = (date: string, lang: Lang) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** The notice's dates in plain words, for Telegram and the web card. */
export function noticeText(
  dates: ReturnType<typeof noticeDates>,
  printed: string,
  lang: Lang,
  today: string,
): string {
  const es = lang === "es";
  if (!dates.deadline || !dates.reminderDeadline)
    return es
      ? "Revisa las fechas de la carta y cuándo llegó."
      : "Check the dates on the letter and when it came.";
  const left = daysFrom(today, dates.reminderDeadline);
  const lines = [
    es
      ? `Carta con fecha del ${day(printed, lang)}. La regla la cuenta como recibida el ${day(dates.countedAsReceived!, lang)}.`
      : `Letter dated ${day(printed, lang)}. The rule counts it as received ${day(dates.countedAsReceived!, lang)}.`,
    es
      ? `Responde a más tardar el ${day(dates.reminderDeadline, lang)}${left >= 0 ? ` (faltan ${left} días)` : ""}.`
      : `Reply by ${day(dates.reminderDeadline, lang)}${left >= 0 ? ` (${left} days from today)` : ""}.`,
  ];
  if (dates.laterArrivalNeedsProof && dates.possibleLaterDeadline)
    lines.push(
      es
        ? `Llegó tarde: guarda una prueba de cuándo llegó, como el sobre. Con esa prueba, la fecha puede ser el ${day(dates.possibleLaterDeadline, lang)}, pero planea con la fecha más temprana.`
        : `It came late: keep proof of when it came, like the envelope. With that proof the date may be ${day(dates.possibleLaterDeadline, lang)}, but plan for the earlier date.`,
    );
  lines.push(
    es
      ? `Te recuerdo ${NOTICE_REMINDER_DAYS[0]} días antes y el día anterior.`
      : `I'll remind you ${NOTICE_REMINDER_DAYS[0]} days before and the day before.`,
    `${es ? "Regla" : "Rule"}: ${dates.citation} — ${ruleUrl(dates.citation)}`,
    es ? "Tu estado decide." : "Your state decides.",
  );
  return lines.join("\n");
}

/** The reminder the daily check-in sends, or null when today is not a reminder day. */
export function noticeReminder(
  printed: string | null,
  arrived: string | null,
  today: string,
  lang: Lang,
): string | null {
  if (!printed) return null;
  const dates = noticeDates(printed, arrived);
  if (!dates.reminderDeadline) return null;
  const left = daysFrom(today, dates.reminderDeadline);
  if (!(NOTICE_REMINDER_DAYS as readonly number[]).includes(left)) return null;
  const es = lang === "es";
  const by = day(dates.reminderDeadline, lang);
  return es
    ? `Recordatorio: tu respuesta a la carta del estado vence el ${by}${left === 1 ? ", mañana" : `, en ${left} días`}. Envía /packet para tu paquete de prueba.`
    : `Reminder: your reply to the state's letter is due ${by}${left === 1 ? ", tomorrow" : `, in ${left} days`}. Send /packet for your proof packet.`;
}

export { addDays };

/** The web card: the member's own letter dates, saved, read or removed. */
export async function noticeDateAction(
  input: { op: "status" | "save" | "clear"; printed?: string | undefined; arrived?: string | null | undefined },
  context: import("@agent-native/core/action").ActionRunContext | undefined,
) {
  const { ownMemberActor } = await import("./member-identity.ts");
  const { getMemberRecord } = await import("./member-records.ts");
  const { today } = await import("./example-accounts.ts");
  const actor = await ownMemberActor(context);
  const member = await getMemberRecord(actor);
  const now = today();
  if (input.op === "clear") await clearNotice(member.id);
  if (input.op === "save")
    await saveNotice(member.id, input.printed ?? "", input.arrived ?? null, now);
  const [row] = await getDb()
    .select({ printed: members.noticePrinted, arrived: members.noticeArrived })
    .from(members)
    .where(eq(members.id, member.id));
  if (!row?.printed) return { printed: null, arrived: null, dates: null, today: now };
  return { printed: row.printed, arrived: row.arrived, dates: noticeDates(row.printed, row.arrived), today: now };
}
