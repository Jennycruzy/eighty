import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

import { defineConfig } from "vitest/config";

const source = path.join(homedir(), ".cache/eighty-agent-native");
const revision = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (revision !== "808ef4ebb0edfe323cf7aadcc66e7a39d77cedf0") {
  throw new Error(
    `Wrong framework revision: ${revision}. Use the pinned core version.`,
  );
}

export default defineConfig({
  resolve: {
    alias: {
      upstream: source,
    },
  },
  test: {
    include: ["tests/framework/*.spec.ts"],
    maxWorkers: 1,
  },
});
