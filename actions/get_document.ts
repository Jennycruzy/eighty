import { defineAction } from "@agent-native/core/action";

import { readDocument } from "../server/lib/document-records.ts";
import {
  documentUpload,
  documentReference,
} from "../shared/document-upload.ts";
export default defineAction({
  description: "Read your own private document.",
  schema: documentReference,
  requiresAuth: true,
  audit: { recordInputs: false },
  agentTool: false,
  mcpTool: false,
  http: { method: "GET" },
  run: (input, context) => readDocument(input.id, context),
});
