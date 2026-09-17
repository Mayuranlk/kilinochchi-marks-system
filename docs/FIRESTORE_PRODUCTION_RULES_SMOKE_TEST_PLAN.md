# Firestore production Rules smoke-test plan

Review only. Execute only in an approved change window after an explicitly
approved Rules-only deployment. Use existing legitimate accounts selected by
the application owner. Do not create production Auth users or synthetic school
records for this smoke test.

## Preconditions

- Record operator, application owner, UTC start, and incident channel.
- Confirm active project is `kilinochchi-marks` (`499271151802`).
- Confirm the deployed Rules hash matches the reviewed proposal.
- Confirm rollback operator and rollback package are immediately available.
- Use a fresh browser session for each role and record pass/fail without personal
  data in evidence.

## Admin

Verify login, Dashboard, Students read, Subjects read, Classroom read, Terms
read, reports read, existing Marks Entry load, and settings read. Do not run
maintenance, promotion, shuffle, restore, bulk update, or destructive actions.

## Teacher

Verify login, Teacher Dashboard, Marks Entry load, Report Card, Teacher Mark
Sheets, and Subject Analysis. A mark create/update is excluded unless the
application owner separately approves a named non-critical record, its expected
before/after values, and an immediate reversal. Record the reversal result.

## Sectional head

Verify login, dashboard, class marks reports, completion report, subject
analysis, and classwise list within the role's permitted scope.

## Account

Verify login, required student lookup, and fee-account read. Do not record a
payment during the initial smoke test.

## Prefect

Verify login and required student lookup. Do not create a late-arrival record
during the initial smoke test.

## Negative checks

- An unauthenticated client cannot read a protected document.
- An ordinary teacher cannot perform an admin-only write.
- An account user cannot read or write marks.
- A prefect cannot access fee-account or academic marks data.

Use safe operations that are rejected before mutation. Do not probe unknown
records or broaden scope merely to test denial.

## Pass gate

All legitimate reads and all negative checks must pass. Any legitimate workflow
denial, unexpected authorization, widespread permission error, or ambiguity is
a stop condition. Declare rollback; do not troubleshoot by editing live Rules.
