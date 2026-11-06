import { runMigrations } from "@agent-native/core/db";
import { defineNitroPlugin, startIntervalJob } from "@agent-native/core/server";

import { DEMO_MIGRATIONS } from "../lib/demo-migrations.ts";
import { runExampleReset } from "../lib/example-reset.ts";

// Keep the migration file and table names: live rows need a data migration to rename them.
const migrate = runMigrations(DEMO_MIGRATIONS, {
  table: "eighty_demo_schema_migrations",
});

// A plain server timer, not a framework job: the reset never goes through a
// model, and its own table records whether each run completed or failed.
export default defineNitroPlugin(async (app) => {
  await migrate(app);
  const job = startIntervalJob(
    async (signal) => {
      await runExampleReset(signal);
    },
    {
      intervalMs: 60 * 60 * 1000,
      leading: false,
      timeoutMs: 15 * 60 * 1000,
      onError: () => {
        console.error("The example reset failed. See eighty_demo_resets.");
      },
    },
  );
  app.hooks.hook("close", () => job.stop());
});
