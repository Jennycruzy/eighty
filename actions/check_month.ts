import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { checkMemberMonth } from "../server/lib/member-month.ts";
export default defineAction({
  description:
    "Read the signed-in member's month from saved answers and confirmed proof.",
  schema: z.strictObject({ month: z.string().max(10).optional() }),
  requiresAuth: true,
  readOnly: true,
  agentTool: true,
  mcpTool: true,
  http: { method: "GET" },
  run: (input, context) => checkMemberMonth(input.month, context),
});
