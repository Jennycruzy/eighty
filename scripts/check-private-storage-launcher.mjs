import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
try {
  const env = {
    ...process.env,
    ...parseEnv(
      await readFile(new URL("../.env.production", import.meta.url), "utf8"),
    ),
    NODE_ENV: "production",
  };
  const database = new URL(env.DATABASE_URL);
  if (database.hostname === "database") database.hostname = "127.0.0.1";
  env.DATABASE_URL = database.toString();
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./check-private-storage.mjs", import.meta.url))],
    { env, stdio: "inherit" },
  );
  child.on("error", () => {
    console.error("The private storage check could not start.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    "Check the private production settings and their file permissions. No setting values were printed.",
  );
  process.exitCode = 1;
}
