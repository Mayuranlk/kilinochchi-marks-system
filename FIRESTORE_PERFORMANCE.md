# Firestore performance architecture

## Scope and repository state

This document records the August 2026 performance review and implementation in the synchronized workspace supplied for the Kilinochchi Marks System. At the time of the original performance review the workspace did not contain `.git` or production Firestore Rules, so no remote could be fetched and no production documents were read, changed, migrated, or deployed. A later manual Firebase Console copy is now preserved as `firestore.rules.deployed.review`; it is comparison evidence only. Review/proposed Rules and indexes remain unreferenced by `firebase.json` and undeployed.

## Persisted model discovered from the code

The application uses top-level Firestore collections. Important collections and compatibility fields are:

| Collection | Purpose and fields observed |
| --- | --- |
| `users` | Auth profile and permissions. Document ID is normally the Firebase UID. Fields include `uid`, `email`, `role`, teacher capability flags, class-teacher fields, sectional-head grade fields, names, and phone. |
| `students` | Student identity and class placement. Code accepts `name`/`fullName`, `admissionNo`, several EMIS ID aliases, `grade`, `section`, `className`, `fullClassName`, `alClassName`, `stream`, `medium`, and `status`. |
| `subjects` | Subject definitions and grade/medium/stream configuration. Identity compatibility uses `subjectId`, `subjectName`/`subject`, and `subjectNumber`. |
| `classrooms` | Grade, section, stream, class-name variants, active state, and class-teacher assignment fields. |
| `teacherAssignments` | Teacher identity (`teacherId`, `teacherUid`, `userId`, or email), class identity variants, subject identity variants, medium, stream, and status. |
| `studentSubjectEnrollments` | `studentId`, student/class snapshots, subject identity variants, `academicYear`/`year`, medium/stream, and status. The enrollment collection is the marks-entry roster source of truth. |
| `marks` | Student/class/subject snapshots; `term`/`termName`; `academicYear`/`year`; term/practice assessment fields; `mark`/`marks`/`score`; `absent`/`isAbsent`; and teacher/audit timestamps. Marks Entry writes all supported aliases to remain compatible. |
| `academicTerms` | `term`/`termName`, `year`/`academicYear`, active flags, and legacy practice-term compatibility. |
| `practiceExams` | Practice assessment name, term, year, grade, subject, and document ID used as the assessment ID. |
| `systemSettings/marksEntry` | Singleton settings document containing teacher-entry enabled/deadline state and audit fields. |
| `elections` | Singleton election documents used by the election count/live screens. |

Other operational collections discovered include `auditLogs`, `classShufflePlans`, and the prefect/election data used by their dedicated pages. Backup, defaults, health, and migration tools intentionally perform broad scans because their function requires complete datasets; they are not mounted as global providers.

Marks do not use a proven deterministic document ID. Existing documents are matched through compatible student, class, subject, term/year, and assessment aliases. New marks continue to use generated IDs, and existing documents are merged. New and updated students, enrollments, and marks now dual-write canonical query keys while retaining every legacy field; existing production documents are not rewritten automatically.

## Root causes found

1. `MarksEntry.loadBase` depended on selected class and term. Its own default-selection updates recreated the callback and caused complete `users`, assignments, terms, exams, marks, and student reads again.
2. Every class/subject/term selection in Marks Entry fetched all enrollments and all students, even though filtering was client-side.
3. Marks Entry subscribed to the complete enrollment collection. Any enrollment change scheduled another complete enrollment/student scan.
4. Every marks save called the complete base loader and row loader, rescanning marks, students, enrollments, users, and metadata after a small batch write.
5. Teacher Dashboard subscribed to the complete marks and enrollment collections. Listener initialization reads every matching document; subsequent changes caused a full six-collection dashboard reload.
6. Teacher Dashboard term changes reloaded all base and progress collections.
7. Admin Dashboard downloaded every mark, subject, and enrollment document only to display counts.
8. Route remounts had no request deduplication or session freshness policy. Firestore persistent local cache was configured, but ordinary `getDocs()` still performs server synchronization and can incur reads.
9. Authentication blocked the entire route tree while waiting for the profile server read, even when the profile already existed in Firestore's persistent local cache.
10. Subject Analysis downloaded seven complete collections on every mount. Its record builder then called `marks.find(...)` for every enrollment, making report preparation O(enrollments × marks) even after the network requests completed.

