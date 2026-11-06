import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { exampleStatus } from "../server/lib/example-accounts.ts";
export default defineAction({
  description:
    "Say whether the signed-in account is a made-up example account.",
  schema: z.strictObject({}),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "GET" },
  run: (_input, context) => exampleStatus(context),
});
