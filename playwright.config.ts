import { existsSync, readFileSync } from "node:fs";

import { defineConfig } from "@playwright/test";
const endpointFile = new URL(
  "./.private/browser-endpoint.json",
  import.meta.url,
);
const baseURL: string = existsSync(endpointFile)
  ? JSON.parse(readFileSync(endpointFile, "utf8")).baseURL
  : "http://127.0.0.1:3000";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("Browser checks require a local test server.");
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: ".private/browser-report", open: "never" }],
  ],
  outputDir: ".private/browser-results",
  use: {
    baseURL,
    viewport: { width: 360, height: 640 },
    trace: "retain-on-failure",
  },
});
