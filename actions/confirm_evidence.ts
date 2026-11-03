import { defineAction, fail } from "@agent-native/core/action";

import {
  confirmInput,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";
export default defineAction({
  description:
    "Confirm a reviewed line. Choose “These are separate” only after comparing the listed lines.",
  schema: confirmInput,
  requiresAuth: true,
  audit: { recordInputs: false },
  uiOnly: true,
  agentTool: false,
  mcpTool: false,
  http: { method: "POST" },
  run: async (input, context) => {
    try {
      return await changeEvidenceRecord("confirm", input, context);
    } catch (error) {
      const failure = error as {
        statusCode?: number;
        data?: Record<string, unknown>;
        message?: string;
      };
      if (failure.data)
        fail(failure.message || "Review this line", {
          errorCode: "evidence-review",
          statusCode: failure.statusCode || 409,
          details: failure.data,
        });
      throw error;
    }
  },
});
