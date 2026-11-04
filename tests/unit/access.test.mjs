import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_PAGES,
  PUBLIC_DATA_PATHS,
  isPublicData,
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

test("Public page data requests stay public without opening member data", () => {
  for (const path of [...PUBLIC_DATA_PATHS, "/states/ne.data"]) {
    assert.equal(isPublicData(path), true);
    assert.equal(isAllowedRequest(path, "GET"), true);
    assert.equal(isAllowedRequest(path, "POST"), false);
  }
  for (const path of [
    "/months.data",
    "/navigator.data",
    "/database.data",
    "/states/ne/profile.data",
  ])
    assert.equal(isPublicData(path), false);
});

test("The document readers are reachable only as allowed services", () => {
  for (const name of ["extract_evidence", "try_read_document"]) {
    assert.equal(
      isAllowedRequest(`/_agent-native/actions/${name}`, "POST"),
      true,
    );
    assert.equal(isPublicPage(`/_agent-native/actions/${name}`), false);
  }
});
