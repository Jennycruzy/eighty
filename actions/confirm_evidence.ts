import { defineAction } from "@agent-native/core/action";

import {
  evidenceReference,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";
export default defineAction({
  description: "Confirm one evidence line after reviewing it.",
  schema: evidenceReference,
  requiresAuth: true,
  audit: { recordInputs: false },
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: (input, context) => changeEvidenceRecord("confirm", input, context),
});
