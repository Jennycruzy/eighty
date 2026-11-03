import { defineAction } from "@agent-native/core/action";

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
  run: (input, context) => prepareMemberAccount(input, context?.requestHeaders),
});
