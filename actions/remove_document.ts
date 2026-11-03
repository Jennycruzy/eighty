import { defineAction } from "@agent-native/core/action";

import { removeDocument } from "../server/lib/document-records.ts";
import {
  documentUpload,
  documentReference,
} from "../shared/document-upload.ts";
export default defineAction({
  description: "Remove an unused private file.",
  schema: documentReference,
  requiresAuth: true,
  audit: { recordInputs: false },
  agentTool: false,
  mcpTool: false,
  uiOnly: true,
  http: { method: "POST" },
  run: (input, context) => removeDocument(input.id, context),
});
