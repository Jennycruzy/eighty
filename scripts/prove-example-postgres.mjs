import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
if (process.argv[2] === "child") {
  const { closeDbExec, runMigrations, withMigrationRuntime } =
    await import("@agent-native/core/db");
  const {
    runAppReleaseMigrations,
    runFrameworkReleaseMigrations,
    runWithRequestContext,
    getBrowserCookieSession,
  } = await import("@agent-native/core/server");
  const { H3Event } = await import("h3");
  try {
    await withMigrationRuntime(async () => {
      await runFrameworkReleaseMigrations(null);
      await runAppReleaseMigrations();
      const { DEMO_MIGRATIONS } =
        await import("../server/lib/demo-migrations.ts");
      await runMigrations(DEMO_MIGRATIONS, {
        table: "eighty_demo_schema_migrations",
      })(null);
    });
    const example = await import(process.argv[3]);
    const headers = new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "sec-fetch-site": "same-origin",
    });
    const { ticket } = await example.startExample(
      { person: "maria" },
      { caller: "http", requestHeaders: headers },
    );
    const event = new H3Event(
      new Request("http://localhost:3000/enter-example", {
        method: "POST",
        headers,
      }),
    );
    await example.enterExample(event, { ticket });
    const cookie = event.res.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const session = await getBrowserCookieSession(
      new H3Event(
        new Request("http://localhost:3000", { headers: { cookie } }),
      ),
    );
    assert(session?.authUserId);
    const result = await runWithRequestContext(
      { userEmail: session.email, authUserId: session.authUserId },
      () =>
        example.exampleMonth({
          caller: "frontend",
          userEmail: session.email,
          requestHeaders: new Headers({ cookie }),
        }),
    );
    assert.equal(result.thisMonth.status, "Short");
    assert.equal(result.thisMonth.hours, 61);
    assert.equal(result.thisMonth.targetHours, 80);
    assert.equal(result.lastMonth.status, "Meets");
  } finally {
    await closeDbExec();
  }
} else {
  const name = `eighty-example-proof-${randomUUID()}`;
  const password = randomBytes(32).toString("hex");
  let created = false;
  try {
    await execute(
      "docker",
      [
        "run",
        "--detach",
        "--name",
        name,
        "--publish",
        "127.0.0.1::5432",
        "--env",
        "POSTGRES_PASSWORD",
        "--env",
        "POSTGRES_USER=eighty",
        "--env",
        "POSTGRES_DB=eighty",
        "postgres:17-bookworm",
      ],
      { env: { ...process.env, POSTGRES_PASSWORD: password } },
    );
    created = true;
    for (let attempt = 0; ; attempt++) {
      try {
        await execute("docker", [
          "exec",
          name,
          "pg_isready",
          "-U",
          "eighty",
          "-d",
          "eighty",
        ]);
        break;
      } catch (error) {
        if (attempt === 59) throw error;
        await delay(1000);
      }
    }
    const port = (await execute("docker", ["port", name, "5432/tcp"])).stdout
      .trim()
      .split(":")
      .pop();
    const env = {
      ...process.env,
      DATABASE_URL: `postgres://eighty:${password}@127.0.0.1:${port}/eighty`,
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    };
    const run = (source) =>
      execute(
        process.execPath,
        [fileURLToPath(import.meta.url), "child", source],
        { env, timeout: 120_000, maxBuffer: 2_000_000 },
      );
    await run(
      new URL("../server/lib/example-accounts.ts", import.meta.url).href,
    );
    console.log(
      "PASS start_example opens Maria's month on PostgreSQL 17 with the production driver: Short, 61 of 80 hours; last month Meets.",
    );
  } finally {
    if (created) await execute("docker", ["rm", "--force", name]);
  }
}
