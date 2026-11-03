import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";

import {
  decodeSlotState,
  withDecodeSlot,
} from "../../server/lib/decode-slots.ts";
import { inspectDocument } from "../../server/lib/document-content.ts";

const fixture = await readFile(
  new URL("../fixtures/documents/pay.png", import.meta.url),
);

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const settle = () => wait(5);

function hold() {
  const latch = deferred(),
    started = deferred();
  const done = withDecodeSlot(() => {
    started.resolve();
    return latch.promise;
  });
  return { started: started.promise, release: latch.resolve, done };
}

test("At most two decodes run together; a third starts only after one finishes", async () => {
  let active = 0,
    most = 0;
  const started = [],
    latches = [deferred(), deferred(), deferred()];
  const calls = latches.map((latch, index) =>
    withDecodeSlot(async () => {
      started.push(index);
      active++;
      most = Math.max(most, active);
      await latch.promise;
      active--;
      return index;
    }),
  );
  await settle();
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(decodeSlotState(), { running: 2, waiting: 1 });
  latches[1].resolve();
  await settle();
  assert.deepEqual(started, [0, 1, 2]);
  latches[0].resolve();
  latches[2].resolve();
  assert.deepEqual(await Promise.all(calls), [0, 1, 2]);
  assert.equal(most, 2);
  assert.deepEqual(decodeSlotState(), { running: 0, waiting: 0 });
});

test("A decode that throws still frees its slot", async () => {
  const first = hold();
  await first.started;
  const failing = deferred();
  const broken = withDecodeSlot(() => failing.promise);
  let ran = false;
  const next = withDecodeSlot(() => {
    ran = true;
    return "next";
  });
  await settle();
  assert.equal(ran, false);
  failing.reject(new Error("decode failed"));
  await assert.rejects(broken, /decode failed/);
  assert.equal(await next, "next");
  assert.equal(ran, true);
  await assert.rejects(
    withDecodeSlot(() => {
      throw new Error("sync failure");
    }),
    /sync failure/,
  );
  first.release();
  await first.done;
  assert.deepEqual(decodeSlotState(), { running: 0, waiting: 0 });
});

test("Waiting decodes start first come, first served", async () => {
  const a = hold(),
    b = hold();
  await Promise.all([a.started, b.started]);
  const order = [];
  const queued = ["one", "two", "three", "four"].map((name) =>
    withDecodeSlot(() => {
      order.push(name);
    }),
  );
  await settle();
  assert.deepEqual(order, []);
  assert.equal(decodeSlotState().waiting, 4);
  a.release();
  await Promise.all(queued);
  assert.deepEqual(order, ["one", "two", "three", "four"]);
  b.release();
  await Promise.all([a.done, b.done]);
  assert.deepEqual(decodeSlotState(), { running: 0, waiting: 0 });
});

test("A caller that waits too long gets a 503 and never runs", async () => {
  const a = hold(),
    b = hold();
  await Promise.all([a.started, b.started]);
  let ran = false;
  const late = withDecodeSlot(
    () => {
      ran = true;
    },
    { waitMs: 20 },
  );
  const after = withDecodeSlot(() => "after");
  await assert.rejects(late, (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(
      error.statusMessage,
      "The server is busy reading other files. Try again in a minute.",
    );
    return true;
  });
  assert.deepEqual(decodeSlotState(), { running: 2, waiting: 1 });
  a.release();
  assert.equal(await after, "after");
  b.release();
  await Promise.all([a.done, b.done]);
  await settle();
  assert.equal(ran, false);
  assert.deepEqual(decodeSlotState(), { running: 0, waiting: 0 });
});

test("A started decode is not cut off by the wait limit", async () => {
  const result = await withDecodeSlot(
    async () => {
      await wait(40);
      return "finished";
    },
    { waitMs: 10 },
  );
  assert.equal(result, "finished");
});

test("inspectDocument waits for a free slot; the size check does not", async () => {
  const a = hold(),
    b = hold();
  await Promise.all([a.started, b.started]);
  await assert.rejects(inspectDocument(Buffer.alloc(0), 0), (error) => {
    assert.equal(error.statusCode, 413);
    return true;
  });
  let finished = false;
  const reading = inspectDocument(fixture, 0).then((result) => {
    finished = true;
    return result;
  });
  await wait(100);
  assert.equal(finished, false);
  assert.deepEqual(decodeSlotState(), { running: 2, waiting: 1 });
  a.release();
  const result = await reading;
  assert.equal(result.mime, "image/png");
  assert.equal(typeof result.preview, "string");
  b.release();
  await Promise.all([a.done, b.done]);
  assert.deepEqual(decodeSlotState(), { running: 0, waiting: 0 });
});
