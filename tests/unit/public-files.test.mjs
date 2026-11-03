import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PUBLIC_PAGES } from "../../shared/access.ts";
const states = JSON.parse(
  await readFile(new URL("../../data/states.json", import.meta.url), "utf8"),
);
test("Container inputs exclude hidden files through one general rule", async () => {
  const lines = (
    await readFile(new URL("../../.dockerignore", import.meta.url), "utf8")
  )
    .split(/\r?\n/)
    .filter((line) => line.startsWith("."));
  assert.deepEqual(lines, [".*"]);
});
test("Public search files list every public address and no member page", async () => {
  const root = new URL("../../public/", import.meta.url);
  const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
  const robots = await readFile(new URL("robots.txt", root), "utf8");
  const expectedPaths = [
    ...PUBLIC_PAGES,
    ...states.map((s) => `/states/${s.code.toLowerCase()}`),
  ];
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1].replaceAll("&amp;", "&")),
  );
  assert.equal(urls.length, expectedPaths.length * 2);
  assert.equal(new Set(urls.map((u) => u.href)).size, urls.length);
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Disallow: \/\n/);
  for (const path of expectedPaths) {
    for (const lang of ["", "?lang=es"]) {
      assert(
        urls.some((u) => u.pathname === path && u.search === lang),
        `${path}${lang} missing from sitemap`,
      );
      assert(
        robots.includes(`Allow: ${path}${lang}$\n`),
        `${path}${lang} missing from robots`,
      );
    }
  }
  for (const u of urls) {
    assert.equal(u.protocol, "https:");
    assert.equal(u.origin, "https://tryeighty.space");
  }
  assert(!sitemap.includes("/months"));
  assert(!sitemap.includes("/navigator"));
  assert.match(robots, /Sitemap: https:\/\/tryeighty\.space\/sitemap.xml/);
});
test("HTTPS policy lasts one year without preload", async () => {
  const config = await readFile(
    new URL("../../deploy/Caddyfile", import.meta.url),
    "utf8",
  );
  assert.match(config, /Strict-Transport-Security "max-age=31536000"/);
  assert(!config.includes("preload"));
});
