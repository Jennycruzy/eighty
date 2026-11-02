import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { closeDbExec, getDbExec } from "@agent-native/core/db";
import { processRecurringJobs } from "@agent-native/core/jobs";
import { parseJobResource } from "@agent-native/core/jobs/frontmatter";
import {
  resourceGetByPath,
  resourcePut,
} from "@agent-native/core/resources/store";
import {
  getRequestUserEmail,
  registerJobRunner,
} from "@agent-native/core/server";

import "../server/plugins/agent-native-email-branding.ts";

const owner = process.argv[2];
assert.match(owner || "", /^eighty-check-[a-f0-9-]+@example\.test$/);
const path = `jobs/deployment-check-${randomUUID()}.md`;
const appId = "eighty-deployment-check";
let calls = 0;

const dispose = registerJobRunner(
  "eighty-deployment-check",
  async (context) => {
    assert.equal(getRequestUserEmail(), owner);
    assert.equal(context.ownerEmail, owner);
    assert.equal(context.manual, false);
    await context.assertCanContinue();
    calls += 1;
    await getDbExec().execute({
      sql: "INSERT INTO eighty_runner_receipts (id) VALUES (?)",
      args: [context.historyId],
    });
    return { status: "success" };
  },
);

try {
  await getDbExec().execute({
    sql: "CREATE TABLE eighty_runner_receipts (id text PRIMARY KEY)",
  });
  await resourcePut(
    owner,
    path,
    [
      "---",
      'schedule: "* * * * *"',
      `nextRun: "${new Date(Date.now() - 120_000).toISOString()}"`,
      "enabled: true",
      "triggerType: schedule",
      "runner: eighty-deployment-check",
      `appId: ${appId}`,
      `createdBy: ${owner}`,
      "---",
      "Run the deployment check.",
    ].join("\n"),
    "text/markdown",
  );

  const forbidden = () => {
    throw new Error("The fixed job must not use the model.");
  };
  await processRecurringJobs({
    appId,
    getActions: forbidden,
    getSystemPrompt: forbidden,
  });
  assert.equal(calls, 1);
  const resource = await resourceGetByPath(owner, path);
  assert(resource);
  const { meta } = parseJobResource(resource.content);
  assert.equal(meta.lastStatus, "success");
  assert(new Date(meta.nextRun).getTime() > Date.now());
  const history = await getDbExec().execute({
    sql: "SELECT id, status, thread_id, run_id, error FROM automation_runs WHERE owner = ? AND path = ?",
    args: [owner, path],
  });
  assert.equal(history.rows.length, 1);
  assert.deepEqual(history.rows[0], {
    id: meta.lastHistoryId,
    status: "success",
    thread_id: null,
    run_id: null,
    error: null,
  });
  const receipts = await getDbExec().execute({
    sql: "SELECT id FROM eighty_runner_receipts",
  });
  assert.deepEqual(receipts.rows, [{ id: meta.lastHistoryId }]);
  console.log(
    "PASS A scheduled fixed job runs once and records success without a model or chat thread.",
  );
} finally {
  dispose();
  await closeDbExec();
}
