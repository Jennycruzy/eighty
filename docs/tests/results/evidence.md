# Private evidence checks

Checked on 3 November 2026 with `pnpm check:production eighty:member-proof` (exit 0).

The check uses two verified, disposable accounts and a 360 × 640 browser viewport. It runs in English and Spanish. Button activation uses the keyboard and waits for saving to finish before moving on.

Passed:

- A large photo is reduced on the phone and can be turned sideways.
- A dark photo asks for a retake or a readability check. Checking and retaking leave no stored file or document row.
- PNG, HEIC and two-page PDF uploads use encrypted private storage. The original bytes are returned unchanged to their owner.
- Both PDF pages can be viewed. HEIC conversion works in the production container.
- The other verified account cannot read the file. Responses forbid caching and return no storage handle.
- Typed wage evidence can be saved, confirmed, edited, rejected and restored.
- A duplicate warning shows the other line. “These are separate” records the comparison and its versions.
- A failed offline save keeps the typed facts.
- An unused file can be removed. The review page, sign-out and sign-in work.
- The final image includes the HTTP safety checker and the HEIC decoder; no safety check is disabled.

The production check also passed its public-page, account-verification, database ownership, stale-version, concurrent-change, scheduled-job and restart checks. Test accounts, files and email messages contain made-up data only. Its email and object-store transports are restricted to the disposable container; encryption, authentication and database operations use the real framework code.

Separately, `pnpm check:storage` passed all seven checks against the configured private R2 bucket with the `hosted-private` provider: application encryption, different stored bytes, exact private reads, denied anonymous access, no direct read link, refused tampered handles and verified deletion.

The checks do not establish real email delivery, a physical iPhone test, or a manual screen-reader review. No model reader is part of this flow. Registration remains closed. There is still no independent database backup, and the file key still exists only on this server.

See [the check script](../../../scripts/check-evidence-browser.mjs), [file tests](../../../tests/unit/document-content.test.mjs) and [evidence guide](../../evidence.md).
