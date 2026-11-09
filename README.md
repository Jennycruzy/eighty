# Eighty

**In 2018, Arkansas cut about 18,000 people from Medicaid. Most of them qualified. They lost it to paperwork.**

Over 40% of the people the Arkansas rule covered failed to report, and studies suggest only about 6% would not have met it through work or an exemption ([KFF](https://www.kff.org/medicaid/issue-brief/an-early-look-at-implementation-of-medicaid-work-requirements-in-arkansas/), [CBPP](https://www.cbpp.org/research/health/pain-but-no-gain-arkansas-failed-medicaid-work-reporting-requirements-should-not-be)). The federal work rule starts on 31 December 2026, and the Congressional Budget Office expects work requirements to leave about 5 million more people uninsured by 2034 ([KFF](https://www.kff.org/60c1aad)).

**Eighty does the paperwork from the phone people already use.** Maria says into her phone, in Spanish, *"Trabajé cuatro horas en la despensa el sábado."* On her month page, her ring grows by four hours while she's still in the chat, and the bot answers in Spanish with what's left.

The new federal work rule asks many adults on Medicaid to show 80 hours of work, school, volunteering or a work program each month, or pay of at least $580. Eighty keeps that proof. A member sends a pay stub photo or a Spanish voice note on Telegram. Eighty reads it, proposes a line, and the member's month fills in on the web as two rings: hours toward 80 and pay toward $580. Every result is cited to the law, plain words first. Nothing counts until the member confirms it, and the state decides.

Live at **[tryeighty.space](https://tryeighty.space)** · Telegram **[@TryEightybot](https://t.me/TryEightybot)** · Built on [Agent-Native](https://agent-native.com)

## Try it in two minutes

1. Open **[tryeighty.space](https://tryeighty.space)** and choose **See Maria's month**. Maria is a made-up delivery driver who volunteers at a food pantry. Her month opens at 61 of 80 hours. No account needed.
2. Under **Send proof from your phone**, tap **Link Telegram** and open the bot. The one-time code links your own Telegram to Maria's month.
3. Send a voice note: *"Trabajé cuatro horas en la despensa el sábado."* Eighty transcribes it, proposes a 4-hour volunteer line and answers in Spanish.
4. Send a photo of [Maria's earnings summary](https://tryeighty.space/example/maria-earnings-sample.png). Eighty reads it and replies with the pay line it found. On Maria's page, the waiting lines show as faint arcs on her rings, without a reload.
5. Open **Review the lines** and check the pay line: Maria spent $206.60 on gas and her phone, so her net pay is $617.85; answer **Yes** to the business-costs question and confirm. Her pay ring closes, and her month changes from **Below the line** to **Meets the rule**, with the citation underneath.
6. Back on the home page, open **Rosa's month** and ask the month helper *"Why is Rosa exempt?"* It answers in plain words, with 42 CFR 435.554(c)(3)(i)(A) underneath.

## Built on Agent-Native

Every operation is one action. The web pages, the month helper, and the Telegram helper all call the same actions, with the same identity and permission checks.

| Agent-Native feature | What it does in Eighty | Where |
| --- | --- | --- |
| Actions (`defineAction`) | 24 actions: evidence, documents, reading, months, Telegram linking, the example. The same action serves the page, the agent and HTTP. Confirming, editing and rejecting a line are `uiOnly` with `agentTool: false`, so no agent can confirm proof. | [`actions/`](actions) |
| Agent chat (`createAgentChatPlugin`) | The month helper on every month page. It reads the member's month and lines, proposes one line from what the member says, and answers with the citation the rules return. Per-member tool surface (`resolveActionSurface`) and context (`extraContext`). | [`server/plugins/agent-chat.ts`](server/plugins/agent-chat.ts), [`server/lib/month-agent.ts`](server/lib/month-agent.ts) |
| AgentKit chat UI and toolkit | The helper's chat panel, guided questions, and screen context (`view-screen`, `navigate`). | [`app/components/MonthHelper.tsx`](app/components/MonthHelper.tsx) |
| Messaging (`createIntegrationsPlugin`, Telegram adapter) | The Telegram loop. Eighty's adapter keeps photos, PDFs and voice notes that the stock adapter drops. `beforeProcess` handles linking, `/status`, `/stop` and files without a model. `resolveExecutionContext` runs each linked chat as its own member. | [`server/plugins/integrations.ts`](server/plugins/integrations.ts), [`server/lib/telegram.ts`](server/lib/telegram.ts) |
| Transcription (`@agent-native/core/transcription/builder`) | Spanish and English voice notes become text the helper turns into a proposed line. | [`server/lib/telegram-voice.ts`](server/lib/telegram-voice.ts) |
| Agent engines | The document reader and both helpers use the deployment's model setting through the framework engine. | [`server/lib/reader.ts`](server/lib/reader.ts) |
| Private blob storage | Every upload is encrypted before it leaves the app and stored opaque. Deletions retry on a framework interval job until storage confirms. | [`server/lib/document-records.ts`](server/lib/document-records.ts), [`server/plugins/private-storage.ts`](server/plugins/private-storage.ts) |
| Auth (Better Auth via the toolkit) | Email sign-up with verification, sessions, and one-day example accounts that see only their own made-up person. | [`server/plugins/auth.ts`](server/plugins/auth.ts), [`server/lib/example-accounts.ts`](server/lib/example-accounts.ts) |
| Database and migrations (`runMigrations`, Drizzle) | Members, documents, evidence with full version history, events, AI ledger, Telegram links. | [`server/plugins/db.ts`](server/plugins/db.ts), [`server/db/schema.ts`](server/db/schema.ts) |
| Interval jobs (`startIntervalJob`) | The hourly example reset and the private-file deletion retries. | [`server/plugins/example.ts`](server/plugins/example.ts) |
| Request context and identity | Each action runs as exactly one member; a Telegram run is accepted only when that exact chat is linked to that member. | [`server/lib/member-identity.ts`](server/lib/member-identity.ts) |
| Observability (`@agent-native/otel`) | OpenTelemetry traces for requests and model calls, sent wherever the standard `OTEL_EXPORTER_OTLP_*` settings point. | [`server/plugins/otel.ts`](server/plugins/otel.ts) |
| `agent-native doctor` | Runs in CI on every push, with the framework's security guards. | [`.github/workflows`](.github/workflows) |

## Measured, not guessed

- **The rules:** [365 cited cases](docs/tests/results/answer-key.md) from 42 CFR 435, all passing, with [100% line, branch and function coverage](docs/tests/results/rules-coverage.txt). `pnpm test` fails below 100%.
- **The document reader on held-out documents:** 26 locked documents that the reader was never tuned on, read three times. It got **797 of 822 fields right (97.0%)** and **0 wrong values**: every field it missed, it left blank for the member. It got **77 of 78 months right** with **0 false Meets** (95% upper bound 3.8%). The one month it missed is a pay stub that hides an instruction aimed at the model: the reader refused it and showed "Not sure yet". [Results and files](docs/tests/results/reading.md).
- **The practice set:** 267 of 269 fields right (99.3%), 25 of 25 months.
- **The app:** 826 unit and integration tests, a production container check that drives the real site in a phone-width browser in English and Spanish, and `agent-native doctor`, all in CI on every push.

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

Built for the Builder.io Agent-Native Hackathon: the federal rules engine and its cited answer cases, the English and Spanish site and screener, member months, private encrypted uploads with blackout, evidence review with version history and duplicate checks, the document reader and its held-out test set, the example people, the month helper, the Telegram loop with voice notes, and the ring design.

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
