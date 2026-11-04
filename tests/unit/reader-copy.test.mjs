import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { questionPaths } from "../../shared/reader.ts";

const load = async (name) =>
  JSON.parse(
    await readFile(new URL(`../../locales/${name}.json`, import.meta.url)),
  ).reader;
const shape = (value) =>
  value && typeof value === "object"
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, shape(value[key])]),
      )
    : typeof value;

test("Reader screens have the same English and Spanish copy, with a label for every question", async () => {
  const [en, es] = await Promise.all([load("en-US"), load("es-US")]);
  assert.deepEqual(shape(en), shape(es));
  for (const copy of [en, es])
    for (const question of Object.keys(questionPaths))
      assert.equal(typeof copy.questions[question], "string", question);
  assert.equal(
    en.unreadable,
    "We couldn't read this. You can type the numbers instead.",
  );
  assert.equal(
    en.notUs,
    "We can't read this as a US pay stub. You can type the numbers instead.",
  );
});
