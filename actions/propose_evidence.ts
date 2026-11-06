import { defineAction } from "@agent-native/core/action";
import {
  draftInput,
  createEvidenceDraft,
} from "../server/lib/evidence-records.ts";

export default defineAction({
  description:
    "Propose one line from what the member says. The member reviews it on /review. It never counts until they confirm it.",
  schema: draftInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  agentTool: true,
  mcpTool: false,
  http: { method: "POST" },
  run: (input, context) => createEvidenceDraft(input, context, "agent"),
});
