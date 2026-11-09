import { defineAction } from "@agent-native/core/action";

import {
  doMonth,
  monthWorkInput,
  MONTH_WORK_WIDGET,
} from "../server/lib/month-work.ts";
export default defineAction({
  description:
    "Do the member's month: read files not read yet, list the lines waiting for them, ask the one question that blocks the month, and show a plan the rules accept. It proposes and plans; only the member confirms a line.",
  schema: monthWorkInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  agentTool: true,
  mcpTool: false,
  http: { method: "POST" },
  chatUI: { renderer: MONTH_WORK_WIDGET, title: "Your month" },
  run: doMonth,
});
