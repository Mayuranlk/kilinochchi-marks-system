# Production Canonical Data Read-Only Audit — 2026-08-08

## Decision

**NOT READY — production canonical audit incomplete due sustained read-quota responses.**

Do not approve an additive production backfill from this evidence. Canonical-only reads, cursor pagination, summaries, deterministic Mark IDs, migrations, and repair tooling remain disabled.

## Safety and identity evidence

- Project: `kilinochchi-marks`
- Project number: `499271151802`
- Database: `(default)`
- Region: `asia-southeast1`
- Branch: `main`
- Commit at audit start: `306de76293fb39a928255a47382ca8710cd230ef`
- Active Rules SHA-256: `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`
- Production writes: 0
- Auth changes: 0
- Deployments: 0
- Migrations or repairs: 0
- `.firebaserc`: absent

The required Phase 2 local gates, audit-tool tests, and Rules review validator passed before production reads. The remote adapter exposed only Firestore read and aggregation methods.

## Exact production counts and scan completion

| Collection | Production count | Audited | Remaining | Status |
| --- | ---: | ---: | ---: | --- |
| Students | 941 | 941 | 0 | Complete |
| Student Subject Enrollments | 10,125 | 10,125 | 0 | Complete |
| Marks | 16,616 | 9,025 | 7,591 | Partial (54.3%) |
| Classrooms | 39 | 0 | 39 | Not scanned |
| Subjects | 68 | 0 | 68 | Not scanned |
| Academic Terms | 2 | 0 | 2 | Not scanned |
| Teacher Assignments | 718 | 0 | 718 | Not scanned |
| **Total** | **28,509** | **20,091** | **8,418** | **Partial** |

The complete-scan checkpoint contains 20,091 documents. A separate seven-document pilot and one single-document connectivity probe were also read; they are not added to coverage denominators.

## Canonical coverage findings

| Collection | Audit status | Canonical-ready | Partially canonical | Legacy-only | Malformed | Unsafe for automatic backfill |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Students | Complete | 0 | 0 | 941 | 0 | 941 |
| Student Subject Enrollments | Complete | 0 | 0 | 10,125 | 0 | 10,125 |
| Marks | Partial | 0 | 0 | 9,025 | 0 | 9,025 |

Exact completed-collection conclusions:

- All 941 Students lack `schemaVersion`, `academicYearKey`, `gradeNumber`, and `classKey`.
- All 10,125 Student Subject Enrollments lack `schemaVersion`, `academicYearKey`, `gradeNumber`, `classKey`, `subjectKey`, and `enrollmentKey`.
- No malformed canonical fields or duplicate canonical identities were observed in those completed scans.

Partial Marks evidence:

- All 9,025 audited Marks lack `schemaVersion`, `academicYearKey`, `termKey`, `gradeNumber`, `classKey`, `subjectKey`, `assessmentKey`, and `markKey`.
- No malformed canonical fields, duplicate canonical identities, invalid numeric Marks, or attendance inconsistencies were observed in the audited subset.
- This subset result must not be extrapolated to the 7,591 unread Marks.

## Classification definitions

- **Canonical-ready:** every source-derived required canonical field is present and valid.
- **Partially canonical:** at least one but not all required canonical fields are present.
- **Legacy-only:** none of the required canonical fields are present.
- **Malformed:** a canonical field is null, blank, invalidly typed, or conflicts with its derivable legacy value.
- **Unsafe for automatic backfill:** at least one incomplete, malformed, ambiguous, unresolved-reference, or duplicate-logical-identity reason exists.

## Limitation and stop condition

The production API returned sustained HTTP 429 responses after bounded retries and cooldown. The audit stopped without mutation. Because supporting reference collections were not scanned, unresolved-reference checks cannot yet be trusted. Production-wide duplicate, ambiguity, and unsafe-backfill totals are also incomplete.

The resumable per-document checkpoint remains in the operator's temporary directory and must not be committed. Repository evidence is aggregate-only and contains no student names, admission numbers, contact details, Marks, emails, or raw production document bodies.

## Required next gate

After the read quota resets:

1. Resume from the saved cursor and read only the remaining 8,418 documents.
2. Reconcile every audited collection total to the exact aggregate count.
3. Regenerate aggregate-only duplicate, ambiguity, reference, malformed, and unsafe totals.
4. Require an approved exception plan for every unsafe or ambiguous record before considering separate backfill authorization.
5. Keep all production migration and feature activation gates closed until the complete audit is reviewed.

## Resume attempt — 2026-08-08T08:39:30Z

**READ QUOTA AVAILABILITY NOT CONFIRMED.** The resume safety gate reverified:

- project `kilinochchi-marks`, project number `499271151802`;
- database `(default)` in `asia-southeast1`;
- active Rules SHA-256 `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`;
- Students checkpoint 941 complete;
- Student Subject Enrollments checkpoint 10,125 complete;
- Marks checkpoint 9,025 incomplete with a saved cursor;
- local audit tests 16/16 passed;
- activation guards and Rules review validator passed;
- `.firebaserc` absent.

Exactly one read-only Marks query was attempted after the saved cursor, with its request retry limit set to one. It returned no document and terminated with a transport-level Firestore request failure before a successful response was available. No second probe was made. The checkpoint counters and cursor remained unchanged; its post-probe SHA-256 was `91CCA3F4AB9D7BC6914C2FA0C46DE6FEB698999D6009167C92F6E2EB7CCC10B8`.

Resume safety totals:

- successful production document reads returned: 0;
- failed read-only query attempts: 1;
- production writes: 0;
- Auth changes: 0;
- Rules deployments: 0;
- index deployments: 0;
- other Firebase deployments: 0;
- migrations: 0;
- feature activations: 0;
- personal data committed: no;
- checkpoint preserved: yes.

**Decision: NOT READY — PRODUCTION CANONICAL AUDIT STILL INCOMPLETE.**
