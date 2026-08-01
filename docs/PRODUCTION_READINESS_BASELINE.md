# Production-readiness baseline

Verified on 2026-08-01 against the supplied workspace. This is a focused gate check, not a repeat of the page audit.

## Confirmed

- Persistent multi-tab Firestore cache remains configured in `src/firebase.js`.
- `src/services/firestoreReadCache.js` retains five-minute reuse, count aggregation fallback, concurrent request deduplication, explicit refresh, generation-safe invalidation, and auth-session clearing.
- Normal teacher/dashboard routes have no broad marks or enrollment listeners. The four remaining `onSnapshot` calls target `systemSettings/marksEntry` or a single election document.
- Marks Entry and Bulk Marks Upload continue to add canonical fields without removing legacy aliases.
- New mark references still use `doc(collection(db, "marks"))`; existing generated mark document IDs are unchanged.
- Report Card remains scoped by `studentId` for marks and enrollments.
- Subject Analysis retains student-indexed compatibility matching.
- Marks Status Live remains a one-time cached snapshot rather than six collection listeners.
- There are no active `limit()` or `startAfter()` application queries. Pagination remains disabled.
- The remaining literal full-collection reads are classified in `FIRESTORE_PAGE_AUDIT.md`; normal reporting paths are compatibility-gated and explicit health/setup/backup/migration/promotion paths are intentional maintenance operations.
- The source does not use a `classTeacherAssignments` collection. Class-teacher assignment compatibility fields are stored on classroom/user documents; the coverage auditor reports this as a virtual logical dataset without issuing an invented collection read.

## Production evidence update

The deployed Rules were subsequently copied manually from Firebase Console and verified locally as `firestore.rules.deployed.review`. They grant every authenticated user global read/write access. The Rules source is now available for security comparison, but project/release metadata and approved production data-audit credentials remain unavailable.

## Production evidence still unavailable

- No `.firebaserc` exists.
- `firebase.json` contains Hosting configuration only and does not reference Firestore Rules or indexes.
- No CI/CD Firebase deployment definition was found.
- Firebase CLI 15.25.1 is now installed locally for emulator testing only. It is not authenticated, and no production project was selected.
- Canonical production coverage, duplicate counts, unresolved references, and report reconciliation are unknown because no production audit was run.

## Application emulator evidence

The actual React application now connects to Authentication and Firestore
emulators only when explicitly enabled with a `demo-` project ID and loopback
hosts. All 9 browser suites pass against `firestore.rules.proposed.review`,
including every role, 31 admin routes, legitimate writes, denial paths, and the
complete backup/restore UI workflow. The existing IT-teacher login redirect was
aligned with the capability logic already used by `AuthContext`; no academic,
report, or Rules behavior changed.

## Gate status

Canonical-only report queries and pagination remain **disabled** until an approved read-only coverage audit, duplicate review, backfill approval, and output reconciliation are complete. The proposed Rules compile and pass both the synthetic Rules suite and application browser suite, but candidate/proposed Rules and indexes remain undeployed pending controlled staging execution, rollback rehearsal, billing review, and explicit production approval.
