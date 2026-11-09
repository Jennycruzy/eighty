// The helper reads its page state in one request; only those keys, only a read.
import assert from "node:assert/strict";
import test from "node:test";

const { isMonthStateBulk } = await import("../../shared/access.ts");
const path = "/_agent-native/application-state";

test("the helper may read its own two page-state keys together", () => {
  assert.equal(isMonthStateBulk(path, "GET", "?keys=navigate:e842846d-d359,guided-questions:e842846d-d359"), true);
  assert.equal(isMonthStateBulk(path, "GET", "?keys=navigation:abc"), true);
});

test("any other key, a write, or no keys is refused", () => {
  assert.equal(isMonthStateBulk(path, "GET", "?keys=navigate:abc,secrets"), false);
  assert.equal(isMonthStateBulk(path, "GET", "?keys=compose-draft:abc"), false);
  assert.equal(isMonthStateBulk(path, "PUT", "?keys=navigate:abc"), false);
  assert.equal(isMonthStateBulk(path, "GET", ""), false);
  assert.equal(isMonthStateBulk(`${path}/other`, "GET", "?keys=navigate:abc"), false);
});
