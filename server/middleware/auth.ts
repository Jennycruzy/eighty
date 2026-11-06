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
  sendRedirect,
} from "h3";

import {
  EXAMPLE_ENTER_PATH,
  isAllowedRequest,
  isExampleAllowedRequest,
  isPublicPage,
  isPublicData,
  isStaticFile,
  isMemberPage,
} from "../../shared/access.ts";
import {
  reservePublicModelUse,
  PUBLIC_HELPER_REST,
  PUBLIC_HELPER_REST_ES,
} from "../lib/try-reading.ts";
import {
  assertSameSite,
  requireExampleAccount,
} from "../lib/example-accounts.ts";
import { isExampleEmail } from "../lib/example-identity.ts";
import { registrationStatus } from "../lib/registration.ts";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  const former = "/\x64emo";
  if (path === former || path === `${former}.data`) {
    return sendRedirect(event, `/example${getRequestURL(event).search}`, 301);
  }
  if (
    [
      "/_agent-native/actions/inspect_document",
      "/_agent-native/actions/upload_document",
      "/_agent-native/actions/try_read_document",
    ].includes(path)
  )
    assertBodySize(event, 22 * 1024 * 1024);
  // Deny unknown services as well as screens. A hidden navigation link is not a permission check.
  if (!isAllowedRequest(path, getMethod(event))) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }
  if (isPublicPage(path) || isPublicData(path) || isStaticFile(path)) return;
  // Signed-out visitors open the example. The handlers check the origin, the
  // per-visitor limit and the one-time ticket.
  if (
    path === EXAMPLE_ENTER_PATH ||
    path === "/_agent-native/actions/start_example"
  ) {
    event.res.headers.set("Cache-Control", "private, no-store");
    if (getMethod(event) !== "POST")
      throw createError({ statusCode: 405, statusMessage: "Use POST" });
    return;
  }
  const session = await getBrowserCookieSession(event);
  if (path === "/_agent-native/month-helper" && getMethod(event) === "POST") {
    assertSameSite(event.req.headers);
    if (session?.emailVerified !== true)
      throw createError({ statusCode: 401, statusMessage: "Sign in required" });
    const visitor = isExampleEmail(session.email)
      ? (
          await requireExampleAccount({
            caller: "frontend",
            userEmail: session.email,
            requestHeaders: event.req.headers,
          })
        ).account.visitor
      : null;
    if (
      visitor &&
      !(await reservePublicModelUse(
        event.req.headers,
        "example_agent_turn",
        visitor,
      ))
    ) {
      throw createError({
        statusCode: 429,
        statusMessage: event.req.headers
          .get("accept-language")
          ?.startsWith("es")
          ? PUBLIC_HELPER_REST_ES
          : PUBLIC_HELPER_REST,
      });
    }
  }
  // Checked on the server for every request, not by hiding links.
  if (
    isExampleEmail(session?.email) &&
    !isExampleAllowedRequest(path, getMethod(event))
  )
    throw createError({
      statusCode: 403,
      statusMessage: "This is not part of the example.",
    });
  if (path === "/send-verification-link") {
    if (getMethod(event) !== "POST")
      throw createError({ statusCode: 405, statusMessage: "Use POST" });
    return;
  }
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
  const redirectPage = (target: string) => {
    const response = sendRedirect(event, target, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const url = getRequestURL(event);
  const pageLoad =
    ["GET", "HEAD"].includes(getMethod(event)) &&
    isMemberPage(path) &&
    !path.endsWith(".data");
  const language = url.searchParams.get("lang");
  const query = new URLSearchParams();
  if (language !== null) query.set("lang", language);
  if (
    pageLoad &&
    isExampleEmail(session?.email) &&
    (path === "/months" || path.startsWith("/months/"))
  ) {
    return redirectPage(`/example${query.size ? `?${query}` : ""}`);
  }
  if (isMemberPage(path) && session?.emailVerified !== true) {
    if (pageLoad) {
      if (path === "/example")
        return redirectPage(
          `/${query.size ? `?${query}` : ""}#example-start-title`,
        );
      query.set("next", `${path}${url.search}`);
      return redirectPage(`/check/sign-in?${query}`);
    }
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  }
  return runAuthGuard(event);
});