## Implemented architecture

### Session read cache

`src/services/firestoreReadCache.js` provides:

- a five-minute freshness window for complete collection reads;
- one shared in-flight Promise per collection, preventing React Strict Mode or concurrent routes from duplicating the same request;
- explicit forced refresh for user Refresh actions;
- write-through updates for marks saved/deleted in Marks Entry;
- cache clearing whenever the authenticated UID changes, preventing data reuse across accounts.

This cache complements, rather than replaces, Firestore's configured persistent multi-tab cache. It does not change security behavior and does not persist application data itself.

### Startup/authentication

The auth provider first attempts `getDocFromCache(users/{uid})`. When available, protected routes render immediately and the profile is revalidated from the server in the background. On a cache miss, the server profile remains required before the workspace opens. A callback generation guard prevents a late request from a previous auth state overwriting the current one.

### Marks Entry and SBA

- Base data has stable dependencies and loads once instead of on selection changes.
- The auth profile is reused; Marks Entry no longer reads every user to identify the current user.
- Students and enrollments are loaded once and filtered locally for selection changes.
- The collection-wide enrollment listener was removed.
- A marks batch save updates `marksDocs`, row IDs, dirty state, and the shared cache locally. It no longer performs any post-save collection scan.
- Admin mark deletion updates local and cached marks immediately.
- Refresh remains available and explicitly bypasses the freshness cache.
- SBA uses the same cached students/enrollments and stable base load, eliminating two full reads for each selector change.

### Dashboards

- Teacher Dashboard uses cached/deduplicated base and progress data. Term changes recalculate from the cached collections. Its complete `marks` and `studentSubjectEnrollments` listeners were removed. The Refresh button explicitly revalidates all inputs.
- Sectional Head Dashboard shares cached/deduplicated collections with other workspace pages.
- Admin Dashboard uses Firestore count aggregation for marks, subjects, and enrollment totals instead of downloading those collections. Students and users remain loaded because the existing UI calculates status/class breakdowns and shows student rows from their fields.

### Subject Analysis

- Subject Analysis now shares the session collection cache and concurrent-request deduplication used by the dashboards and marks workflows. Its Reload action remains an explicit server refresh.
- Marks are indexed once by `studentId` before enrollment records are built. Each enrollment now searches only that student's small mark set while retaining the existing term, year, class, assessment, subject-ID, subject-name, absent, and legacy matching rules.
- The dominant calculation is reduced from O(enrollments × marks) to O(marks + enrollments × marks-per-student). No Firestore field assumption or production index migration was required.

### Real-time policy

Real-time behavior remains only where a single-document update is part of the feature:

- `systemSettings/marksEntry`: one small document, so teacher lock/deadline changes apply promptly;
- election count/live screens: one election document;
- `MarksStatusLive` now uses deduplicated one-time reads for its six source collections. It is a status snapshot rather than six whole-collection subscriptions, eliminating listener fan-out and repeat billing while the page is open.

## Quota-safety implementation completed

- The audited report routes (`ClassMarksReports`, `ClassCompletionReport`, `ClassReport`, `StudentsBySubject`, `TeacherMarkSheets`) now share the session cache instead of independently downloading the same complete collections on route changes. Manual reload still performs an explicit refresh.
- `ReportCard` now queries `marks` and `studentSubjectEnrollments` by `studentId` on the server. It no longer downloads the school-wide collections for one student.
- `BulkMarksUpload` indexes existing marks by student before compatibility matching, eliminating repeated whole-array searches. It invalidates the marks cache after bulk saves and deletes.
- Ordinary management pages for students, subjects, classrooms, academic terms, practice exams, teacher assignments, class lists, fee accounts, and subject-enrollment views now share cached reads. Their write paths invalidate affected caches before reloading.
- Literal `getDocs(collection(...))` sites fell from about 71 to 24. The remaining sites are the shared cache plus explicit backup, restore/default setup, enrollment generation, data-health, identity-fix, subject migration, and year-end promotion workflows that intentionally require complete data.
- New writes dual-write `schemaVersion`, normalized academic/class/subject/assessment keys, and logical `markKey`/`enrollmentKey` identities. Generated document IDs and all legacy aliases remain unchanged.
- Cache invalidation uses generation guards, so a request started before a write cannot finish later and repopulate the shared cache with stale data. Concurrent forced refresh clicks are also deduplicated.
- Class shuffle and year-end promotion now update canonical student class keys and invalidate affected caches. Promotion writes are committed in chunks of 400 rather than risking Firestore's 500-operation batch limit.
- Backup restore clears all session reads, and setup/repair/class-reset maintenance services invalidate every collection they modify.

