# Capped production canonical audit operator checklist

Status: **prepared, not approved, not executed**.

## Proposed first cap and read estimate

The first production sample selects seven real collections and caps each collection at 100 documents:

```text
students
studentSubjectEnrollments
marks
classrooms
subjects
academicTerms
teacherAssignments
```

`classTeacherAssignments` is derived virtually from classroom fields and causes no extra query.

Run the offline estimate before any credentialed command:

```powershell
npm.cmd run audit:estimate-reads -- `
  --collections students,studentSubjectEnrollments,marks,classrooms,subjects,academicTerms,teacherAssignments `
  --batch-size 100 `
  --maximum-documents 100 `
  --json
```

Calculated bound:

- maximum returned-document reads: **700**;
- minimum when all seven queries are empty: **7**, because Firestore bills at least one document read per query;
- maximum query requests without retries: **7**;
- writes/deletes: **0**;
- result: intentionally partial and not sufficient to enable canonical queries or migration.

Firestore's current billing documentation confirms the one-read minimum for an empty query: [Cloud Firestore pricing](https://firebase.google.com/docs/firestore/pricing#minimum-charge-for-queries).

## Mandatory approval gates

- [ ] Change ticket identifies the audit operator, date, window, and 700-read maximum.
- [ ] Project owner confirms the exact project ID through two trusted sources.
- [ ] Database ID is confirmed as `(default)` or the tool is reviewed for the actual database ID.
- [ ] Operator credentials contain `roles/datastore.viewer` or an equivalent custom read-only role—no entity create/update/delete permissions.
- [ ] Separate Rules retrieval credentials contain `roles/firebaserules.viewer` or equivalent read-only permissions.
- [ ] Credentials are temporary, externally stored, and absent from the repository.
- [ ] Firebase Usage/billing owner approves the read window.
- [ ] `audit-output/` remains ignored and is stored according to the school's data-handling policy.
- [ ] No `REACT_APP_ENABLE_CANONICAL_SCOPED_READS=true` setting exists in production deployment configuration.
- [ ] Operator understands that Admin SDK bypasses Firestore Security Rules and relies on IAM.

The official IAM descriptions identify `roles/datastore.viewer` as Firestore/Datastore read access and `roles/firebaserules.viewer` as read-only Rules access: [Firestore IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firestore), [Firebase Rules IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules).

## Rules evidence

The manual Console source is now stored as `firestore.rules.deployed.review`. Refresh it through `docs/PRODUCTION_RULES_RETRIEVAL_GUIDE.md` if project/release provenance changes; never store a token or credential. Structural comparison can be reproduced with:

```powershell
npm.cmd run audit:compare-rules -- `
  --deployed firestore.rules.deployed.review `
  --candidate firestore.rules.candidate `
  --output audit-output/rules-structural-comparison.json
```

Update `docs/FIRESTORE_RULES_COMPARISON.md` manually with evidence-backed scope and validation findings. Do not deploy either file.

## Exact capped audit command—do not run before every checkbox passes

```powershell
npm.cmd run audit:canonical -- `
  --allow-production-read `
  --confirm-project CONFIRMED_PROJECT_ID `
  --collections students,studentSubjectEnrollments,marks,classrooms,subjects,academicTerms,teacherAssignments `
  --batch-size 100 `
  --maximum-documents 100 `
  --checkpoint audit-output/production-sample.checkpoint.json `
  --json audit-output/production-sample.coverage.json `
  --markdown audit-output/production-sample.coverage.md
```

Do not substitute an inferred project ID. The command must be copied into the approved ticket with the confirmed ID before execution.

## Post-command checks

- [ ] Confirm output says `production-read-approved` and the expected project.
- [ ] Confirm no collection exceeds 100 returned documents.
- [ ] Confirm report `partial` is `true`; a capped sample must not satisfy readiness gates.
- [ ] Confirm no personal names, emails, or phone numbers appear in output/checkpoint.
- [ ] Record actual document reads from Firebase Usage after metrics settle.
- [ ] Revoke temporary credentials when the audit window ends.
- [ ] Do not run the backfill planner until the sample is reviewed.
- [ ] Do not activate scoped queries, pagination, summaries, Rules, or indexes.

## Stop conditions

Stop immediately if the project ID is uncertain, credentials have write permissions, the expected collection list differs, usage spikes beyond the approved bound, output contains personal data, or any command requests deployment/migration confirmation.
