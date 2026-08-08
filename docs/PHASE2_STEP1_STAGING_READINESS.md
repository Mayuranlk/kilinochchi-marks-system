# Phase 2 Step 1 staging-readiness operator package

## Release boundary

This package prepares an operator for a future, separately approved staging
window. It does not authorize remote access or deployment. Production and
staging project IDs, credentials, tokens, and personal data must not be added to
the repository. Do not create `.firebaserc`; every future remote command must
name the exact approved non-production project explicitly.

Canonical scoped reads, Firestore cursor pagination, summary documents,
canonical backfill execution, deterministic mark IDs, Rules deployment, and
index deployment remain disabled.

## Local evidence commands

Run from a clean checkout at the intended revision:

```powershell
npm.cmd run verify:phase2-local-gates
npm.cmd run test:firestore-rules
npm.cmd test -- --watchAll=false --runInBand
npm.cmd run build
npm.cmd run test:audit-tools
npm.cmd run audit:validate-rules-review
```

Record the revision, operator, UTC timestamp, command exit codes, test totals,
and artifact hashes. A failure blocks staging preparation; it must not be
worked around by weakening Rules or activating compatibility flags.

Generate hashes without contacting Firebase:

```powershell
Get-FileHash firestore.rules.deployed.review -Algorithm SHA256
Get-FileHash firestore.rules.proposed.review -Algorithm SHA256
Get-FileHash firestore.indexes.json -Algorithm SHA256
Get-FileHash firebase.staging.rules.review.json -Algorithm SHA256
```

## Approval handoff checklist

- [ ] Exact staging project ID supplied in the approved change record.
- [ ] Independent owner confirms the ID is non-production.
- [ ] Staging contains synthetic data and synthetic accounts only.
- [ ] Security reviewer and application owner approve the window.
- [ ] Named deploy and rollback operators are available.
- [ ] Current staging Rules are exported, reviewed, dated, and hashed for rollback.
- [ ] Firebase CLI identity is verified during the approved window.
- [ ] Local evidence commands above pass at the intended revision.
- [ ] Expected route/role results and stop conditions are attached.
- [ ] Read-volume and latency observation plan is attached.

If any item is incomplete, staging access and deployment are **BLOCKED**.

## Separated change units

Rules validation is the only prepared staging deployment unit and uses
`firebase.staging.rules.review.json`. Indexes are a separate future change and
must not be included in the Rules command. Migration, scoped-query activation,
pagination, summaries, Hosting, and production promotion are also separate
changes requiring their own evidence and approval.

The controlled deployment, validation, stop, and rollback procedure remains in
`docs/FIRESTORE_STAGING_VALIDATION_ROLLBACK.md`. Operators must substitute an
approved project ID only in their shell for the approved window, never in a
tracked file.

## Evidence record template

| Evidence | Value |
| --- | --- |
| Git revision | |
| Operator | |
| UTC start/end | |
| Local gate result | |
| Rules emulator result | |
| React test result | |
| Production build result | |
| Audit-tool test result | |
| Rules review validator result | |
| Proposed Rules SHA-256 | |
| Staging config SHA-256 | |
| Approved change record | |
| Security reviewer | |
| Application owner | |
| Rollback operator | |

Do not record credentials, access tokens, student data, or other secrets in the
evidence record.
