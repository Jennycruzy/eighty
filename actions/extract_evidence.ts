import { defineAction } from "@agent-native/core/action";

import { extractEvidence, extractInput } from "../server/lib/extraction.ts";
export default defineAction({
  description:
    "Read one of your private documents into proposed proof lines. Nothing counts until you check and confirm each line.",
  schema: extractInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  // The member's own agent may ask for a reading. It cannot confirm anything.
  agentTool: true,
  mcpTool: false,
  http: { method: "POST" },
  run: extractEvidence,
});
