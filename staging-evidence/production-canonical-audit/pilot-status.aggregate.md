# Canonical Firestore coverage audit

- Generated: 2026-08-08T08:19:23.239Z
- Confirmed project: `kilinochchi-marks`
- Mode: production-read-approved
- Interrupted: no
- Personal data: intentionally excluded

| Collection | Read | Ready | Coverage | Unsafe | Duplicate groups |
| --- | ---: | ---: | ---: | ---: | ---: |
| `students` | 1 | 0 | 0% | 1 | 0 |

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
