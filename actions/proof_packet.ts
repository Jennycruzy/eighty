import { defineAction } from "@agent-native/core/action";

import { packetInput, proofPacket } from "../server/lib/proof-packet.ts";

export default defineAction({
  description:
    "Make the member's proof packet for a finished month: a cover page with the rule it meets and a signature line, then the documents behind each counted line, as a PDF, with an email draft the member sends. Only in the member's own browser.",
  schema: packetInput,
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "POST" },
  run: proofPacket,
});
