import { closeDbExec, withMigrationRuntime } from "@agent-native/core/db";
import { loadEnv } from "@agent-native/core/scripts";
import {
  runAppReleaseMigrations,
  runFrameworkReleaseMigrations,
} from "@agent-native/core/server";

loadEnv();
await import("../server/plugins/agent-native-email-branding.ts");

async function main(): Promise<void> {
  await withMigrationRuntime(async () => {
    await runFrameworkReleaseMigrations(null);
    await runAppReleaseMigrations();
  });
}

try {
  await main();
} finally {
  await closeDbExec();
}
