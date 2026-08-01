# Firestore Rules comparison

## Evidence status

The deployed Rules source supplied from Firebase Console is now verified locally as `firestore.rules.deployed.review`. Its SHA-256 is `04f9eced7836f7ca4266bbf91a843a9bde63698e28f40bfa6414ce46d111c57e`.

The original `firestore.rules.candidate` remains historical review evidence. The new `firestore.rules.proposed.review` is the source-backed interim proposal. Neither file is referenced by `firebase.json` or deployed.

| Control | Verified deployed Rules | Original candidate | Proposed review |
| --- | --- | --- | --- |
| Authentication | Unauthenticated denied; any authenticated user gets global read/write. | Authentication plus role lookup. | Authentication plus profile-backed roles/capabilities and default deny. |
| Public access | None. | None. | None; authenticated election reads preserve deployed behavior. |
| Admin permissions | No meaningful admin boundary because all users have the same access. | Core academic CRUD but operational collections omitted. | Admin CRUD for every source-discovered operational/backup collection. |
| Teacher class/subject read scope | Global read/write. | Broad academic read. | Broad academic read retained temporarily because current queries are unscoped. |
| Class-teacher scope | Not enforced. | Not enforced. | Not yet enforced; blocked on query-compatible authorization design. |
| Sectional-head scope | Not enforced. | Broad academic read/write through academic-staff mark rule. | Broad read, marks read-only unless the profile also has subject-teacher capability. |
| Marks create/update/delete | Any authenticated user can do all three. | Academic staff create/update; admin delete. | Admin full access; subject teachers validated create/update; admin-only delete. |
| Immutable identity | None. | None. | Teacher cannot change student ID or an existing logical `markKey`. |
| Mark type/range | None. | Number/null type only. | Aliases consistent; absent consistency; null or numeric 0–100; attendance 0–100. |
| Enrollment permissions | Any authenticated user CRUD. | Academic read, admin write. | Academic read, admin write, preserving generator/admin workflows. |
| Bulk operations | Unlimited by role/shape. | Profile dependency untested. | Emulator passed 1/20/100/400 teacher mark and admin audit batches; production billing acceptance remains. |
| Aggregation queries | Any authenticated user. | Likely academic-compatible. | Emulator passed academic marks aggregation and denied account marks aggregation. |
| List queries | Any authenticated user, no limits. | Broad academic lists. | Current broad academic lists retained; account/prefect user lists denied. |
| Role self-promotion | Any authenticated user can update any `users` document. | Admin-only user writes. | Admin-only user writes; unknown/account/prefect get own profile only. |
| Rules `get()` / `exists()` | None. | Profile `get()`. | Profile `exists()`/`get()`; billing/access-call impact must be tested. |
| Operational collections | Global authenticated access. | Several omitted and would break features. | Elections, late arrivals, accounts, logs, shuffle, promotion, teachers, settings, and fallback explicitly handled. |
| Unknown collections | Global authenticated access. | Default deny. | Default deny, including admin, until explicitly reviewed. |

## Critical deployed vulnerabilities

1. Any authenticated account can grant itself `admin` by modifying a user profile.
2. Any authenticated account can read all student, teacher, account, prefect, and academic data.
3. Any authenticated account can create, alter, or delete marks and historical records without validation.
4. Any authenticated account can alter fee accounts, elections, settings, assignments, and enrollments.
5. Any authenticated account can overwrite or delete audit records and backup-restored data.
6. React route guards do not protect against direct Firestore SDK or REST requests.

## Why the proposal is interim

Firestore Rules are not filters. Current academic pages still make broad compatibility queries, so assignment-scoped Rules would reject those queries. Final least privilege requires canonical reconciliation, scoped frontend queries, deterministic authorization documents usable by Rules, and role/query emulator tests. See [securely query data](https://firebase.google.com/docs/firestore/security/rules-query).

Server/Admin SDK audit tooling bypasses Rules and remains controlled separately through read-only IAM and explicit project confirmation.

## Emulator evidence

On 2026-08-01, Firebase CLI 15.25.1 loaded the proposal into Firestore Emulator
1.22.0 under the demo-only project `demo-kilinochchi-rules`. The expanded suite
identified and corrected one narrow defect: canonical mark `subjectId` now must
be a nonempty string. All 11 suites then passed. This establishes local compilation and
synthetic semantic coverage; it does not replace authenticated route smoke tests,
staging validation, production billing review, deployment approval, or rollback
preparation. See `FIRESTORE_RULES_EMULATOR_RESULTS.md`.
