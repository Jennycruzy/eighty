import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  save: vi.fn(),
  run: vi.fn(),
}));
vi.mock("upstream/packages/core/src/automations/service.js", () => ({
  resolveAutomationExecutionIdentity: async () => ({
    ok: true,
    identity: {
      userEmail: "test@example.test",
      orgId: "synthetic-org",
      eventOwner: "test@example.test",
    },
  }),
}));
vi.mock("upstream/packages/core/src/db/client.js", () => ({
  isProductionServerlessFunctionRuntime: () => true,
}));
vi.mock("upstream/packages/core/src/event-bus/index.js", () => ({
  subscribeAll: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("upstream/packages/core/src/jobs/automation-events.js", () => ({}));
vi.mock("upstream/packages/core/src/jobs/automation-outcome.js", () => ({}));
vi.mock(
  "upstream/packages/core/src/jobs/background-automation-runner.js",
  () => ({
    isBackgroundAutomationRunActive: () => false,
    runBackgroundAutomation: state.run,
  }),
);
vi.mock("upstream/packages/core/src/jobs/sweep-hooks.js", () => ({
  registerRecurringSweepHandler: vi.fn(),
}));
vi.mock("upstream/packages/core/src/resources/store.js", () => ({
  resourceGetByPath: async () => ({
    id: "synthetic-job",
    owner: "test@example.test",
    path: "jobs/reminder.md",
    content:
      "---\nenabled: true\ntriggerType: webhook\nmode: deterministic\nappId: eighty\ncreatedBy: test@example.test\n---\nCall the reminder action.",
  }),
  resourcePutIfCurrent: state.save,
}));
vi.mock("upstream/packages/core/src/server/background-jobs.js", () => ({}));
vi.mock("upstream/packages/core/src/server/interval-job.js", () => ({}));
vi.mock("upstream/packages/core/src/server/request-context.js", () => ({
  runWithRequestContext: async (_context: unknown, task: () => unknown) =>
    task(),
}));
vi.mock("upstream/packages/core/src/triggers/condition-evaluator.js", () => ({
  evaluateCondition: () => true,
}));
vi.mock("upstream/packages/core/src/triggers/event-queue.js", () => ({}));

import {
  initTriggerDispatcher,
  dispatchAutomationWebhookTask,
} from "upstream/packages/core/src/triggers/dispatcher.ts";

it("a deterministic webhook job records a skip reason when no action runs", async () => {
  await initTriggerDispatcher({ appId: "eighty" } as never);
  const result = await dispatchAutomationWebhookTask({
    owner: "test@example.test",
    path: "jobs/reminder.md",
    automationId: "synthetic-job",
    eventId: "synthetic-event",
    payload: {},
  } as never);
  expect(result).toBe("completed");
  expect(state.run).not.toHaveBeenCalled();
  expect(state.save).toHaveBeenCalled();
});
