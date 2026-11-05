import { defineAction } from "@agent-native/core/action";

import {
  coverageAnswerInput,
  saveCoverageAnswer,
} from "../server/lib/coverage-answer.ts";
export default defineAction({
  description:
    "Save one Medicaid coverage answer for the signed-in member. Keep the other saved answers.",
  schema: coverageAnswerInput,
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  maxBodyBytes: 1024,
  http: { method: "POST" },
  run: (input, context) => saveCoverageAnswer(input, context),
});
