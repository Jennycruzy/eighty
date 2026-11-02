# Federal rules answer key

Rule version: 42-CFR-435-2026-10-29.

Result: **365 of 365 cases passed**.

Run `pnpm test:answer-key` to reproduce this report. Inputs and expected answers are in `tests/answer-key/cases.mjs`; those answers are not generated from the engine output.

These synthetic cases check the federal rule and the app’s stated safety policies. They are not a legal review, a state approval, a document-reading test or a test with real members. Income cases use a confirmed Medicaid MAGI count unless the case explicitly tests taxable wages, net self-employment earnings or pay-only uncertainty.

Each case cites the paragraph it tests. The original official XML and source hashes are in `data/regulations/2026-10-29/`. Procedural helpers keep a grey status because they do not decide whether a month meets the rule.

| Case | What is checked | Function | Paragraph | Expected status | Result |
| --- | --- | --- | --- | --- | --- |
| age-18 | Age boundary: 18 | isApplicableIndividual | [42 CFR 435.551; 435.119(b)(1)](https://www.ecfr.gov/current/title-42/section-435.551) | Exempt | Pass |
| age-19 | Age boundary: 19 | isApplicableIndividual | [42 CFR 435.551; 435.119(b)(1)](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| age-64 | Age boundary: 64 | isApplicableIndividual | [42 CFR 435.551; 435.119(b)(1)](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| age-65 | Age boundary: 65 | isApplicableIndividual | [42 CFR 435.551; 435.119(b)(1)](https://www.ecfr.gov/current/title-42/section-435.551) | Exempt | Pass |
| other-group | Other coverage group is outside this rule | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Exempt | Pass |
| app-pregnant | pregnant prevents applicability | isApplicableIndividual | [42 CFR 435.119(b)(2)–(3)](https://www.ecfr.gov/current/title-42/section-435.119) | Exempt | Pass |
| app-medicare | medicare prevents applicability | isApplicableIndividual | [42 CFR 435.119(b)(2)–(3)](https://www.ecfr.gov/current/title-42/section-435.119) | Exempt | Pass |
| 1115-covered | Qualifying demonstration coverage | isApplicableIndividual | [42 CFR 435.551(b)(1)–(4)](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| 1115-no-mec | Demonstration without minimum essential coverage | isApplicableIndividual | [42 CFR 435.551(b)](https://www.ecfr.gov/current/title-42/section-435.551) | Exempt | Pass |
| 1115-other-eligible | Other State plan eligibility excludes demonstration group | isApplicableIndividual | [42 CFR 435.551(b)(4)](https://www.ecfr.gov/current/title-42/section-435.551) | Exempt | Pass |
| expansion-other-not-enrolled | Eligibility alone does not equal enrollment in another mandatory group | isApplicableIndividual | [42 CFR 435.119(b)(4)](https://www.ecfr.gov/current/title-42/section-435.119) | Not sure yet | Pass |
| expansion-mandatory-enrolled | Other mandatory group eligibility and enrollment | isApplicableIndividual | [42 CFR 435.119(b)(4)](https://www.ecfr.gov/current/title-42/section-435.119) | Exempt | Pass |
| app-missing-age-null | Unknown coverage fact stays unsure | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| app-missing-age--1 | Unknown coverage fact stays unsure | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| app-missing-age-19.5 | Unknown coverage fact stays unsure | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| app-missing-group-null | Unknown coverage fact stays unsure | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| app-missing-pregnant-null | Unknown coverage fact stays unsure | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| app-missing-medicare-null | Unknown coverage fact stays unsure | isApplicableIndividual | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| 1115-unknown-mec | Unknown demonstration coverage | isApplicableIndividual | [42 CFR 435.551(b)](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| 1115-unknown-other | Unknown other eligibility | isApplicableIndividual | [42 CFR 435.551(b)(4)](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| expansion-unknown-enrollment | Check other mandatory enrollment when other eligibility is known | isApplicableIndividual | [42 CFR 435.119(b)(4)](https://www.ecfr.gov/current/title-42/section-435.119) | Not sure yet | Pass |
| exclusions-none | No listed exclusion in complete answers | checkExclusions | [42 CFR 435.554(c)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| exclude-formerFosterYouthGroup | formerFosterYouthGroup qualifies | checkExclusions | [42 CFR 435.554(c)(1)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exclude-unknown-formerFosterYouthGroup | formerFosterYouthGroup unknown | checkExclusions | [42 CFR 435.554(c)(1)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| exclude-indianUnder44751 | indianUnder44751 qualifies | checkExclusions | [42 CFR 435.554(c)(2)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exclude-unknown-indianUnder44751 | indianUnder44751 unknown | checkExclusions | [42 CFR 435.554(c)(2)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| exclude-veteran100Percent | veteran100Percent qualifies | checkExclusions | [42 CFR 435.554(c)(4)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exclude-unknown-veteran100Percent | veteran100Percent unknown | checkExclusions | [42 CFR 435.554(c)(4)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| exclude-tanf407Compliant | tanf407Compliant qualifies | checkExclusions | [42 CFR 435.554(c)(6)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exclude-unknown-tanf407Compliant | tanf407Compliant unknown | checkExclusions | [42 CFR 435.554(c)(6)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| exclude-inmate | inmate qualifies | checkExclusions | [42 CFR 435.554(c)(9)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exclude-unknown-inmate | inmate unknown | checkExclusions | [42 CFR 435.554(c)(9)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| exclude-pregnantOrPostpartum | pregnantOrPostpartum qualifies | checkExclusions | [42 CFR 435.554(c)(10)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exclude-unknown-pregnantOrPostpartum | pregnantOrPostpartum unknown | checkExclusions | [42 CFR 435.554(c)(10)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| snap-subject | SNAP household and member subject to SNAP work rules | checkExclusions | [42 CFR 435.554(c)(7)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| snap-exempt | SNAP work exemption is not this exclusion | checkExclusions | [42 CFR 435.554(c)(7)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| snap-unknown | SNAP receipt alone is insufficient | checkExclusions | [42 CFR 435.554(c)(7)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| treatment-qualifies | Qualifying treatment meets the state minimum | checkExclusions | [42 CFR 435.554(c)(8)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| treatment-unknown-minimum | Treatment minimum is unknown | checkExclusions | [42 CFR 435.554(c)(8)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| treatment-below-minimum | Known unmet treatment minimum | checkExclusions | [42 CFR 435.554(c)(8)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-none | No care role | caregiverExclusion | [42 CFR 435.554(c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-missing | Missing care role | caregiverExclusion | [42 CFR 435.554(c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-parent-13 | parent of a dependent aged 13 | caregiverExclusion | [42 CFR 435.554(a), (c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-parent-14 | parent of a nondisabled child aged 14 | caregiverExclusion | [42 CFR 435.554(a), (c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-guardian-13 | guardian of a dependent aged 13 | caregiverExclusion | [42 CFR 435.554(a), (c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-guardian-14 | guardian of a nondisabled child aged 14 | caregiverExclusion | [42 CFR 435.554(a), (c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-child-no-reliance | Child must rely on care | caregiverExclusion | [42 CFR 435.554(a)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-parent-disabled-adult | Parent care of a disabled adult | caregiverExclusion | [42 CFR 435.554(c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-target-unknown | Disability and age both unknown | caregiverExclusion | [42 CFR 435.554(a)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-caretaker | Caretaker relative lives with and has primary responsibility | caregiverExclusion | [42 CFR 435.554(a), (c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-caretaker-fallback | Nonresident relative can meet the family caregiver test | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-caretaker-not-primary | A resident relative without primary responsibility can still meet family test A | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(A)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-caretaker-no-family | No caretaker responsibility or family definition | caregiverExclusion | [42 CFR 435.554(a)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| rosa-a | Rosa lives with her disabled mother; no 80-hour minimum for A | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(A)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-b | Nonresident relative gives regular nonincidental help | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-c-80 | Nonresident nonrelative gives 80 hours | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(C)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-c-short | Nonresident nonrelative gives less than 80 hours | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(C)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-c-unknown | Nonresident nonrelative hours unknown | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(C)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-incidental | Incidental help does not meet test A | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(A)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-irregular | Resident help must be regular | caregiverExclusion | [42 CFR 435.554(c)(3)(i)(A)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| care-adult-family | An adult family member need not also prove a separate significant relationship | caregiverExclusion | [42 CFR 435.554(a), (c)(3)(i)(A)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| care-role-invalid | Unknown role is not an automatic exemption | caregiverExclusion | [42 CFR 435.554(c)(3)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-ssa-blind-or-disabled | Confirmed ssa-blind-or-disabled significantly impairs compliance | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| medical-disabling-mental-disorder | Confirmed disabling-mental-disorder significantly impairs compliance | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| medical-disability-affecting-daily-living | Confirmed disability-affecting-daily-living significantly impairs compliance | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| medical-serious-or-complex | Confirmed serious-or-complex significantly impairs compliance | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| medical-recovery-0 | Stable recovery boundary | medicalExclusion | [42 CFR 435.554(c)(5)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| medical-recovery-4.99 | Stable recovery boundary | medicalExclusion | [42 CFR 435.554(c)(5)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| medical-recovery-5 | Stable recovery boundary | medicalExclusion | [42 CFR 435.554(c)(5)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-recovery-6 | Stable recovery boundary | medicalExclusion | [42 CFR 435.554(c)(5)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-recovery-unknown | Unknown stable recovery period | medicalExclusion | [42 CFR 435.554(c)(5)(i)(B)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-no-impairment | A condition alone does not establish significant impairment | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-unknown | Unknown health evidence | medicalExclusion | [42 CFR 435.554(c)(5)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-no-category | An unclassified condition needs review | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-invalid-category | Do not invent a medical category | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-empty | No qualifying category | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-impairment-unknown | Unknown effect on compliance | medicalExclusion | [42 CFR 435.554(c)(5)(i)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| medical-overall | Health criteria appear before activity tests | checkExclusions | [42 CFR 435.554(c)(5)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| exception-under19DuringMonth | Part of the month is enough | checkMandatoryExceptions | [42 CFR 435.553(a)(1)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| exception-medicareDuringMonth | Part of the month is enough | checkMandatoryExceptions | [42 CFR 435.553(a)(2)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| exception-mandatoryGroupDuringMonth | Part of the month is enough | checkMandatoryExceptions | [42 CFR 435.553(a)(3)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| exception-excludedDuringMonth | Part of the month is enough | checkMandatoryExceptions | [42 CFR 435.553(a)(4)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| inmate-2026-07-01-2026-07-01 | Three-month period includes its first and last day | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| inmate-2026-06-30-2026-06-30 | Three-month period includes its first and last day | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Not sure yet | Pass |
| inmate-2026-06-01-2026-07-01 | Three-month period includes its first and last day | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| inmate-2026-10-01-2026-10-01 | Three-month period includes its first and last day | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| inmate-2026-10-02-2026-10-02 | Three-month period includes its first and last day | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Not sure yet | Pass |
| inmate-2026-06-01-null | Three-month period includes its first and last day | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| inmate-december-window | Lookback crosses a year boundary | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| exceptions-unknown | Unknown past status stays unsure | checkMandatoryExceptions | [42 CFR 435.553](https://www.ecfr.gov/current/title-42/section-435.553) | Not sure yet | Pass |
| exceptions-bad-month | Invalid assessment month | checkMandatoryExceptions | [42 CFR 435.553](https://www.ecfr.gov/current/title-42/section-435.553) | Not sure yet | Pass |
| inmate-invalid-period | Invalid institution date needs review | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Not sure yet | Pass |
| inmate-reversed-period | Reversed institution dates need review | checkMandatoryExceptions | [42 CFR 435.553(b)](https://www.ecfr.gov/current/title-42/section-435.553) | Not sure yet | Pass |
| credits-0 | Exact credit math without rounding up to 80 | educationHours | [42 CFR 435.552(d)(1)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| credits-0.5 | Exact credit math without rounding up to 80 | educationHours | [42 CFR 435.552(d)(1)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| credits-6 | Exact credit math without rounding up to 80 | educationHours | [42 CFR 435.552(d)(1)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| credits-6.1585 | Exact credit math without rounding up to 80 | educationHours | [42 CFR 435.552(d)(1)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| credits-6.1586 | Exact credit math without rounding up to 80 | educationHours | [42 CFR 435.552(d)(1)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-half-time | School sets the status; half-time meets on its own | educationHours | [42 CFR 435.552(a)(4), (c)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-full-time | School sets the status; half-time meets on its own | educationHours | [42 CFR 435.552(a)(4), (c)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-none | Not enrolled | educationHours | [42 CFR 435.552(c)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-unapproved | Nonqualifying educational program | educationHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-unknown-status | Do not infer half-time from credit count | educationHours | [42 CFR 435.552(c)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-noncredit | Actual noncredit class and activity hours | educationHours | [42 CFR 435.552(d)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-noncredit-short | Noncredit hours below 80 | educationHours | [42 CFR 435.552(d)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-break | Normal break continues prior status when registered for next regular term | educationHours | [42 CFR 435.552(c)(2)–(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-term-end | Status continues through the term-end month | educationHours | [42 CFR 435.552(c)(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-no-next-term | Not registered for next regular term | educationHours | [42 CFR 435.552(c)(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-not-normal-break | No normal break status | educationHours | [42 CFR 435.552(c)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-break-unknown | Unknown next regular term | educationHours | [42 CFR 435.552(c)(2)–(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-break-date-unknown | A break needs the next regular term date | educationHours | [42 CFR 435.552(c)(2)–(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-stale-break | A prior break does not establish enrollment after the new term | educationHours | [42 CFR 435.552(c)(1)–(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-exit-month | Withdrawal keeps status through the exit month | educationHours | [42 CFR 435.552(c)(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| school-after-exit | No carry after exit month | educationHours | [42 CFR 435.552(c)(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-other-program | Another program needs its own school record | educationHours | [42 CFR 435.552(c)(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-unknown-after-exit | Unknown continuation after graduation or exit | educationHours | [42 CFR 435.552(c)(3)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-before-start | A registration is not enrollment before term starts | educationHours | [42 CFR 435.552(c)(1)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-start-later-this-month | A future term within the current month has not started | educationHours | [42 CFR 435.552(c)(1)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-confirmed-false | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-qualifyingProgram-null | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-termStart-bad | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-termEnd-2026-07-01 | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-exitDate-bad | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-usesCreditHours-null | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-credits-null | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-credits--1 | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-invalid-credits-0.00001 | Unconfirmed or invalid school facts stay unsure | educationHours | [42 CFR 435.552(c)–(d)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-actual-missing | Unknown noncredit hours | educationHours | [42 CFR 435.552(d)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-future-month | Future school month not proved | educationHours | [42 CFR 435.552(c)(1)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-bad-date | Invalid review date | educationHours | [42 CFR 435.552(c)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| school-bad-month | Invalid school month | educationHours | [42 CFR 435.552(c)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| income-57999 | Income comparison uses exact cents | incomeTest | [42 CFR 435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| income-58000 | Income comparison uses exact cents | incomeTest | [42 CFR 435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| income-58001 | Income comparison uses exact cents | incomeTest | [42 CFR 435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| income-0 | Income comparison uses exact cents | incomeTest | [42 CFR 435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| income--10000 | Income comparison uses exact cents | incomeTest | [42 CFR 435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| income-unconfirmed | Unconfirmed income cannot produce Meets | incomeTest | [42 CFR 435.552(f)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| income-pay-only | Pay shown is not silently treated as the Medicaid MAGI count | incomeTest | [42 CFR 435.552(f)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| income-invalid-amountCents-null | Missing or invalid income count | incomeTest | [42 CFR 435.552(f)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| income-invalid-amountCents-58000.5 | Missing or invalid income count | incomeTest | [42 CFR 435.552(f)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| income-invalid-basis-null | Missing or invalid income count | incomeTest | [42 CFR 435.552(f)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-exact | Six prior months average exactly $580 | seasonalIncomeTest | [42 CFR 435.552(a)(7), (g)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| seasonal-zero-months | A seasonal worker can have zero-income months | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| seasonal-one-cent-short | Do not round a six-month average up | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| seasonal-not-qualified | High past income does not prove seasonal status | seasonalIncomeTest | [42 CFR 435.552(g)(1)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-unknown-status | Seasonal classification needs proof | seasonalIncomeTest | [42 CFR 435.552(g)(1)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-missing-month | All six months, not five | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-duplicate-month | Duplicate income month must be resolved | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-no-records | No income history | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-unconfirmed-month | An unconfirmed prior month cannot support an average | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-bad-month | Invalid reference month | seasonalIncomeTest | [42 CFR 435.552(g)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-0 | Income-derived hours use the federal wage and do not round up | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-7250 | Income-derived hours use the federal wage and do not round up | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-14500 | Income-derived hours use the federal wage and do not round up | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-29000 | Income-derived hours use the federal wage and do not round up | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-57999 | Income-derived hours use the federal wage and do not round up | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-no-option | State declined income-derived hours | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-hours-recorded | Do not replace or add to documented work hours | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-income-580 | At $580 use the income test instead | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-policy-unverified | A draft state option cannot enable hours | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-option-unknown | Unknown state option | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-records-unknown | Unknown hours documentation | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-household-unknown | Unknown household worker allocation | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-household-needs-split | Do not assign all household hours to one member | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-household-approved | Use a state-verified reasonable allocation | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-household-excess | Allocation cannot exceed household-derived total | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-loss | A negative income count cannot establish positive hours | incomeDerivedHours | [42 CFR 435.552(e)(2)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| hardship-not-elected | A disaster alone cannot elect a state hardship | checkHardship | [42 CFR 435.555(a)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| hardship-unverified | Draft state policy cannot grant a hardship | checkHardship | [42 CFR 435.555(a)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-DR | Presidential declaration covers every incident month | checkHardship | [42 CFR 435.555(d)(2)(iv), (e)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| disaster-EM | Presidential declaration covers every incident month | checkHardship | [42 CFR 435.555(d)(2)(iv), (e)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| disaster-fm | Fire management declaration is not DR or EM | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-other-county | County must match residence | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-before-start | No incident in an earlier month | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-end-month | One incident day includes its whole end month | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| disaster-after-end | No automatic month after the incident end | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-extension | CMS-approved extension can cover a later month | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| disaster-expired-extension | An extension is limited to its approved months | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-open | Ongoing incident verified in the assessment month | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| disaster-stale-open | Old open-incident data does not prove a new month | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-nea | National emergency must affect compliance and be notified to CMS | checkHardship | [42 CFR 435.555(d)(2)(i)–(iii)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| disaster-nea-unaffected | National declaration alone is not enough | checkHardship | [42 CFR 435.555(d)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-nea-notice-unknown | Unknown state notice to CMS | checkHardship | [42 CFR 435.555(d)(2)(ii)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-missing-declarationType | Unknown disaster fact | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-missing-countyMatchesResidence | Unknown disaster fact | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-missing-incidentStart | Unknown disaster fact | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-missing-incidentEnd | Unknown disaster fact | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-extension-unknown | Do not assume a CMS extension | checkHardship | [42 CFR 435.555(d)(2)(iv)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| disaster-no-feed | Failed county lookup stays unsure | checkHardship | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-6-4 | Rate is compared with the lesser threshold | checkHardship | [42 CFR 435.555(d)(3)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| unemployment-5.99-4 | Rate is compared with the lesser threshold | checkHardship | [42 CFR 435.555(d)(3)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-8-6 | Rate is compared with the lesser threshold | checkHardship | [42 CFR 435.555(d)(3)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| unemployment-7.99-6 | Rate is compared with the lesser threshold | checkHardship | [42 CFR 435.555(d)(3)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-6.15-4.1 | Rate is compared with the lesser threshold | checkHardship | [42 CFR 435.555(d)(3)(i)–(ii)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| unemployment-approval-needed | High unemployment is not itself CMS approval | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-missing-countyRate-null | Rate, period and residence must be established | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-missing-nationalRate-null | Rate, period and residence must be established | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-missing-countyRate-101 | Rate, period and residence must be established | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-missing-appliesToMonth-2026-09 | Rate, period and residence must be established | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-missing-countyMatchesResidence-null | Rate, period and residence must be established | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-other-county | Wrong county rate does not apply | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| unemployment-no-feed | Missing rate lookup | checkHardship | [42 CFR 435.555(d)(3)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| inpatient-granted | Requested care exception granted by state | checkHardship | [42 CFR 435.555(d)(1)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| inpatient-pending | A care event without a granted request stays unsure | checkHardship | [42 CFR 435.555(d)(1)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| inpatient-no-event | No qualifying care event | checkHardship | [42 CFR 435.555(d)(1)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| inpatient-unknown | Unknown qualifying care | checkHardship | [42 CFR 435.555(d)(1)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| travel-member | Member must travel for qualifying care | checkHardship | [42 CFR 435.555(d)(4)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| travel-dependent-no-member | Dependent travels while member takes related leave | checkHardship | [42 CFR 435.555(d)(4)(i)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| travel-dependent-no-leave | Nontraveling member must show leave or absence | checkHardship | [42 CFR 435.555(d)(4)(i)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| travel-pending | Travel request not yet granted | checkHardship | [42 CFR 435.555(d)(4)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| travel-unknown | Unknown medical travel facts | checkHardship | [42 CFR 435.555(d)(4)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| hardship-option-unknown | Unknown elected option | checkHardship | [42 CFR 435.555(a)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| hardship-future | Future hardship month not proved | checkHardship | [42 CFR 435.555(a)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| hardship-bad-month | Invalid hardship month | checkHardship | [42 CFR 435.555(a)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| hardship-bad-date | Invalid hardship review date | checkHardship | [42 CFR 435.555(a)](https://www.ecfr.gov/current/title-42/section-435.555) | Not sure yet | Pass |
| work-80 | Confirmed paid, in-kind or unpaid work hours count | combineHours | [42 CFR 435.552(a)(1), (b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| work-unpaid | Unpaid work outside community service may count | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| work-short | A confirmed complete total can be Short | combineHours | [42 CFR 435.552(e)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| work-proposed | App policy: proposed hours do not count | combineHours | [42 CFR 435.557(b)(2)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| work-rejected | Rejected app evidence is not counted | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| income-not-activity | An income line is not an extra set of work hours | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| activity-other-month | Hours belong to the month worked | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| activity-next-month | Hours from a later month are not this month | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| activity-cross-month | No invented split of cross-month hours | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-future | Future scheduled hours are not completed hours | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-duplicate-id | Repeated versions cannot double count hours | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-duplicate-period | Same employer and period needs a duplicate review | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-separate-organizations | Separate confirmed work may be added | combineHours | [42 CFR 435.552(e)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| activity-incomplete | Missing evidence is not a known Short total | combineHours | [42 CFR 435.557(b)(2)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| activity-no-hours | Unknown work hours do not become zero-confirmed hours | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-negative-hours | Negative work hours need correction | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-bad-dates | Bad activity dates need correction | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-bad-version | Unversioned evidence needs review | combineHours | [42 CFR 435.557(b)(2)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| service-80 | Structured confirmed community service counts | combineHours | [42 CFR 435.552(a)(2), (b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| service-not-unpaid | Community service must be unpaid | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| service-unknown-unpaid | Unknown community service fact: unpaid | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| service-not-directCommunityBenefit | Community service must be directCommunityBenefit | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| service-unknown-directCommunityBenefit | Unknown community service fact: directCommunityBenefit | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| service-not-publicOrNonprofit | Community service must be publicOrNonprofit | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| service-unknown-publicOrNonprofit | Unknown community service fact: publicOrNonprofit | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| service-not-structuredAndSupervised | Community service must be structuredAndSupervised | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| service-unknown-structuredAndSupervised | Unknown community service fact: structuredAndSupervised | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| service-not-nonpartisan | Community service must be nonpartisan | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| service-unknown-nonpartisan | Unknown community service fact: nonpartisan | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| service-not-tracksDatesAndHours | Community service must be tracksDatesAndHours | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| service-unknown-tracksDatesAndHours | Unknown community service fact: tracksDatesAndHours | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| service-no-contact | A confirmation contact is required | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| program-wioa | Approved work program: wioa | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| program-trade-act | Approved work program: trade-act | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| program-veterans | Approved work program: veterans | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| program-snap-partnership | Approved work program: snap-partnership | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| job-search-no | Standalone job search does not count | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| program-subsidiary-0 | State-approved subsidiary job search must be less than half | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| program-subsidiary-0.49 | State-approved subsidiary job search must be less than half | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| program-subsidiary-0.5 | State-approved subsidiary job search must be less than half | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| program-subsidiary-1 | State-approved subsidiary job search must be less than half | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| program-ratio-invalid-null | Unknown or invalid program composition | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| program-ratio-invalid--1 | Unknown or invalid program composition | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| program-ratio-invalid-2 | Unknown or invalid program composition | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| program-unknown | A program label is not proof of an approved type | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| daniel-combined | Daniel: six credits and 20 work hours | combineHours | [42 CFR 435.552(d)(1), (e)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| education-half-no-combine | Half-time status meets independently, with no invented 80 school hours | combineHours | [42 CFR 435.552(a)(4)–(5), (e)(1)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| derived-plus-service | State-derived work and community service can combine | combineHours | [42 CFR 435.552(e)(2), (e)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| derived-not-plus-recorded-work | Recorded work hours prevent adding hours from the same income | combineHours | [42 CFR 435.552(e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| activity-future-month | Future activity month not proved | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-bad-month | Invalid activity month | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-bad-review-date | Invalid activity review date | combineHours | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| application-lookback-1 | Application needs consecutive months immediately before application | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| application-lookback-2 | Application needs consecutive months immediately before application | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| application-lookback-3 | Application needs consecutive months immediately before application | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| application-invalid-0 | State application option is bounded by federal law | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| application-invalid-4 | State application option is bounded by federal law | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| application-invalid-1.5 | State application option is bounded by federal law | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| application-invalid-null | State application option is bounded by federal law | lookbackWindow | [42 CFR 435.556(a)(1)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| renewal-one-not-all | One required month does not make every candidate month mandatory | lookbackWindow | [42 CFR 435.556(a)(2)(i), (b)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| renewal-nonconsecutive | State-selected renewal months need not be consecutive | lookbackWindow | [42 CFR 435.556(a)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| frequent-check-window | More frequent check cannot reach before last demonstration | lookbackWindow | [42 CFR 435.556(a)(2)(ii), (b)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| change-window | Change window ends before the month applicability begins | lookbackWindow | [42 CFR 435.556(a)(2)(iii)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| lookback-unknown-policy | Unknown state choice cannot be guessed | lookbackWindow | [42 CFR 435.556(a)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| lookback-too-many | State cannot require more months than the enrollment period | lookbackWindow | [42 CFR 435.556(b)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| lookback-outside-month | Selected month must be inside the period | lookbackWindow | [42 CFR 435.556(b)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| lookback-bad-start | Period cannot run backwards | lookbackWindow | [42 CFR 435.556(b)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| lookback-bad-due | Invalid due date | lookbackWindow | [42 CFR 435.556(a)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| lookback-bad-kind | Unknown window kind | lookbackWindow | [42 CFR 435.556(a)](https://www.ecfr.gov/current/title-42/section-435.556) | Not sure yet | Pass |
| documentation-2027-12-31-true | Documentation transition and unavailable-document protection | documentationEra | [42 CFR 435.557(b)(2)(i)–(iii)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-2028-01-01-true | Documentation transition and unavailable-document protection | documentationEra | [42 CFR 435.557(b)(2)(i)–(iii)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-2028-01-01-false | Documentation transition and unavailable-document protection | documentationEra | [42 CFR 435.557(b)(2)(i)–(iii)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-state-data | Check state data before asking member for documents | documentationEra | [42 CFR 435.557(b), (c)(1)(i)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-unknown-data | Unknown state data availability | documentationEra | [42 CFR 435.557(b)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-unknown-availability | Do not assume documents exist | documentationEra | [42 CFR 435.557(b)(2)(ii)–(iii)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-medical-before | Before 2028 a state may accept a sworn health statement at each check | documentationEra | [42 CFR 435.557(f)(1)(i)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-medical-once | From 2028 the statement option is once per enrollment | documentationEra | [42 CFR 435.557(f)(1)(ii)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-medical-medicalStatementUsedThisEnrollment | Follow-up health verification requires data or documents | documentationEra | [42 CFR 435.557(f)(1)(ii)(B)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-medical-firstRenewalAfterMedicalStatement | Follow-up health verification requires data or documents | documentationEra | [42 CFR 435.557(f)(1)(ii)(A)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-medical-unknown | Unknown prior use of a sworn statement | documentationEra | [42 CFR 435.557(f)(1)(ii)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-bad-kind | Unknown documentation path | documentationEra | [42 CFR 435.557(b)(2)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| documentation-bad-date | Invalid date cannot choose an era | documentationEra | [42 CFR 435.557(b)(2)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| notice-2026-11-27 | Printed date plus five days, then 30 calendar days | noticeDeadline | [42 CFR 435.558(a)(2), (c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-2028-02-25 | Printed date plus five days, then 30 calendar days | noticeDeadline | [42 CFR 435.558(a)(2), (c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-2026-12-31 | Printed date plus five days, then 30 calendar days | noticeDeadline | [42 CFR 435.558(a)(2), (c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-2026-02-01 | Printed date plus five days, then 30 calendar days | noticeDeadline | [42 CFR 435.558(a)(2), (c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-late-reported | Reported late arrival shows a possible date but keeps earlier reminder | noticeDeadline | [42 CFR 435.558(c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-late-proved | Accepted proof uses later receipt but preserves earlier reminder | noticeDeadline | [42 CFR 435.558(c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-early | Early delivery does not shorten the assumed five days | noticeDeadline | [42 CFR 435.558(c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-arrived-before-print | Contradictory arrival date needs review | noticeDeadline | [42 CFR 435.558(c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-bad-arrival | Impossible reported date | noticeDeadline | [42 CFR 435.558(c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-date-overflow | Out-of-range reply date must not wrap into an earlier year | noticeDeadline | [42 CFR 435.558(a)(2)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| notice-arrival-overflow | Out-of-range later deadline needs review | noticeDeadline | [42 CFR 435.558(c)(4)](https://www.ecfr.gov/current/title-42/section-435.558) | Not sure yet | Pass |
| month-maria-income | Maria: a confirmed Medicaid income count of $612 meets | assessMonth | [42 CFR 435.552(a)(6), (f)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| month-daniel | Daniel: less-than-half-time school and work | assessMonth | [42 CFR 435.552(d)(1), (e)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| month-rosa | Rosa: caregiver exclusion wins before activity or income | assessMonth | [42 CFR 435.554(c)(3)(i)(A)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| month-short-19 | Complete confirmed facts leave 19 hours | assessMonth | [42 CFR 435.552(e)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| month-empty-known | Confirmed no activity and no income | assessMonth | [42 CFR 435.552(a)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| month-unknown-applicability | Even 80 hours does not establish unknown coverage scope | assessMonth | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Not sure yet | Pass |
| month-definite-exclusion-unknown-age | A proven exclusion does not need every other coverage answer | assessMonth | [42 CFR 435.554(c)(4)](https://www.ecfr.gov/current/title-42/section-435.554) | Exempt | Pass |
| month-outside | Outside coverage group needs no hour proof | assessMonth | [42 CFR 435.551](https://www.ecfr.gov/current/title-42/section-435.551) | Exempt | Pass |
| month-deemed | Turned 19 during month, despite no activities | assessMonth | [42 CFR 435.553(a)(1)](https://www.ecfr.gov/current/title-42/section-435.553) | Deemed | Pass |
| month-hardship | Elected county disaster deems month | assessMonth | [42 CFR 435.555(d)(2)](https://www.ecfr.gov/current/title-42/section-435.555) | Deemed | Pass |
| month-half-time | Half-time school meets independently | assessMonth | [42 CFR 435.552(a)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| month-seasonal | Seasonal average qualifies a low-income month | assessMonth | [42 CFR 435.552(a)(7), (g)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| month-proposed-not-green | App policy: an unconfirmed 80-hour proposal cannot make Meets | assessMonth | [42 CFR 435.552(e)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| month-unknown-exclusion | Unknown exclusion is not a known Short result | assessMonth | [42 CFR 435.554(c)](https://www.ecfr.gov/current/title-42/section-435.554) | Not sure yet | Pass |
| month-proven-compliance-followup | Proven compliance does not wait for an uncertain exclusion | assessMonth | [42 CFR 435.557(c)(3)](https://www.ecfr.gov/current/title-42/section-435.557) | Meets | Pass |
| month-pay-only | Gross pay is not silently labeled as a verified Medicaid count | assessMonth | [42 CFR 435.552(f)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| month-future | Future month cannot be confirmed now | assessMonth | [42 CFR 435.552(a)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| month-invalid | Malformed month is not a status decision | assessMonth | [42 CFR 435.552(a)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| month-invalid-review | Malformed review date is not a status decision | assessMonth | [42 CFR 435.552(a)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-pay-only | Seasonal averages also require Medicaid income counts | seasonalIncomeTest | [42 CFR 435.552(g)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-overflow-9007199254740991 | An unrepresentable total needs review rather than an unsafe sum | seasonalIncomeTest | [42 CFR 435.552(g)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| seasonal-overflow--9007199254740991 | An unrepresentable total needs review rather than an unsafe sum | seasonalIncomeTest | [42 CFR 435.552(g)(2)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-unknown-kind | Unrecognized evidence type cannot count as work | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-empty-id | Counted evidence must have a source identifier | combineHours | [42 CFR 435.557(b)(2)](https://www.ecfr.gov/current/title-42/section-435.557) | Not sure yet | Pass |
| activity-overflow-total | An unsafe hour sum needs review, never Meets | combineHours | [42 CFR 435.552(e)(4)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-service-missing-metadata | Volunteer title alone does not prove the service definition | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-program-missing-metadata | Program title alone does not prove an approved program | combineHours | [42 CFR 435.552(b)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| activity-unknown-school-and-hours-record | Unknown school and work-record facts are not a confirmed zero | combineHours | [42 CFR 435.552(c), (e)(2)(i)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-at-line | Confirmed taxable wages meet exactly at $580 | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| wages-below-line | Pre-tax deductions put wages one cent below the line | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| wages-zero-deductions | Confirmed zero pre-tax deductions use gross wages | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| wages-zero-pay | Confirmed zero wages do not meet | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| wages-unconfirmed | Proposed wage details cannot meet | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-too-many-deductions | Deductions greater than gross pay need review | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| gig-confirmed-net | Confirmed gig net earnings after costs meet | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| gig-net-below | Gig net earnings below the line are Short | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| gig-loss | Confirmed business loss does not meet | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| gig-unconfirmed-costs | Net amount without confirmed costs stays unsure | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| gig-gross-only | Gig gross receipts alone cannot meet | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| gig-net-unconfirmed | Proposed net earnings do not count | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-grossPayCents-missing | Wages need valid grossPayCents: missing | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-grossPayCents-negative | Wages need valid grossPayCents: negative | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-grossPayCents-fractional-cent | Wages need valid grossPayCents: fractional-cent | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-grossPayCents-overflow | Wages need valid grossPayCents: overflow | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-preTaxDeductionsCents-missing | Wages need valid preTaxDeductionsCents: missing | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-preTaxDeductionsCents-negative | Wages need valid preTaxDeductionsCents: negative | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-preTaxDeductionsCents-fractional-cent | Wages need valid preTaxDeductionsCents: fractional-cent | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| wages-preTaxDeductionsCents-overflow | Wages need valid preTaxDeductionsCents: overflow | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| gig-net-missing | Net earnings need whole valid cents: missing | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| gig-net-fractional | Net earnings need whole valid cents: fractional | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| gig-net-overflow | Net earnings need whole valid cents: overflow | incomeTest | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| month-confirmed-stub | Confirmed taxable wages can establish a Meets month | assessMonth | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Meets | Pass |
| month-gig-before-costs | A month with gross gig earnings alone stays unsure | assessMonth | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-wages-below-line | State income-derived hours use taxable wages after deductions | incomeDerivedHours | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-wages-at-line | Taxable wages at threshold use income instead of derived hours | incomeDerivedHours | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Not sure yet | Pass |
| derived-wage-gross-is-not-count | Gross wage total cannot replace the after-deduction count | incomeDerivedHours | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
| derived-gig-gross-is-not-net | Gig gross receipts cannot replace confirmed net earnings | incomeDerivedHours | [42 CFR 435.552(a)(6), (f)(2); 435.603(e)](https://www.ecfr.gov/current/title-42/section-435.552) | Short | Pass |
