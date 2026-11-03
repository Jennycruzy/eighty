import { defineAction } from "@agent-native/core/action";

import {
  editInput,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";
export default defineAction({
  description: "Edit a line and review it again before it counts.",
  schema: editInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: (input, context) => changeEvidenceRecord("edit", input, context),
});
