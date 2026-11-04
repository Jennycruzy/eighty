import { assertBodySize, defineEventHandler, readBody, setCookie } from "h3";

import { enterDemo } from "../lib/demo-accounts.ts";

// Signs the visitor in to the demo account that start_demo made, once.
export default defineEventHandler(async (event) => {
  event.res.headers.set("Cache-Control", "private, no-store");
  assertBodySize(event, 1024);
  const body = await readBody(event).catch(() => null);
  const result = await enterDemo(event, body);
  // A plain hint for the page to show the demo band. It grants nothing; the
  // server reads the real session on every request.
  setCookie(event, "eighty_demo", "1", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60,
  });
  return result;
});
