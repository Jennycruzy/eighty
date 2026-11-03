import {
  getBrowserCookieSession,
  runAuthGuard,
} from "@agent-native/core/server";
import {
  createError,
  defineEventHandler,
  getMethod,
  getRequestURL,
  assertBodySize,
} from "h3";

import {
  isAllowedRequest,
  isPublicPage,
  isPublicData,
  isStaticFile,
  isMemberPage,
} from "../../shared/access.ts";
import { registrationStatus } from "../lib/registration.ts";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (
    [
      "/_agent-native/actions/inspect_document",
      "/_agent-native/actions/upload_document",
    ].includes(path)
  )
    assertBodySize(event, 22 * 1024 * 1024);
  // Deny unknown services as well as screens. A hidden navigation link is not a permission check.
  if (!isAllowedRequest(path, getMethod(event))) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }
  if (isPublicPage(path) || isPublicData(path) || isStaticFile(path)) return;
  if (
    [
      "/_agent-native/actions/prepare_member_account",
      "/_agent-native/actions/finish_member_account",
      "/_agent-native/auth/ba/sign-up/email",
      "/_agent-native/auth/ba/verify-email",
      "/_agent-native/auth/email-link/landing",
    ].includes(path)
  ) {
    if (!(await registrationStatus()).open)
      throw createError({
        statusCode: 503,
        statusMessage:
          "Account creation is closed while email is being set up.",
      });
    if (
      path === "/_agent-native/auth/email-link/landing" &&
      getMethod(event) === "GET"
    ) {
      const callback = getRequestURL(event).searchParams.get("callbackURL");
      try {
        const language = new URL(
          callback || "/",
          getRequestURL(event).origin,
        ).searchParams.get("lang");
        if (language === "en" || language === "es")
          event.req.headers.set("accept-language", `${language}-US`);
      } catch {
        /* The auth handler validates malformed links. */
      }
    }
    if (path !== "/_agent-native/actions/finish_member_account") return;
  }
  if (isMemberPage(path) || path.startsWith("/_agent-native/actions/"))
    event.res.headers.set("Cache-Control", "private, no-store");
  if (
    isMemberPage(path) &&
    (await getBrowserCookieSession(event))?.emailVerified !== true
  ) {
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  }
  return runAuthGuard(event);
});
