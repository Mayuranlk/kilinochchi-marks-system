# Firestore production Rules review package

## Classification

**READY FOR EXPLICIT PRODUCTION DEPLOYMENT APPROVAL**

Review only. No production deployment is authorized by this document.

## Risk and verified identity

Current production Rules allow every authenticated account broad Firestore
read/write access. The current live source was retrieved read-only on
`2026-08-08T06:26:50.292Z` using authenticated account
`techzlkpro@gmail.com`.

- Production: `kilinochchi-marks`, number `499271151802`, ACTIVE
- Staging: `kilinochchi-marks-staging`, number `571201491847`, ACTIVE
- Production database: `(default)`, `asia-southeast1`
- Current Ruleset: `projects/kilinochchi-marks/rulesets/d98a04f8-7720-4214-8c7d-359a152bcd5b`
- Current source SHA-256:
  `D714CFE3216B0A68DBE348BC779F02D370DFFAC543C4E55F3C467FFA2CF12FCB`
- Proposed source SHA-256:
  `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`

The current source is preserved under `staging-evidence/production-review/`.
It differs from `firestore.rules.deployed.review` only in whitespace and is the
authoritative rollback source.

## Package artifacts

- Proposed Rules: `firestore.rules.proposed.review`
- Rules-only future deployment config: `firebase.production.rules.review.json`
- Production evidence manifest:
  `staging-evidence/production-review/production-review-manifest.json`
- Rollback package: `docs/FIRESTORE_PRODUCTION_ROLLBACK_PACKAGE.md`
- Smoke plan: `docs/FIRESTORE_PRODUCTION_RULES_SMOKE_TEST_PLAN.md`
- Monitoring plan: `docs/FIRESTORE_PRODUCTION_RULES_MONITORING_PLAN.md`

Both configs contain only a Firestore Rules source. No indexes or other
Firebase products are referenced.

## Release evidence

Fresh local verification passed: Phase 2 activation guard; Rules emulator
11/11; React 34/34; production build; audit tools 12/12; Rules validator; and
application-emulator browser suites 9/9. Canonical-only reads, cursor
pagination, summaries, migrations, and remote index deployment remain inactive.

Staging evidence records a clean browser run of 9/9 after 9/9 Auth/profile
readiness checks. It covered admin routes and staff creation, teacher Marks
Entry, IT/sectional reports, account and prefect workflows, unknown-role,
missing-profile and unauthenticated denial, and backup validation/upload/restore.
Proposed deployment and rollback hashes matched exactly. Final staging cleanup
verified zero known synthetic users and zero known synthetic documents, and
staging ended on preserved default-deny Rules.

## Stop and rollback conditions

Rollback immediately if legitimate admin login/workspace fails; Teacher Marks
Entry cannot load; an approved legitimate teacher write is denied; Dashboard or
Report Card fails because of Rules; account/prefect legitimate workflows fail;
an unauthorized write succeeds; permission-denied errors spike; or broad
authorization failures appear. Do not edit Rules in Firebase Console. Use the
freshly preserved rollback package.

## Future commands — do not run without explicit approval

Deployment:

```powershell
.\node_modules\.bin\firebase.cmd deploy --only firestore:rules --project kilinochchi-marks --config firebase.production.rules.review.json --non-interactive
```

Rollback:

```powershell
.\node_modules\.bin\firebase.cmd deploy --only firestore:rules --project kilinochchi-marks --config staging-evidence\production-review\firebase.production.rollback.review.json --non-interactive
```

After either operation, retrieve active Rules with explicit project
`kilinochchi-marks` and require exact expected hash parity before proceeding.

## Operator checklist and approvals

- [ ] Reverify CLI identity and production project ID/number.
- [ ] Reverify current live Rules and refresh rollback evidence if they changed.
- [ ] Reverify proposed hash equals `EB6518...FE969`.
- [ ] Re-run all local gates immediately before the window.
- [ ] Confirm both configs are Rules-only and commands name production exactly.
- [ ] Name deployment owner, rollback operator, application owner, and incident
      contact.
- [ ] Confirm smoke accounts and any separately approved reversible write.
- [ ] Open monitoring and incident channels before deployment.

Required approvals:

- [ ] Production project owner — name/time: `[pending]`
- [ ] Application owner — name/time: `[pending]`
- [ ] Security reviewer — name/time: `[pending]`
- [ ] Change window owner — window/time: `[pending]`
- [ ] Rollback operator confirmation — name/time: `[pending]`

Explicit production deployment approval must be a separate instruction after
these placeholders are completed. Review readiness is not deployment authority.

## Safety report

- Production Rules deployments: 0
- Production Firestore writes: 0
- Production Auth changes: 0
- Index, Hosting, Functions, and Storage deployments: 0
- Migrations and feature activations: 0
- `.firebaserc` created: no
