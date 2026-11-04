// One eval case per locked test document. Each case asks the agent to read the document with the
// extract_evidence tool and nothing else. The scorer fails a case on any false Meets, and the
// threshold of 1 means a single false Meets fails the whole run.
// `agent-native eval` runs only the chat agent through evals/production-context.ts, so these cases go
// through the agent and its extract_evidence tool rather than calling the reader directly.
// Run:  pnpm exec agent-native eval reading --owner-email <email> --org-id <org>
import { readFileSync } from "node:fs";

import { createScorer, defineEval, usesTool } from "@agent-native/core/eval";

import { READ_TOOL, judgeRun } from "../tests/reading/eval-judge.ts";
import type { Answer } from "../tests/reading/score.ts";

const root = new URL("../tests/reading/", import.meta.url);
const sets = JSON.parse(readFileSync(new URL("sets.json", root), "utf8")) as {
  locked: { document: string; sha256: string; language: "en" | "es" }[];
};

export default sets.locked.map((item) => {
  const answer = JSON.parse(
    readFileSync(new URL(`answers/${item.document.replace(/\.\w+$/, ".json")}`, root), "utf8"),
  ) as Answer;
  return defineEval({
    name: `reading locked: ${item.document}`,
    input: {
      prompt: [
        `Read the attached test document with the ${READ_TOOL} tool.`,
        `Document: tests/reading/documents/${item.document}`,
        `SHA-256: ${item.sha256}`,
        `Language: ${item.language}`,
        "Do not save, confirm or change anything. Reply with what the tool found.",
      ].join("\n"),
    },
    actionAllowlist: [READ_TOOL],
    threshold: 1,
    scorers: [
      usesTool(READ_TOOL),
      createScorer({
        name: "no_false_meets",
        analyze: (run) => judgeRun(run, answer),
        generateScore: (judgement) => judgement.score,
        generateReason: ({ analysis }) => analysis.reason,
      }),
    ],
  });
});
