import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { request as proxyRequest } from "node:http";
import { createServer } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import postgres from "postgres";

import { checkDemo } from "./check-demo.mjs";
import { checkPublicHeads } from "./check-public-heads.mjs";
import { checkPublicPages } from "./check-public-pages.mjs";

const execute = promisify(execFile);
const image = process.argv[2] || "eighty:local";
const runId = `eighty-check-${randomUUID()}`;
const database = `${runId}-db`;
const app = `${runId}-app`;
const accounts = `${runId}-accounts`;
const accountEncryptionKey = randomBytes(32).toString("hex");
const databasePassword = randomBytes(32).toString("hex");
const authSecret = randomBytes(32).toString("hex");
const logPath = new URL("../.private/production-check.log", import.meta.url);
const environmentFile = new URL(`../.private/${runId}.env`, import.meta.url);
const secrets = [databasePassword, authSecret, accountEncryptionKey];
const browserEndpoint = new URL(
  "../.private/browser-endpoint.json",
  import.meta.url,
);
let browserEndpointCreated = false;
const resources = {
  network: false,
  database: false,
  app: false,
  accounts: false,
};
let sql;
let accountProxy;
const accountTlsKey = new URL(`../.private/${runId}-key.pem`, import.meta.url);
const accountTlsCert = new URL(
  `../.private/${runId}-cert.pem`,
  import.meta.url,
);
let step = "prepare the check";

await mkdir(new URL("../.private/", import.meta.url), {
  recursive: true,
  mode: 0o700,
});
await writeFile(logPath, "", { mode: 0o600 });
await writeFile(environmentFile, "", { mode: 0o600 });

async function log(value) {
  let text = String(value);
  for (const secret of secrets) text = text.replaceAll(secret, "[redacted]");
  await appendFile(logPath, `${text}\n`);
}

// Names the failed check and its first error line. A child check script marks
// its failure with "CHECK FAILED: <check>: <first line>" on stderr.
function failureSummary(error) {
  const marked = String(error?.stderr || "")
    .split("\n")
    .find((line) => line.startsWith("CHECK FAILED: "));
  if (marked) return marked.slice("CHECK FAILED: ".length);
  const lines = String(error?.message ?? error)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    (lines[0]?.startsWith("Command failed:") ? lines[1] : lines[0]) ||
    "unknown error"
  );
}

async function command(file, args, env = process.env, timeout = 120_000) {
  try {
    const result = await execute(file, args, {
      env,
      timeout,
      maxBuffer: 2_000_000,
    });
    await log(result.stdout);
    await log(result.stderr);
    return result.stdout.trim();
  } catch (error) {
    await log(error.stdout || "");
    await log(error.stderr || "");
    throw error;
  }
}

async function waitUntil(check, description) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // A starting service may refuse connections before it is ready.
    }
    await delay(1000);
  }
  throw new Error(`Timed out: ${description}`);
}

async function publishedPort(container, port) {
  const output = await command("docker", ["port", container, port]);
  assert.match(output, /^127\.0\.0\.1:\d+$/);
  return Number(output.split(":")[1]);
}

