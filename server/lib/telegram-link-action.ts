import type { ActionRunContext } from "@agent-native/core/action";
import { eq } from "drizzle-orm";

import { getDb } from "../db/index.ts";
import { members } from "../db/schema.ts";

import { reviewedMemberActor } from "./member-identity.ts";
import { configuredBotName, telegramBotToken } from "./telegram-config.ts";
import { setCheckins } from "./member-reminders.ts";
import { getMemberRecord } from "./member-records.ts";
import {
  createLinkCode,
  linkForMember,
  unlinkMember,
} from "./telegram-links.ts";

export type MemberLanguage = "en-US" | "es-US";
/** The language the bot hears voice notes in and answers in. */
export async function setMemberLanguage(
  memberId: string,
  language: MemberLanguage,
) {
  await getDb()
    .update(members)
    .set({ language, updatedAt: new Date() })
    .where(eq(members.id, memberId));
}

let botName: Promise<string | null> | null = null;
/** The bot's @username, read once from Telegram with the deployment's token. */
export function telegramBotName(): Promise<string | null> {
  botName ??= (async () => {
    const configured = configuredBotName();
    if (configured) return configured;
    const token = telegramBotToken();
    if (!token) return null;
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        result?: { username?: string };
      };
      return data.ok ? (data.result?.username ?? null) : null;
    } catch {
      return null;
    }
  })().then((name) => {
    if (!name) botName = null;
    return name;
  });
  return botName;
}

/**
 * Linking starts from the member's own verified browser session, never from a
 * chat or an agent: the code proves the chat belongs to this account.
 */
export async function telegramLink(
  op: "status" | "code" | "unlink" | "language" | "checkins",
  context: ActionRunContext | undefined,
  language?: MemberLanguage,
  on?: boolean,
) {
  const actor = await reviewedMemberActor(context);
  const member = await getMemberRecord(actor);
  const bot = await telegramBotName();
  if (op === "unlink") await unlinkMember(member.id);
  if (op === "language" && language) {
    await setMemberLanguage(member.id, language);
    member.language = language;
  }
  if (op === "checkins" && typeof on === "boolean") await setCheckins(member.id, on);
  const link = await linkForMember(member.id);
  const base = {
    available: Boolean(bot),
    bot,
    linked: Boolean(link),
    linkedAt: link?.createdAt?.toISOString() ?? null,
    checkins: link ? link.checkins : null,
    language: member.language === "es-US" ? "es-US" : "en-US",
  };
  if (op !== "code" || !bot) return { ...base, code: null, url: null };
  const { code, expiresAt } = await createLinkCode(actor, member.id);
  return {
    ...base,
    code,
    expiresAt,
    url: `https://t.me/${bot}?start=${code}`,
  };
}
