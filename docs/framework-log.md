# Framework checks

Checked on 2 November 2026 against [808ef4ebb0edfe323cf7aadcc66e7a39d77cedf0](https://github.com/BuilderIO/agent-native/tree/808ef4ebb0edfe323cf7aadcc66e7a39d77cedf0). These checks execute that revision's unchanged functions. The application uses the published core package 0.222.2. Results do not establish the behavior of other revisions.

No issue or pull request has been filed. Duplicate searches for the original findings, live service checks and checks in other templates and underlying libraries remain open. No upstream fix or merge is claimed.

## Run the checks

With Node.js 22.22 or later and the app dependencies installed:

```sh
git clone https://github.com/BuilderIO/agent-native.git "$HOME/.cache/eighty-agent-native"
git -C "$HOME/.cache/eighty-agent-native" checkout 808ef4ebb0edfe323cf7aadcc66e7a39d77cedf0
ln -s "$PWD/node_modules" "$HOME/.cache/eighty-agent-native/node_modules"
pnpm exec vitest run --config vitest.framework.config.ts --reporter=dot
```

The checkout and link commands assume those paths do not already exist. The test configuration refuses a different revision. These are separate upstream checks, outside the app's unit test command. They assert the desired behavior and exit with failure while the problems remain.

The run returned **9 failed assertions and 1 passing text-message control** across four files. No real member data, messaging account, database or storage account was used. Infrastructure boundaries are replaced in tests; the parsing, dispatch, upload handler and page renderer under examination run unchanged.

## Incoming media

Test: `tests/framework/messaging.spec.ts`.

- Send a Telegram photo with a caption, a PDF document, or a voice message to `parseIncomingMessage`.
- Send a WhatsApp image, document, or audio message to `parseIncomingMessage`.
- Expected: a message with media or an explicit unsupported-message result.
- Actual: each of the six calls returns `null`. The Telegram text control returns its text.

Status: reproduced at the parser boundary. Actual bot delivery, email and Slack have not been checked. The tests do not claim a live reply was sent or received. There is no workaround installed yet.

## Jobs without model calls

Test: `tests/framework/jobs.spec.ts`.

- Initialize the dispatcher and supply an enabled webhook job with `mode: deterministic`, a matching app ID and a nonempty body. Supply an allowed identity and a matching condition.
- Expected: if it cannot run, record a skip and its reason.
- Actual: dispatch returns `completed`, with no background run and no call to save the job's skip status. A console warning is emitted.

Status: reproduced for webhook dispatch. The scheduled behavior of `mode: deterministic` and its queued records has not been established. That option is not used by Eighty.

The scheduled runner is a separate, supported path. `scripts/check-job-runner.mjs` exercises `registerJobRunner` and `processRecurringJobs` against the production check's PostgreSQL database. It verifies one callback, the owner's request context, a stored receipt, a successful history row, the next scheduled time, and no chat thread. The callback needs no model. The scheduler subcheck uses the local deployment setting because production intentionally rejects reserved test identities. Eighty can use this supported path for fixed scheduled reminders; the reminder actions themselves are not implemented yet. This does not fix the webhook result above.

## Forms upload privacy

Test: `tests/framework/forms-upload.spec.ts`.

- Pass a valid synthetic multipart file through the published-form upload handler to the storage boundary.
- Expected: it does not request a permanent public document URL.
- Actual: the handler calls storage with `stableUrl: true` and returns the storage URL.

Status: the public-URL request is reproduced. The storage boundary is replaced, so this is **not proof of public access to a real stored file**. An upload to a configured provider followed by an unauthenticated read is still required. Sensitive documents must not use Forms uploads. Forms is unchanged. The separate private-bucket encryption change below does not change its public upload handler.

## Public form language

Test: `tests/framework/forms-language.spec.ts`.

- Render a published form with a Spanish title and field label, Spanish language and locale settings, and a Spanish language query.
- Expected: the page declares Spanish as its language.
- Actual: the renderer produces the Spanish title but declares `<html lang="en">`. The output also contains English system messages.

Status: page-language mismatch reproduced in rendered HTML. Browser interaction and screen-reader behavior have not been checked. There is no workaround installed yet.

## Container page rendering

Package: `@agent-native/core` 0.222.2, Node.js 22.23.4, Nitro `node` target. Test: `scripts/check-production.mjs`.

- Build the scaffold using the framework's documented two-stage container, copying only `.output` into the runtime image.
- Start it with PostgreSQL and a signing key. Do not give the runtime access to the host's `node_modules`.
- Expected: database health passes and the public page returns HTTP 200.
- Actual before the workaround: database health passes, but rendering fails with `Cannot find module 'react'` in the compiled `with-selector` chunk. The page check fails.

Workaround: keep `use-sync-external-store` external during the intermediate React Router server build, through Vite's supported `ssr.external` setting. The final server build then resolves it in the server graph. The container page and signed-in action checks pass with this setting. No dependencies were patched or copied by hand.

A duplicate search for `Cannot find module` and `react` on 2 November returned [issue 2982](https://github.com/BuilderIO/agent-native/issues/2982), which describes a related Node container failure involving a missing `yjs` dependency. It is not proof that the React case has the same repair. No new issue or pull request has been filed for this case.

## Encrypting files in a private bucket

Package: core 0.222.2. Reproduced on 2 November 2026 with the installed package and a real private R2 bucket. Test: `tests/unit/private-storage-encryption.test.mjs`; live check: `pnpm check:storage`.

The S3 private provider encrypts the file itself only when a public base URL is configured. Without that URL it relies on the bucket's access controls and storage-side encryption. The handle is opaque, but its `encrypted` flag is false and an authenticated raw object read returns the original bytes. This is the framework's stated behavior, not evidence that R2's own encryption or private access is broken.

Eighty requires application encryption too. The regression test failed before the change because the upload contained the original bytes. The real R2 check also found no application encryption and a generated direct read link. Every synthetic test object was deleted.

Local change: `patches/@agent-native__core@0.222.2.patch` makes the shared private S3 helper always use its existing AES-256-GCM encryption. Both S3 and hosted private providers use that helper; only the S3/R2 path has been tested live. Existing handles remain readable through their recorded encryption parameters.

After the patch, the regression passes. The live R2 check confirms different stored bytes, exact private reads, rejected anonymous access, no direct read link, rejected tampered handles and verified deletion. Forms' public uploader is unchanged and must still not receive sensitive documents.

Duplicate searches on 2 November for `repo:BuilderIO/agent-native "private" "encryption" "bucket"` and `repo:BuilderIO/agent-native "s3-private" "encrypt"` returned no matches. No issue or pull request has been filed for this application-specific change. No upstream fix or merge is claimed.

## 3 November: private-storage HTTP dependency missing from the Node image

Steps: build the production container, verify a disposable account, then save a synthetic photo through `upload_document`. The account and file checks passed; the storage request failed with “SSRF protection is unavailable because the server dispatcher could not be loaded.” The Node image did not contain `undici`, which the framework loads through a variable import.

Expected: the production image contains the HTTP dependency needed by the storage safety check. Actual: the dependency was installed during development but was absent from the final image.

Local workaround: pin `undici` directly and include it through Nitro's `traceDeps` setting in `nitro.config.ts`. The production check now also resolves its `Agent` inside the final container, with networking disabled. The storage safety check stays enabled. See [Nitro dependency tracing](https://nitro.build/config/build).

Duplicate search is not complete: the GitHub command is unavailable in this execution environment. No issue or pull request has been filed. This is a local packaging workaround; no upstream fix is claimed.

The HEIC browser check also reproduced a Node packaging error: bundling the CommonJS decoder as an ES module left `__dirname` undefined. Keeping `libheif-js` external through `traceDeps` preserves its supported CommonJS entry. The container dependency check covers that entry too. This does not change the decoder or weaken upload checks. No upstream fix is claimed.
