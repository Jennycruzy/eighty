import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PUBLIC_PAGES } from "../shared/access.ts";
const states = JSON.parse(
  await readFile(new URL("../data/states.json", import.meta.url), "utf8"),
);
export async function checkPublicIndex(baseUrl) {
  const robots = await fetch(`${baseUrl}/robots.txt`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(robots.status, 200, "robots.txt must load without an account");
  assert.match(robots.headers.get("content-type"), /text\/plain/);
  const rules = await robots.text();
  const sitemap = await fetch(`${baseUrl}/sitemap.xml`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(sitemap.status, 200, "sitemap.xml must load without an account");
  assert.match(
    sitemap.headers.get("content-type"),
    /(?:application|text)\/xml/,
  );
  const xml = await sitemap.text();
  const paths = [
    ...PUBLIC_PAGES,
    ...states.map((s) => `/states/${s.code.toLowerCase()}`),
  ];
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1].replaceAll("&amp;", "&")),
  );
  assert.equal(locations.length, paths.length * 2);
  for (const path of paths)
    for (const language of ["", "?lang=es"]) {
      assert(
        locations.some((u) => u.pathname === path && u.search === language),
        `Sitemap must include ${path}${language}`,
      );
      assert(rules.includes(`Allow: ${path}${language}$\n`));
    }
  assert(
    !xml.includes("/months") &&
      !xml.includes("/navigator") &&
      !xml.includes("/admin"),
  );
  console.log(
    "PASS Public search files load signed out and list all 130 public language addresses.",
  );
}
