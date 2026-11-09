import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { telegramLink } from "../server/lib/telegram-link-action.ts";

export default defineAction({
  description:
    "Show whether Telegram is linked, make a one-time link code, unlink Telegram, choose the language the bot answers in, or turn the weekly check-in on or off. Only the member, in their own signed-in browser.",
  schema: z.strictObject({
    op: z.enum(["status", "code", "unlink", "language", "checkins"]).default("status"),
    language: z.enum(["en-US", "es-US"]).optional(),
    on: z.boolean().optional(),
  }),
  requiresAuth: true,
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  http: { method: "POST" },
  run: (input, context) => telegramLink(input.op, context, input.language, input.on),
});
