import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import { SITE_ORIGIN } from "../shared/site.ts";
import { checkPublicHeads } from "./check-public-heads.mjs";
import { checkPublicPages } from "./check-public-pages.mjs";
export async function checkDomain() {
  for (const hostname of ["tryeighty.space", "www.tryeighty.space"]) {
    const response = await fetch(`https://${hostname}/`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(
      response.headers.get("strict-transport-security"),
      "max-age=31536000",
    );
    assert.equal(response.status, hostname === "tryeighty.space" ? 200 : 301);
    console.log(
      `PASS Trusted HTTPS certificate and HTTPS policy for ${hostname}.`,
    );
  }
  const suffix = "/check?lang=es&from=share";
  for (const origin of [
    "https://www.tryeighty.space",
    "http://www.tryeighty.space",
    "https://38.49.219.205.sslip.io",
    "http://38.49.219.205.sslip.io",
    "http://38.49.219.205",
    "http://tryeighty.space",
  ]) {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(origin + suffix, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
      assert(
        [301, 308].includes(response.status),
        `${method} ${origin} must permanently redirect`,
      );
      assert.equal(response.headers.get("location"), SITE_ORIGIN + suffix);
    }
  }
  console.log(
    "PASS Permanent redirects preserve the path and query for GET and HEAD.",
  );
  await checkPublicPages(SITE_ORIGIN);
  await checkPublicHeads(SITE_ORIGIN);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href)
  await checkDomain();
