import type { ActionRunContext } from "@agent-native/core/action";
import {
  getBrowserCookieSession,
  getRequestContext,
  getBetterAuthUserIdForEmail,
} from "@agent-native/core/server";
import { H3Event, createError } from "h3";

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
