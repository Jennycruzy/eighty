# Eighty

**In 2018, Arkansas cut about 18,000 people from Medicaid. Most of them qualified. They lost it to paperwork.**

Over 40% of the people the Arkansas rule covered failed to report, and studies suggest only about 6% would not have met it through work or an exemption ([KFF](https://www.kff.org/medicaid/issue-brief/an-early-look-at-implementation-of-medicaid-work-requirements-in-arkansas/), [CBPP](https://www.cbpp.org/research/health/pain-but-no-gain-arkansas-failed-medicaid-work-reporting-requirements-should-not-be)). The federal work rule starts on 31 December 2026, and the Congressional Budget Office expects work requirements to leave about 5 million more people uninsured by 2034 ([KFF](https://www.kff.org/60c1aad)).

**Eighty does the paperwork from the phone people already use.** Maria says into her phone, in Spanish, *"Trabajé cuatro horas en la despensa el sábado."* On her month page, her ring grows by four hours while she's still in the chat, and the bot answers in Spanish with what's left.

The new federal work rule asks many adults on Medicaid to show 80 hours of work, school, volunteering or a work program each month, or pay of at least $580. Eighty keeps that proof. A member sends a pay stub photo or a Spanish voice note on Telegram. Eighty reads it, proposes a line, and the member's month fills in on the web as two rings: hours toward 80 and pay toward $580. Every result is cited to the law, plain words first. Nothing counts until the member confirms it, and the state decides.

Live at **[tryeighty.space](https://tryeighty.space)** · Telegram **[@TryEightybot](https://t.me/TryEightybot)** · Claude connector **`https://tryeighty.space/_agent-native/mcp`** · Built on **[Agent-Native](https://agent-native.com)**

**Watch the demo (3 min):** [Clips recording](https://clips.agent-native.com/share/wH5UAjTaA9Ww) · **Slides:** [the deck, 10 slides](https://drive.google.com/file/d/1Y-KgMVKOefQZdVBHKjU6vAiGyePuiSJm/view?usp=sharing)

## Judges: start here

| | What you see | Sign-in | Time |
| --- | --- | --- | --- |
| **A** | Maria's example month: Telegram voice note, Do my month, proof packet | None | 2 min |
| **B** | A real member account: add a line, confirm it, Do my month | Judge login below | 2 min |
| **C** | Claude reads that same month over MCP | Judge login below | 3 min |

**Judge login** (a shared, made-up member in Nebraska, with one confirmed line: Corner Bakery, 30 hours)

```
Sign in:   https://tryeighty.space/check/sign-in
Email:     judge@tryeighty.space
Password:  EightyJudge-2026
```

Other judges use the same account, so you may see their lines too.

**Or make your own account** (about 2 minutes, any email you can open):

1. Open **[tryeighty.space](https://tryeighty.space)** and choose **Check if it applies to me**.
2. Answer the questions: your state, the kind of Medicaid, your age, and a few yes or no questions. Only the questions that matter for your answers appear. The result never says the rule applies; your state decides that.
3. Choose **Track my months**. Type your email and a password of at least 12 characters, then **Create account**.
4. Open the email from Eighty, click the link, then **Continue**. Your month page opens.
5. **Add proof**: upload a photo or PDF of a pay stub, or **Type a proof line**. Then confirm it on **Review the lines**.
6. Optional: **Link Telegram** from your month page, or connect Claude as in path C below, signing in with your own email.


**A. Example month, no sign-in**

1. Open **[tryeighty.space](https://tryeighty.space)** and choose **See Maria's month**. Maria is a made-up delivery driver who volunteers at a food pantry. Her month opens at 61 of 80 hours.
2. Under **Send proof from your phone**, tap **Link Telegram** and open the bot. The one-time code links your Telegram to Maria's month.
3. Send a voice note: *"Trabajé cuatro horas en la despensa el sábado."* Eighty transcribes it, proposes a 4-hour volunteer line and answers in Spanish. Maria's page shows **New from your phone** without a reload.
4. Send `/month` in the chat: what is waiting, and a plan the rules accept.
5. On the web, tap **Do my month**. It reads her earnings summary and asks the one question only she can answer: gas and phone costs. Type `206.60`, save, and confirm the lines. Her pay ring closes at $617.85 and the month changes to **Meets the rule**, with the citation underneath.
6. Download **the proof packet**: a plain-words cover page, cited to the law, with her documents.
7. Back on the home page, open **Rosa's month**: the rule does not apply to her, and Eighty says why, with 42 CFR 435.554(c)(3)(i)(A) underneath.

**B. A real member account**

1. Sign in with the judge login. You land on the month page: 30 of 80 hours, **Not sure yet**.
2. **Add proof** → **Type a proof line**: Work, any employer, dates in this month, hours. Save it.
3. On **Review the lines**, the line says **Needs review; does not count**. Edit it, reject it, or **Confirm facts**. Only then does the ring move.
4. Tap **Do my month** for the plan.

**C. Claude over MCP, same account**

1. In Claude: **Settings → Connectors → Add custom connector**. Name `Eighty`, URL `https://tryeighty.space/_agent-native/mcp`. Add, then **Connect**.
2. Eighty's sign-in page opens. Type the judge email, choose **Use a password instead**, type the email and password, sign in, then **Authorize**.
3. In a new chat: *"Using Eighty, what's left in my month, and what should I do next?"* Allow the tool. Claude calls **Check month** and answers from the judge's real month: hours confirmed, hours left, and the next steps.
4. Ask Claude to confirm a line. It can't: confirming is not a tool any agent gets.

## Why Eighty only works on Agent-Native

**Eighty is one set of actions with four doors: the member's buttons, the web month helper, the Telegram helper, and Claude over MCP. Agent-Native is what makes those four doors one app instead of four.**

- **One action, every surface.** Eighty has **27 actions** (`defineAction`). The Confirm button, the month helper, the Telegram helper and Claude all run the same action code, with the same per-member identity check. Without Agent-Native this is a REST API, an agent tool layer, a Telegram bot backend and an MCP server: four copies of the rules that could disagree about whether someone keeps their health coverage.
- **The safety line is a framework flag, not a prompt.** `confirm_evidence`, `edit_evidence` and `reject_evidence` are `uiOnly`, `agentTool: false` and `mcpTool: false`. No model, in the app, in Telegram or in Claude, is ever handed the tool that makes proof count. Agents propose; only the member confirms.
- **Claude connects with OAuth on Eighty's own accounts.** The `mcp` option on `createAgentChatPlugin` serves the MCP connector and its OAuth sign-in. Eighty chose the three actions Claude gets (`check_month`, `list_evidence`, `do_my_month`) and checks that the caller is the verified member, never an example account.
- **Telegram is the same agent, not a second bot.** `createIntegrationsPlugin` with Eighty's adapter runs each linked chat as its member, with the same actions and checks as the web.
- **The UI and the agent share one screen and one database.** The helper sees the page (`view-screen`), moves the member to the right page (`navigate`), and a line sent from the phone shows up on the open month page.
- **Spanish voice notes, private files and check-ins come from the framework.** Builder transcription turns voice notes into text, private blob storage keeps every upload encrypted, and the month check-ins run as Agent-Native jobs.

## Every Agent-Native part Eighty uses

| Agent-Native feature | What it does in Eighty | Where |
| --- | --- | --- |
| Actions (`defineAction`) | 27 actions: evidence, documents, reading, months, Do my month, the proof packet, notice dates, Telegram linking, the example. The same action serves the page, the agent and HTTP. Confirming, editing and rejecting a line are `uiOnly` with `agentTool: false` and `mcpTool: false`, so no agent can confirm proof. | [`actions/`](actions) |
| Agent chat (`createAgentChatPlugin`) | The month helper on every month page. It reads the member's month and lines, proposes one line from what the member says, and answers with the citation the rules return. Per-member tool surface (`resolveActionSurface`) and context (`extraContext`). | [`server/plugins/agent-chat.ts`](server/plugins/agent-chat.ts), [`server/lib/month-agent.ts`](server/lib/month-agent.ts) |
| AgentKit chat UI and toolkit | The helper's chat panel, guided questions, and screen context (`view-screen`, `navigate`). | [`app/components/MonthHelper.tsx`](app/components/MonthHelper.tsx) |
| MCP connector and OAuth (`createAgentChatPlugin` `mcp`) | Claude, or any MCP client, connects at `/_agent-native/mcp`, signs in with the member's own Eighty account, and gets `check_month`, `list_evidence` and `do_my_month` (`mcpTool: true`). Each call runs as that verified member. | [`server/plugins/agent-chat.ts`](server/plugins/agent-chat.ts), [`server/lib/member-identity.ts`](server/lib/member-identity.ts), [`shared/access.ts`](shared/access.ts) |
| Messaging (`createIntegrationsPlugin`, Telegram adapter) | The Telegram loop. Eighty's adapter keeps photos, PDFs and voice notes that the stock adapter drops. `beforeProcess` handles linking, `/status`, `/stop` and files without a model. `resolveExecutionContext` runs each linked chat as its own member. | [`server/plugins/integrations.ts`](server/plugins/integrations.ts), [`server/lib/telegram.ts`](server/lib/telegram.ts) |
| Transcription (`@agent-native/core/transcription/builder`) | Spanish and English voice notes become text the helper turns into a proposed line. | [`server/lib/telegram-voice.ts`](server/lib/telegram-voice.ts) |
| Agent engines | The document reader and both helpers use the deployment's model setting through the framework engine. | [`server/lib/reader.ts`](server/lib/reader.ts) |
| Private blob storage | Every upload is encrypted before it leaves the app and stored opaque. Deletions retry on a framework interval job until storage confirms. | [`server/lib/document-records.ts`](server/lib/document-records.ts), [`server/plugins/private-storage.ts`](server/plugins/private-storage.ts) |
| Auth (Better Auth via the toolkit) | Email sign-up with verification, sessions, and one-day example accounts that see only their own made-up person. | [`server/plugins/auth.ts`](server/plugins/auth.ts), [`server/lib/example-accounts.ts`](server/lib/example-accounts.ts) |
| Database and migrations (`runMigrations`, Drizzle) | Members, documents, evidence with full version history, events, AI ledger, Telegram links. | [`server/plugins/db.ts`](server/plugins/db.ts), [`server/db/schema.ts`](server/db/schema.ts) |
| Jobs (`@agent-native/core/jobs`) | The month check-ins: a scheduled job tells linked members on Telegram what is still missing before the month ends. | [`server/lib/checkins.ts`](server/lib/checkins.ts) |
| Interval jobs (`startIntervalJob`) | The hourly example reset and the private-file deletion retries. | [`server/plugins/example.ts`](server/plugins/example.ts) |
| Request context and identity | Each action runs as exactly one member; a Telegram run is accepted only when that exact chat is linked to that member. | [`server/lib/member-identity.ts`](server/lib/member-identity.ts) |
| Observability (`@agent-native/otel`) | OpenTelemetry traces for requests and model calls, sent wherever the standard `OTEL_EXPORTER_OTLP_*` settings point. | [`server/plugins/otel.ts`](server/plugins/otel.ts) |
| `agent-native doctor` | Runs in CI on every push, with the framework's security guards. | [`.github/workflows`](.github/workflows) |

## Measured, not guessed

- **The rules:** [365 cited cases](docs/tests/results/answer-key.md) from 42 CFR 435, all passing, with [100% line, branch and function coverage](docs/tests/results/rules-coverage.txt). `pnpm test` fails below 100%.
- **The document reader on held-out documents:** 26 locked documents that the reader was never tuned on, read three times. It got **797 of 822 fields right (97.0%)** and **0 wrong values**: every field it missed, it left blank for the member. It got **77 of 78 months right** with **0 false Meets** (95% upper bound 3.8%). The one month it missed is a pay stub that hides an instruction aimed at the model: the reader refused it and showed "Not sure yet". [Results and files](docs/tests/results/reading.md).
- **The practice set:** 267 of 269 fields right (99.3%), 25 of 25 months.
- **The app:** 863 unit and integration tests, a production container check that drives the real site in a phone-width browser in English and Spanish, and `agent-native doctor`, all in CI on every push.

## Safe by design

- **The member confirms; the agent proposes.** Agents can read and propose. Only the member, in their own verified browser session, can confirm, edit or reject a line.
- **Plain words first, the law one tap away.** Every month shows its status in plain English or Spanish, with the exact paragraph of 42 CFR 435 underneath.
- **Private files stay private.** Uploads are encrypted before they reach storage. Members can black out parts of a photo before uploading it. Telegram chats link only with a one-time code made in the member's own signed-in browser, and only in a private chat.
- **The example is separate.** Example accounts see only their own made-up person, can't reach real members' records, and are deleted within a day.

## How it works

```
Phone (Telegram)          Web (tryeighty.space)          Agent-Native
photo · PDF · voice  ──▶  adapter + beforeProcess  ──▶  actions ──▶ rules (42 CFR 435)
                          month helper (agent chat)  ──▶  actions ──▶ reader (model)
                          month page: two rings      ◀──  check_month / example_month
                          review: member confirms    ──▶  confirm_evidence (uiOnly)
```

The rules in [`server/rules/`](server/rules) are pure functions: money in integer cents, hours in integer millionths, so an amount just below a line can't round up to a pass. See [the rules](docs/rules.md), [evidence and review](docs/evidence.md), [Telegram](docs/telegram.md), [the example people](docs/example-member.md), [the screener](docs/screener.md) and [the reading test](docs/reading-test.md).

## What was built during the hackathon

Built for the Builder.io Agent-Native Hackathon: the federal rules engine and its cited answer cases, the English and Spanish site and screener, member months, private encrypted uploads with blackout, evidence review with version history and duplicate checks, the document reader and its held-out test set, the example people, the month helper, the Telegram loop with voice notes, Do my month and `/month`, the proof packet, notice dates and month check-ins, the Claude (MCP) connector on members' own accounts, and the ring design.

Taken from the starter: the Agent-Native chat template and `@agent-native/core` supply authentication, actions, the chat service, model connections, messaging adapters, email delivery, database support and private storage connections. React and React Router render the pages; Drizzle stores member records; image and PDF libraries prepare documents. A small pinned patch to core ([`patches/`](patches)) encrypts private files before they leave the app and exports the sign-in instance so a member can ask for a new verification link.

## Run it

Use Node.js 22.22 or later and pnpm 10.29.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm agent-native:doctor
pnpm build
```

For a container, use `docker build -t eighty:local .` and `pnpm check:production eighty:local`. See [the server guide](docs/self-hosting.md).

## Settings

- **Database and sign-in:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
- **Email:** `RESEND_API_KEY` and `EMAIL_FROM`; `EIGHTY_REGISTRATION_ENABLED=1` offers accounts. Verification links work for 24 hours, and members can ask for a new link three times an hour.
- **Private storage:** `AGENT_NATIVE_HOSTED_STORAGE_ENABLED=true`, `AGENT_NATIVE_HOSTED_STORAGE_ENDPOINT`, `_REGION`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_BUCKET` and `SECRETS_ENCRYPTION_KEY`. Keep a recovery copy of the encryption key and the database backups.
- **Models:** the reader and both helpers use the deployment's `AGENT_ENGINE` and `AGENT_MODEL` and that provider's key; voice notes use the Builder connection (`BUILDER_PUBLIC_KEY`, `BUILDER_PRIVATE_KEY`). `EIGHTY_PUBLIC_MODEL_USES_PER_DAY` sets the shared daily model limit for try reads, example reads, example chat turns and example Telegram messages (50 by default); `EIGHTY_TRY_READS_PER_VISITOR` limits each visitor (3 by default).
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `A2A_SECRET` (signs the framework's task processor) and `EIGHTY_TELEGRAM_BOT` (the bot's username). See [Telegram](docs/telegram.md) for the webhook.
- **Example:** `EIGHTY_EXAMPLE_ENABLED=0` turns off new example months; `EIGHTY_EXAMPLE_STARTS_PER_VISITOR_HOUR` and `EIGHTY_EXAMPLE_STARTS_PER_HOUR` set their limits (5 and 120 by default).

## License

[MIT](LICENSE)
