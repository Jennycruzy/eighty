import { defineAction } from "@agent-native/core/action";

import { refuseExampleContext } from "../server/lib/example-accounts.ts";
import {
  registrationInput,
  prepareMemberAccount,
} from "../server/lib/registration.ts";
export default defineAction({
  description:
    "Carry the screener answers to email verification after the person chooses to save them.",
  schema: registrationInput,
  requiresAuth: false,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  maxBodyBytes: 16384,
  http: { method: "POST" },
  run: async (input, context) => {
    await refuseExampleContext(context);
    return prepareMemberAccount(input, context?.requestHeaders);
  },
});
