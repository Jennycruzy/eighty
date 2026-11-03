import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listDocuments } from "../server/lib/document-records.ts";
export default defineAction({
  description: "List your own saved files.",
  schema: z.strictObject({}),
  requiresAuth: true,
  audit: { recordInputs: false },
  agentTool: false,
  mcpTool: false,
  http: { method: "GET" },
  run: (input, context) => listDocuments(context),
});
