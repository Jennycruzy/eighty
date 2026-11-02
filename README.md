# Eighty

Eighty is intended to help Medicaid members collect evidence of work, school and service, check it against cited rules, and prepare proof for their state.

The application is not available yet. There is no live service, account system, document reader or verified rules engine in this repository. Do not upload personal documents.

## Setup

The [Agent-Native setup guide](https://github.com/BuilderIO/agent-native/blob/main/packages/core/docs/content/getting-started.mdx) requires Node.js 22.22 or later and pnpm. The intended server also needs Git, Docker and Caddy.

Check these tools without changing the machine:

```sh
node scripts/check-setup.mjs
node --test tests/check-setup.test.mjs
```

The setup check exits with a failure when a required tool is absent. It does not check service credentials, network access or deployment readiness.

No rule accuracy, privacy, accessibility or production readiness claims have been verified yet.
