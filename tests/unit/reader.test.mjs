import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { startLocalS3 } from "../helpers/local-s3.mjs";
import { TEST_ENGINE } from "../helpers/reader-engine.mjs";

const execute = promisify(execFile);
// The child is its own test run, not part of this one.
const { NODE_TEST_CONTEXT: _testContext, ...parentEnv } = process.env;
// Each reader check file runs in its own process with a disposable PGlite
// database, a local S3 transport and the test engine selected through the
// framework's AGENT_ENGINE setting. Everything else is real app and framework code.
async function runReaderCheck(name, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), "eighty-reader-"));
  const storage = await startLocalS3();
  const file = fileURLToPath(
    new URL(`../reader-checks/${name}.check.mjs`, import.meta.url),
  );
  try {
    const { stdout } = await execute(
      process.execPath,
      ["--test", "--test-reporter=tap", file],
      {
        cwd: directory,
        timeout: 300_000,
        maxBuffer: 20_000_000,
        env: {
          ...parentEnv,
          ...storage.env,
          NODE_ENV: "test",
          DATABASE_URL: `pglite:${join(directory, "db")}`,
          NETLIFY_DATABASE_URL: "",
          AGENT_ENGINE: TEST_ENGINE,
          ...env,
        },
      },
    );
    assert.match(stdout, /# fail 0/);
    assert.doesNotMatch(stdout, /# pass 0\b/);
    return { stdout, storage };
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    const failed = String(error.stdout || "")
      .split("\n")
      .filter((line) =>
        /^\s*(not ok|# fail|error:|expected|actual|message)/.test(line),
      )
      .join("\n");
    assert.fail(`${name} checks failed:\n${failed || error.message}`);
  } finally {
    await storage.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("Reader: parsing, refusals, fencing and the PDF page limit", async () => {
  await runReaderCheck("reader");
});

test("Extraction: owner check, proposed lines only, no duplicates, one ledger row per call", async () => {
  const { storage } = await runReaderCheck("extraction");
  for (const data of storage.objects.values())
    assert.equal(
      data.subarray(1, 4).equals(Buffer.from("PNG")) ||
        data.subarray(0, 5).equals(Buffer.from("%PDF-")),
      false,
      "Stored documents stay encrypted",
    );
});

test("Try mode: in memory only, nothing stored, visitor limits and a daily budget", async () => {
  const { storage } = await runReaderCheck("try", {
    EIGHTY_TRY_READS_PER_VISITOR: "2",
    EIGHTY_TRY_READS_PER_DAY: "3",
  });
  assert.equal(storage.writes(), 0, "Try mode never writes to storage");
});
