# The example: open a made-up member's month

Anyone can see the real app work in one tap, with no account. The landing page has a button, “See Maria's month”, and smaller links for Daniel and Rosa. Each tap makes a fresh copy of that made-up person for this visitor alone. It uses the real actions, the real rules and the real storage path. No real member is ever shown.

Example pages show one quiet line: “Maria is an example person. Anything you add is deleted within a day.” A link leads back to the home page.

## The people

All three are made up. Their dates follow the current month, so the example is always about “this month”. The rules never count a future date, so this month's lines run from the 1st to the day the copy is made. Early in a month the lines sit close together.

| Person                        | Story                                                                                                                                                             | This month                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maria, 34, Omaha, Nebraska    | Delivers through an app with uneven weeks, volunteers at a food pantry on Saturdays, uses only her phone, Spanish at home and English at work, renewal in January | **Short**: 61 of 80 hours (49 delivery hours, 12 pantry hours with the service details filled). Last month **Meets** (84 hours). One proposed line from last month waits for review. |
| Daniel, 22, Billings, Montana | Community college, 6 credits (less than half-time), part-time job of about 20 hours a month                                                                       | **Meets**: 6 × 3 × 4.33 = 77.94 school hours plus 5 job hours so far                                                                                                                 |
| Rosa, 51, Lincoln, Nebraska   | Cares every day for her mother, who has dementia and lives with her                                                                                               | **Exempt** as a family caregiver, 42 CFR 435.554(c)(3)(i)(A). She did not know.                                                                                                      |

The facts the rules need beyond the saved lines (coverage group, exclusions, state choices) are in `server/lib/example-people.ts`. The state choices there are made up and say nothing about Nebraska or Montana. `tests/unit/example-rules.test.mjs` runs the real `assessMonth`, `combineHours`, `educationHours` and `incomeTest` on each person and locks these numbers.

Seed lines are made through the same server functions a member's own requests use (`saveMemberRecord`, `createEvidenceDraft`, `changeEvidenceRecord`), with a real session for the new account.

## Maria's sample earnings summary

`public/example/maria-earnings-sample.png` and `.pdf` are a made-up earnings summary marked “SAMPLE - made up”. Remake them with:

```sh
pnpm exec tsx scripts/make-example-sample.ts 2026-11-04
```

The date sets the month shown. The committed copies are for November 2026. In the app, “Add Maria's sample” makes the same one-page PDF for the current month and saves it through the normal upload code, with the same limits.

The summary shows $824.45 in total earnings ($638.20 delivery pay and $186.25 tips). Maria's own costs for gas and her phone, $206.60, are not on it; she answers the business-costs question. Her net pay after costs is $617.85. Confirmed as gig pay with net pay and costs checked, her month becomes **Meets** through the income rule, 42 CFR 435.552(a)(6), (f)(2); 435.603(e). The total alone does not count: without net pay and the costs answer, the month stays “Not sure yet”.

The reader proposes lines from the saved file. The member reviews each line before it counts. Typed entry also works.

## What an example account can and cannot do

An example account can look at, upload, confirm, reject, edit and remove its own made-up lines and files, with the same limits as a member.

It cannot change its email or password (it has none), invite or share, connect messaging or email, send any email or message, export, use another account's data, or reach admin, settings, database or extension screens. The request filter (`server/middleware/auth.ts`, using `isExampleAllowedRequest` in `shared/access.ts`) refuses everything outside the example list with 403 on the server. The account actions also refuse example accounts inside the action. `tests/unit/example-accounts.test.mjs` tests each refused path.

Example accounts are marked by a server-made address on the reserved `demo.eighty.invalid` domain and a row in `eighty_demo_accounts`. No action input names either. Mail to that domain cannot be delivered, so no one can sign up with it. A database check only accepts example addresses in that table. Member lookups for real accounts exclude example records (`realMembersOnly`), and an example account reaches only the one record the server made for it.

Every example account belongs to one “Example” organisation (`eighty-example`) as a plain member. Its owner is a host address that cannot sign in.

## Starting an example

`start_example` (no account, HTTP POST, hidden from the agent and MCP) checks the request comes from this site's own pages, applies the limit, makes the account, organisation membership, member and lines, and returns a one-time ticket. The page posts the ticket to `/enter-example`, which signs the visitor in once. Tickets last two minutes.

Settings (all optional; a missing or wrong value uses the default):

| Setting                                  | Default | Meaning                                      |
| ---------------------------------------- | ------- | -------------------------------------------- |
| `EIGHTY_EXAMPLE_ENABLED`                 | on      | `0` closes the example                       |
| `EIGHTY_EXAMPLE_STARTS_PER_VISITOR_HOUR` | 5       | Starts per visitor per hour (1–50)           |
| `EIGHTY_EXAMPLE_STARTS_PER_HOUR`         | 120     | Starts across all visitors per hour (1–5000) |

When the hourly total of 120 starts is used up, the visitor sees “Too many example months were opened from here. Try again in an hour.” The server returns 429. Raise `EIGHTY_EXAMPLE_STARTS_PER_HOUR` to allow more starts, up to 5000 per hour. Failed starts do not count toward either limit.

A visitor is a hash of the address Caddy passes in `X-Forwarded-For`. IPv6 addresses share one limit per /64 prefix. The address itself is not kept.

Run the PostgreSQL proof with `node scripts/prove-example-postgres.mjs`. It starts its own PostgreSQL 17 container, runs `start_example` with the production driver, and removes the container when done. It requires Maria's saved month numbers.

## The nightly reset

A server timer (`server/plugins/example.ts`) runs every hour, starting one hour after the server starts. It does not go through the model or the framework's job dispatcher. Each run removes example accounts older than 24 hours with their member record, evidence, versions, events, organisation membership, sessions and user row. Files go through the existing deletion record in `eighty_document_deletions`, so storage deletion is retried until storage confirms it. Every delete names an example address in the query itself; a real member is never matched, however old.

Each run writes one row to `eighty_demo_resets`: started, finished, accounts removed, documents queued, and errors. A run that throws is marked `failed` with the reason. A run that stops mid-way stays `running`; it never says `completed`.

## Check that it ran

```sql
SELECT started_at, finished_at, status, accounts_removed, documents_queued, errors
FROM eighty_demo_resets ORDER BY started_at DESC LIMIT 5;
SELECT count(*) FROM eighty_demo_accounts WHERE created_at < now() - interval '25 hours';
SELECT count(*) FROM eighty_document_deletions WHERE owner_email LIKE '%@demo.eighty.invalid';
```

The second count should be 0. The third shows example files still waiting for storage to confirm deletion.

## Ask about the month

The month page has an “Ask about my month” panel. It uses the saved example month and proof. It can read a document or propose one line. Only the member confirms, changes or rejects a line on the review page. The daily model limit is shared with try mode; typing and looking around still work when it is used.
