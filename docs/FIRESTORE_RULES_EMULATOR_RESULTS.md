# Firestore Rules emulator results

## Outcome

`firestore.rules.proposed.review` compiled successfully and passed all synthetic
Firestore Emulator tests on 2026-08-01 after one narrow validation correction.
The proposal remains review-only and is not referenced by `firebase.json`.

The expanded negative suite proved that an empty-string `subjectId` was accepted
even though the documented canonical identity contract requires a nonblank
subject identity. The proposal was corrected from a string-only check to require
`data.subjectId.size() > 0`. No role, collection, or operation was granted
additional access.

## Isolation controls

- Firebase project ID: `demo-kilinochchi-rules`.
- Firestore endpoint: `127.0.0.1:8085`.
- Emulator UI: disabled.
- Test identities and documents: synthetic only.
- Production credentials/tokens: none used or stored.
- Production reads/writes and Rules/index deployments: zero.
- Emulator state: discarded when `emulators:exec` stopped.

Firebase CLI explicitly confirmed that the `demo-` project uses demo
configuration and attempts to access non-emulated services fail.

## Toolchain

| Tool | Version |
| --- | --- |
| Node.js | 24.18.0 |
| npm | 11.16.0 |
| Eclipse Temurin Java | 21.0.12 LTS |
| Firebase CLI | 15.25.1 |
| Firestore Emulator | 1.22.0 |
| `@firebase/rules-unit-testing` | 5.0.1 |
| Firebase Web SDK | 12.11.0 |

## Executed coverage

All 11 suites passed:

1. unauthenticated denial across every explicit and fallback collection;
2. unknown-role and missing-profile boundaries;
3. admin, teacher, IT teacher, sectional-head, account, and prefect access;
4. capability-flag role variants;
5. admin CRUD across every current `SYSTEM_COLLECTIONS` collection;
6. profile self-promotion and fallback-deny protection;
7. canonical mark writes, ranges, aliases, types, absence, attendance, and required keys;
8. immutable teacher mark identity and admin-only deletion;
9. fee-account and late-arrival write constraints;
10. whole-collection, filtered, ordered, aggregation, scoped, and cursor-query shapes;
11. teacher/admin write batches containing 1, 20, 100, and 400 operations.

Expected `PERMISSION_DENIED` emulator log entries were produced by negative
assertions and were counted as successful denials. Final result: 11 passed,
0 failed, 0 skipped.

## Reproduction

Java must be available on `PATH`, then run:

```powershell
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = 'true'
$env:CI = 'true'
npm.cmd run test:firestore-rules
```

The npm script starts and stops the emulator automatically. It does not use the
hosting-only `firebase.json`; it uses `firebase.emulator.rules.json`.

## Application integration evidence

On 2026-08-01, an emulator-configured production React build passed all 9
Playwright suites in 66 seconds using 8 synthetic identities and an initial 30
synthetic documents across all 17 application collections. Coverage included 31
admin routes; teacher, IT-teacher, sectional-head, account, and prefect routes;
canonical teacher mark update; settings, staff-creation, payment and late-arrival
writes; unauthorized/unknown-role denials; public live-page denial fallback; and
the complete backup download, validation, upload, confirmation, and restore UI
flow.

One application integration defect was corrected: `Login.js` did not route the
existing `it_teacher` role/capability variants even though `AuthContext` already
authorized them. Test-only selector and orchestration defects were also corrected.
No Rules authorization was weakened or changed. Proposed Rules SHA-256 remained
`EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`.

## Remaining release blockers

- Review dependent profile-read billing and operational impact; emulator success proves access-call acceptance, not production billing cost.
- Execute the approved staging plan and rehearse the rollback procedure in `docs/FIRESTORE_STAGING_VALIDATION_ROLLBACK.md`.
- Obtain explicit review and production deployment approval.

Until those gates pass, do not reference the proposal from `firebase.json` and
do not deploy it.
