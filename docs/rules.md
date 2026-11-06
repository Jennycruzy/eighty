# Federal rules

The rules in `server/rules/` are pure TypeScript. They use no model, network, database or system clock. Callers supply the assessment date and confirmed facts. The engine returns a status, basis, citation, math and missing fields. It does not make the state's eligibility decision.

The [answer key](tests/results/answer-key.md) contains 365 synthetic cases with explicit expected answers and paragraph citations. The [coverage report](tests/results/rules-coverage.txt) records full line, branch and function coverage. Run `pnpm test` for the required checks, `pnpm test:rules` for rules and notice tests, or `pnpm test:answer-key` to regenerate the answer-key report. Tests freeze inputs to check that rules do not change them. Coverage proves that branches ran; it does not replace independent legal review.

## Sources and version

The rule version is `42-CFR-435-2026-10-29`. Official eCFR XML, source URLs, dates and SHA-256 hashes are saved in [the source directory](../data/regulations/2026-10-29/sources.json), checked on 2 November 2026. The engine uses this dated text. It does not fetch later amendments or claim to apply rules that have not been reviewed.

| Function                   | Rule                                                                                                                               | What it checks                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isApplicableIndividual`   | [435.551](https://www.ecfr.gov/current/title-42/section-435.551), [435.119](https://www.ecfr.gov/current/title-42/section-435.119) | Expansion or qualifying waiver group, age, pregnancy, Medicare and other coverage. For the expansion group, eligibility and enrollment in another mandatory group matter. |
| `checkExclusions`          | [435.554(c)(1)–(10)](https://www.ecfr.gov/current/title-42/section-435.554)                                                        | Former foster youth, Indian status, caregivers, disability rating, medical frailty, TANF, SNAP, treatment, inmates and pregnancy or postpartum coverage.                  |
| `checkMandatoryExceptions` | [435.553](https://www.ecfr.gov/current/title-42/section-435.553)                                                                   | Part-month exceptions and the incarceration window ending on the first day of the assessed month.                                                                         |
| `checkHardship`            | [435.555](https://www.ecfr.gov/current/title-42/section-435.555)                                                                   | Verified state elections, qualifying disasters, unemployment with CMS approval, and approved requests for care or medical travel.                                         |
| `educationHours`           | [435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552)                                                            | School-set enrollment status, term dates, breaks, exit months, credit hours and actual non-credit hours.                                                                  |
| `combineHours`             | [435.552(a)–(e)](https://www.ecfr.gov/current/title-42/section-435.552)                                                            | Confirmed work, qualifying community service, work programs and less-than-half-time education.                                                                            |
| `incomeTest`               | [435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552)                                                        | Confirmed monthly Medicaid MAGI income against the federal wage times 80.                                                                                                 |
| `seasonalIncomeTest`       | [435.552(a)(7), (g)](https://www.ecfr.gov/current/title-42/section-435.552)                                                        | Verified seasonal worker classification and income in all six preceding months.                                                                                           |
| `incomeDerivedHours`       | [435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552)                                                             | Verified state option, income below the threshold, no hours record, and any required household allocation.                                                                |
| `assessMonth`              | [435.551–.555](https://www.ecfr.gov/current/title-42/section-435.552)                                                              | Applicability, exclusions, mandatory exceptions, hardships, then activity and income tests.                                                                               |
| `lookbackWindow`           | [435.556(a)](https://www.ecfr.gov/current/title-42/section-435.556)                                                                | Application months and the allowed review period for renewals, frequent checks and changed circumstances.                                                                 |
| `noticeDeadline`           | [435.558(a)(2), (c)(4)](https://www.ecfr.gov/current/title-42/section-435.558)                                                     | Printed date plus five calendar days for receipt, then 30 calendar days to reply.                                                                                         |
| `documentationEra`         | [435.557(b)(2), (f)](https://www.ecfr.gov/current/title-42/section-435.557)                                                        | Available state data first, documentation rules before and from 2028, and special medical statements.                                                                     |

The answer-key report names the function and paragraph for every case. Its cases also cover application safety choices such as invalid dates, duplicate evidence, future evidence and arithmetic overflow; these choices are not presented as additional legal requirements.

## Decisions and missing facts

There are five statuses: Meets, Exempt, Deemed, Short and Not sure yet. Only a proven compliance path returns Meets. A known exclusion returns Exempt; a mandatory exception or granted hardship returns Deemed. Unknown facts name the exact fields needed. Short requires enough known information to establish a gap. Date, documentation and lookback helpers keep a grey status because they do not establish monthly compliance.

A proven compliance path can satisfy the month while a possible exclusion still needs follow-up, consistent with 435.557(c)(3). The result keeps those follow-up fields. It never invents hours, approves a hardship or diagnoses a condition.

Callers must load confirmed evidence and verified state choices. These are function contracts, not access controls. No signed-in member action or HTTP endpoint is exposed yet. The public manual tools call these same pure functions in the browser and save nothing. Future actions must check identity, ownership, consent, evidence confirmation and state-profile approval inside the action. A caller's assertion that a fact is confirmed is not sufficient at that boundary.

## Important calculations

Money uses integer cents. Hours use integer millionths, so an amount just below a threshold cannot round up to a passing result. The dated wage constant is $7.25, effective 24 July 2009, from the [Department of Labor](https://www.dol.gov/agencies/whd/minimum-wage/faq); 80 times that rate is $580.

Confirmed wages use gross pay minus the pre-tax deductions shown on the stub. Missing deductions are unknown, never assumed to be zero. Tax withholding and after-tax deductions are not subtracted. This follows the MAGI-based count in [435.603(e)](https://www.ecfr.gov/current/title-42/section-435.603) and the [federal taxable wage guidance](https://www.healthcare.gov/income-and-household-information/income/). `basis: "taxable-wages"` requires both wage fields and member confirmation. That confirmed count can establish Meets. The result says “Pay you showed us; the state may count it differently.”

Gig or self-employment receipts alone stay grey. `basis: "self-employment"` requires net earnings after business costs, confirmed costs and member confirmation. A confirmed business loss remains below the line. Both wage and net-income cases feed the same monthly income test and state-option hours calculation. An unrelated gross `amountCents` cannot override the confirmed taxable or net amount.

Unclassified `pay-shown` inputs remain distinct from a Medicaid count. The engine does not implement all Medicaid tax and household income rules. Seasonal inputs need confirmed monthly counts and a verified worker classification under 26 USC 45R(d)(5)(B); seasonality is not inferred from uneven earnings.

Six credits below half-time produce `6 × 3 × 4.33 = 77.94` hours. Enrollment at half-time or more satisfies the education path on its own and returns no invented numeric hours. School status comes from the institution. Normal breaks require registration for the next regular term. Term start, withdrawal and end dates are checked against the supplied assessment date.

Work may be paid, in kind or unpaid. Community service needs the organization's tracking and contact, along with the rule's other conditions. Standalone job searching does not count. A state-approved work program may include job searching as a subsidiary activity of less than half its time. Overlapping duplicate groups are held for review. Evidence crossing a month boundary needs a monthly split.

Income-derived hours require a verified state election, income below $580 and no documented work hours. Where other household members work, the state must supply a reasonable allocation. The engine does not invent that allocation or add derived hours to documented work hours.

Caregiver tests A, B and C are separate. A resident caregiver and a nonresident relative do not have an 80-hour minimum in those tests. The nonresident nonrelative test requires at least 80 hours. Qualifying care must be non-incidental. Caretaker-relative and family-caregiver definitions are checked separately. Medical frailty requires verified qualifying facts and impairment of compliance, with a note about the state's published list and review duties.

For October, the incarceration window is represented as 1 July through 1 October, inclusive, following 435.553(b)'s period ending on the first day. Boundary cases are explicit in the answer key so this interpretation is visible to the independent reviewer. It is a calendar-month window, not a fixed 90-day approximation.

Disaster results require presidential DR or EM declarations, matching county and incident months, or the separate qualifying national-emergency path. Fire-management declarations alone do not count. Ongoing incidents cannot establish future months. Unemployment is compared with the lesser of 8% or 1.5 times the national rate using exact arithmetic; a high rate alone does not establish CMS approval. Requested hardships require an actual grant.

Notice dates use UTC calendar arithmetic. Weekends and holidays do not alter the stated calendar-day calculation. Reported late delivery produces a possible later deadline and a request for proof; reminders retain the earlier date. Accepted proof can set the later counted receipt date. Invalid dates produce no deadline.

## Limits before member use

Independent review remains outstanding. The current engine consumes structured facts; it does not read documents, fetch FEMA or BLS data, determine a state's start date, approve a state profile, send reminders or submit proof. The state directory links to sourced CMS contacts and expansion data. State-specific start dates and reporting profiles still need review. The public site provides a scoped manual work/pay check, a screener and sourced state help. Signed-in member workflows remain closed.
