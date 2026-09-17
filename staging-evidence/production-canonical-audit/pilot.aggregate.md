# Canonical Firestore coverage audit

- Generated: 2026-08-08T08:19:36.402Z
- Confirmed project: `kilinochchi-marks`
- Mode: production-read-approved
- Interrupted: no
- Personal data: intentionally excluded

| Collection | Read | Ready | Coverage | Unsafe | Duplicate groups |
| --- | ---: | ---: | ---: | ---: | ---: |
| `students` | 1 | 0 | 0% | 1 | 0 |
| `studentSubjectEnrollments` | 1 | 0 | 0% | 1 | 0 |
| `marks` | 1 | 0 | 0% | 1 | 0 |
| `classrooms` | 1 | 0 | 0% | 1 | 0 |
| `subjects` | 1 | 0 | 0% | 1 | 0 |
| `academicTerms` | 1 | 0 | 0% | 1 | 0 |
| `teacherAssignments` | 1 | 0 | 0% | 1 | 0 |
| `classTeacherAssignments` | 1 | 0 | 0% | 1 | 0 |

## students

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; gradeNumber: 1; classKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: gradeNumber: 1; classKey: 1
- Unresolved references: None
- Ambiguous normalization: None
- Unsafe reasons: canonical_fields_incomplete: 1

## studentSubjectEnrollments

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; gradeNumber: 1; classKey: 1; subjectKey: 1; enrollmentKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 1; gradeNumber: 1; classKey: 1; subjectKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: subjectId: 1
- Ambiguous normalization: classKey: 1; subjectKey: 1
- Unsafe reasons: ambiguous_normalization: 1; unresolved_subject_reference: 1; canonical_fields_incomplete: 1

## marks

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; termKey: 1; gradeNumber: 1; classKey: 1; subjectKey: 1; assessmentKey: 1; markKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 1; termKey: 1; gradeNumber: 1; classKey: 1; subjectKey: 1; assessmentKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: studentId: 1; subjectId: 1
- Ambiguous normalization: classKey: 1; subjectKey: 1
- Unsafe reasons: ambiguous_normalization: 1; unresolved_student_reference: 1; unresolved_subject_reference: 1; canonical_fields_incomplete: 1
- Generated/non-logical document IDs: 1 (informational; IDs are not migration targets)
- Invalid numeric marks: 0
- Attendance inconsistencies: 0

## classrooms

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; gradeNumber: 1; classKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 1; gradeNumber: 1; classKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: None
- Ambiguous normalization: classKey: 1
- Unsafe reasons: ambiguous_normalization: 1; canonical_fields_incomplete: 1

## subjects

- Missing canonical fields: schemaVersion: 1; subjectKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: subjectKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: None
- Ambiguous normalization: subjectKey: 1
- Unsafe reasons: ambiguous_normalization: 1; canonical_fields_incomplete: 1

## academicTerms

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; termKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 1; termKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: None
- Ambiguous normalization: None
- Unsafe reasons: canonical_fields_incomplete: 1

## teacherAssignments

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; classKey: 1; subjectKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: gradeNumber: 1; classKey: 1; subjectKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: subjectId: 1
- Ambiguous normalization: classKey: 1; subjectKey: 1
- Unsafe reasons: ambiguous_normalization: 1; unresolved_subject_reference: 1; incomplete_logical_identity: 1; canonical_fields_incomplete: 1

## classTeacherAssignments

- Missing canonical fields: schemaVersion: 1; academicYearKey: 1; classKey: 1
- Coverage states: canonicalReady: 0; partiallyCanonical: 0; legacyOnly: 1; malformed: 0
- Null canonical fields: None
- Blank canonical fields: None
- Invalid field types: None
- Conflicting canonical fields: None
- Mixed field types: None
- Legacy alias usage: academicYearKey: 1; gradeNumber: 1; classKey: 1; markKey: 1; enrollmentKey: 1
- Unresolved references: None
- Ambiguous normalization: classKey: 1
- Unsafe reasons: ambiguous_normalization: 1; canonical_fields_incomplete: 1
