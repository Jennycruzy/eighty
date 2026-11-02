import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_PAGES,
  isAllowedRequest,
  isMemberPage,
  isPublicPage,
} from "../../shared/access.ts";
for (const path of [...PUBLIC_PAGES, "/states/ne", "/states/DC"]) {
  test(`Signed-out public route: ${path}`, () => {
    assert.equal(isPublicPage(path), true);
    assert.equal(isAllowedRequest(path, "GET"), true);
    assert.equal(isMemberPage(path), false);
  });
}
for (const path of [
  "/home",
  "/chat",
  "/chat/abc",
  "/terminal",
  "/agent",
  "/database",
  "/extensions",
  "/observability",
  "/team",
  "/settings/agent",
  "/_agent-native/actions/hello",
  "/_agent-native/terminal",
  "/_agent-native/chat",
  "/_agent-native/auth/ba/sign-up/email",
]) {
  test(`Starter capability is closed: ${path}`, () => {
    assert.equal(isPublicPage(path), false);
    if (path === "/settings/agent") assert.equal(isMemberPage(path), true);
    else assert.equal(isAllowedRequest(path, "GET"), false);
    assert.equal(isAllowedRequest(path, "POST"), path === "/settings/agent");
  });
}
test("Public page matching does not expose nested services", () => {
  for (const path of [
    "/states/ne/profile",
    "/states/ne/admin",
    "/states/NE/../database",
    "/states/ne.json",
    "/proof/packets",
  ])
    assert.equal(isPublicPage(path), false);
  assert.equal(isAllowedRequest("/try", "POST"), false);
  assert.equal(isMemberPage("/months/2026-11"), true);
});
