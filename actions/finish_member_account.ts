import { defineAction } from "@agent-native/core/action";

import { refuseDemoContext } from "../server/lib/demo-accounts.ts";
import {
  finishRegistrationInput,
  finishMemberAccount,
} from "../server/lib/registration.ts";
export default defineAction({
  description:
    "Save the carried screener answers in the matching verified account. Keep any existing profile.",
  schema: finishRegistrationInput,
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  maxBodyBytes: 8192,
  http: { method: "POST" },
  run: async (input, context) => {
    await refuseDemoContext(context);
    return finishMemberAccount(input, context);
  },
});
