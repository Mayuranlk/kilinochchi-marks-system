# Text Book Request Report

## Purpose

`/text-book-request` calculates current textbook quantities from existing school data. It supports whole-school, grade, and class/division views with actual medium and stream filters. `Books Required` equals the unique active students enrolled in each subject; no buffer is added.

## Data and counting policies

- Sources: `students`, `studentSubjectEnrollments`, `subjects`, and `classrooms` only.
- Active students: `status` is absent or normalizes to `active`; explicit inactive/other statuses are excluded. An explicit student year must match the selected academic year. Students must resolve to an actual classroom for that year.
- Gender: `gender` is used with `sex` as a compatibility fallback. Male values are `male`, `m`, or `boy`; female values are `female`, `f`, or `girl`; every other value is reported as Unknown / Unspecified.
- Active enrollments: `status` is absent or normalizes to `active`; an explicit enrollment year must match. The student must be active and in the resolved class. Explicit grade, medium, stream, and class values must not conflict with the student/class.
- Subject identity: subject ID is preferred with subject-name compatibility fallback. Existing subject order fields/subject numbers and source definition order are preserved.
- Duplicate enrollment documents cannot increase counts because each class/subject aggregate stores student IDs in a `Set`.
- Religion, aesthetic, optional, basket, A/L stream, and general subjects are not inferred or hardcoded. Only actual active enrollments count.

## Reports and exports

- Whole school: gender totals, grade breakdown, and school-wide subject requirements.
- Grade: gender totals, division breakdown, and subject requirements with division columns.
- Class/division: gender totals and subject/student/book counts.
- PDF: generated from the already-computed report, with readable summary, breakdown, and subject tables.
- Excel: `Summary`, `Subject Requirements`, and `Division Breakdown` sheets.
- PDF and Excel generate zero Firestore reads.

## Database and performance strategy

The page uses `getCollectionRows()` and the existing five-minute shared cache/request deduplication. The four collections are loaded once in parallel. A memoized O(S + E) index builds student/class maps and class/subject student-ID sets. Filter changes project from that local index and do not refetch data. Refresh is explicit. No listeners, N+1 queries, derived-data writes, canonical-only queries, or new collections are used.

## Access and legacy compatibility

The route uses the existing `ReportAccessRoute`, so Admin and IT/report-capable accounts can access it. It does not widen Firestore Rules. Legacy year, class, medium, stream, gender, and subject-name fields are supported alongside additive canonical fields. Unresolved legacy students are excluded rather than assigned to a guessed class; data-health review is appropriate if counts appear lower than the active-student roster.
