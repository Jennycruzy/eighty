import type { ActionRunContext } from "@agent-native/core/action";
import { createError } from "h3";

export function requireMemberIdentity(
  context: ActionRunContext | undefined,
): string {
  if (!context?.userEmail)
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  return context.userEmail;
}
export function requireMemberReview(
  context: ActionRunContext | undefined,
): string {
  const email = requireMemberIdentity(context);
  // Pair this check with uiOnly on the action and a verified browser session.
  // The caller label alone is not proof of a browser.
  // Terminal flags, model approvals and an external assistant's approval do not count.
  if (context?.caller !== "frontend")
    throw createError({
      statusCode: 403,
      statusMessage: "Review this evidence in your account",
    });
  return email;
}
