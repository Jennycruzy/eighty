/**
 * Telegram belongs to the deployment, not to a member. In production the
 * framework will not let a signed-in member's request fall back to deployment
 * values, so a member's own page would see no bot at all. These read the
 * deployment's values directly. Server code only: the token never leaves it.
 */
export function telegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null; // guard:allow-env-credential — the deployment's own bot; server only, never sent to a browser or stored per member
}

/** The bot's public @username, when the deployment names it. */
export function configuredBotName(): string | null {
  return process.env.EIGHTY_TELEGRAM_BOT?.trim().replace(/^@/, "") || null; // guard:allow-env-credential — a public bot username, not a secret
}
