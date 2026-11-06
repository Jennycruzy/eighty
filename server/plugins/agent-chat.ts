import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";
import actionsRegistry from "../../.generated/actions-registry.js";
import { MONTH_AGENT_PROMPT, MONTH_AGENT_TOOLS } from "../lib/month-agent.ts";
import { isExampleEmail } from "../lib/example-identity.ts";
import { memberActor } from "../lib/member-identity.ts";
import { getMemberRecord } from "../lib/member-records.ts";

export default createAgentChatPlugin({
  appId: "eighty",
  path: "/_agent-native/month-helper",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: false },
  frameworkTools: "minimal",
  initialToolNames: MONTH_AGENT_TOOLS,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: MONTH_AGENT_PROMPT,
  leanPrompt: true,
  // With the follow-up tool offered beside the answer, the model often wrote
  // its reply only in its reasoning and then pointed back to it.
  followUpSuggestions: false,
  skipFilesContext: true,
  resolveActionSurface: ({ ownerEmail }) => ({
    allowedActionNames: MONTH_AGENT_TOOLS.filter(
      (name) =>
        name !== (isExampleEmail(ownerEmail) ? "check_month" : "example_month"),
    ),
  }),
  extraContext: async (_event, owner) => {
    const member = await getMemberRecord(
      await memberActor({ caller: "tool", userEmail: owner }),
    );
    return `Member language: ${member.language}. ${isExampleEmail(owner) ? "This is an example person. Call example_month." : "Call check_month."}`;
  },
});
