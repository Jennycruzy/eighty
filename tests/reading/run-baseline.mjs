// Runs the plain-text baseline on both sets and writes data/reading-results/baseline-<set>-<date>.json.
//   node tests/reading/run-baseline.mjs
// The baseline needs no model or key. Its patterns were written from practice documents only.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readByText } from "./baseline.ts";
import { MIME, buildReport, describe } from "./report.ts";
import { scoreDocument } from "./score.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const sets = JSON.parse(await readFile(path.join(here, "sets.json"), "utf8"));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const reader = {
  name: "baseline: plain text matching",
  version: git("rev-parse", "HEAD"),
  uncommittedChanges: git("status", "--porcelain", "--", "tests/reading").length > 0,
};
const date = new Date().toISOString().slice(0, 10);
const chosen = process.argv.includes("--set") ? [process.argv[process.argv.indexOf("--set") + 1]] : ["practice", "locked"];
await mkdir(path.join(root, "data", "reading-results"), { recursive: true });
for (const set of chosen) {
  const documents = [];
  for (const item of sets[set]) {
    const bytes = await readFile(path.join(here, "documents", item.document));
    const answer = JSON.parse(await readFile(path.join(here, "answers", item.document.replace(/\.\w+$/, ".json")), "utf8"));
    const result = await readByText({ bytes, mime: MIME[item.document.split(".").pop()] });
    documents.push({ score: scoreDocument(answer, result), tokens: { input: 0, output: 0 } });
  }
  const report = buildReport({ set, run: 1, date, reader, documents });
  const file = path.join(root, "data", "reading-results", `baseline-${set}-${date}.json`);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${describe(report)}\nWrote ${path.relative(root, file)}\n`);
}
