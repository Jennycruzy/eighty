import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { readerResult } from "../../shared/evidence.ts";
import { pdfText } from "../reading/pdf-text.ts";
import { scoreDocument } from "../reading/score.ts";
import { SAMPLE_MARK } from "../reading/make/draw.mjs";
import { documents, draw, fileName } from "../reading/make/catalog.mjs";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../reading/", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sets = JSON.parse(await readFile(path.join(root, "sets.json"), "utf8"));
const answerFor = async (name) =>
  JSON.parse(await readFile(path.join(root, "answers", name.replace(/\.\w+$/, ".json")), "utf8"));

test("sets.json lists every document once, in sets of at least 20 with every type in both, and its hashes match the files", async () => {
  const files = (await readdir(path.join(root, "documents"))).sort();
  const listed = [...sets.practice, ...sets.locked].map((item) => item.document).sort();
  assert.deepEqual(listed, files);
  assert(files.length >= 40);
  assert(sets.practice.length >= 20);
  assert(sets.locked.length >= 20);
  const types = new Set(listed.map((name) => documents.find((d) => fileName(d) === name).type));
  for (const type of types) {
    assert(sets.practice.some((item) => item.type === type), `practice has ${type}`);
    assert(sets.locked.some((item) => item.type === type), `locked has ${type}`);
  }
  for (const item of [...sets.practice, ...sets.locked])
    assert.equal(sha256(await readFile(path.join(root, "documents", item.document))), item.sha256, item.document);
});

test("Every answer fits the reader result shape and the real rules give its stated month outcome", async () => {
  for (const item of [...sets.practice, ...sets.locked]) {
    const answer = await answerFor(item.document);
    assert.equal(answer.document, item.document);
    assert(readerResult.safeParse(answer.expected).success, item.document);
    const score = scoreDocument(answer, answer.expected);
    assert(score.fields.every((field) => field.outcome === "correct"), item.document);
    assert.equal(score.outcome.actual, answer.expectedOutcome, item.document);
    for (const { proposal, question } of answer.unreadable)
      assert(answer.expected.proposals[proposal].questions.includes(question), item.document);
  }
  const outcomes = new Set(
    await Promise.all([...sets.practice, ...sets.locked].map(async (item) => (await answerFor(item.document)).expectedOutcome)),
  );
  assert.deepEqual([...outcomes].sort(), ["Meets", "Not sure yet", "Short"]);
});

test("Every document shows the made-up mark where a reader can see it", async () => {
  for (const document of documents) {
    if (document.format === "pdf") {
      const pages = await pdfText(await readFile(path.join(root, "documents", fileName(document))));
      for (const text of pages) assert(text.includes(SAMPLE_MARK), document.id);
      continue;
    }
    const { sheets, regions } = await draw(document);
    const crop = document.effects?.find((effect) => effect.kind === "crop");
    const blurred = (document.effects ?? []).filter((effect) => effect.kind === "blur").flatMap((effect) => effect.regions(regions));
    const visible = sheets[0].items.filter(
      (item) =>
        item.type === "text" &&
        item.value.includes(SAMPLE_MARK) &&
        (!crop || item.y < crop.box(regions, sheets[0]).h) &&
        !blurred.some((box) => item.y >= box.y && item.y <= box.y + box.h),
    );
    assert(visible.length, document.id);
  }
});

test("The make scripts are deterministic: two runs give the same SHA-256 for every file", { timeout: 240_000 }, async () => {
  const make = fileURLToPath(new URL("../reading/make/make.mjs", import.meta.url));
  const first = await mkdtemp(path.join(tmpdir(), "eighty-make-a-"));
  const second = await mkdtemp(path.join(tmpdir(), "eighty-make-b-"));
  try {
    const a = await run(process.execPath, [make, "--out", first], { maxBuffer: 1 << 20 });
    const b = await run(process.execPath, [make, "--out", second], { maxBuffer: 1 << 20 });
    assert.equal(a.stdout, b.stdout);
    const lines = a.stdout.trim().split("\n");
    assert.equal(lines.length, documents.length);
    for (const line of lines) {
      const [hash, name] = line.split(/\s+/);
      assert.equal(sha256(await readFile(path.join(first, name))), hash);
      assert.equal(sha256(await readFile(path.join(second, name))), hash);
    }
    // The committed files were made on Linux x64; other platforms build sharp's image libraries differently.
    if (process.platform === "linux" && process.arch === "x64") {
      const committed = Object.fromEntries([...sets.practice, ...sets.locked].map((item) => [item.document, item.sha256]));
      for (const line of lines) {
        const [hash, name] = line.split(/\s+/);
        assert.equal(hash, committed[name], name);
      }
    }
  } finally {
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});
