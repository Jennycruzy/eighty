# The demo: open a made-up member's month

Anyone can see the real app work in one tap, with no account. The landing page has a button, “Open Maria's month”, and smaller links for Daniel and Rosa. Each tap makes a fresh copy of that made-up person for this visitor alone. It uses the real actions, the real rules and the real storage path. No real member is ever shown.

Every demo screen shows a band: “Demo. Maria is made up. Anything you add is deleted within a day.” It has “Start again” (a new fresh copy) and “Leave demo” (signs out).

## The people

All three are made up. Their dates follow the current month, so the demo is always about “this month”. The rules never count a future date, so this month's lines run from the 1st to the day the copy is made. Early in a month the lines sit close together.

| Person                        | Story                                                                                                                                                             | This month                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maria, 34, Omaha, Nebraska    | Delivers through an app with uneven weeks, volunteers at a food pantry on Saturdays, uses only her phone, Spanish at home and English at work, renewal in January | **Short**: 61 of 80 hours (49 delivery hours, 12 pantry hours with the service details filled). Last month **Meets** (84 hours). One proposed line from last month waits for review. |
| Daniel, 22, Billings, Montana | Community college, 6 credits (less than half-time), part-time job of about 20 hours a month                                                                       | **Meets**: 6 × 3 × 4.33 = 77.94 school hours plus 5 job hours so far                                                                                                                 |
| Rosa, 51, Lincoln, Nebraska   | Cares every day for her mother, who has dementia and lives with her                                                                                               | **Exempt** as a family caregiver, 42 CFR 435.554(c)(3)(i)(A). She did not know.                                                                                                      |

The facts the rules need beyond the saved lines (coverage group, exclusions, state choices) are in `server/lib/demo-people.ts`. The state choices there are made up and say nothing about Nebraska or Montana. `tests/unit/demo-rules.test.mjs` runs the real `assessMonth`, `combineHours`, `educationHours` and `incomeTest` on each person and locks these numbers.

Seed lines are made through the same server functions a member's own requests use (`saveMemberRecord`, `createEvidenceDraft`, `changeEvidenceRecord`), with a real session for the new account.

## Maria's sample earnings summary

`public/demo/maria-earnings-sample.png` and `.pdf` are a made-up earnings summary marked “SAMPLE - made up”. Remake them with:

```sh
pnpm exec tsx scripts/make-demo-sample.ts 2026-11-04
```

The date sets the month shown. The committed copies are for November 2026. In the app, “Add Maria's sample” makes the same one-page PDF for the current month and saves it through the normal upload code, with the same limits.

The summary shows $824.45 in total earnings ($638.20 delivery pay and $186.25 tips). Maria's own costs for gas and her phone, $206.60, are not on it; she answers the business-costs question. Her net pay after costs is $617.85. Confirmed as gig pay with net pay and costs checked, her month becomes **Meets** through the income rule, 42 CFR 435.552(a)(6), (f)(2); 435.603(e). The total alone does not count: without net pay and the costs answer, the month stays “Not sure yet”.

Reading the document is separate work. Until the reader is added, the file is saved and the typed-entry form opens.

## What a demo account can and cannot do

A demo account can look at, upload, confirm, reject, edit and remove its own made-up lines and files, with the same limits as a member.

It cannot change its email or password (it has none), invite or share, connect messaging or email, send any email or message, export, use another account's data, or reach the agent, admin, settings, database or extension screens. The request filter (`server/middleware/auth.ts`, using `isDemoAllowedRequest` in `shared/access.ts`) refuses everything outside the demo list with 403 on the server. The account actions also refuse demo accounts inside the action. `tests/unit/demo-accounts.test.mjs` tests each refused path.

Demo accounts are marked by a server-made address on the reserved `demo.eighty.invalid` domain and a row in `eighty_demo_accounts`. No action input names either. Mail to that domain cannot be delivered, so no one can sign up with it. A database check only accepts demo addresses in that table. Member lookups for real accounts exclude demo records (`realMembersOnly`), and a demo account reaches only the one record the server made for it.

Every demo account belongs to one “Demo” organisation (`eighty-demo`) as a plain member. Its owner is a host address that cannot sign in.

## Starting a demo

`start_demo` (no account, HTTP POST, hidden from the agent and MCP) checks the request comes from this site's own pages, applies the limit, makes the account, organisation membership, member and lines, and returns a one-time ticket. The page posts the ticket to `/enter-demo`, which signs the visitor in once. Tickets last two minutes.

Settings (all optional; a missing or wrong value uses the default):

| Setting                               | Default | Meaning                                      |
| ------------------------------------- | ------- | -------------------------------------------- |
| `EIGHTY_DEMO_ENABLED`                 | on      | `0` closes the demo                          |
| `EIGHTY_DEMO_STARTS_PER_VISITOR_HOUR` | 5       | Starts per visitor per hour (1–50)           |
| `EIGHTY_DEMO_STARTS_PER_HOUR`         | 120     | Starts across all visitors per hour (1–5000) |

When the hourly total of 120 starts is used up, the visitor sees “Too many demos were opened from here. Try again in an hour.” The server returns 429. Raise `EIGHTY_DEMO_STARTS_PER_HOUR` to allow more starts, up to 5000 per hour. Failed starts do not count toward either limit.

A visitor is a hash of the address Caddy passes in `X-Forwarded-For`. IPv6 addresses share one limit per /64 prefix. The address itself is not kept.

Run the PostgreSQL proof with `node scripts/prove-demo-postgres.mjs`. It starts its own PostgreSQL 17 container, runs `start_demo` with the production driver, and removes the container when done. It first runs the source from `5c30deb` and requires the Date error, then runs the current source and requires Maria's saved month numbers.

## The nightly reset

A server timer (`server/plugins/demo.ts`) runs every hour, starting one hour after the server starts. It does not go through the model or the framework's job dispatcher. Each run removes demo accounts older than 24 hours with their member record, evidence, versions, events, organisation membership, sessions and user row. Files go through the existing deletion record in `eighty_document_deletions`, so storage deletion is retried until storage confirms it. Every delete names a demo address in the query itself; a real member is never matched, however old.

Each run writes one row to `eighty_demo_resets`: started, finished, accounts removed, documents queued, and errors. A run that throws is marked `failed` with the reason. A run that stops mid-way stays `running`; it never says `completed`.

## Check that it ran

```sql
SELECT started_at, finished_at, status, accounts_removed, documents_queued, errors
FROM eighty_demo_resets ORDER BY started_at DESC LIMIT 5;
SELECT count(*) FROM eighty_demo_accounts WHERE created_at < now() - interval '25 hours';
SELECT count(*) FROM eighty_document_deletions WHERE owner_email LIKE '%@demo.eighty.invalid';
```

The second count should be 0. The third shows demo files still waiting for storage to confirm deletion.
