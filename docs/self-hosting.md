# Run Eighty on a server

Eighty has public information pages, a manual work/pay check, a screener and a tested federal rules engine. Sign-up, document upload and signed-in member workflows remain closed. Do not upload personal documents.

## Tools

Use Node.js 22.22 or later, pnpm 10.29.1, Git, Docker with Compose, and Caddy. The repository pins the local Node version in `.node-version`. Check installed tools with:

```sh
node scripts/check-setup.mjs
```

The check proves that the commands run. It does not prove that Docker is running, a database is reachable, or a public site is ready.

## Check the container with a separate database

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm typecheck
pnpm test
pnpm agent-native:doctor
docker build --tag eighty:local .
pnpm check:production eighty:local
```

The production check creates its own Docker network, PostgreSQL container and application container. Published ports bind to localhost. Passwords are generated for the run and are not printed. The check uses no model or email service.

It checks database readiness after release migrations, all public pages and all state pages signed out in both languages, closed starter routes and sign-up, protected member pages, phone-sized browser flows, a scheduled job without a model, and data persistence after database and application restarts. The job must write a receipt and a successful history row, without creating a chat thread. Finally, the check removes only its own containers, database volume and network. Redacted diagnostics stay in `.private/production-check.log`, outside Git and the image.

The web server runs in production mode throughout. The scheduler subcheck uses the framework's local deployment setting: the framework intentionally blocks reserved test email addresses from running jobs in production. This subcheck proves the runner's work and stored result in the test database; it does not prove a real account's production reminder delivery. Only the explicit public page list bypasses login. Member pages require a cookie session. Unknown services, including starter actions, are denied. Caddy adds a separate published-path allowlist.

This checks the public application and container. It is not a complete test of member journeys, email verification, backups or restore, document storage, or a public deployment. PostgreSQL runs locally for this check; production should use the planned managed database.

The [framework's Docker guide](https://www.agent-native.com/docs/docker/) describes the underlying server. The image uses two stages: the first installs and builds; the second holds the server output and runs as a regular user. Credentials are supplied when the container starts. They are not build arguments. `.dockerignore` excludes environment files, private notes, development data and local build output.

## Production settings

Copy `.env.example` to `.env.production` and give it file permissions `600`. Fill in the real PostgreSQL URL. Generate separate random signing and encryption keys, save them securely, and keep them stable across deployments. Do not commit this file.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Persistent PostgreSQL outside the application container |
| `BETTER_AUTH_SECRET` | Signs sessions |
| `SECRETS_ENCRYPTION_KEY` | Protects stored credentials and private document keys |
| `BETTER_AUTH_URL` | The actual public origin, when one is configured |
| `S3_*` | Private storage credentials, when document capture is ready |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email verification, password resets and reminders |

The application disables public upload fallback in its source configuration. Compose also sets `AGENT_NATIVE_PRIVATE_BLOB_PUBLIC_UPLOAD_FALLBACK=0`. Missing private storage must remain a visible failure. Do not turn on a public fallback to make uploads work.

After all required settings are configured:

```sh
docker compose --env-file .env.production -f deploy/compose.yaml config --quiet
docker compose --env-file .env.production -f deploy/compose.yaml build
```

Run release migrations against the intended database before starting a new version. Migrations change that database, so check the selected URL without printing credentials. Then:

```sh
pnpm migrate:production
docker compose --env-file .env.production -f deploy/compose.yaml up -d
curl --fail 'http://127.0.0.1:3000/_agent-native/health?strict=1'
```

`pnpm migrate:production` reads `.env`, not `.env.production`. Supply the values from `.env.production` in the migration process's environment using the server's secret manager; do not assume Compose exported them to the host shell.

The container is bound to localhost. Its health check requires both server readiness and a reachable database. Caddy's configuration is in `deploy/Caddyfile`. Set `EIGHTY_HOST` in the Caddy service environment to the chosen host before installing that configuration. Validate it before restarting Caddy.

Compose reads `.env.production` by default. `EIGHTY_ENV_FILE` can select a different service environment file, such as a separate preview configuration. Use an absolute path when overriding it. The production check uses its own empty temporary file and supplies its test database and signing key through the process environment; it never creates or edits `.env.production`.

## Current server preview

The preview is served over HTTPS at `38.49.219.205.sslip.io`. The HTTP IP address redirects there. Caddy forwards to the production container on localhost and manages the certificate. The app runs as a regular user with login enabled and public upload fallback disabled.

For this preview, `deploy/compose.ip.yaml` adds PostgreSQL with the persistent `eighty_postgres_data` volume. The database port is bound to localhost. This is a local database on the VPS, not the planned managed database. Do not remove its volume when updating the application.

```sh
docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.ip.yaml up -d
docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.ip.yaml ps
curl --fail 'https://38.49.219.205.sslip.io/_agent-native/health?strict=1'
```

The server has a 4 GiB swap file at `/swapfile`, with permissions `600`. Its entry in `/etc/fstab` enables it after reboot. Check it with `swapon --show` and `findmnt --verify --tab-file /etc/fstab`. No reboot was needed to enable it.

Once the purchased domain resolves to this server, set `BETTER_AUTH_URL` in the private production settings to its HTTPS origin. Change `EIGHTY_HOST` in `/etc/systemd/system/caddy.service.d/eighty.conf` to that domain without an HTTP prefix; keep `EIGHTY_IP` set to the server IP for the redirect. Validate the Caddyfile, recreate the app with the updated environment, reload the service settings, and restart Caddy. Caddy can then obtain and renew the HTTPS certificate. Verify HTTPS and sign-in before directing members to it.

`@agent-native/otel` is pinned to `0.1.29`. Its published package records core `0.222.2` as its development dependency and declares a core peer range that includes that version. The lockfile records the exact installed pair.

## Before serving members

Independent rules review, member workflows, private storage access checks, working email, deletion, navigator consent, backups, restore, monitoring and accessibility checks remain to be completed. A successful container check alone does not make this a member service.

## Public route boundary

`shared/access.ts` names the public pages. `app/routes.ts` mounts only Eighty’s own pages. The request middleware rejects unknown services and requires a cookie session for member pages. Public sign-up is denied; email verification is required before registration can be enabled.

Caddy adds a separate published-path allowlist. Update that list deliberately when a real member endpoint is ready. Do not open the framework namespace to make a page load. The current site provides no public chat, terminal, database console, extension manager, team page or observability page. The starter manifest and logos are not published.

The [public-page check results](tests/results/public-pages.md) record the current verification.
