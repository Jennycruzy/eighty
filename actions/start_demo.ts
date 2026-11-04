import { defineAction } from "@agent-native/core/action";

import { startDemo, startDemoInput } from "../server/lib/demo-accounts.ts";
// Signed-out visitors open the demo, so the framework's uiOnly check (which
// needs a signed-in account) cannot apply. The run checks the request comes
// from this site's own pages, and the action is hidden from the agent and MCP.
export default defineAction({
  description:
    "Open a fresh copy of a made-up member's month for this visitor. No real member data is used.",
  schema: startDemoInput,
  requiresAuth: false,
  agentTool: false,
  mcpTool: false,
  audit: { recordInputs: false },
  maxBodyBytes: 1024,
  http: { method: "POST" },
  run: (input, context) => startDemo(input, context),
});
