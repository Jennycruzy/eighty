import type { ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import { coverageAnswers } from "../../shared/screener.ts";
import { refuseDemoContext } from "./demo-accounts.ts";
import { reviewedMemberActor } from "./member-identity.ts";
import { getMemberRecord, saveMemberRecord } from "./member-records.ts";

const answer = z.enum(["yes", "no", "unknown"]);
export const coverageAnswerInput = z.strictObject({
  answers: z.union([
    z.strictObject({ group: z.enum(["", "expansion", "1115", "other"]) }),
    z.strictObject({ otherGroup: answer }),
    z.strictObject({ otherwiseEligible: answer }),
    z.strictObject({ fullCoverage: answer }),
  ]),
});

// Saving one answer keeps the rest of the profile and clears answers for another group.
export async function saveCoverageAnswer(
  input: z.infer<typeof coverageAnswerInput>,
  context: ActionRunContext | undefined,
) {
  const { answers } = coverageAnswerInput.parse(input);
  await refuseDemoContext(context);
  const actor = await reviewedMemberActor(context);
  const member = await getMemberRecord(actor);
  await saveMemberRecord(actor, {
    language: member.language === "es-US" ? "es-US" : "en-US",
    screener: coverageAnswers({ ...member.screener, ...answers }),
  });
  return { saved: true };
}
