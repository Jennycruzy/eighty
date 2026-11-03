# Eighty

Eighty is intended to help Medicaid members collect evidence of work, school and service, check it against cited rules, and prepare proof for their state.

The public tools run at [https://tryeighty.space](https://tryeighty.space). The manual month check, screener and public help pages need no account. Sign-up stays closed. Uploads and evidence review require a verified account. Do not send real personal documents while sign-up is closed. The site uses its registered domain.

## Setup

The [Agent-Native setup guide](https://github.com/BuilderIO/agent-native/blob/main/packages/core/docs/content/getting-started.mdx) requires Node.js 22.22 or later and pnpm. The intended server also needs Git, Docker and Caddy.

Check these tools without changing the machine:

```sh
node scripts/check-setup.mjs
node --test tests/check-setup.test.mjs
```

Install and check the application with Node.js 22.22 or later:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm agent-native:doctor
pnpm build
```

`pnpm dev` runs the application locally. The scaffold uses Agent-Native core 0.222.2. Production needs a stable authentication secret, PostgreSQL, private document storage and email before accounts can be offered to members. The example environment file contains no credentials.

The [server guide](docs/self-hosting.md) explains the container setup and its separate PostgreSQL check. It also lists what remains before members can use the service.

The setup check exits with a failure when a required tool is absent. It does not check service credentials, network access or deployment readiness.

The federal rules engine has [365 cited answer cases](docs/tests/results/answer-key.md) and [100% line, branch and function coverage](docs/tests/results/rules-coverage.txt). `pnpm test` enforces those coverage thresholds. See [the rules, source text and limits](docs/rules.md). These checks do not establish legal approval, document-reading accuracy, privacy, accessibility or readiness for members.

The [public-page checks](docs/tests/results/public-pages.md) cover signed-out English and Spanish pages, closed starter routes and phone-browser flows. The [real private storage check](docs/tests/results/private-storage.md) passes. Document reading and real email delivery have not been verified. Sign-up stays closed. Private uploads and typed evidence work through a verified account.

The [initial check and account handoff](docs/screener.md) use 13 optional questions, cited reasons and proof checklists. Account creation stays closed on the preview. Public HEAD requests are checked against GET in the production checks.

The [evidence guide](docs/evidence.md) explains private photo and PDF uploads, manual entry, review cards, duplicate comparisons and saved versions. The flow uses no model reader. See [the production evidence checks](docs/tests/results/evidence.md).

## Limits before sign-up opens

- The database runs on this server with no independent backup. A local dump does not protect against losing the server.
- The file encryption key is only on this server. It needs a separate secure recovery copy.

Both must be fixed before sign-up opens.
