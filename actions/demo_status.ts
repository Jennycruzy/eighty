import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { demoStatus } from "../server/lib/demo-accounts.ts";
export default defineAction({
  description: "Say whether the signed-in account is a made-up demo account.",
  schema: z.strictObject({}),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "GET" },
  run: (_input, context) => demoStatus(context),
});
