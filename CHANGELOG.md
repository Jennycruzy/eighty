# Changes

## 2 November 2026

- Add private member and evidence tables with account ownership checks.
- Validate reader proposals without accepting status changes, personal identity fields or free-text instructions.
- Check verified browser sessions and private record ownership using a separate database.

- Close public sign-up and starter pages and services.
- Add public English and Spanish pages, a manual work/pay check and the screener.
- Add sourced state contacts and expansion status for every state and DC.
- Count confirmed taxable wages and confirmed net self-employment earnings, with additional answer cases.
- Check every public page without a login in the production container.

- Add the federal rules engine, archived official source text and a cited answer key.
- Require complete rules coverage in the application checks.

- Serve the scaffold preview through Caddy with HTTPS on a temporary sslip.io address and an IP redirect, with a persistent local PostgreSQL volume.
- Pin telemetry to the release paired with core 0.222.2.
- Track template features that must be removed before launch.
- Add a container that runs the server as a regular user.
- Add deployment settings that keep the application bound to localhost and require database and signing settings.
- Check account creation, sign-in, action access, database identity and recovery using a separate PostgreSQL database.
- Check scheduled work and its stored result without a model or chat thread.
- Disable public upload fallback and check that a missing private store cannot send document bytes to a public uploader.
- Fix page rendering in the standalone container.
- Add repeatable checks for messaging, jobs and Forms, with their limits recorded.
- Calculate notice reply dates, including a possible later arrival while keeping the earlier reminder date.

The member workflows are not available yet. The rules engine awaits independent review.
