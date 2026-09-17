# Scoped query and pagination rollout

`src/services/firestoreScopedRepository.js` contains the planned canonical queries. It is not imported by production pages and is disabled unless:

```text
REACT_APP_ENABLE_CANONICAL_SCOPED_READS=true
```

Setting that variable alone is not approval to activate the repositories. The application pages must remain on compatibility reads until their readiness gate passes.

## Page-specific gates

| Page | Required reconciled collections | Required output comparison |
| --- | --- | --- |
| Subject Analysis | students, enrollments, marks, subjects, classrooms, terms, assignments | Per-subject student membership, absent counts, mark distribution, averages, ranks |
| Marks Status Live | students, enrollments, marks, classrooms, terms, assignments | Per-class/per-subject completion and missing counts |
| Class Report | students, enrollments, marks, classrooms, terms | Student totals, averages, ranks, grades, absent states |
| Class Marks Reports | students, enrollments, marks, classrooms, terms | Every PDF/Excel cell and ordering |
| Class Completion Report | students, enrollments, marks, classrooms, terms | Completion, missing marks, student identifiers |
| Students By Subject | students, enrollments, marks, terms | Membership and mark status |
| Teacher Mark Sheets | students, enrollments, terms | Roster membership and ordering |

## Cursor design

- Student roster pagination uses canonical year/class/status equality constraints and `orderBy("admissionNo")` with a document snapshot cursor.
- Page size is clamped to 100.
- Cursors are opaque Firestore snapshots, not admission numbers supplied by the browser.
- Filter changes discard the prior cursor.
- A page is not presented as complete until `hasMore` is false.
- PDF/Excel exports must not export only the visible page. They must either traverse all approved cursor pages with progress/cancellation or use a controlled summary/export process.
- Rankings and class-wide calculations cannot run on a single page; they require a reconciled summary or complete scoped result.

## Activation sequence

1. Deploy reviewed indexes in staging.
2. Run Rules emulator tests for each role and exact query.
3. Complete canonical coverage and duplicate gates.
4. Reconcile legacy versus canonical output fixtures.
5. Activate one read-only page in staging.
6. Compare query results and Firebase Usage.
7. Roll back by removing the environment flag if any mismatch appears.
8. Activate production pages individually, never all at once.
