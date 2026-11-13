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
- Composite index definitions for both legacy year field names are included in `firestore.indexes.json`.

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
- Focused Jest suites: 17 tests passed.
- Local Auth/Firestore emulator and Chrome flow: passed with the current reviewed rules.
- The rules suite previously completed with 13 tests passed.

## Deployment and monitoring

Push the application change so Vercel builds the new bundle. Deploy `firestore.indexes.json` through Firebase as a separate Firebase operation; a Vercel deployment does not deploy Firestore indexes. After production deployment, use one controlled teacher session and check the one-hour Firestore graph plus `window.getFirestoreReadDiagnostics()` before inviting all teachers.

The Firebase graph is project-wide, so unrelated admin reports, term-entry scans, data-health audits, console browsing, writes, and deletes can appear in the same interval. A production spike after this release should be correlated with Query Insights or a controlled timestamp before attributing it to SBA.