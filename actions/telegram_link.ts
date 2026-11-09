import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { telegramLink } from "../server/lib/telegram-link-action.ts";

export default defineAction({
  description:
    "Show whether Telegram is linked, make a one-time link code, or unlink Telegram. Only the member, in their own signed-in browser.",
  schema: z.strictObject({
    op: z.enum(["status", "code", "unlink"]).default("status"),
  }),
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "POST" },
  run: (input, context) => telegramLink(input.op, context),
});
