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
  run: async (_input, context) => {
    try {
      return await exampleMonth(context);
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status !== 401 && status !== 403)
        console.error("[example_month] failed:", status ?? "", error instanceof Error ? error.stack ?? error.message : error);
      throw error;
    }
  },
});
