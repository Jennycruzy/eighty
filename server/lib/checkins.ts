import { buildJobContent, parseJobFrontmatter } from "@agent-native/core/jobs";
import {
  ensureResourceStoreReady,
  resourceGetByPath,
  resourcePut,
  SHARED_OWNER,
} from "@agent-native/core/resources";
import { registerJobRunner } from "@agent-native/core/server";
import { eq } from "drizzle-orm";

import type { Lang } from "../../shared/telegram-words.ts";
import { getDb } from "../db/index.ts";
import { telegramLinks } from "../db/schema.ts";
import { today as todayIso } from "./example-accounts.ts";
import { getMemberRecord } from "./member-records.ts";
import { daysFrom, noticeReminder } from "./member-reminders.ts";
import { doMonth } from "./month-work.ts";
import { monthWorkText } from "./month-work-text.ts";
import { asMember, sendTelegramText } from "./telegram.ts";

export const CHECKIN_RUNNER = "eighty-month-check";
export const CHECKIN_JOB_PATH = "jobs/eighty-month-check.md";
/** Every day at 16:00 UTC: morning in the US. */
export const CHECKIN_SCHEDULE = "0 16 * * *";
/** The month check-in starts once a third of the month is gone. */
export const CHECKIN_FROM_DAY = 10;
const CHECKIN_EVERY_DAYS = 7;

const JOB_BODY = `Eighty's daily check-in. For each member who linked Telegram and kept check-ins on:
- from day ${CHECKIN_FROM_DAY} of the month, once a week, when the month is still short, send the plan from "Do my month";
- 7 days and 1 day before the reply date of a state letter the member saved, send a reminder.
At most one message a day. The member turns it off with /checkins off.
This job runs Eighty's own code; no model is used.`;

export interface CheckinCounts {
  chats: number;
  sent: number;
  monthPlans: number;
  reminders: number;
  failed: number;
}

/**
 * One pass of the daily check-in over every linked chat with check-ins on.
 * It reads each month with the same code the member's page uses, and only
 * sends; it never proposes, confirms or changes a line.
 */
export async function runCheckins(options: {
  today?: string;
  send?: (chatId: string, text: string) => Promise<void>;
  deadlineAt?: number;
} = {}): Promise<CheckinCounts> {
  const today = options.today ?? todayIso();
  const send = options.send ?? sendTelegramText;
  const links = await getDb()
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.checkins, true));
  const counts: CheckinCounts = { chats: links.length, sent: 0, monthPlans: 0, reminders: 0, failed: 0 };
  for (const link of links) {
    if (options.deadlineAt && Date.now() > options.deadlineAt) break;
    if (link.lastMessageOn === today) continue;
    const actor = { email: link.ownerEmail, userId: link.userId };
    try {
      const parts: string[] = [];
      let plan = false;
      let remind = false;
      await asMember(actor, async (context) => {
        const member = await getMemberRecord(actor);
        const lang: Lang = member.language === "es-US" ? "es" : "en";
        const reminder = noticeReminder(member.noticePrinted, member.noticeArrived, today, lang);
        if (reminder) {
          parts.push(reminder);
          remind = true;
        }
        const due =
          Number(today.slice(8, 10)) >= CHECKIN_FROM_DAY &&
          (!link.monthCheckinOn || daysFrom(link.monthCheckinOn, today) >= CHECKIN_EVERY_DAYS);
        if (due) {
          const work = await doMonth({ read: false }, context);
          if (!work.done && work.plan) {
            plan = true;
            parts.push(
              (lang === "es"
                ? "Reviso tu mes, como cada semana (/checkins off para dejar de recibirlo).\n\n"
                : "Checking in on your month, as every week (/checkins off to stop).\n\n") +
                monthWorkText(work, lang),
            );
          }
        }
      });
      if (!parts.length) continue;
      await send(link.chatId, parts.join("\n\n"));
      await getDb()
        .update(telegramLinks)
        .set({
          lastMessageOn: today,
          ...(plan ? { monthCheckinOn: today } : {}),
        })
        .where(eq(telegramLinks.chatId, link.chatId));
      counts.sent += 1;
      if (plan) counts.monthPlans += 1;
      if (remind) counts.reminders += 1;
    } catch (error) {
      counts.failed += 1;
      console.error("[eighty-checkins] chat failed:", error instanceof Error ? error.message : error);
    }
  }
  console.log("[eighty-checkins]", JSON.stringify(counts));
  return counts;
}

/** The job file the framework scheduler runs, written once at startup. */
export function checkinJobContent(schedule = CHECKIN_SCHEDULE) {
  return buildJobContent(
    {
      schedule,
      enabled: true,
      timezone: "UTC",
      runAs: "shared",
      runner: CHECKIN_RUNNER,
      mode: "deterministic",
      createdBy: "eighty",
    },
    JOB_BODY,
  );
}

/**
 * Registers the runner with the framework and makes sure its job file exists.
 * A job file that already has this runner and schedule keeps its run history.
 */
export async function setUpCheckins(schedule = CHECKIN_SCHEDULE) {
  registerJobRunner(CHECKIN_RUNNER, async (ctx) => {
    const counts = await runCheckins({ deadlineAt: ctx.deadlineAt });
    return counts.chats === 0
      ? { status: "skipped", reason: "No linked chat has check-ins on." }
      : { status: "success" };
  });
  await ensureResourceStoreReady();
  const existing = await resourceGetByPath(SHARED_OWNER, CHECKIN_JOB_PATH);
  if (existing) {
    const { meta } = parseJobFrontmatter(existing.content);
    if (meta.runner === CHECKIN_RUNNER && meta.schedule === schedule) return;
  }
  await resourcePut(SHARED_OWNER, CHECKIN_JOB_PATH, checkinJobContent(schedule), "text/markdown");
}

