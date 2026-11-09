import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listEvidenceRecords } from "../server/lib/evidence-records.ts";
export default defineAction({
  description: "List evidence belonging to the signed-in member.",
  schema: z.strictObject({}),
  requiresAuth: true,
  readOnly: true,
  audit: { recordInputs: false },
  agentTool: true,
  mcpTool: true,
  http: { method: "GET" },
  run: (_input, context) => listEvidenceRecords(context),
});
