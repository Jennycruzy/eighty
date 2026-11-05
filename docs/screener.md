# The initial Medicaid check

The check shows one question on each screen. It asks which Medicaid group the person has. The adult group has one coverage question. A section 1115 program has two coverage questions. Every answer is optional. Every screen has an “I'm not sure” choice. It asks about state, age, pregnancy or postpartum care, Medicare, a child in the person's care, care for someone with a disability, the federal Indian definition, a VA rating, treatment, SNAP, former foster youth coverage, health needs and TANF compliance.

The public landing page has separate doors for Medicaid members and people trying their own month.

## Results

The check uses the same pure rules as the rules answer key. An established exclusion shows its reason, the citation and a specific proof checklist. Caregiving, treatment, health needs and SNAP are not treated as established exclusions without the facts those rules require.

The initial questions collect the Medicaid coverage group and its coverage facts. They do not establish every possible exclusion. When the listed answers show no exclusion, the page says **“The rule may apply. Here's what counts.”** It explains which activities count. The screener result remains “Not sure yet” until month proof is reviewed. The state makes coverage decisions. Missing answers show “Not sure yet,” with questions and proof to keep.

English and Spanish include the questions, reasons, proof checklists and account step. The displayed legal link follows the applied rule.

## Carrying answers into an account

Answers stay in page memory while the person checks them, changes language or opens the account step. They are not put in browser storage or the page address. Reloading or closing the page clears that draft.

Registration is closed by default. The account step says so plainly and keeps a working link back to the same answers. It does not show a disabled or pretend sign-up form. `EIGHTY_REGISTRATION_ENABLED` must remain `0` until real-domain account email and member readiness are approved. The server checks this setting and email readiness again inside the account actions and at the native auth routes.

When registration is enabled, the person supplies an email and password, and chooses to save the screener answers. The framework handles password hashing, account creation, verification mail and the verified session. Eighty encrypts the carried answers using the framework's existing secret encryption. The encrypted handoff is bound to that email and expires after one hour. It is carried in the verification callback, so email can be opened in another browser without exposing readable answers in the address.

Only the matching verified browser account can save that handoff. The finish action is UI-only and hidden from agent and MCP tools. Its audit record omits inputs. Wrong-account, changed and expired links are refused. Existing profile answers are kept; a repeated claim with the same answers is harmless. The account page is not cached. The draft leaves the address bar after a successful claim. No member profile is written before verification.

## Checks and limits

The production check uses its own disposable PostgreSQL database and two containers: a closed public instance and an instance with registration enabled only for testing. Its email transport captures mail to synthetic `example.test` recipients inside that container. It never sends these messages to a provider. Password hashing, account creation, verification tokens, cookies and member records use the real framework code. The account test uses a local HTTPS proxy and a temporary test certificate. The captured transport does not prove real email delivery or domain setup.

The account check uses a 360 px phone viewport and keyboard input in both languages. It verifies the carried answers in PostgreSQL after email verification, and rejects wrong-account, expired and changed handoffs. The public check covers closed registration, proof text, citations, preserved answers and all public HEAD responses.

No independent database backup is configured. The file encryption key exists only on this server. Both remain blockers before sign-up opens.
