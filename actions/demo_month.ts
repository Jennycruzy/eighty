import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { demoMonth } from "../server/lib/demo-accounts.ts";
export default defineAction({
  description:
    "Check this month and last month for the made-up demo member, using the fixed rules.",
  schema: z.strictObject({}),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "GET" },
  run: (_input, context) => demoMonth(context),
});
