# Framework checks

Checked on 2 November 2026 against [808ef4ebb0edfe323cf7aadcc66e7a39d77cedf0](https://github.com/BuilderIO/agent-native/tree/808ef4ebb0edfe323cf7aadcc66e7a39d77cedf0). These checks execute that revision's unchanged functions. The application uses the published core package 0.222.2. Results do not establish the behavior of other revisions.

No issue or pull request has been filed. Duplicate searches, live service checks and checks in other templates and underlying libraries remain open. No fix is claimed.

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

Status: reproduced for webhook dispatch. The test does not establish the persisted status of a scheduled queue record. The scheduled path and database records still need a separate check. There is no workaround installed yet.

## Forms upload privacy

Test: `tests/framework/forms-upload.spec.ts`.

- Pass a valid synthetic multipart file through the published-form upload handler to the storage boundary.
- Expected: it does not request a permanent public document URL.
- Actual: the handler calls storage with `stableUrl: true` and returns the storage URL.

Status: the public-URL request is reproduced. The storage boundary is replaced, so this is **not proof of public access to a real stored file**. An upload to a configured provider followed by an unauthenticated read is still required. Sensitive documents must not use Forms uploads. No change has been made to Forms or core storage.

## Public form language

Test: `tests/framework/forms-language.spec.ts`.

- Render a published form with a Spanish title and field label, Spanish language and locale settings, and a Spanish language query.
- Expected: the page declares Spanish as its language.
- Actual: the renderer produces the Spanish title but declares `<html lang="en">`. The output also contains English system messages.

Status: page-language mismatch reproduced in rendered HTML. Browser interaction and screen-reader behavior have not been checked. There is no workaround installed yet.
