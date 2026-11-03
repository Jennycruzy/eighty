import assert from "node:assert/strict";
import test from "node:test";

import { readBodyWithSizeLimit } from "@agent-native/core/server";
import { H3Event } from "h3";

import inspect from "../../actions/inspect_document.ts";
import upload from "../../actions/upload_document.ts";
import { MAX_DOCUMENT_BYTES } from "../../shared/document-upload.ts";

for (const [name, action] of [
  ["upload_document", upload],
  ["inspect_document", inspect],
]) {
  test(`${name} refuses a declared oversized body with 413 before reading any bytes`, async () => {
    const base64Bytes = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4;
    assert.equal(
      typeof action.maxBodyBytes,
      "number",
      "The action must bound its body before parsing JSON",
    );
    assert(
      action.maxBodyBytes > base64Bytes &&
        action.maxBodyBytes <= base64Bytes + 4096,
    );
    let reads = 0;
    const stream = new ReadableStream(
      {
        pull(controller) {
          reads++;
          controller.enqueue(new Uint8Array([123]));
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("http://localhost/" + name, {
      method: "POST",
      headers: { "content-length": String(action.maxBodyBytes + 1) },
      body: stream,
      duplex: "half",
    });
    const event = new H3Event(request);
    await assert.rejects(
      readBodyWithSizeLimit(event, action.maxBodyBytes),
      (error) => error.statusCode === 413,
    );
    assert.equal(reads, 0);
    await stream.cancel();
  });
}

test("A chunked upload is stopped at the byte limit instead of buffering the rest", async () => {
  const limit = upload.maxBodyBytes;
  assert.equal(typeof limit, "number");
  let reads = 0,
    cancelled = false;
  const stream = new ReadableStream(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(Math.ceil(limit / 2) + 1));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const event = new H3Event(
    new Request("http://localhost/upload_document", {
      method: "POST",
      body: stream,
      duplex: "half",
    }),
  );
  await assert.rejects(
    readBodyWithSizeLimit(event, limit),
    (error) => error.statusCode === 413,
  );
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
});