try {
  step = "check the image";
  const [metadata] = JSON.parse(
    await command("docker", ["image", "inspect", image]),
  );
  assert.equal(metadata.Config.User, "node");
  assert(
    !metadata.Config.Env.some((value) =>
      /^(DATABASE_URL|BETTER_AUTH_SECRET|SECRETS_ENCRYPTION_KEY|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|AGENT_NATIVE_HOSTED_STORAGE_ACCESS_KEY_ID|AGENT_NATIVE_HOSTED_STORAGE_SECRET_ACCESS_KEY)=/.test(
        value,
      ),
    ),
  );

  step = "check the storage HTTP dependency";
  await command("docker", [
    "run",
    "--rm",
    "--network",
    "none",
    "--cap-drop",
    "ALL",
    image,
    "node",
    "--input-type=module",
    "-e",
    "import {createRequire} from 'node:module'; const require=createRequire('/app/.output/server/index.mjs'); if(typeof require('undici').Agent !== 'function' || typeof require('libheif-js').HeifDecoder !== 'function' || typeof require('@napi-rs/canvas').createCanvas !== 'function' || !require('node:fs').existsSync(require('node:path').join(require('node:path').dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts', 'LiberationSans-Regular.ttf'))) process.exit(1);",
  ]);
  console.log(
    "PASS The image includes the HTTP safety checker, HEIC decoder and PDF page renderer.",
  );

  step = "start a separate test database";
  await command("docker", ["network", "create", runId]);
  resources.network = true;
  await command(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      database,
      "--network",
      runId,
      "--label",
      `care.eighty.check=${runId}`,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_PASSWORD",
      "--env",
      "POSTGRES_USER=eighty",
      "--env",
      "POSTGRES_DB=eighty",
      "postgres:17-bookworm@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5",
    ],
    { ...process.env, POSTGRES_PASSWORD: databasePassword },
  );
  resources.database = true;
  await waitUntil(async () => {
    await command("docker", [
      "exec",
      database,
      "pg_isready",
      "-U",
      "eighty",
      "-d",
      "eighty",
    ]);
    return true;
  }, "PostgreSQL startup");
  const databasePort = await publishedPort(database, "5432/tcp");
  const hostDatabaseUrl = `postgres://eighty:${databasePassword}@127.0.0.1:${databasePort}/eighty`;

  step = "validate the deployment settings";
  await command(
    "docker",
    [
      "compose",
      "--env-file",
      "/dev/null",
      "-f",
      "deploy/compose.yaml",
      "config",
      "--no-env-resolution",
      "--quiet",
    ],
    {
      ...process.env,
      DATABASE_URL: hostDatabaseUrl,
      BETTER_AUTH_SECRET: authSecret,
      SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
      EIGHTY_ENV_FILE: fileURLToPath(environmentFile),
    },
  );

  step = "run the release migrations";
  await command("pnpm", ["migrate:production"], {
    ...process.env,
    DATABASE_URL: hostDatabaseUrl,
    BETTER_AUTH_SECRET: authSecret,
    SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
    NODE_ENV: "production",
  });
  sql = postgres(hostDatabaseUrl, { max: 1, connect_timeout: 5 });
  await sql`CREATE TABLE eighty_deploy_check (id text PRIMARY KEY)`;
  await sql`INSERT INTO eighty_deploy_check (id) VALUES (${runId})`;

  step = "start the application with login enabled";
  const appDatabaseUrl = `postgres://eighty:${databasePassword}@${database}:5432/eighty`;
  await command(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      app,
      "--network",
      runId,
      "--label",
      `care.eighty.check=${runId}`,
      "--init",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--publish",
      "127.0.0.1::3000",
      "--env",
      "DATABASE_URL",
      "--env",
      "BETTER_AUTH_SECRET",
      "--env",
      "SECRETS_ENCRYPTION_KEY",
      "--mount",
      `type=bind,src=${fileURLToPath(new URL("../tests/helpers/capture-account-email.mjs", import.meta.url))},dst=/tmp/capture-account-email.mjs,readonly`,
      "--env",
      "NODE_OPTIONS=--import=/tmp/capture-account-email.mjs",
      "--env",
      "RESEND_API_KEY=eighty-disposable-email",
      "--env",
      "EMAIL_FROM=Eighty Check <noreply@example.test>",
      "--env",
      "EIGHTY_REGISTRATION_ENABLED=0",
      "--env",
      "AUTH_DISABLED=false",
      "--env",
      "AGENT_NATIVE_PRIVATE_BLOB_PUBLIC_UPLOAD_FALLBACK=0",
      image,
    ],
    {
      ...process.env,
      DATABASE_URL: appDatabaseUrl,
      BETTER_AUTH_SECRET: authSecret,
      SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
    },
  );
  resources.app = true;
  const appPort = await publishedPort(app, "3000/tcp");
  let baseUrl = `http://127.0.0.1:${appPort}`;
  const health = async () => {
    const response = await fetch(
      `${baseUrl}/_agent-native/health?schema=1&strict=1`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return false;
    const result = await response.json();
    return (
      result.ready === true &&
      result.db === true &&
      result.database.configured === true &&
      result.database.runningApp === "eighty" &&
      result.database.identityMismatch === false &&
      result.database.identity?.state === "recorded" &&
      result.database.identity.app === "eighty"
    );
  };
  await waitUntil(health, "application and database readiness");
  console.log("PASS Container runs as a regular user and reaches PostgreSQL.");
  await checkDemo(baseUrl, sql);
  const closedSignup = await fetch(
    `${baseUrl}/_agent-native/auth/ba/sign-up/email`,
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({
        email: "closed-with-email@example.test",
        password: "Test-password-for-closed-signup",
        name: "Closed check",
      }),
    },
  );
  assert.equal(
    closedSignup.status,
    503,
    "Registration stays closed even when email credentials are present",
  );
  const closedRows =
    await sql`SELECT id FROM "user" WHERE email='closed-with-email@example.test'`;
  assert.equal(closedRows.length, 0);
  console.log(
    "PASS Registration stays closed with configured test email, without creating an account.",
  );

  step = "check private member records";
  const memberOutput = await command(
    "node",
    ["scripts/check-member-records.mjs", runId],
    {
      ...process.env,
      DATABASE_URL: hostDatabaseUrl,
      BETTER_AUTH_SECRET: authSecret,
      SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
      NODE_ENV: "production",
    },
  );
  for (const line of memberOutput.split("\n")) {
    if (line.startsWith("PASS ")) console.log(line);
  }
  step = "check signed-out public pages and closed starter routes";
  await checkPublicPages(baseUrl);
  step = "check public HEAD responses";
  await checkPublicHeads(baseUrl);
  step = "check the public tools in a phone browser";
  await writeFile(browserEndpoint, JSON.stringify({ baseURL: baseUrl }), {
    mode: 0o600,
    flag: "wx",
  });
  browserEndpointCreated = true;
  const browserOutput = await command("pnpm", ["test:browser"]);
  await unlink(browserEndpoint);
  browserEndpointCreated = false;
  console.log(browserOutput);
  step = "check account creation with captured test mail";
  await command("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    fileURLToPath(accountTlsKey),
    "-out",
    fileURLToPath(accountTlsCert),
    "-subj",
    "/CN=eighty.example.test",
    "-days",
    "1",
  ]);
  let accountUpstreamPort;
  accountProxy = createServer(
    {
      key: await readFile(accountTlsKey),
      cert: await readFile(accountTlsCert),
    },
    (request, response) => {
      if (!accountUpstreamPort) {
        response.writeHead(503);
        response.end();
        return;
      }
      const upstream = proxyRequest(
        {
          hostname: "127.0.0.1",
          port: accountUpstreamPort,
          path: request.url,
          method: request.method,
          headers: {
            ...request.headers,
            "x-forwarded-proto": "https",
            "x-forwarded-host": request.headers.host,
            "x-forwarded-for": "127.0.0.1",
          },
        },
        (reply) => {
          response.writeHead(reply.statusCode, reply.headers);
          reply.pipe(response);
        },
      );
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      // Send the headers now: the app must see them even when no body bytes arrive.
      upstream.flushHeaders();
      request.pipe(upstream);
    },
  );
  await new Promise((resolve, reject) => {
    accountProxy.once("error", reject);
    accountProxy.listen(0, "127.0.0.1", resolve);
  });
  const accountUrl = `https://eighty.example.test:${accountProxy.address().port}`;
  await command(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      accounts,
      "--network",
      runId,
      "--label",
      `care.eighty.check=${runId}`,
      "--init",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--publish",
      "127.0.0.1::3000",
      "--mount",
      `type=bind,src=${fileURLToPath(new URL("../tests/helpers/capture-account-email.mjs", import.meta.url))},dst=/tmp/capture-account-email.mjs,readonly`,
      "--env",
      "DATABASE_URL",
      "--env",
      "BETTER_AUTH_SECRET",
      "--env",
      "SECRETS_ENCRYPTION_KEY",
      "--mount",
      `type=bind,src=${fileURLToPath(new URL("../tests/helpers/capture-document-storage.mjs", import.meta.url))},dst=/tmp/capture-document-storage.mjs,readonly`,
      "--env",
      "S3_ENDPOINT=https://eighty-storage.example.test",
      "--env",
      "AGENT_NATIVE_HOSTED_STORAGE_ENABLED=true",
      "--env",
      "AGENT_NATIVE_HOSTED_STORAGE_ENDPOINT=https://eighty-storage.example.test",
      "--env",
      "AGENT_NATIVE_HOSTED_STORAGE_BUCKET=eighty-disposable-documents",
      "--env",
      "AGENT_NATIVE_HOSTED_STORAGE_ACCESS_KEY_ID=eighty-disposable-storage",
      "--env",
      "AGENT_NATIVE_HOSTED_STORAGE_SECRET_ACCESS_KEY=eighty-disposable-storage-secret",
      "--env",
      "AGENT_NATIVE_HOSTED_STORAGE_REGION=auto",
      "--env",
      "S3_BUCKET=eighty-disposable-documents",
      "--env",
      "S3_REGION=auto",
      "--env",
      "S3_ACCESS_KEY_ID=eighty-disposable-storage",
      "--env",
      "S3_SECRET_ACCESS_KEY=eighty-disposable-storage-secret",
      "--env",
      "AGENT_NATIVE_PRIVATE_BLOB_PUBLIC_UPLOAD_FALLBACK=0",
      "--env",
      "NODE_OPTIONS=--import=/tmp/capture-account-email.mjs --import=/tmp/capture-document-storage.mjs",
      "--env",
      "AUTH_DISABLED=false",
      "--env",
      "EIGHTY_REGISTRATION_ENABLED=1",
      "--env",
      "RESEND_API_KEY=eighty-disposable-email",
      "--env",
      "EMAIL_FROM=Eighty Check <noreply@example.test>",
      "--env",
      `BETTER_AUTH_URL=${accountUrl}`,
      image,
    ],
    {
      ...process.env,
      DATABASE_URL: appDatabaseUrl,
      BETTER_AUTH_SECRET: authSecret,
      SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
    },
  );
  resources.accounts = true;
  const accountPort = await publishedPort(accounts, "3000/tcp");
  accountUpstreamPort = accountPort;
  const accountHealthUrl = `http://127.0.0.1:${accountPort}`;
  await waitUntil(async () => {
    const r = await fetch(accountHealthUrl + "/_agent-native/health?strict=1");
    return r.ok;
  }, "account check startup");
  const accountOutput = await command(
    "node",
    ["scripts/check-account-creation.mjs", runId, accounts, accountUrl],
    {
      ...process.env,
      DATABASE_URL: hostDatabaseUrl,
      BETTER_AUTH_SECRET: authSecret,
      SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
      NODE_ENV: "production",
    },
    240_000,
  );
  for (const line of accountOutput.split("\n"))
    if (line.startsWith("PASS ")) console.log(line);
  const email = `${runId}@example.test`;

  step = "check the scheduled runner without a model";
  const runnerOutput = await command(
    "node",
    ["scripts/check-job-runner.mjs", email],
    {
      ...process.env,
      DATABASE_URL: hostDatabaseUrl,
      BETTER_AUTH_SECRET: authSecret,
      SECRETS_ENCRYPTION_KEY: accountEncryptionKey,
      NODE_ENV: "production",
      AGENT_NATIVE_DEPLOYMENT_ENVIRONMENT: "local",
    },
  );
  const runnerMessage = runnerOutput
    .split("\n")
    .find((line) => line.startsWith("PASS "));
  assert(runnerMessage);
  console.log(runnerMessage);

  step = "check database persistence after a restart";
  await command("docker", ["restart", database]);
  await waitUntil(health, "database recovery");
  await sql.end({ timeout: 5 });
  const recoveredDatabasePort = await publishedPort(database, "5432/tcp");
  sql = postgres(
    `postgres://eighty:${databasePassword}@127.0.0.1:${recoveredDatabasePort}/eighty`,
    {
      max: 1,
      connect_timeout: 5,
    },
  );
  await command("docker", ["restart", app]);
  baseUrl = `http://127.0.0.1:${await publishedPort(app, "3000/tcp")}`;
  await waitUntil(health, "application recovery");
  const rows = await sql`SELECT id FROM eighty_deploy_check`;
  assert.deepEqual(
    rows.map((row) => row.id),
    [runId],
  );
  await checkPublicPages(baseUrl);
  step = "check public HEAD responses";
  await checkPublicHeads(baseUrl);
  console.log("PASS Test data survives database and application restarts.");
} catch (error) {
  process.exitCode = 1;
  await log(error.message);
  if (resources.accounts) {
    try {
      await command("docker", ["logs", accounts]);
    } catch {}
  }
  if (resources.app) {
    try {
      await command("docker", ["logs", "--tail", "150", app]);
    } catch {
      /* Keep the original failure. */
    }
  }
  await log(error?.stack || String(error));
  let summary = failureSummary(error).slice(0, 300);
  for (const secret of secrets)
    summary = summary.replaceAll(secret, "[redacted]");
  console.error(
    `FAIL Could not ${step}. Failed: ${summary}. See .private/production-check.log.`,
  );
} finally {
  if (accountProxy) {
    accountProxy.closeAllConnections();
    await new Promise((resolve) => accountProxy.close(resolve));
  }
  for (const file of [accountTlsKey, accountTlsCert])
    try {
      await unlink(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  if (browserEndpointCreated) await unlink(browserEndpoint);
  if (sql) {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      process.exitCode = 1;
    }
  }
  for (const [key, name] of [
    ["accounts", accounts],
    ["app", app],
    ["database", database],
  ]) {
    if (!resources[key]) continue;
    try {
      await command("docker", ["rm", "--force", "--volumes", name]);
    } catch {
      process.exitCode = 1;
      console.error(`FAIL Cleanup did not remove ${name}.`);
    }
  }
  if (resources.network) {
    try {
      await command("docker", ["network", "rm", runId]);
    } catch {
      process.exitCode = 1;
      console.error(`FAIL Cleanup did not remove network ${runId}.`);
    }
  }
  try {
    await unlink(environmentFile);
  } catch {
    process.exitCode = 1;
    console.error(
      "FAIL Cleanup did not remove the temporary environment file.",
    );
  }
}