The detailed result for every route is recorded in `FIRESTORE_PAGE_AUDIT.md`.

Production-readiness tooling and gates are documented under `docs/`, including the deployed-Rules retrieval procedure, index/query map, guarded canonical coverage auditor, offline dry-run backfill planner, page reconciliation gates, disabled scoped repositories, pagination rollout, summary design, and quota projections. None of these tools performs an automatic production migration or deployment.

## Canonical migration and pagination gate

Cursor pagination cannot safely be switched on for the existing reports yet: those screens calculate totals, rank, completion, search, PDF, and Excel output from the complete compatible dataset. Paginating those reads before old documents have canonical keys would silently omit legacy records and change report results. The safe rollout is:

1. Review `firestore.rules.candidate` against the actual deployed rules; do not replace production rules wholesale.
2. Review and deploy `firestore.indexes.json` through the normal Firebase change process.
3. Run a separately approved, dry-run-first backfill of canonical fields and reconcile document counts. This repository does not run that migration automatically.
4. Verify canonical coverage is 100% for the required report scope.
5. Change report/list reads to canonical `where(...)`, `orderBy(...)`, `limit(...)`, and `startAfter(...)` queries, adding explicit page controls where the UI is a list. Full export jobs must use a controlled server/export path or intentionally traverse every cursor page.

Until that gate is complete, shared caching and scoped queries reduce repeated billing without risking incomplete academic reports. Adding `limit()` now merely to satisfy a code pattern would be data loss, not an optimization.

## Read-impact model

Let `M`, `E`, `S`, `U`, `A`, and `T` be the document counts for marks, enrollments, students, users, assignments, and terms.

- Previous Marks Entry selection: approximately `E + S` reads per selection, plus repeated base loads dominated by `M + U + A`. A save then repeated both sets.
- Current Marks Entry selection: zero Firestore reads after the base dataset is present. A save writes only dirty rows and performs zero follow-up reads.
- Previous Teacher Dashboard mount: approximately `U + A + classrooms + T + E + M`, followed by two collection listeners whose initial snapshots add `E + M`; changes then caused another dashboard reload.
- Current Teacher Dashboard mount: one deduplicated/cached dataset load; term changes use the cache; no complete-collection listeners. Manual Refresh is the explicit server revalidation point.
- Previous Admin Dashboard: downloaded `M + E + subjects` documents for three integers. Current behavior uses three count aggregations, billed by index entries rather than full document downloads.

Exact billing reduction depends on production collection sizes, active sessions, cache state, and use of the dedicated live page. Firebase Usage should be compared for at least one full school day after deployment.

## Validation and operations

Automated checks:

- `npm.cmd test -- --watchAll=false --runInBand`
- `npm.cmd run build`

The cache has tests for concurrent request deduplication, reuse, forced refresh, and write-through updates. Existing academic-data, identity, medium, marks-access, backup, and basket/ICT tests also pass.

Recommended production checks after deployment:

1. Use Firebase Usage to compare document reads per active user and per hour/day.
2. Exercise admin, teacher, sectional-head, marks-entry, SBA, and live-status roles with real security rules.
3. Confirm Refresh shows changes made by another session immediately; otherwise normal pages may remain up to five minutes behind an external write.
4. Confirm `MarksStatusLive` shows the expected point-in-time status and use route reload when a fresh snapshot is required.
5. Reconcile the review-only rules candidate with exported production rules and validate index deployment in a staging Firebase project before production.

## Deliberately unchanged

- Collection names, persisted aliases, generated mark IDs, permission checks, Material UI, report/PDF/Excel logic, academic calculations, absent representation, and legacy A/L matching are unchanged.
- No production data was queried, deleted, or migrated, and candidate rules/indexes were not deployed.
- React Strict Mode remains enabled; request deduplication addresses duplicate effects without hiding them.
- Broad scans in explicit backup, restore, migration, generation, and data-health tools remain because complete-data processing is their stated purpose.
