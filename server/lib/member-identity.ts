import type { ActionRunContext } from "@agent-native/core/action";
import {
  getBrowserCookieSession,
  getRequestContext,
  getBetterAuthUserIdForEmail,
} from "@agent-native/core/server";
import { getDbExec } from "@agent-native/core/db";
import { H3Event, createError } from "h3";

import { isExampleEmail } from "./example-identity.ts";

import { linkedTelegramActor } from "./telegram-links.ts";
import {
  requireMemberIdentity,
  requireMemberReview,
} from "./evidence-permissions.ts";
export interface MemberActor {
  email: string;
  userId: string;
}
export async function memberActor(
  context: ActionRunContext | undefined,
): Promise<MemberActor> {
  const email = requireMemberIdentity(context);
  const ambient = getRequestContext();
  if (ambient?.userEmail && ambient.userEmail !== email)
    throw createError({
      statusCode: 403,
      statusMessage: "This request has a different account identity",
    });
  const userId =
    ambient?.authUserId || (await getBetterAuthUserIdForEmail(email));
  if (!userId)
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  return { email, userId };
}
export async function reviewedMemberActor(
  context: ActionRunContext | undefined,
): Promise<MemberActor> {
  const email = requireMemberReview(context);
  if (!context?.requestHeaders)
    throw createError({
      statusCode: 403,
      statusMessage: "Review this evidence in your account",
    });
  const event = new H3Event(
    new Request("http://localhost/eighty-review", {
      headers: context.requestHeaders,
    }),
  );
  const session = await getBrowserCookieSession(event);
  if (session?.email !== email || session.emailVerified !== true)
    throw createError({
      statusCode: 403,
      statusMessage: "Verify your email before reviewing evidence",
    });
  const userId = session.authUserId || session.userId;
  if (!userId)
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  return { email, userId };
}

export async function browserMemberActor(
  context: ActionRunContext | undefined,
): Promise<MemberActor> {
  const email = requireMemberIdentity(context);
  if (!context?.requestHeaders)
    throw createError({
      statusCode: 403,
      statusMessage: "Sign in on this device",
    });
  const session = await getBrowserCookieSession(
    new H3Event(
      new Request("http://localhost/eighty-document", {
        headers: context.requestHeaders,
      }),
    ),
  );
  if (session?.email !== email || session.emailVerified !== true)
    throw createError({
      statusCode: 403,
      statusMessage: "Verify your email first",
    });
  const userId = session.authUserId || session.userId;
  if (!userId)
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  return { email, userId };
}

/** The Telegram chat a framework message run came from, if it came from one. */
function telegramChatOf(ambient: object): string | null {
  const incoming = (
    ambient as {
      integration?: {
        incoming?: { platform?: string; platformContext?: { chatId?: unknown } };
      };
    }
  ).integration?.incoming;
  const chatId = incoming?.platformContext?.chatId;
  return incoming?.platform === "telegram" &&
    (typeof chatId === "string" || typeof chatId === "number")
    ? String(chatId)
    : null;
}
/**
 * An MCP tool call from an assistant the member connected (Claude, for one).
 * The framework sets the account id only after it verified the MCP token for
 * that user (a stateless connection carries no request id, so that is not used). The member's email must
 * be verified, and example accounts never connect.
 */
async function mcpMemberActor(
  context: ActionRunContext | undefined,
  ambient: ReturnType<typeof getRequestContext>,
): Promise<MemberActor | null> {
  if (
    context?.caller !== "mcp" ||
    !context.userEmail ||
    !ambient?.authUserId ||
    ambient.userEmail !== context.userEmail ||
    ambient.agentRunAnonymous ||
    isExampleEmail(context.userEmail)
  )
    return null;
  const { rows } = await getDbExec().execute({
    sql: 'SELECT id, email_verified FROM "user" WHERE email = ?',
    args: [context.userEmail],
  });
  const row = rows[0] as { id?: string; email_verified?: unknown } | undefined;
  const verified = row?.email_verified === true || row?.email_verified === 1 || row?.email_verified === "t";
  if (!row || row.id !== ambient.authUserId || !verified)
    throw createError({ statusCode: 403, statusMessage: "Verify your email first" });
  return { email: context.userEmail, userId: ambient.authUserId };
}

export async function ownMemberActor(
  context: ActionRunContext | undefined,
): Promise<MemberActor> {
  const ambient = getRequestContext();
  const mcp = await mcpMemberActor(context, ambient);
  if (mcp) return mcp;
  if (
    context?.caller === "tool" &&
    ambient?.userEmail === context.userEmail &&
    ambient?.authUserId &&
    !ambient.agentRunAnonymous
  ) {
    return memberActor(context);
  }
  // A message from a linked Telegram chat runs the member's helper with only
  // the member's email in context. The link, made from the member's own
  // verified browser session, supplies the account id.
  if (
    context?.caller === "tool" &&
    context.userEmail &&
    ambient?.userEmail === context.userEmail &&
    !ambient.authUserId &&
    !ambient.agentRunAnonymous &&
    (ambient as { isIntegrationCaller?: boolean }).isIntegrationCaller ===
      true &&
    telegramChatOf(ambient)
  ) {
    const linked = await linkedTelegramActor(
      context.userEmail,
      telegramChatOf(ambient)!,
    );
    if (linked) {
      ambient.authUserId = linked.userId;
      return linked;
    }
  }
  return browserMemberActor(context);
}
