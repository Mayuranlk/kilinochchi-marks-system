# Canonical audit and migration runbook

## Safety model

The coverage auditor is read-only and imports no Firestore write API. It refuses production access unless `--allow-production-read` and an exact `--confirm-project` value are both supplied. Firebase Admin SDK bypasses Firestore Rules, so IAM credentials must be read-only for audit use.

Reports and checkpoints exclude student names, emails, phone numbers, and other direct personal fields. Duplicate identities are represented by hashes.

The auditor reads the actual collections found in source. `classTeacherAssignments` is reported as a virtual logical dataset derived from classroom assignment fields because no collection with that name exists in the application schema.

## Emulator audit

```powershell
npm.cmd run audit:canonical -- --emulator --confirm-project demo-kilinochchi
```

Optional controls:

```powershell
npm.cmd run audit:canonical -- `
  --emulator 127.0.0.1:8080 `
  --confirm-project demo-kilinochchi `
  --collections students,studentSubjectEnrollments,marks `
  --batch-size 250 `
  --maximum-documents 10000 `
  --checkpoint audit-output/checkpoint.json `
  --json audit-output/coverage.json `
  --markdown audit-output/coverage.md
```

Resume safely with the same project and collection selection:

```powershell
npm.cmd run audit:canonical -- --emulator --confirm-project demo-kilinochchi --resume
```

`Ctrl+C` stops after the current read page, writes the checkpoint and partial report, and exits with code 130.

## Approved production read

Do not run this without a production change ticket, confirmed project ID, read-only IAM/ADC credentials, and an estimated read budget.

```powershell
npm.cmd run audit:canonical -- `
  --allow-production-read `
  --confirm-project CONFIRMED_PROJECT_ID `
  --batch-size 250 `
  --maximum-documents APPROVED_MAXIMUM
```

Start with a small approved maximum and inspect the output. `--maximum-documents` applies per selected collection. The audit itself causes document reads and must be scheduled and budgeted.

## Dry-run backfill plan

Planning is offline and reads the sanitized audit checkpoint:

```powershell
npm.cmd run audit:plan-backfill -- `
  --checkpoint audit-output/canonical-coverage.checkpoint.json `
  --output audit-output/canonical-backfill-plan.json
```

The planner:

- produces additive canonical field patches only;
- is idempotent;
- preserves legacy fields and generated document IDs;
- skips conflicting canonical values, incomplete identities, and duplicate logical identities;
- hashes skipped document IDs in its safety report;
- never connects to Firebase;
- rejects `--apply` deliberately.

No production migration executor is enabled. Enabling execution requires separate approval, plan review, a backup, update-time preconditions, 400-write checkpoints, audit logging, rollback design, and a staging rehearsal.

## Reconciliation gate

After an approved backfill, rerun the read-only audit. A page can enter canonical-query testing only when:

- every required collection has 100% canonical coverage;
- duplicate logical identity groups are zero;
- unsafe records are zero;
- the audit is complete, not capped or interrupted;
- legacy and canonical result sets produce identical academic outputs.

`scripts/lib/queryReadinessGates.js` encodes these conditions for each compatibility-gated report page. Feature activation remains a separate reviewed deployment.

Copy `docs/reconciliation-template.json`, attach evidence paths, and change a page status to `passed` only after its comparison is independently reviewed. Then evaluate gates:

```powershell
npm.cmd run audit:query-readiness -- `
  --audit audit-output/canonical-coverage.json `
  --reconciliation audit-output/reconciliation.json `
  --output audit-output/query-readiness.json
```
