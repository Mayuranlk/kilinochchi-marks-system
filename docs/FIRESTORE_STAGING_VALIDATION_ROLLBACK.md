# Firestore staging validation and rollback

## Status and scope

This is a review-only staging package. It was prepared after the proposed Rules
passed 11 synthetic Rules suites and the actual React application passed all 9
browser suites against local Authentication and Firestore emulators. Nothing in
this package authorizes or performs a production deployment.

The normal `firebase.json` remains Hosting-only. The separate
`firebase.staging.rules.review.json` points only to
`firestore.rules.proposed.review` and must be used only with an explicitly
approved, non-production project ID.

## Current controlled-phase release baseline (2026-08-01)

The local release gates were rerun immediately before the staging approval
checkpoint:

- Firestore Rules emulator: 11 of 11 suites passed.
- React unit tests: 32 of 32 tests passed across 9 suites.
- Production React build: compiled successfully.
- `firebase.staging.rules.review.json` parses successfully, references only
  `firestore.rules.proposed.review`, and contains no index configuration.
- The normal `firebase.json` remains Hosting-only and `.firebaserc` is absent.
- All local Auth, Firestore, emulator hub, logging, websocket, and app test ports
  were closed after verification.

Verified SHA-256 evidence:

```text
firestore.rules.deployed.review
04F9ECED7836F7CA4266BBF91A843A9BDE63698E28F40BFA6414CE46D111C57E

firestore.rules.proposed.review
EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969

firebase.staging.rules.review.json
63EDF90A85EB1C0184ADE011DA628E84EA296AD8E1183F225F5C0A286F9D7301
```

No approved staging project ID was present in the repository or supplied for
this controlled phase. In accordance with the release gate, no remote Firebase
command was run, no project was contacted, and no Rules deployment or rollback
was attempted. Resume only after the exact non-production project ID and the
required approvals below are supplied in writing.

## Required staging gates

1. An owner confirms the exact Firebase staging project ID in writing and proves
   it is not the production project.
2. The staging project contains synthetic data only and has no production users,
   credentials, backups, or personal data.
3. The currently deployed staging Rules are exported to a dated rollback file,
   reviewed, SHA-256 hashed, and stored before any change.
4. Firebase CLI authentication and the active account are verified. Do not add a
   default project to `.firebaserc`; every command must include `--project`.
5. The local Rules and application suites remain green at the same commit.
6. A security reviewer and application owner approve the staging window and
   named rollback operator.

## Controlled staging deployment procedure

The commands below are instructions for an approved future window; they were not
executed during this phase.

```powershell
$approvedStagingProject = '<EXACT_APPROVED_NON_PRODUCTION_PROJECT_ID>'
firebase projects:list
firebase deploy --only firestore:rules `
  --project $approvedStagingProject `
  --config firebase.staging.rules.review.json
```

Immediately after the staging-only deployment, use synthetic accounts to repeat:

- admin access to all protected administration routes, settings, staff creation,
  and the full 17-collection backup/export and restore UI flow;
- teacher dashboard, assigned reports, SBA, Report Card, canonical mark update,
  and denial from admin-only routes;
- IT-teacher and sectional-head report routes;
- account payment creation and denial from academic write routes;
- prefect late-arrival creation/handover and denial from finance routes;
- unknown-role and unauthenticated denial, including public live-page fallback;
- browser console review for `permission-denied`, query incompatibility, and
  unexpected load errors.

Record tester, timestamp, project ID, Rules hash, application revision, route,
expected result, actual result, and console evidence. Staging observation should
also compare Firestore read counts and latency before and after the Rules change;
emulator success does not prove production billing behavior.

## Stop and rollback conditions

Rollback immediately if any legitimate workflow receives an unexplained denial,
an unauthorized write succeeds, a report differs from its approved baseline,
backup/restore fails, or error/read volume rises unexpectedly. Do not weaken the
proposal in the console as an emergency workaround.

Use the predeployment staging Rules file captured in gate 3:

```powershell
$approvedStagingProject = '<EXACT_APPROVED_NON_PRODUCTION_PROJECT_ID>'
$rollbackConfig = '<PATH_TO_REVIEWED_STAGING_ROLLBACK_CONFIG>'
firebase deploy --only firestore:rules `
  --project $approvedStagingProject `
  --config $rollbackConfig
```

After rollback, verify its deployed hash/source, repeat the failed route, preserve
logs, and open a defect with the rejected request shape. A successful staging
rollback does not authorize production deployment.

## Production promotion gate

Production remains blocked until staging passes, rollback is rehearsed, dependent
profile-read cost is reviewed, canonical production coverage is audited with
explicit read-only approval, and production deployment receives separate written
approval. Indexes, migrations, pagination, summaries, and canonical-only reads
remain outside this Rules rollout.
