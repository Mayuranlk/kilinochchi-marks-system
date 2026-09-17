# Firestore production rollback package

Review only. This package does not authorize deployment.

## Preserved production state

- Project: `kilinochchi-marks` (`499271151802`, ACTIVE)
- Database: `(default)`, `asia-southeast1`
- Retrieval: `2026-08-08T06:26:50.292Z`
- Authenticated operator at retrieval: `techzlkpro@gmail.com`
- Ruleset: `projects/kilinochchi-marks/rulesets/d98a04f8-7720-4214-8c7d-359a152bcd5b`
- Source: `staging-evidence/production-review/firestore.rules.production-before-20260808-062700`
- SHA-256: `D714CFE3216B0A68DBE348BC779F02D370DFFAC543C4E55F3C467FFA2CF12FCB`
- Rollback config: `staging-evidence/production-review/firebase.production.rollback.review.json`

The fresh source differs byte-for-byte from `firestore.rules.deployed.review`
(SHA-256 `04F9...C57E`) because of whitespace. Both express the same broad grant to
every authenticated account. The fresh retrieved source is the rollback
authority and historical evidence was not overwritten.

The rollback config contains only `firestore.rules`; it contains no index,
Hosting, Functions, or Storage target. Its Rules source compiled successfully
with the local Firestore emulator.

## Future rollback command

Run only after an authorized production change window has begun and a rollback
condition has been declared:

```powershell
.\node_modules\.bin\firebase.cmd deploy --only firestore:rules --project kilinochchi-marks --config staging-evidence\production-review\firebase.production.rollback.review.json --non-interactive
```

## Rollback verification

1. Confirm the CLI identity is the approved rollback operator.
2. Confirm the command contains project `kilinochchi-marks` and only
   `firestore:rules`.
3. Deploy the preserved source without editing it.
4. Retrieve the active Rules with an explicit `--project kilinochchi-marks`.
5. Require retrieved SHA-256
   `D714CFE3216B0A68DBE348BC779F02D370DFFAC543C4E55F3C467FFA2CF12FCB`.
6. Confirm the release points to the newly created rollback Ruleset.
7. Repeat narrow admin, teacher, account, and prefect read smoke tests.
8. Continue incident monitoring and record UTC timestamps and operator names.

If deployment or source parity fails, escalate immediately. Do not edit Rules
ad hoc in Firebase Console.
