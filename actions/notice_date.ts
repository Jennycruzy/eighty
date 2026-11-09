import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { noticeDateAction } from "../server/lib/member-reminders.ts";

export default defineAction({
  description:
    "Save, read or remove the dates of a letter from the state: the date printed on it and, if it came late, the day it came. Returns the reply-by date from the notice rule.",
  schema: z.strictObject({
    op: z.enum(["status", "save", "clear"]).default("status"),
    printed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    arrived: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }),
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "POST" },
  run: (input, context) => noticeDateAction(input, context),
});
