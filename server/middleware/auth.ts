import {
  getBrowserCookieSession,
  runAuthGuard,
} from "@agent-native/core/server";
import { createError, defineEventHandler, getMethod, getRequestURL } from "h3";

import {
  isAllowedRequest,
  isPublicPage,
  isStaticFile,
  isMemberPage,
} from "../../shared/access.ts";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  // Deny unknown services as well as screens. A hidden navigation link is not a permission check.
  if (!isAllowedRequest(path, getMethod(event))) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }
  if (isPublicPage(path) || isStaticFile(path)) return;
  if (isMemberPage(path) && !(await getBrowserCookieSession(event))) {
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  }
  return runAuthGuard(event);
});
