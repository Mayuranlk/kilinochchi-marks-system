# Firestore production Rules deployment evidence — 2026-08-08

## Classification

**PRODUCTION RULES DEPLOYED — MANUAL SMOKE TESTS PASSED**

The reviewed Firestore Rules-only production deployment completed. Exact
post-deployment source/hash parity passed. All manual role and negative smoke
tests passed, and the completed initial monitoring window reported no visible
regression.

## Accountable identities and window

- Deployment operator: `techzlkpro@gmail.com`
- Rollback operator: `techzlkpro@gmail.com`
- Application owner: Mayuran
- Security reviewer: Mayuran
- Authorized change-window start: `2026-08-08T07:13:55.374Z`
- Incident/rollback channel: local operator session and this evidence log

## Verified production state

- Project: `kilinochchi-marks`
- Project number: `499271151802`
- Project state: ACTIVE
- Database: `(default)`
- Region: `asia-southeast1`
- Active predeployment Ruleset:
  `projects/kilinochchi-marks/rulesets/d98a04f8-7720-4214-8c7d-359a152bcd5b`
- Active and preserved rollback SHA-256:
  `D714CFE3216B0A68DBE348BC779F02D370DFFAC543C4E55F3C467FFA2CF12FCB`
- Approved proposed SHA-256:
  `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`

The active Rules were retrieved again immediately before the mutation gate and
exactly matched the preserved rollback authority. The proposed Rules also
matched the approved hash. Deployment and rollback configs were verified to
contain only a Firestore Rules source. `.firebaserc` remained absent.

## Technical gates

- Phase 2 activation guard: passed
- Firestore Rules emulator: 11/11 passed
- React tests: 34/34 passed
- Production build: passed
- Audit-tool tests: 12/12 passed
- Rules validator: passed without warnings or failures
- Canonical reads, cursor pagination, summaries, and migrations: inactive

## Stop condition

Mayuran approved a manual operator-assisted method using existing legitimate
production accounts. Codex does not request, receive, infer, log, or store
passwords, tokens, cookies, or account personal information. Each role is
recorded only as PASS/FAIL with UTC time and a non-sensitive failure summary.

## Results

- Deployment command executed: yes, Rules only, explicit project
  `kilinochchi-marks`, config `firebase.production.rules.review.json`
- Deployment release time: `2026-08-08T07:16:58.696152Z`
- Previous Ruleset:
  `projects/kilinochchi-marks/rulesets/d98a04f8-7720-4214-8c7d-359a152bcd5b`
- New Ruleset:
  `projects/kilinochchi-marks/rulesets/437fedc1-4675-45e6-85d9-83c88f381c33`
- Deployed hash:
  `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`
- Exact deployed/proposed parity: passed
- Smoke tests: all five legitimate role checks passed
- Negative authorization checks: PASS — `2026-08-08T07:41:01.3667496Z`
- Production Firestore writes: 0
- Production Auth changes: 0
- Index, Hosting, Functions, and Storage deployments: 0
- Rollback required: not currently; rollback remains immediately available
- Current active Rules: new Ruleset/hash above
- Monitoring: PASS. Initial 15-minute window started at
  `2026-08-08T07:41:09.451Z`; operator reported no visible issues at
  `2026-08-08T07:46:00.1234089Z`; interim active Rules hash reconfirmed at
  `2026-08-08T07:46:20.497Z`; full-window PASS was reported at
  `2026-08-08T08:06:49.4729957Z`; final Ruleset/hash parity was reconfirmed at
  `2026-08-08T08:07:24.430Z`

## Manual smoke results

- Admin: PASS — `2026-08-08T07:34:05.2837883Z`
- Teacher: PASS — `2026-08-08T07:35:16.5174436Z` (no mark write)
- Sectional Head: PASS — `2026-08-08T07:37:22.3384699Z`
- Account: PASS — `2026-08-08T07:38:41.2703241Z` (read-only; no payment)
- Prefect: PASS — `2026-08-08T07:40:02.6031488Z` (read-only; no late-arrival write)
- Negative authorization checks: PASS — `2026-08-08T07:41:01.3667496Z`
  (unauthenticated, Teacher admin-route, Account marks-route, and Prefect
  account/marks-route denials; navigation/read-only checks)

## Final status

- Final active Ruleset:
  `projects/kilinochchi-marks/rulesets/437fedc1-4675-45e6-85d9-83c88f381c33`
- Final active SHA-256:
  `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`
- Production Firestore document writes: 0
- Production Auth changes: 0
- Index, Hosting, Functions, and Storage deployments: 0
- Rollback required: no
- `.firebaserc` created: no
- Anomaly: the first final read-only Rules retrieval had a transient Firebase
  Rules API request failure; the immediate retry succeeded with exact parity.
- Remaining monitoring: continue first-hour and first-school-day observation
  under `FIRESTORE_PRODUCTION_RULES_MONITORING_PLAN.md` with rollback readiness.
