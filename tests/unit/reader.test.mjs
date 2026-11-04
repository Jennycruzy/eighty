import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { TEST_ENGINE } from "../helpers/reader-engine.mjs";

const execute = promisify(execFile);
// The child is its own test run, not part of this one.
const { NODE_TEST_CONTEXT: _testContext, ...parentEnv } = process.env;
// Each reader check file runs in its own process with a disposable PGlite
// database and the test engine selected through the framework's AGENT_ENGINE
// setting. Everything else is the app's and the framework's real code.
export async function runReaderCheck(name, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), "eighty-reader-"));
  const file = fileURLToPath(
    new URL(`../reader-checks/${name}.check.mjs`, import.meta.url),
  );
  try {
    const { stdout } = await execute(
      process.execPath,
      ["--test", "--test-reporter=tap", file],
      {
        cwd: directory,
        timeout: 240_000,
        maxBuffer: 20_000_000,
        env: {
          ...parentEnv,
          NODE_ENV: "test",
          DATABASE_URL: `pglite:${join(directory, "db")}`,
          NETLIFY_DATABASE_URL: "",
          AGENT_ENGINE: TEST_ENGINE,
          ...env,
        },
      },
    );
    return stdout;
  } catch (error) {
    const failed = String(error.stdout || "")
      .split("\n")
      .filter((line) => /^\s*(not ok|# fail|error:|expected|actual)/.test(line))
      .join("\n");
    assert.fail(`${name} checks failed:\n${failed || error.message}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("Reader: parsing, refusals, fencing and the PDF page limit", async () => {
  const output = await runReaderCheck("reader");
  assert.match(output, /# fail 0/);
  assert.doesNotMatch(output, /# pass 0\b/);
});
