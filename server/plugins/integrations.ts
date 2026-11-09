import {
  getIntegrationConfig,
  saveIntegrationConfig,
} from "@agent-native/core/integrations";
import {
  createIntegrationsPlugin,
  defineNitroPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { telegramBotToken } from "../lib/telegram-config.ts";
import { setUpCheckins } from "../lib/checkins.ts";
import {
  TELEGRAM_AGENT_PROMPT,
  TELEGRAM_AGENT_TOOLS,
} from "../lib/month-agent.ts";
import {
  beforeTelegramMessage,
  eightyTelegramAdapter,
  telegramExecutionContext,
} from "../lib/telegram.ts";

// Telegram only. Each linked chat talks to its own member's helper, with the
// same actions and checks as the web. An unlinked chat never reaches a model.
const integrations = createIntegrationsPlugin({
  appId: "eighty",
  callAgent: false,
  adapters: [eightyTelegramAdapter()],
  actions: Object.fromEntries(
    Object.entries(loadActionsFromStaticRegistry(actionsRegistry)).filter(
      ([name]) => (TELEGRAM_AGENT_TOOLS as readonly string[]).includes(name),
    ),
  ),
  initialToolNames: TELEGRAM_AGENT_TOOLS,
  systemPrompt: TELEGRAM_AGENT_PROMPT,
  beforeProcess: (incoming) => beforeTelegramMessage(incoming),
  resolveExecutionContext: (incoming) => telegramExecutionContext(incoming),
});

// Eighty has no messaging settings screen: a deployment with a bot token has
// Telegram switched on. Without a token, the webhook stays refused.
export default defineNitroPlugin(async (app) => {
  await integrations(app);
  if (!telegramBotToken()) return;
  try {
    await setUpCheckins();
  } catch (error) {
    console.error("[eighty-checkins] setup failed:", error instanceof Error ? error.message : error);
  }
  const current = await getIntegrationConfig("telegram");
  if (current?.configData?.enabled === true) return;
  await saveIntegrationConfig("telegram", {
    ...(current?.configData ?? {}),
    enabled: true,
  });
});
