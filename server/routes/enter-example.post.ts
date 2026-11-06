import { assertBodySize, defineEventHandler, readBody, setCookie } from "h3";

import { enterExample } from "../lib/example-accounts.ts";

// Signs the visitor in to the example account that start_example made, once.
export default defineEventHandler(async (event) => {
  event.res.headers.set("Cache-Control", "private, no-store");
  assertBodySize(event, 1024);
  const body = await readBody(event).catch(() => null);
  const result = await enterExample(event, body);
  // A plain hint for the page to show the example band. It grants nothing; the
  // server reads the real session on every request.
  setCookie(event, "eighty_example", "1", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60,
  });
  return result;
});
