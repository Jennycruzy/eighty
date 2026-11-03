import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PUBLIC_PAGES } from "../shared/access.ts";
const states = JSON.parse(
  await readFile(new URL("../data/states.json", import.meta.url), "utf8"),
);
export async function checkPublicHeads(baseUrl) {
  const pages = [
    ...PUBLIC_PAGES,
    ...states.map((state) => `/states/${state.code.toLowerCase()}`),
  ];
  const paths = [
    ...pages.flatMap((path) => [path, `${path}?lang=es`]),
    "/robots.txt",
    "/sitemap.xml",
  ];
  // These fields describe individual network requests, not the page representation.
  const variable = new Set([
    "date",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "server-timing",
    "x-agent-native-request-id",
  ]);
  for (const path of paths) {
    const options = {
      redirect: "manual",
      headers: { "accept-encoding": "identity" },
      signal: AbortSignal.timeout(15000),
    };
    const get = await fetch(baseUrl + path, options);
    const head = await fetch(baseUrl + path, { ...options, method: "HEAD" });
    assert.equal(get.status, 200, `GET ${path}`);
    if (path.startsWith("/check/account"))
      assert.match(
        get.headers.get("cache-control"),
        /no-store/,
        "Account callbacks must not be cached",
      );
    assert.equal(head.status, get.status, `HEAD ${path} must match GET`);
    assert.equal(
      (await head.arrayBuffer()).byteLength,
      0,
      `HEAD ${path} must have no body`,
    );
    for (const [name, value] of get.headers)
      if (!variable.has(name))
        assert.equal(
          head.headers.get(name),
          value,
          `HEAD ${path}: ${name} must match GET`,
        );
    await get.body?.cancel();
  }
  console.log(
    `PASS HEAD matches GET status and page headers, without a body, on ${paths.length} public addresses.`,
  );
}
