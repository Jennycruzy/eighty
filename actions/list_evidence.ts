import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listEvidenceRecords } from "../server/lib/evidence-records.ts";
export default defineAction({
  description: "List evidence belonging to the signed-in member.",
  schema: z.strictObject({}),
  requiresAuth: true,
  audit: { recordInputs: false },
  agentTool: false,
  mcpTool: false,
  http: { method: "GET" },
  run: (_input, context) => listEvidenceRecords(context),
});
