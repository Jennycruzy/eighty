import type { ActionRunContext } from "@agent-native/core/action";
import { resolveSecret } from "@agent-native/core/server";

import { reviewedMemberActor } from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";
import {
  createLinkCode,
  linkForMember,
  unlinkMember,
} from "./telegram-links.ts";

let botName: Promise<string | null> | null = null;
/** The bot's @username, read once from Telegram with the deployment's token. */
export function telegramBotName(): Promise<string | null> {
  botName ??= (async () => {
    const configured = await resolveSecret("EIGHTY_TELEGRAM_BOT");
    if (configured) return configured.replace(/^@/, "");
    const token = await resolveSecret("TELEGRAM_BOT_TOKEN");
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
  op: "status" | "code" | "unlink",
  context: ActionRunContext | undefined,
) {
  const actor = await reviewedMemberActor(context);
  const member = await getMemberRecord(actor);
  const bot = await telegramBotName();
  if (op === "unlink") await unlinkMember(member.id);
  const link = await linkForMember(member.id);
  const base = {
    available: Boolean(bot),
    bot,
    linked: Boolean(link),
    linkedAt: link?.createdAt?.toISOString() ?? null,
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
