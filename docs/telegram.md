# Telegram

A member links Telegram once. After that, a photo or PDF of proof, or a voice note about their hours, goes straight into their month.

## Linking

1. On their month page (or Maria's example month), the member taps **Link Telegram**. The `telegram_link` action runs only in the member's own verified browser session (`uiOnly`, `agentTool: false`, `mcpTool: false`).
2. It makes an 8-character one-time code from an alphabet with no look-alike characters. Only its SHA-256 hash is stored. The code lasts 15 minutes, works once, and a newer code replaces an older one.
3. The member opens `t.me/<bot>?start=<code>` or types the code to the bot. The chat is now linked to that member: one chat per member, one member per chat. Group chats are refused, so proof stays in a private chat.
4. `/stop` in Telegram, or **Unlink Telegram** on the month page, removes the link. Deleting a member or an example account removes its link with it.

## What each message does

`server/plugins/integrations.ts` mounts Agent-Native's messaging plugin with Eighty's Telegram adapter, a `beforeProcess` hook and a `resolveExecutionContext` hook.

| Message | What happens | Model used |
| --- | --- | --- |
| A link code, or `/start <code>` | Links the chat and says whose month it adds to | No |
| `/status` | This month's status, confirmed hours out of 80, hours still needed, and the rule with its link | No |
| `/help`, `/stop` | Help text; unlink | No |
| A photo or PDF | Saved through the same encrypted save path as a web upload, with the same quality and size checks, then read by the document reader. The reply lists the proposed lines, links to review, and gives the month's status. | Reader |
| A voice note | Transcribed with Agent-Native's transcription, then passed to the member's helper, which proposes one line and answers in the member's language with the hours still needed | Transcription, helper |
| Typed text | The member's helper, with `check_month` or `example_month`, `list_evidence` and `propose_evidence` | Helper |
| Video, sticker, location, contact | A plain answer that says what the bot can read | No |
| Any message from an unlinked chat | How to link | No |

The helper on Telegram can propose a line. It can never confirm one: the member does that on the web, and the ring fills only then.

## Identity

The framework resolves a chat's identity before `beforeProcess` runs, so an unlinked chat gets a service identity with no member behind it. Every unlinked message is answered by `beforeProcess` and never reaches a model, and no Eighty action accepts that identity.

A linked chat's helper runs with the member's email. Eighty's actions accept that run only when the framework marks it as a Telegram integration run and that exact chat is linked to that email. The account id comes from the link, which the member made from their own verified session. The tests in `tests/unit/telegram.test.mjs` check that one member's chat can't act for another member, and that a bare email without the integration marks is refused.

## Files

The stock adapter keeps text only, so a photo, PDF or voice note would never arrive. Eighty's adapter (`eightyTelegramAdapter`) uses the framework's own signature check and replies, and its parser keeps the largest photo size, the document, or the voice note. Files are fetched from Telegram with the bot token on the server, capped at 15 MB (voice notes at 5 MB), and zeroed in memory after use.

## The example

Maria, Daniel and Rosa's example months can be linked the same way, so a visitor can try the loop from their own phone. Example reads and helper turns from Telegram share the public daily model limit with the web example.

## Switching it on

Set `TELEGRAM_BOT_TOKEN` (from @BotFather), `TELEGRAM_WEBHOOK_SECRET` (a random string), `A2A_SECRET` (signs the framework's task processor) and `EIGHTY_TELEGRAM_BOT` (the bot's username). With a token set, the app switches the Telegram integration on at start. Register the webhook once with the Bot API:

```sh
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'content-type: application/json' \
  -d '{"url":"https://<your-site>/_agent-native/integrations/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

Caddy and the app open only two Telegram paths, both by POST: the webhook, which checks Telegram's secret header, and the framework's task processor, which checks its signed token.
