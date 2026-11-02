# Eighty

Eighty is intended to help Medicaid members collect evidence of work, school and service, check it against cited rules, and prepare proof for their state.

The public tools run at [https://38.49.219.205.sslip.io](https://38.49.219.205.sslip.io). The manual month check, screener and public help pages need no account. Sign-up, uploads and member workflows remain closed. Do not send personal documents. The purchased domain will replace this temporary address.

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

The [public-page checks](docs/tests/results/public-pages.md) cover signed-out English and Spanish pages, closed starter routes and phone-browser flows. Private document storage, document reading and real email delivery are still unconfigured; sign-up and uploads remain closed.
