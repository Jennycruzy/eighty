# Rules

These functions do not call a model, network or database. They are not yet a complete assessment of any person's month.

## Notice reply dates

Source: [42 CFR 435.558(a)(2) and (c)(4)](https://www.ecfr.gov/current/title-42/section-435.558), checked 2 November 2026. eCFR displayed Title 42 as current through 29 October 2026.

`noticeDeadline` adds five calendar days to the printed date, then 30 calendar days for the reply. Weekends and holidays do not change this calculation. Dates use calendar days without local clock or daylight saving changes.

If a person reports a later arrival, the function also returns a possible later reply date and asks for proof. Reminders keep the earlier date. An early arrival does not shorten the period. Missing or invalid dates return no deadline and name the field to check.

A reply date does not establish that a month meets the rule. This function therefore never returns a Meets status. The state makes the real decision.

Tests: `tests/unit/notice-deadline.test.mjs`. Run:

```sh
node --test tests/unit/notice-deadline.test.mjs
```

The tests cover month ends, year ends, leap days, daylight saving dates, early and late arrival, and invalid inputs. This is a component test, not the complete rules answer key or a legal review.
