# Eighty

Eighty is intended to help Medicaid members collect evidence of work, school and service, check it against cited rules, and prepare proof for their state.

A scaffold preview runs at [https://38.49.219.205.sslip.io](https://38.49.219.205.sslip.io). The member workflows, document reader and complete rules engine are not available yet. Do not upload personal documents. The purchased domain will replace this temporary address.

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

The notice reply date calculation has local component tests. See [the rule and its limits](docs/rules.md). The full rules engine, privacy, accessibility and production readiness have not been verified.
