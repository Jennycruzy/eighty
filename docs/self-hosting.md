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

It checks database readiness after release migrations, all public pages and all state pages signed out in both languages, closed starter routes and sign-up, protected member pages, phone-sized browser flows, a scheduled job without a model, and data persistence after database and application restarts. The job must write a receipt and a successful history row, without creating a chat thread. Finally, the check removes only its own containers, database volume and network. A failure names the check that failed and its first error line. Full redacted diagnostics stay in `.private/production-check.log`, outside Git and the image.

The web server runs in production mode throughout. The scheduler subcheck uses the framework's local deployment setting: the framework intentionally blocks reserved test email addresses from running jobs in production. This subcheck proves the runner's work and stored result in the test database; it does not prove a real account's production reminder delivery. Only the explicit public page list bypasses login. Member pages require a verified cookie session. Unknown services, including starter actions, are denied. Caddy adds a separate published-path allowlist.

This checks the public application and container. It checks synthetic account verification and evidence review with disposable email and storage transports. It does not prove real email delivery, independent backups or restore, or a public deployment. PostgreSQL runs locally for this check; production should use a managed database.

The [framework's Docker guide](https://www.agent-native.com/docs/docker/) describes the underlying server. The image uses two stages: the first installs and builds; the second holds the server output and runs as a regular user. Credentials are supplied when the container starts. They are not build arguments. `.dockerignore` excludes environment files, private notes, development data and local build output.

## Production settings

Copy `.env.example` to `.env.production` and give it file permissions `600`. Fill in the real PostgreSQL URL. Generate separate random signing and encryption keys, save them securely, and keep them stable across deployments. Do not commit this file.

| Setting                         | Purpose                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                  | Persistent PostgreSQL outside the application container                        |
| `BETTER_AUTH_SECRET`            | Signs sessions                                                                 |
| `SECRETS_ENCRYPTION_KEY`        | Protects stored credentials and private document keys                          |
| `BETTER_AUTH_URL`               | The actual public origin, when one is configured                               |
| `S3_*`                          | Private bucket credentials used by the operator storage check                  |
| `AGENT_NATIVE_HOSTED_STORAGE_*` | The same private bucket, configured as app-owned storage for signed-in members |
| `RESEND_API_KEY`, `EMAIL_FROM`  | Email verification, password resets and reminders                              |

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

The container is bound to localhost. Its health check requires both server readiness and a reachable database. Caddy's configuration is in `deploy/Caddyfile`. The Caddyfile names the canonical domain and its redirects explicitly. Validate it before loading it. `EIGHTY_IP` selects the HTTP IP redirect.

Compose reads `.env.production` by default. `EIGHTY_ENV_FILE` can select a different service environment file, such as a separate preview configuration. Use an absolute path when overriding it. The production check uses its own empty temporary file and supplies its test database and signing key through the process environment; it never creates or edits `.env.production`.

## Current server preview

The preview is served over HTTPS at `tryeighty.space`. The HTTP IP address redirects there. Caddy forwards to the production container on localhost and manages the certificate. The app runs as a regular user with login enabled and public upload fallback disabled.

For this preview, `deploy/compose.ip.yaml` adds PostgreSQL with the persistent `eighty_postgres_data` volume. The database port is bound to localhost. This is a local database on the VPS, not a managed database. Do not remove its volume when updating the application.

```sh
docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.ip.yaml up -d
docker compose --env-file .env.production -f deploy/compose.yaml -f deploy/compose.ip.yaml ps
curl --fail --head 'https://tryeighty.space/'
```

The server has a 4 GiB swap file at `/swapfile`, with permissions `600`. Its entry in `/etc/fstab` enables it after reboot. Check it with `swapon --show` and `findmnt --verify --tab-file /etc/fstab`. No reboot was needed to enable it.

The canonical site is `https://tryeighty.space`. Its `www` name and the temporary preview name permanently redirect there, preserving the path and query. Caddy manages certificates for those names. `BETTER_AUTH_URL` must use the canonical origin. Keep registration disabled until the real email setup and member readiness are approved. The Caddyfile names the live domain explicitly; changing the domain requires updating it, `shared/site.ts`, the auth URL and the generated search files.

`@agent-native/otel` is pinned to `0.1.29`. Its published package records core `0.222.2` as its development dependency and declares a core peer range that includes that version. The lockfile records the exact installed pair.

## Before serving members

The database runs on this server with no independent backup. The file encryption key is only on this server. A local database dump does not protect against server loss. Set up an independent backup, test restoration, and keep a secure recovery copy of the key before opening sign-up.

Independent rules review, member workflows, private storage access checks, working email, deletion, navigator consent, backups, restore, monitoring and accessibility checks remain to be completed. A successful container check alone does not make this a member service.

## Public route boundary

`shared/access.ts` names the public pages. `app/routes.ts` mounts only Eighty’s own pages. The request middleware rejects unknown services and requires a cookie session for member pages. Public sign-up is denied; email verification is required before registration can be enabled.

Caddy adds a separate published-path allowlist. Update that list deliberately when a real member endpoint is ready. Do not open the framework namespace to make a page load. The current site provides no public chat, terminal, database console, extension manager, team page or observability page. The starter manifest and logos are not published.

The [public-page check results](tests/results/public-pages.md) record the current verification.

## Check private document storage

Keep the R2 bucket private and use a bucket-scoped Object Read & Write key. Save the `S3_*` values in the private production environment file. For member uploads, also set `AGENT_NATIVE_HOSTED_STORAGE_ENABLED=true` and the `AGENT_NATIVE_HOSTED_STORAGE_ENDPOINT`, `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` and `REGION` settings using the same bucket and credentials (repeat the full prefix for each setting). The app selects the framework's `hosted-private` provider: its app-owned bucket works for signed-in members without giving them storage credentials. A server plugin registers the providers at startup. Do not configure a public bucket URL. Keep the signing and encryption keys stable.

`pnpm check:storage` loads that private file in a child process and runs a synthetic upload/read/delete check. For the local Compose database it connects through the localhost port. It never prints credentials, document contents or opaque handles. This is an operator check, separate from the account-free unit checks.

The [storage results](tests/results/private-storage.md) describe the verification and its limits. The pinned core patch must be included before `pnpm install` in the container build; the Dockerfile copies `patches/` for that reason. A normal install uses the patch recorded in the lockfile.

## Public search files and HTTPS

`public/robots.txt` permits only public page addresses and the assets needed to read them. `public/sitemap.xml` lists all public pages and state pages in English and Spanish. Run `node scripts/update-public-index.mjs` after changing the public routes or the HTTPS origin. The automatic checks compare the files with the route and state lists, and check that the running container serves both files without an account.

Caddy sets `Strict-Transport-Security: max-age=31536000` on the HTTPS site. Preloading remains off. The header applies to errors and closed routes as well as public pages.
