# Run Eighty on a server

Eighty currently has the framework scaffold and a notice-date calculation. It does not have member workflows or a verified rules engine. Keep the server private. Do not upload personal documents.

## Tools

Use Node.js 22.22 or later, pnpm 10.29.1, Git, Docker with Compose, and Caddy. The repository pins the local Node version in `.node-version`. Check installed tools with:

```sh
node scripts/check-setup.mjs
```

The check proves that the commands run. It does not prove that Docker is running, a database is reachable, or a public site is ready.

## Check the container with a separate database

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm agent-native:doctor
docker build --tag eighty:local .
pnpm check:production eighty:local
```

The production check creates its own Docker network, PostgreSQL container, application container and temporary account. Published ports bind to localhost. Passwords are generated for the run and are not printed. The check uses no model or email service.

It checks database readiness after release migrations, the public page, the login requirement, account creation, sign-in, a scheduled job without a model, and data persistence after database and application restarts. The job must write a receipt and a successful history row, without creating a chat thread. Finally, the check removes only its own containers, database volume and network. Redacted diagnostics stay in `.private/production-check.log`, outside Git and the image.

The web server runs in production mode throughout. The scheduler subcheck uses the framework's local deployment setting: the framework intentionally blocks reserved test email addresses from running jobs in production. This subcheck proves the runner's work and stored result in the test database; it does not prove a real account's production reminder delivery. Page shells are public, so access is tested at the action: an anonymous request must be denied, and a signed-in request must succeed.

This checks the scaffold. It is not a test of Medicaid decisions, member journeys, email verification, backups or restore, document storage, or a public deployment. PostgreSQL runs locally for this check; production should use the planned managed database.

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

## Current IP preview

The preview is served over HTTP at `38.49.219.205`. Caddy forwards to the production container on localhost. The app runs as a regular user with login enabled and public upload fallback disabled.

For this preview, `deploy/compose.ip.yaml` adds PostgreSQL with the persistent `eighty_postgres_data` volume. The database port is bound to localhost. This is a local database on the VPS, not the planned managed database. Do not remove its volume when updating the application.

```sh
docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.ip.yaml up -d
docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.ip.yaml ps
curl --fail 'http://38.49.219.205/_agent-native/health?strict=1'
```

The server has a 4 GiB swap file at `/swapfile`, with permissions `600`. Its entry in `/etc/fstab` enables it after reboot. Check it with `swapon --show` and `findmnt --verify --tab-file /etc/fstab`. No reboot was needed to enable it.

Once the chosen domain resolves to this server, set `BETTER_AUTH_URL` in the private production settings to the HTTPS origin. Change `EIGHTY_HOST` in `/etc/systemd/system/caddy.service.d/eighty.conf` from the HTTP IP address to that domain without an HTTP prefix. Validate the Caddyfile, recreate the app with the updated environment, reload the service settings, and restart Caddy. Caddy can then obtain and renew the HTTPS certificate. Verify HTTPS and sign-in before directing members to it.

`@agent-native/otel` is pinned to `0.1.29`. Its published package records core `0.222.2` as its development dependency and declares a core peer range that includes that version. The lockfile records the exact installed pair.

## Before serving members

The member workflows, exact rules and answer key, private storage access checks, working email, deletion, navigator consent, backups, restore, monitoring and accessibility checks remain to be completed. A successful container check alone does not make this a member service.
