import { defineAction } from "@agent-native/core/action";

import {
  draftInput,
  createEvidenceDraft,
} from "../server/lib/evidence-records.ts";
export default defineAction({
  description: "Save a typed evidence line for review. It does not count yet.",
  schema: draftInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: createEvidenceDraft,
});
