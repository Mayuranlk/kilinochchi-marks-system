# Proposed Firestore Rules test plan

Status: **executed successfully on 2026-08-01** with Firebase CLI 15.25.1,
Firestore Emulator 1.22.0, and Eclipse Temurin Java 21.0.12. The reproducible
suite is `scripts/tests/firestoreRulesEmulator.test.cjs`; results are recorded in
`docs/FIRESTORE_RULES_EMULATOR_RESULTS.md`.

## Required test identities

Create emulator-only Auth users and `users/{uid}` profiles for admin, teacher, IT teacher, sectional head, account, prefect, capability-flag variants, unknown role, missing profile, and unauthenticated access. Do not use production identities or personal information.

## Authentication and roles

- Unauthenticated access is denied on every path, including elections, matching verified deployed behavior.
- Unknown/missing-role user can get only `users/{ownUid}` and read elections.
- A user cannot create/update/delete their own profile or another profile.
- Only admin can create roles or change role/capability fields.
- Account and prefect cannot list users.
- Academic readers can list users because current Teacher Dashboard requires it.

## Students and academic metadata

- Admin has CRUD on students, subjects, classrooms, terms, exams, assignments, and enrollments.
- Teacher, IT teacher, and sectional head can read/list those collections but cannot mutate them.
- Account and prefect can read students but cannot mutate them.
- Account/prefect cannot read subjects, terms, assignments, enrollments, or marks.
- Unknown authenticated users cannot read academic collections.

## Marks

- Teacher and IT teacher can create a valid canonical mark with their own UID as `teacherId`.
- Capability-based subject teacher can do the same.
- Sectional head without subject-teacher capability is read-only.
- Teacher cannot create a mark with another `teacherId`.
- Reject marks below 0 or above 100.
- Reject string/object/array mark types.
- Reject `absent == true` with a numeric mark.
- Reject inconsistent `mark`/`marks`/`score` aliases.
- Reject inconsistent `absent`/`isAbsent` aliases.
- Reject missing or blank canonical keys.
- Reject invalid attendance percentages.
- Permit null non-absent mark to preserve current blank/draft-compatible writes.
- Teacher update cannot change `studentId`.
- Teacher update cannot change an existing `markKey`.
- Admin can correct or restore legacy marks and delete marks.
- Teacher cannot delete marks.
- Generated document IDs remain permitted and unchanged.

## Accounts and prefect workflows

- Account and admin can read/create/update fee accounts; only admin can delete.
- Prefect can create a valid late-arrival record.
- Prefect update is limited to the four return/handover fields and must set returned status.
- Prefect cannot delete a late-arrival record.
- Admin retains full late-arrival CRUD for repair/restore.

## Elections and settings

- Any authenticated user can read an election document.
- Only admin can create/update/delete elections.
- Academic readers can read system settings.
- Only admin can mutate system settings.

## Administrative collections and fallback

- Only admin has access to audit logs, shuffle plans, promotion history, and legacy teachers.
- Backup/restore test verifies admin can recreate and overwrite documents in every `SYSTEM_COLLECTIONS` entry.
- Every unmatched collection/path is denied, including for admin, until explicitly reviewed.

## Query-shape tests

Run the exact active queries from Report Card, Teacher Dashboard, Marks Entry, Subject Analysis, Sectional Head Dashboard, account, prefect, count aggregations, and all admin maintenance routes. Rules are all-or-nothing for list queries, so individual-document tests are insufficient.

## Batch/access-call tests

Test 1, 20, 100, and 400 mark writes using the same authenticated teacher and admin. Verify profile lookup caching/access-call limits and billed dependent reads. A syntactically valid ruleset is not deployable until these tests pass.

## Deployment blockers

- Firebase Emulator compilation and semantic suite pass. **Satisfied locally.**
- Every existing role completes its route smoke test. **Satisfied locally in the 9-suite application emulator run.**
- Admin CRUD across every current `SYSTEM_COLLECTIONS` entry works in the emulator. **Satisfied at the Rules and full backup/restore UI layers.**
- Current canonical mark payloads pass; malformed/unauthorized payloads fail. **Satisfied for the source-backed payload matrix.**
- Rules access-call limits pass for synthetic 1/20/100/400 teacher and admin batches. Billing impact still requires acceptance.
- Controlled staging execution and rollback rehearsal are approved. **Plan prepared; execution remains blocked pending approval.**
- `firebase.json` remains unchanged until a separate deployment task.
