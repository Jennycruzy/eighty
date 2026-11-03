import { defineAction } from "@agent-native/core/action";

import { inspectUpload } from "../server/lib/document-records.ts";
import {
  documentUpload,
  MAX_UPLOAD_REQUEST_BYTES,
} from "../shared/document-upload.ts";
export default defineAction({
  description: "Check a private photo before saving it.",
  schema: documentUpload,
  requiresAuth: true,
  maxBodyBytes: MAX_UPLOAD_REQUEST_BYTES,
  audit: { recordInputs: false },
  agentTool: false,
  mcpTool: false,
  uiOnly: true,
  http: { method: "POST" },
  run: (input, context) => inspectUpload(input, context),
});
