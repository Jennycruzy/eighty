import { defineAction } from "@agent-native/core/action";

import {
  evidenceReference,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";
export default defineAction({
  description: "Reject one evidence line.",
  schema: evidenceReference,
  requiresAuth: true,
  audit: { recordInputs: false },
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: (input, context) => changeEvidenceRecord("reject", input, context),
});
