import { defineAction } from "@agent-native/core/action";

import { MAX_UPLOAD_REQUEST_BYTES } from "../shared/document-upload.ts";
import { tryReadDocument, tryReadInput } from "../server/lib/try-reading.ts";
export default defineAction({
  description:
    "Read one document for a visitor without an account. Nothing is saved.",
  schema: tryReadInput,
  requiresAuth: false,
  maxBodyBytes: MAX_UPLOAD_REQUEST_BYTES,
  audit: { recordInputs: false },
  // uiOnly cannot be used here: the framework only proves UI requests for a
  // signed-in user. The action checks its own same-origin page call instead.
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: tryReadDocument,
});
