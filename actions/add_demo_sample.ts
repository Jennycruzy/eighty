import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { addDemoSample } from "../server/lib/demo-accounts.ts";
export default defineAction({
  description:
    "Save Maria's made-up sample earnings summary as a private upload in her demo account.",
  schema: z.strictObject({}),
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "POST" },
  run: (_input, context) => addDemoSample(context),
});
