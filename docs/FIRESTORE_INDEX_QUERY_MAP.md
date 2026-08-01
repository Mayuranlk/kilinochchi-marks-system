# Firestore index-to-query map

No candidate index is deployed by this repository. `firebase.json` intentionally has no Firestore deployment stanza.

| # | Collection and fields | Exact current/planned query | Source/repository | Active | Backfill | Pagination | Rules dependency | Classification |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `marks`: `academicYearKey ASC, termKey ASC, classKey ASC, assessmentKey ASC, subjectKey ASC` | Planned `queryMarksByScope({academicYearKey, termKey, classKey, assessmentKey, subjectKey})` using equality constraints. | Planned scoped repository; report/analysis consumers | No | Required | No | Academic staff must be allowed for the same scope. | Required after canonical reconciliation; blocked |
| 2 | `marks`: `studentId ASC, academicYearKey DESC, termKey ASC` | Planned student-history query ordered by year/term. Current Report Card only uses `where("studentId", "==", studentId)` and does not require this composite index. | `ReportCard.js`; planned repository | No composite query active | Required for historical ordering | Optional cursor | Student/self or staff scope must match query. | Optional after reconciliation |
| 3 | `studentSubjectEnrollments`: `academicYearKey ASC, classKey ASC, subjectKey ASC, status ASC` | Planned `queryEnrollmentsByScope({academicYearKey, classKey, subjectKey, status})`. | Planned scoped repository; marks/report consumers | No | Required | No | Assignment/class scope must be provable. | Required after canonical reconciliation; blocked |
| 4 | `studentSubjectEnrollments`: `studentId ASC, academicYearKey DESC, status ASC` | Planned student enrollment history. Current Report Card uses only `studentId`. | `ReportCard.js`; planned repository | No composite query active | Required for ordering/status | Optional cursor | Student/staff list scope. | Optional after reconciliation |
| 5 | `students`: `academicYearKey ASC, classKey ASC, status ASC, admissionNo ASC` | Planned class roster query with stable admission-number cursor: equality on year/class/status, `orderBy("admissionNo")`, `limit`, `startAfter`. | Planned roster repository | No | Required | Yes | Rules must require permitted class and maximum limit. | Required for pagination after reconciliation; blocked |
| 6 | `teacherAssignments`: `teacherId ASC, academicYearKey DESC, status ASC` | Planned teacher assignment history/current-scope query. | Planned assignment repository | No | Required | Optional cursor | Teacher may access own assignments; admin broader. | Required after canonical reconciliation; blocked |

## Current scoped queries that do not require these composites

- Report Card: marks and enrollments filtered by `studentId` (single-field indexes).
- Class Shuffle: students filtered by `grade` (single-field index).
- Teacher Assignments: users filtered by `role` (single-field index).
- Enrollment generator: enrollments filtered by `studentId` (single-field index).

## Review result

- None of the six composite indexes is required by an active query today.
- Indexes 1, 3, 5, and 6 map to concrete post-reconciliation repositories.
- Indexes 2 and 4 are optional unless ordered student history is activated.
- No index currently maps to summary documents; singleton/known-ID summary reads do not require a composite index.
- Deployment remains blocked until Rules compatibility, canonical coverage, emulator query tests, and a staging rollout are complete.
