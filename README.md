# Eighty

Eighty helps people on Medicaid collect proof of work, pay, school and volunteer service. It compares their saved answers and confirmed proof with the federal work rule and shows the cited result; the state decides.

## Try it

1. [See Maria's month](https://tryeighty.space/example). Ask the helper about her month, add her sample pay summary, confirm a line and watch the month change. Maria, Daniel and Rosa are example people. Anything you add is deleted within a day.
2. [Try your own pay stub without saving](https://tryeighty.space/try). You can also type the numbers.
3. [Make an account](https://tryeighty.space/check). Answer the questions, choose to save them and confirm your email.

## What was built

Work for Eighty from 27 October 2026 onward includes the Medicaid rules, cited answer cases, English and Spanish public pages, screener, member months, private proof uploads, evidence review, duplicate comparisons, document reader, practice set, example people and month helper. The repository history begins on 2 November 2026. It records the rules in `1761d71`, the reader in `fe5c515`, the example people in `471048b`, member months in `7ec9fd3` and coverage answers in `08169e0`.

The Agent-Native chat starter and core 0.222.2 supply authentication, actions, the chat service, model connections, email delivery, database support and private storage connections. The starter file list is bundled at `node_modules/@agent-native/core/src/templates/chat/`. Eighty's public layout and month panel replace its starter screens. React and the routing library render the pages; the database library stores member records; image and PDF libraries prepare documents. A small pinned patch to core (`patches/@agent-native__core@0.222.2.patch`) encrypts private files before they leave the app and exports the sign-in instance so a member can ask for a new verification link.

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

For a container, use `docker build -t eighty:local .` and `pnpm check:production eighty:local`. See [the server guide](docs/self-hosting.md) for the database and container settings.

## Switch on services

Set `DATABASE_URL` for PostgreSQL and `BETTER_AUTH_SECRET` for the stable sign-in secret. Set `BETTER_AUTH_URL` to the site's HTTPS address.

Email uses `RESEND_API_KEY` and `EMAIL_FROM`. After setting the sender for your domain, set `EIGHTY_REGISTRATION_ENABLED=1` to offer accounts. Verification links work for 24 hours. Members can request a new link three times an hour per address.

Private storage uses `AGENT_NATIVE_HOSTED_STORAGE_ENABLED=true`, `AGENT_NATIVE_HOSTED_STORAGE_ENDPOINT`, `AGENT_NATIVE_HOSTED_STORAGE_REGION`, `AGENT_NATIVE_HOSTED_STORAGE_ACCESS_KEY_ID`, `AGENT_NATIVE_HOSTED_STORAGE_SECRET_ACCESS_KEY`, `AGENT_NATIVE_HOSTED_STORAGE_BUCKET` and `SECRETS_ENCRYPTION_KEY`. See [the storage settings](docs/self-hosting.md). Keep a secure recovery copy of the encryption key and database backups.

The reader and helper use the deployment's `AGENT_ENGINE` and `AGENT_MODEL` settings and that provider's key. The [reader guide](docs/reading-test.md) lists the model run commands. `EIGHTY_PUBLIC_MODEL_USES_PER_DAY` shares a daily model limit across try reads, example reads and example chat turns (50 by default). The older `EIGHTY_TRY_READS_PER_DAY` setting also works. `EIGHTY_TRY_READS_PER_VISITOR` limits each visitor (3 by default). Typing and looking around work after the model limit is used.

`EIGHTY_EXAMPLE_ENABLED=0` turns off new example months. `EIGHTY_EXAMPLE_STARTS_PER_VISITOR_HOUR` and `EIGHTY_EXAMPLE_STARTS_PER_HOUR` set their opening limits (5 and 120 by default).

## Measured results

The [federal rules](docs/rules.md) have [365 cited cases](docs/tests/results/answer-key.md) and [100% line, branch and function coverage](docs/tests/results/rules-coverage.txt). The test command requires those coverage levels.

The synthetic document set has 51 documents: 25 practice and 26 locked. The second practice run read **267 of 269 fields right (99.3%)**, got **25 of 25 months right**, wrongly marked **0 months Meets**, and had **0 unreadable documents**. The first practice run read **228 of 269 fields right (84.8%)**. Both runs used the same 25 practice documents. The reader instructions changed for school facts, volunteer contacts and gig pay. The locked set is kept apart for the final model runs.

Read the [measured results](docs/tests/results/reading.md), [documents](https://github.com/Jennycruzy/eighty/blob/main/tests/reading/documents), [answer files](https://github.com/Jennycruzy/eighty/blob/main/tests/reading/answers), [first result file](data/reading-results/practice-2026-11-04-run1.json) and [second result file](data/reading-results/practice-2026-11-05-run1.json).
