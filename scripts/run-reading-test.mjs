// Runs the document reader on one test set and scores every document against its answer file.
//   pnpm test:reading --set practice|locked [--runs N]
// Writes data/reading-results/<set>-<date>-run<k>.json for each run.
// Exit codes: 0 all read and no false Meets; 1 any false Meets; 2 a document could not be read or
// the reader returned something that is not a reader result; 3 bad arguments or changed test files.
// Needs the reader (server/lib/reader.ts, from the reader branch) and the model key it uses.
// Locked documents are for release runs only: do not look at their reader output while building.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadReader } from "../tests/reading/reader.ts";
import { MIME, buildReport, describe } from "../tests/reading/report.ts";
import { scoreDocument } from "../tests/reading/score.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const reading = path.join(root, "tests", "reading");
const resultsDir = path.join(root, "data", "reading-results");

function fail(message) {
  console.error(message);
  process.exit(3);
}
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const set = option("--set");
if (set !== "practice" && set !== "locked") fail("Use --set practice or --set locked.");
const runs = Number(option("--runs") ?? 1);
if (!Number.isInteger(runs) || runs < 1 || runs > 20) fail("Use --runs with a whole number from 1 to 20.");

const sets = JSON.parse(await readFile(path.join(reading, "sets.json"), "utf8"));
const items = sets[set];
// Refuse to run if any test file differs from the hash recorded when the sets were made.
for (const item of items) {
  const bytes = await readFile(path.join(reading, "documents", item.document));
  if (createHash("sha256").update(bytes).digest("hex") !== item.sha256)
    fail(`${item.document} does not match its SHA-256 in tests/reading/sets.json.`);
}

const git = (...gitArgs) => execFileSync("git", gitArgs, { cwd: root, encoding: "utf8" }).trim();
const reader = {
  name: "document reader (server/lib/reader.ts)",
  version: git("rev-parse", "HEAD"),
  uncommittedChanges: git("status", "--porcelain").length > 0,
};
let readDocument;
try {
  readDocument = await loadReader();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const date = new Date().toISOString().slice(0, 10);
await mkdir(resultsDir, { recursive: true });
// Never overwrite earlier results: number new runs after any already saved for this set and date.
const pattern = new RegExp(`^${set}-${date}-run(\\d+)\\.json$`);
const saved = (await readdir(resultsDir)).map((name) => Number(name.match(pattern)?.[1] ?? 0));
const first = Math.max(0, ...saved) + 1;

let falseMeets = 0;
let unread = 0;
for (let run = first; run < first + runs; run++) {
  const documents = [];
  for (const item of items) {
    const bytes = new Uint8Array(await readFile(path.join(reading, "documents", item.document)));
    const answer = JSON.parse(
      await readFile(path.join(reading, "answers", item.document.replace(/\.\w+$/, ".json")), "utf8"),
    );
    try {
      const { result, usage } = await readDocument({
        bytes,
        mime: MIME[item.document.split(".").pop()],
        language: item.language,
      });
      const score = scoreDocument(answer, result);
      if (!score.valid) unread++;
      documents.push({
        score,
        tokens: { input: usage?.inputTokens ?? null, output: usage?.outputTokens ?? null },
      });
    } catch (error) {
      unread++;
      // A failed read proposes nothing; it is scored as an empty, invalid result.
      documents.push({
        score: scoreDocument(answer, undefined),
        tokens: { input: null, output: null },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const report = buildReport({ set, run, date, reader, documents });
  falseMeets += report.totals.falseMeets;
  const file = path.join(resultsDir, `${set}-${date}-run${run}.json`);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${describe(report)}\nWrote ${path.relative(root, file)}\n`);
}
if (falseMeets) {
  console.error(`FAILED: ${falseMeets} false Meets. A wrong read must end as a question or "Not sure yet".`);
  process.exit(1);
}
if (unread) {
  console.error(`FAILED: ${unread} document reads failed or returned something that is not a reader result.`);
  process.exit(2);
}
