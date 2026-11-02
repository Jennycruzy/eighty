# Remove template features before launch

These files came from the starting template. Do not use them as Medicaid features. Keep member work in the rule functions and the actions designed for it. Remove or replace the items below before members are invited.

| Item | Files | Required change |
| --- | --- | --- |
| Greeting action | `actions/hello.ts` | Remove the action, its initial tool entry and its use in the container check once member actions provide the access check |
| Extra language packs | `app/i18n/` | Keep the required English and US Spanish strings; remove unsupported languages from both files and the language picker |
| General database page | `app/routes/database.tsx` | Remove the route and navigation entry; use scoped member and navigator actions |
| General extensions pages | `app/routes/extensions*` | Remove unused routes, navigation entries and extension suggestions |
| General observability page | `app/routes/observability.tsx` | Replace with the planned operator view and enforce operator access inside its actions |
| General team page | `app/routes/team.tsx` | Replace with the navigator consent and organisation workflow |
| Starter home | `app/components/home/HomePage.tsx`, `app/routes/home.tsx` | Replace with the verified month view after the rules and answer key pass |
| Starter agent instructions and tools | `server/plugins/agent-chat.ts`, `actions/run.ts`, `actions/provider-api-request.ts` | Keep only the capabilities Eighty needs; use the same permission checks across all callers |
| Template navigation and metadata | `app/components/layout/`, `public/manifest.json`, `public/favicon.svg`, `app/routes/home.tsx` | Remove dead links and starter descriptions; supply Eighty's own public metadata and icons |

The current IP deployment is a scaffold preview. The rules, document reader, member screens and production email and storage are not ready for members. The list above is not a list of completed Medicaid features.
