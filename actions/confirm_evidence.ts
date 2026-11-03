import { defineAction } from "@agent-native/core/action";

import {
  confirmInput,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";
export default defineAction({
  description:
    "Confirm a reviewed line. Choose “These are separate” only after comparing the listed lines.",
  schema: confirmInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: (input, context) => changeEvidenceRecord("confirm", input, context),
});
