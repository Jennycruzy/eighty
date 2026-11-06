import { defineAction } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

export const monthPagePath = z
  .string()
  .max(200)
  .refine((value) =>
    /^\/(?:example|add|review|check|months(?:\/\d{4}-\d{2})?)(?:\?lang=(?:en|es))?$/.test(
      value,
    ),
  );
export default defineAction({
  description: "Open the member's month, proof, review or answers page.",
  schema: z.strictObject({ path: monthPagePath }),
  requiresAuth: true,
  agentTool: true,
  mcpTool: false,
  http: false,
  run: async ({ path }) => {
    await writeAppStateForCurrentTab("navigate", {
      path,
      _writeId: crypto.randomUUID(),
    });
    return { path };
  },
});
