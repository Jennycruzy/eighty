// Caddy answers 404 for any path not on its list, before the app sees it.
// Every path the app lets through must also be on Caddy's list, or that page or action is dead on the live site.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EXAMPLE_ENTER_PATH,
  EXAMPLE_SAMPLE_FILES,
  HEALTH_PATH,
  MEMBER_PAGES,
  PUBLIC_DATA_PATHS,
  PUBLIC_PAGES,
  isExampleAllowedRequest,
  isMemberPage,
  isPublicData,
  isPublicPage,
  isStaticFile,
  servicePaths,
  staticFiles,
} from "../../shared/access.ts";

const caddyfile = readFileSync(
  new URL("../../deploy/Caddyfile", import.meta.url),
  "utf8",
);
const line = caddyfile
  .split("\n")
  .find((l) => l.trim().startsWith("@unpublished not path "));
const patterns = line
  .trim()
  .slice("@unpublished not path ".length)
  .split(/\s+/);

// Caddy's path matcher: exact, or "*" standing for any run of characters. It ignores case.
function caddyOpen(path) {
  const lower = path.toLowerCase();
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    if (!p.includes("*")) return p === lower;
    const re = new RegExp(
      `^${p
        .split("*")
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*")}$`,
    );
    return re.test(lower);
  });
}

const appPaths = [
  ...PUBLIC_PAGES,
  ...PUBLIC_DATA_PATHS,
  "/states/oh",
  "/states/oh.data",
  ...MEMBER_PAGES.flatMap((page) => [
    page,
    `${page}.data`,
    `${page}/2026-10`,
    `${page}/2026-10.data`,
  ]),
  ...staticFiles(),
  "/assets/entry.client-abc123.js",
  ...servicePaths(),
  ...EXAMPLE_SAMPLE_FILES,
  EXAMPLE_ENTER_PATH,
];

test("The lists the checks read agree with the app's own rules", () => {
  for (const path of PUBLIC_PAGES) assert.equal(isPublicPage(path), true, path);
  for (const path of PUBLIC_DATA_PATHS)
    assert.equal(isPublicData(path), true, path);
  for (const page of MEMBER_PAGES) assert.equal(isMemberPage(page), true, page);
  for (const path of staticFiles())
    assert.equal(isStaticFile(path), true, path);
});

for (const path of appPaths) {
  // /example/<anything> other than the two sample files is a member path the example itself refuses.
  if (path.startsWith("/example/") && !EXAMPLE_SAMPLE_FILES.includes(path))
    continue;
  test(`Caddy lets through what the app allows: ${path}`, () => {
    assert.equal(
      caddyOpen(path),
      true,
      `${path} is allowed by shared/access.ts but deploy/Caddyfile answers 404`,
    );
  });
}

for (const path of [
  "/_agent-native/actions/start_example",
  "/_agent-native/actions/example_month",
  EXAMPLE_ENTER_PATH,
  "/example",
  "/example.data",
  "/months.data",
  "/add/2026-10",
]) {
  test(`A path the example uses is open in Caddy: ${path}`, () => {
    assert.equal(
      isExampleAllowedRequest(
        path,
        path.startsWith("/_agent-native/") || path === EXAMPLE_ENTER_PATH
          ? "POST"
          : "GET",
      ),
      true,
    );
    assert.equal(caddyOpen(path), true);
  });
}

test("Caddy keeps the container health check closed from outside", () => {
  assert.equal(caddyOpen(HEALTH_PATH), false);
});

for (const path of [
  "/chat",
  "/terminal",
  "/_agent-native/actions/hello",
  "/_agent-native/agent-chat",
  "/example/other",
  "/database",
]) {
  test(`Caddy keeps a closed path closed: ${path}`, () => {
    assert.equal(caddyOpen(path), false);
  });
}
