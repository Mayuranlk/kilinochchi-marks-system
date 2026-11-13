# SBA read audit - 13 November 2026

## Result

The SBA teacher path is now class-scoped and the large-fixture regression test passes. With 36 students in the selected class and 2,000 unrelated legacy enrollments for the same subject, a cold SBA page load returned 77 instrumented documents. Before this correction the same test returned 2,072 documents.

The correction keeps SBA in the separate `sbaMarks` collection. It does not read from or write to the term `marks` collection.

## What caused the spike

The previous compatibility path queried `studentSubjectEnrollments` using only `subjectId`. It then removed other years and classes in JavaScript. Firestore bills the documents returned by the query before client-side filtering, so every teacher opening one subject could read enrollment history for many unrelated classes and years.

The production data audit also showed that canonical fields were not yet complete. Enabling canonical-only queries would therefore risk hiding students. The new path uses the existing legacy fields (`academicYear` or `year`, `grade`, `section`, and `subjectId`) and queries their exact values in Firestore. Numeric/string compatibility variants are bounded and merged by document ID.

## Changes

- SBA roster queries are scoped by academic year, grade, section, and subject.
- Each compatibility query has a hard limit of 201 documents. More than 200 produces a clear data-quality error instead of an unbounded scan.
- Student documents are fetched only for enrollment IDs returned by the selected class query.
- Teacher assignments are loaded by the logged-in teacher's UID/email fields instead of scanning every assignment.
- The teacher dashboard reuses those scoped assignment queries and the authenticated profile; it no longer scans all users and assignments on login.
- Teachers see only SBA Marks Entry. A3 Register and Blank Assessment Sheet remain available to administrators, and old teacher URLs redirect to `/teacher/sba-marks`.
- SBA saves read the entry-control document once for the save set instead of once per changed student. Firestore rules still enforce the control on every write.

## System-wide second pass

The later review found that the teacher term-marks page was still loading the complete `marks`, `students`, and `studentSubjectEnrollments` collections when it opened. That page is part of the same teacher workflow and can overlap an SBA session in the project-wide usage graph. It was a separate broad-read source even though SBA records remained isolated correctly.

The following automatic reads are now bounded:

- Term marks entry loads the logged-in teacher's assignments, the selected class roster, and marks for only those student IDs and the selected academic scope.
- SBA blank-sheet generation loads the selected class roster only. The A3 and blank-sheet tools remain admin-only.
- Class reports, sectional-head views, live marks status, and academic-data health checks query their selected grades or academic year. The data-health audit runs only after an administrator selects **Run audit**.
- Compatibility queries use the canonical field first and try legacy field names/types only when the primary query is empty. This prevents every normal page load from paying for every legacy variant.
- Admin deletion loads mark history for the selected student only. It no longer requires loading the whole `marks` collection.

No new mark-query composite indexes are required by this change. The scoped queries contain equality filters, which Firestore can serve by merging its automatic single-field indexes. Avoiding unnecessary indexes also avoids extra index-entry writes on every mark save.

Security-rule dependent reads remain billable. For SBA, they are bounded checks of the authenticated profile, settings, assignment, enrollment, term, and student documents. They can add a small fixed/read-per-row cost, but they cannot explain a 60,000-179,000 read burst from one class. The reviewed rules also do not allow a teacher to delete SBA records; delete activity in the project graph must come from an administrator, maintenance operation, or Firebase console action.

## Emulator evidence

Test: `e2e/sba-read-audit.spec.cjs`

Fixture: 36 selected-class students/enrollments plus 1,000 unrelated same-subject rows in another class and 1,000 in another year. The fixture runs only against project `demo-kilinochchi-rules` and local Auth/Firestore emulators.

| Action | Instrumented documents returned | Transaction document requests |
| --- | ---: | ---: |
| Teacher dashboard | 4 | 0 |
| Open SBA, cumulative from login | 76 | 0 |
| Type two marks | 76 | 0 |
| Save two marks | 76 | 4 |
| Explicit SBA refresh, cumulative | 155 | 4 |
| Direct cold SBA reload | 77 | 4 cumulative from the test |

Typing caused no database query. Saving two changed rows did not reload the roster. The teacher register and blank-sheet routes both redirected to SBA Marks Entry.

The figures above are query-loader diagnostics, not exact billed reads. Firestore also charges minimum reads for empty queries and may charge security-rule dependent document reads. Even with those additions, the request count is bounded by the selected class rather than total enrollment history.

For the tested 36-student shape, 15 simultaneous cold teacher sessions are approximately 1,155 returned documents (15 x 77), compared with about 31,080 on the old 2,072-document path. This is a capacity estimate, not a production billing guarantee.

## Verification

- Production build: passed.
- Focused Jest suites: 4 suites and 17 tests passed.
- Local Auth/Firestore emulator and Chrome flow: passed with the current reviewed rules.
- Firestore rules suite: 13 tests passed.

## Deployment and monitoring

Push the application change so Vercel builds the new bundle. No Firestore schema, collection, or index deployment is needed for this correction. After production deployment, use one controlled teacher session and check the one-hour Firestore graph plus `window.getFirestoreReadDiagnostics()` before inviting all teachers.

The application cannot reverse reads that Firebase has already billed. If the Spark daily quota is already exhausted, saves may remain unavailable until Firebase resets the daily quota; upgrading the billing plan is the other immediate recovery option. The corrected bundle prevents the identified automatic whole-collection scans from repeating after deployment.

The Firebase graph is project-wide, so unrelated admin reports, term-entry scans, data-health audits, console browsing, writes, and deletes can appear in the same interval. A production spike after this release should be correlated with Query Insights or a controlled timestamp before attributing it to SBA.
