import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { exampleMonth } from "../server/lib/example-accounts.ts";
export default defineAction({
  description:
    "Check this month and last month for the made-up example member, using the fixed rules.",
  schema: z.strictObject({}),
  requiresAuth: true,
  readOnly: true,
  agentTool: true,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "GET" },
  run: (_input, context) => exampleMonth(context),
});
