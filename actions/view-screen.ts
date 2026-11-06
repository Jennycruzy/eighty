import { defineAction } from "@agent-native/core/action";
import { readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

export default defineAction({
  description: "Read the member's current page and language.",
  schema: z.strictObject({}),
  requiresAuth: true,
  agentTool: true,
  mcpTool: false,
  http: false,
  readOnly: true,
  run: async () => ({
    navigation: await readAppStateForCurrentTab("navigation"),
  }),
});
