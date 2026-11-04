import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  MAX_DOCUMENT_BYTES,
  documentUpload,
  isBase64,
} from "../../shared/document-upload.ts";

const MAX_LENGTH = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4;
const MB = 1024 * 1024;
const accepts = (data) => documentUpload.safeParse({ data }).success;

// The earlier pattern, kept here only to prove the new check agrees with it on
// short strings, where it still works.
const earlier =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function* strings(alphabet, length) {
  if (!length) return yield "";
  for (const rest of strings(alphabet, length - 1))
    for (const char of alphabet) yield rest + char;
}

test("Base64 data at the largest allowed size is accepted, quickly", () => {
  const data = randomBytes(MAX_DOCUMENT_BYTES).toString("base64");
  assert.equal(data.length, MAX_LENGTH);
  const started = performance.now();
  const parsed = documentUpload.parse({ data });
  const elapsed = performance.now() - started;
  assert.equal(parsed.data.length, MAX_LENGTH);
  assert(elapsed < 1000, `parsing took ${Math.round(elapsed)} ms`);
});

test("Base64 data of 5 MB, 8 MB and just under 15 MB with padding is accepted", () => {
  for (const bytes of [5 * MB, 8 * MB, MAX_DOCUMENT_BYTES - 2]) {
    const data = randomBytes(bytes).toString("base64");
    assert(data.endsWith("="));
    assert.equal(accepts(data), true, `${bytes} bytes`);
  }
  assert(
    randomBytes(MAX_DOCUMENT_BYTES - 2)
      .toString("base64")
      .endsWith("=="),
  );
});

test("Short valid base64 with no padding, one = or two = is accepted", () => {
  for (const data of ["YWJj", "YWI=", "YQ==", "YWJjZA==", "+/+/", "AAAAAAA="])
    assert.equal(accepts(data), true, data);
});

test("Malformed base64 and data over the limit are refused", () => {
  for (const data of [
    "YWJjZ",
    "YWJjZA=",
    "YW=j",
    "YQ==YWJj",
    "Y===",
    "YWJjZ===",
    "====",
    "YW-j",
    "YW_j",
    "YW j",
    "YWJj\n",
    "YW\nJj",
    "YWJj ",
    "\tYWJj",
  ])
    assert.equal(accepts(data), false, JSON.stringify(data));
  const big = randomBytes(MAX_DOCUMENT_BYTES).toString("base64");
  assert.equal(accepts(`${big}AAAA`), false);
});

test("The new check accepts exactly the strings the earlier pattern accepted", () => {
  let compared = 0;
  for (let length = 0; length <= 6; length++)
    for (const value of strings(
      ["A", "z", "0", "+", "/", "=", "-", "\n"],
      length,
    )) {
      assert.equal(isBase64(value), earlier.test(value), JSON.stringify(value));
      compared++;
    }
  for (const value of strings(["A", "=", "_"], 8)) {
    assert.equal(isBase64(value), earlier.test(value), JSON.stringify(value));
    compared++;
  }
  assert.equal(compared, (8 ** 7 - 1) / 7 + 3 ** 8);
});
