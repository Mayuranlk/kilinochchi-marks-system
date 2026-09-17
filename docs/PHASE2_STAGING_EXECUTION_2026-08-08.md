# Phase 2 staging execution record — 2026-08-08

## Outcome

**READY FOR CONTROLLED PRODUCTION RULES REVIEW**

The first browser run passed five of nine suites and stopped safely. After the
targeted harness stabilization and exact synthetic-state cleanup, the complete
clean rerun passed 9/9. The second rollback rehearsal passed exact source/hash
parity, all known synthetic fixtures were removed, and staging ended on its
preserved default-deny Rules. This outcome authorizes production Rules review
only; it does not authorize production deployment.

## Verified boundary

- Authenticated CLI account: `techzlkpro@gmail.com`
- Staging project: `kilinochchi-marks-staging`
- Staging project number: `571201491847`
- Registered Web App: `Kilinochchi Marks Staging Web`
- Staging App ID: `1:571201491847:web:cce11f4d0c29f914f77922`
- Production was independently identified as `kilinochchi-marks` / project
  number `499271151802` and was never targeted.
- Every Firebase CLI command included the exact staging `--project` argument.
- `.firebaserc` remained absent.
- SDK configuration and ephemeral synthetic passwords were runtime-only and
  were not written to tracked files.

## Local gates

- Phase 2 activation gate: passed.
- React tests: 9 suites, 34 tests passed.
- Production build: passed.
- Audit-tool tests: 12 passed.
- Rules structural validator: passed without warnings or failures.
- Firestore Rules emulator: 11 passed.
- Canonical scoped reads, cursor pagination, summaries, migration execution,
  and remote index deployment remained inactive.

## Rules evidence

Preserved default-deny SHA-256:

`ECF30F940747DCC3C5BA4993093E9A11AC9FC5DF7E14B2A1512D2446923D84EB`

Reviewed proposal SHA-256:

`EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`

The proposed Rules were deployed only through
`firebase.staging.rules.review.json`; retrieved source parity passed. After the
application failures, the preserved default-deny Rules were redeployed and
retrieved again.

- Final rollback Ruleset:
  `projects/kilinochchi-marks-staging/rulesets/6eb0784d-2bbb-4a62-90a3-ff1ebe53e334`
- Post-failure rollback SHA-256:
  `ECF30F940747DCC3C5BA4993093E9A11AC9FC5DF7E14B2A1512D2446923D84EB`
- Final staging Rules state: preserved default deny.

## Synthetic staging seed

The harness used the authenticated CLI OAuth session in memory for explicit
staging Admin REST writes. No service-account file or production SDK
configuration was used.

- Synthetic Auth users prepared: 8.
- Synthetic Firestore seed documents: 30.
- One synthetic IAM diagnostic document was also created at
  `auditLogs/phase2-staging-admin-probe`.
- The fixtures contain synthetic names and identifiers only.

Synthetic records remain in staging behind default-deny Rules. They were not
deleted after the stop condition because the approved window stopped at the
failed legitimate workflows. Cleanup and a rerun must be separately controlled
to avoid masking the failure evidence.

## Application results

Passed suites (5/9):

- teacher routes, Marks Entry canonical update, and admin-route denial;
- IT-teacher report routes;
- sectional-head routes and reports;
- account route, payment write, and academic-route denial;
- full 17-collection backup download, validation, upload, and restore UI flow.

Failed suites (4/9):

- first admin all-route suite: admin remained on `/login`;
- admin settings/secondary-teacher suite: admin remained on `/login`;
- prefect late-arrival workflow: create did not reach the success state;
- unknown-role suite: expected role-configuration denial was not rendered.

The later backup/restore suite successfully authenticated the same admin
fixture, so early Auth/profile propagation is a possible contributor. The
prefect fixture also had prior synthetic state from interrupted attempts, which
may have caused a same-identity create/update collision. These are hypotheses,
not waived failures. No Rules or application behavior was weakened and no retry
was performed after the stop condition.

## Gates not completed

- Complete admin route matrix.
- Admin settings and secondary Auth-user creation.
- Prefect create/return workflow.
- Unknown-role denial and the remaining unauthenticated assertions in that
  suite.
- A clean repeat of the entire nine-suite run.
- Reliable Rules profile-lookup latency/read-impact measurement.

## Remote operation record

- Staging Rules: proposal deployed, then rollback deployed and verified.
- Staging users/documents: synthetic only, as counted above.
- Index, Hosting, Functions, and Storage deployments: 0.
- Canonical migrations and feature activations: 0.
- Production operations: 0.

## Resume gate

Before another proposal deployment, preserve current Rules again and create a
reviewed cleanup/reseed procedure limited to the fixed synthetic identities.
Add readiness polling that proves every synthetic Auth user can sign in and its
matching profile is readable before browser tests begin. Ensure the prefect
test uses a unique record identity or removes only its previous synthetic
record. Then rerun all nine suites from a clean synthetic state; partial passes
do not satisfy the release gate.

## Controlled stabilization rerun

The resume gate above was completed later on 2026-08-08. This section
supersedes the earlier partial-run status while retaining it as incident
evidence.

- Current staging Rules were retrieved again before mutation. Ruleset
  `projects/kilinochchi-marks-staging/rulesets/6eb0784d-2bbb-4a62-90a3-ff1ebe53e334`
  was exact default deny with SHA-256
  `ECF30F940747DCC3C5BA4993093E9A11AC9FC5DF7E14B2A1512D2446923D84EB`.
- A new rollback artifact and Rules-only rollback config were generated from
  that exact source.
- The exact synthetic allowlist was inventoried, 33 known documents and nine
  known Auth users were removed, and a pre-run inventory verified zero/zero.
- The harness now uses bounded Auth/profile readiness polling (60-second
  timeout, 750-ms interval), fresh browser state, a separate Auth-only
  missing-profile fixture, and a deterministic current-run prefect identity.
- All nine readiness checks passed. Expected profiles returned HTTP 200 with
  exact roles; the separate missing-profile case returned HTTP 404. Observed
  per-identity readiness was 833–1,314 ms.
- All mandatory local gates passed again: Rules emulator 11/11, React 34/34,
  application emulator browser suites 9/9, audit tools 12/12, production build,
  activation guard, and Rules validator.
- Proposed Rules deployed to staging only as Ruleset
  `projects/kilinochchi-marks-staging/rulesets/9bfbc85c-7806-4bbf-9906-cfc011f2d1a2`.
  Retrieved SHA-256 exactly matched the reviewed proposal:
  `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`.
- The clean serial staging browser run passed 9/9, covering admin routes and
  staff creation, teacher Marks Entry, IT and sectional reports, accounts,
  prefect create/return, unknown/missing-profile/unauthenticated rejection,
  and the full backup validation/upload/restore UI rehearsal.
- Rollback was rehearsed again and released as Ruleset
  `projects/kilinochchi-marks-staging/rulesets/c87af2a3-5369-496c-a02e-7e3d762a532c`.
  Retrieved rollback SHA-256 exactly matched the newly preserved source.
- Post-run cleanup removed 32 exact synthetic documents and ten exact
  synthetic Auth users (the ninth-suite staff-creation workflow added the
  tenth user). A separate final inventory verified zero known synthetic users
  and zero known synthetic documents remain.
- Final staging Rules state is the preserved default deny. Index, Hosting,
  Functions, Storage, migration, feature activation, and production operations
  remained zero. `.firebaserc` remains absent.

Final classification: **READY FOR CONTROLLED PRODUCTION RULES REVIEW**.

This classification authorizes review only. It does not authorize any
production deployment or data operation.
