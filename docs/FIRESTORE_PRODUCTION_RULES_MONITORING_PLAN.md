# Firestore production Rules monitoring plan

Review only. Start this plan only after an explicitly approved production
Rules-only deployment.

## Signals

Monitor permission-denied errors, authentication failures, Firestore request
failures, Marks Entry load/save failures, Dashboard and report failures, read
count changes, user-profile lookup latency/read impact, overall latency, and
verified user-reported access failures. Do not claim billing impact until real
production measurements are available.

## First 15 minutes

- Keep deployment and rollback operators continuously available.
- Complete the narrow role smoke matrix in order: admin, teacher, sectional
  head, account, prefect, then negative checks.
- Watch application console/error telemetry and Firebase request/error metrics.
- Roll back immediately on any defined stop condition.

## First hour

- Review permission-denied and authentication trends at least every 15 minutes.
- Compare Firestore request volume, error rate, and latency with the same recent
  operating period, noting that normal traffic variation may dominate.
- Confirm Marks Entry, Dashboard, Report Card, and role-specific workflows with
  the application owner.

## First school day

- Keep a named support contact and rollback operator reachable.
- Review failures during peak login, Marks Entry, reporting, fee-account, and
  prefect usage periods.
- Reconcile user reports with role and route; do not weaken Rules based on an
  unverified report.
- Close the monitoring window only after the application owner and security
  reviewer accept the evidence.

## Ownership and escalation

- Deployment owner: `[required before approval]`
- Rollback operator: `[required before approval]`
- Application owner: `[required before approval]`
- Security incident contact: `[required before approval]`

Escalate and roll back for legitimate admin workspace failure, teacher Marks
Entry load/write denial, Dashboard or Report Card Rules failure, account or
prefect workflow denial, an unexpected unauthorized write, a permission-denied
spike, or broad authorization failures. Use the preserved rollback package;
never edit live Rules ad hoc in Firebase Console.
