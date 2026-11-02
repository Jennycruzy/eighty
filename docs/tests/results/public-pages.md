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

The 130 signed-out page checks also passed through the live HTTPS proxy at `https://38.49.219.205.sslip.io/`. Starter logos, the starter manifest, chat, terminal and database paths returned 404 through that proxy.

Reproduce the container checks:

```sh
pnpm exec playwright install --with-deps chromium
docker build --tag eighty:check .
pnpm check:production eighty:check
```

The runner uses a separate database, binds its ports to localhost and deletes only its own test resources. It passes the browser's temporary local URL through a private file and removes that file afterwards. Reports remain in `.private/browser-report/`; CI uploads them as an artifact.

These checks do not establish document-reading accuracy, complete member journeys, real email delivery, working private document storage, a full screen-reader pass or legal approval. Sign-up and uploads remain closed. The public month tool checks work and pay; it does not check every exclusion or state choice.
