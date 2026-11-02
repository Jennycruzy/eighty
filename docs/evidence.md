# Evidence and member records

The public tools are live. Account creation, document upload and document reading remain closed. These modules prepare the private data boundary; no member action or screen uses them yet.

## Proposed facts

`shared/evidence.ts` accepts dates, hours, pay, school facts and service facts. It rejects a proposed owner, member ID, version or confirmed status. It has no field for a Social Security number, member name or diagnosis. Follow-up questions are known field codes, not free text that could contain instructions. The reader cannot claim that the member confirmed business costs.

Income records keep the pay date separate from the work dates. That lets a later monthly assessment ask which month the pay belongs to instead of guessing from the work period.

The reader itself is not connected. Passing these schema tests does not establish document-reading accuracy.

## Who may review

The review helper refuses tool, HTTP, CLI, MCP, widget, automation and app-to-app caller labels. A frontend label alone is insufficient: the browser helper also checks the actual session cookie, verified email and matching user identity.

Each future review action must also declare `uiOnly: true`, hide itself from agent and MCP tool catalogs, and call the review helper inside its server action. The framework verifies the signed UI capability there. A frontend header is only a caller's claim. Approval flags from a terminal or assistant do not establish that a person reviewed the line.

The tests exercise refusal paths and a real signed session in an isolated database. There is no signed-in evidence-confirmation endpoint yet, so full transport tests for that endpoint remain outstanding.

## Storage of records

The app uses its own `eighty_` tables and the framework's typed database client and release migration runner. Member records require both the owner email and the canonical user ID. The helper checks the active request identity too. An account with a reused email cannot replace a profile owned by a different user ID. Repeated saves update one profile.

The initial migration adds members, private document references, evidence, evidence versions, member events and model/rule counters. It creates only app-owned tables. It does not alter framework tables or existing member data.

Document rows require actual boolean `encrypted` and `opaque` flags. This database check is not a test of encryption or bucket privacy. Real storage still has to pass those tests before uploads are enabled.

Anonymous try-counter rows cannot contain a member ID. The content-free counter table is excluded from general database tools through `doctor.dbToolScopingDenylist`; adding an owner identity would conflict with the anonymous try-mode contract. An operator view must use a separate authorized action.

## Verification

`pnpm test` checks the proposal schema, caller restrictions, missing browser credentials and profile-field restrictions. `pnpm check:production` runs member record checks against a disposable PostgreSQL database, then the public route, browser and recovery checks.

The member-record script first requires the run's unique marker in the test database. It will not write member records to an arbitrary database. Test identities are fictional. The cookie test seeds a verified identity through the framework's server helper; it does not test Google sign-in or email delivery. SQL tests distinguish valid private-handle metadata from missing, false and string flags, and reject a member-linked anonymous try row.
