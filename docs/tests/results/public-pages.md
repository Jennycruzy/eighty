# Public pages and access checks

Checked on 2 November 2026 with Node.js 22.23.4 and the production container.

- All 14 public paths and all 51 state/DC pages loaded signed out in English and Spanish: 130 successful page loads.
- The same checks passed after restarting the test database and application.
- All eight phone-browser tests passed at 360 × 640: public pages, confirmed wages, gig costs, offline manual entry and skipped screener answers, in both languages.
- Browser checks verified page language, translated titles, no horizontal overflow and no page script errors.
- The manual wage check sent no write requests and added no browser storage.
- Starter pages and services were closed. Sign-up was closed. Member pages required a cookie session.
- A scheduled fixed job ran once and recorded success without a model or chat thread.
- Test data survived application and database restarts.

Repeated on 3 November 2026 at `https://tryeighty.space/`: 132 signed-out page loads and 134 HEAD comparisons passed. Both domain certificates were trusted, and the `www` and former preview names permanently redirected with paths and queries preserved. Starter logos, the starter manifest, chat, terminal and database paths returned 404 through that proxy.

Reproduce the container checks:

```sh
pnpm exec playwright install --with-deps chromium
docker build --tag eighty:check .
pnpm check:production eighty:check
```

The runner uses a separate database, binds its ports to localhost and deletes only its own test resources. It passes the browser's temporary local URL through a private file and removes that file afterwards. Reports remain in `.private/browser-report/`; CI uploads them as an artifact.

These checks do not establish document-reading accuracy, complete member journeys, real email delivery, working private document storage, a full screen-reader pass or legal approval. Sign-up and uploads remain closed. The public month tool checks work and pay; it does not check every exclusion or state choice.

The signed-in evidence update was checked on 3 November with `pnpm check:production eighty:member-proof`. Adding the public sign-in page brings the count to 134 signed-out page loads and 136 HEAD comparisons, including the two search files. The new `/add`, `/review` and evidence services remain protected. Set `EIGHTY_REGISTRATION_ENABLED=1` with email configured to offer accounts.
