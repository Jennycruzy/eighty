import { runMigrations } from "@agent-native/core/db";
import { defineNitroPlugin } from "@agent-native/core/server";

import { DEMO_MIGRATIONS } from "../lib/demo-migrations.ts";

const migrate = runMigrations(DEMO_MIGRATIONS, {
  table: "eighty_demo_schema_migrations",
});

export default defineNitroPlugin(async (app) => {
  await migrate(app);
});
