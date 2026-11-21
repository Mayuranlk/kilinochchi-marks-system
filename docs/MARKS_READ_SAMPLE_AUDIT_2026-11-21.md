# Marks-entry read reduction: bounded production sample — 21 November 2026

The user authorized a read-only sample of `kilinochchi-marks`. The audit used the existing capped canonical-coverage tool and read 250 `studentSubjectEnrollments` and 250 `teacherAssignments` documents, ordered by document ID. Both collections were incomplete at the cap, so this is not a representative or full coverage audit. Document IDs and personal data are excluded here.

| Collection | Sampled | Canonical-ready | Legacy-only | Collection fully scanned |
| --- | ---: | ---: | ---: | --- |
| studentSubjectEnrollments | 250 | 0 | 250 | No |
| teacherAssignments | 250 | 0 | 250 | No |

All sampled enrollments lacked schemaVersion, academicYearKey, gradeNumber, classKey, subjectKey and enrollmentKey. All sampled assignments lacked schemaVersion, academicYearKey, classKey and subjectKey. The sampled enrollment rows used a string `academicYear`, numeric `grade`, and string `section`; none had a `year` alias. These observations do not describe unscanned documents.

The sample-only dry-run planner identified 250 additive enrollment patches within the sample and no duplicate identities *within that sample*. It cannot detect duplicates in unscanned records, validate concurrent changes, or justify production writes. The planner has no apply mode and now marks incomplete source collections explicitly. The detailed checkpoint and plan under ignored `audit-output/` can contain document identifiers and must not be published.

The current enrollment generator already attaches canonical enrollment fields to its newly generated full payloads; this does not establish that every write, restore, promotion, or legacy update path maintains those fields. Inactive/completed updates change status without rewriting legacy metadata. Existing deployments and old browser clients may still create legacy-shaped data.

Do not switch the roster to canonical-only reads based on this sample: it would omit sampled records. Before any production backfill, use a complete, bounded and resumable audit with an agreed read budget, verify duplicate and identity consistency across the entire relevant scope, review all writers and indexes, prepare preconditioned/idempotent writes and a rollback, and separately approve a concrete migration. After migration, verify complete coverage and compare both result sets before using canonical queries. The 36-student emulator measurement observed 36 enrollment, 36 student and 36 term-mark query results; canonicalizing alone does not eliminate those required document reads. It can reduce compatibility-query overhead and duplicate results, but savings require measurement.

## Continuation — capped at 500 per collection

The next approved read-only batch resumed from the checkpoint, adding 250 enrollment reads and 250 assignment reads. The cumulative sample is 500 of each; both remain incomplete. All sampled rows still lack the canonical fields listed above. The enrollment dry run proposes 500 additive patches and detects no duplicates within the sample; it cannot evaluate duplicates against unscanned documents and must not be applied as a migration.

A Cloud Monitoring quota query returned no matching Firestore quota time series, so current remaining daily quota could not be established automatically. No larger batches were started without a reliable quota reading. Check the Cloud Console daily read-operations quota before continuing.
