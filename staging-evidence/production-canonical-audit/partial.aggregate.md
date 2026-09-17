# Canonical Firestore coverage audit

- Generated: 2026-08-08T08:27:23.647Z
- Confirmed project: `kilinochchi-marks`
- Mode: offline-summary-of-temporary-production-read-checkpoint
- Interrupted: yes
- Personal data: intentionally excluded

| Collection | Read | Ready | Coverage | Unsafe | Duplicate groups |
| --- | ---: | ---: | ---: | ---: | ---: |
| `students` | 941 | 0 | 0% | 941 | 0 |
| `studentSubjectEnrollments` | 10125 | 0 | 0% | 10125 | 0 |
| `marks` | 9025 | 0 | 0% | 9025 | 0 |

## students

- Missing canonical fields: schemaVersion: 941; academicYearKey: 941; gradeNumber: 941; classKey: 941
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 941; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: gradeNumber: 941; classKey: 941
- Unresolved references: None
- Ambiguous normalization: None
- Unsafe reasons: canonical_fields_incomplete: 941

## studentSubjectEnrollments

- Missing canonical fields: schemaVersion: 10125; academicYearKey: 10125; gradeNumber: 10125; classKey: 10125; subjectKey: 10125; enrollmentKey: 10125
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 10125; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 10125; gradeNumber: 10125; classKey: 10125; subjectKey: 10125; markKey: 10125; enrollmentKey: 10125
- Unresolved references: None
- Ambiguous normalization: None
- Unsafe reasons: canonical_fields_incomplete: 10125

## marks

- Missing canonical fields: schemaVersion: 9025; academicYearKey: 9025; termKey: 9025; gradeNumber: 9025; classKey: 9025; subjectKey: 9025; assessmentKey: 9025; markKey: 9025
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 9025; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 9025; termKey: 9025; gradeNumber: 9025; classKey: 9025; subjectKey: 9025; assessmentKey: 7534; markKey: 9025; enrollmentKey: 9025
- Unresolved references: None
- Ambiguous normalization: None
- Unsafe reasons: canonical_fields_incomplete: 9025
- Generated/non-logical document IDs: 9025 (informational; IDs are not migration targets)
- Invalid numeric marks: 0
- Attendance inconsistencies: 0
