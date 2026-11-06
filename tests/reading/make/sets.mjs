// Writes tests/reading/sets.json: which documents are for practice and which are locked, with each file's SHA-256.
//   node tests/reading/make/sets.mjs
// Locked documents are never read by a reader during development and never used to tune anything.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { documents, fileName } from "./catalog.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = async (document) => ({
  document: fileName(document),
  type: document.type,
  language: document.language,
  conditions: document.conditions ?? [],
  sha256: createHash("sha256")
    .update(await readFile(path.join(root, "documents", fileName(document))))
    .digest("hex"),
});
const pick = (set) =>
  Promise.all(documents.filter((document) => document.set === set).map(entry));
const sets = {
  about:
    "Practice documents may be read while building the reader. Locked documents are read only by the release runs; nobody looks at reader output for them while building. The example's sample earnings summary in public/example/ belongs to no set.",
  asOf: "2026-11-04",
  practice: await pick("practice"),
  locked: await pick("locked"),
  notInAnySet: ["public/example/"],
};
for (const type of new Set(documents.map((document) => document.type)))
  for (const name of ["practice", "locked"])
    if (!sets[name].some((item) => item.type === type))
      throw new Error(`${name} has no ${type}`);
await writeFile(
  path.join(root, "sets.json"),
  `${JSON.stringify(sets, null, 2)}\n`,
);
console.log(`practice ${sets.practice.length}, locked ${sets.locked.length}`);
