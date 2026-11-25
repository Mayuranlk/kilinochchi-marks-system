# Teacher dashboard query repair: production sample

Status: **investigation in progress; scoped marks and enrollment reads are not ready**.

The read-only audit first resumed the 10-document sample to 100 documents per collection, and then to 250. Later bounded batches completed 1,045 students and 720 teacher assignments and increased the samples to 4,150 enrollments and 3,250 marks. It also has complete reads of 43 classrooms, 68 subjects, and 3 academic terms. This is 9,279 returned documents across all batches, excluding query minimums, aggregation reads and retries. The latest batch stopped on HTTP 429 after returning 900 enrollments; the cursor was saved. The checkpoint is private, ignored by Git, and can be resumed; the marks and enrollment scans are not complete. No production records were changed.

The first 100-record sample found missing canonical fields on 100/100 enrollments, 96/100 marks, and 94/100 students. At 250 records, the corresponding counts are 250/250, 236/250, and 233/250. All 250 teacher assignments lack at least one required canonical field. These are sample counts, not estimates of the whole database. The audit's unresolved-reference counts for marks cannot be interpreted as real missing students because the student sample is incomplete.

`scripts/analyzeDashboardKeyConsistency.js` performs a separate aggregate-only comparison of inferred class and term keys. It compares only rows whose grade and section identify exactly one sampled classroom; multiple matches are excluded. Six of 100 comparable enrollment rows and one of 95 comparable assignment rows had a derived class key different from the classroom's derived key. None of 97 comparable marks had that mismatch. None of 99 comparable marks had a term-key mismatch against the corresponding term. These are diagnostic candidates: a match on grade and section alone does not establish historical class membership or resolve streams. The counts do not prove that other records are consistent.

This matters because adding the current canonical fields to every old document would still leave some queries unable to find records used by the existing compatibility matching. Coverage alone is not a sufficient rollout gate.

The experimental `queryEnrollmentsByScope` previously filtered to `status == "active"`. Its default now retains inactive rows: they can contain explicit `subjectTermIds` needed to show a student's earlier subject after a term change. A future dashboard caller must apply term membership to the returned rows. This repository remains disabled in production until reconciliation. Any marks query must also be reconciled with the existing dashboard's handling of term and assessment variants.

## Follow-up class review

The offline `planDashboardClassReconciliation.js` review uses explicit stream matching for A/L grades and never writes data. In the first sample, the six enrollment candidates from the earlier grade-and-section-only comparison have streams that do not resolve to a current classroom; the earlier comparison did not establish that their class keys were wrong. In the 250-record marks and enrollment samples and the completed assignment scan, the review finds six unresolved enrollment streams, four marks and nine assignments with different inferred class keys, and 12 assignments whose class or stream could not be resolved. These are review candidates only, since current classrooms do not establish a student's historical class. The source collections are incomplete, so this review cannot authorize a backfill.

## Full reference scan and dry run

The complete assignment scan found no derivable academic year on 717 of 720 rows. The planned year-filtered assignment query therefore needs a different, explicitly reconciled design; a year must not be invented from today's term. The reference scan also showed that earlier apparent missing student references in sampled marks were caused by the incomplete student sample; none of the 250 sampled marks has an unresolved student reference against the completed scan.

The experimental assignment repository now omits year and status filters by default, retaining legacy assignments when those fields are absent. An explicit year filter remains available only for callers that have established complete coverage. This repository is still disabled and is not yet used by the dashboard: the current dashboard also supports email matching and class-teacher monitoring, which a teacher-ID-only query does not by itself reproduce. Assignment creation currently models ongoing assignments rather than a confirmed year-specific history, so no year has been invented for existing or newly created assignments.

The local backfill planner now refuses to propose operations from incomplete collections, missing references, ambiguous class mappings, conflicting aliases, or incompatible class or term keys. Its production apply mode remains disabled. A dry run against this checkpoint proposed zero operations and skipped all 1,545 examined students, enrollments, and marks. The scans of marks and enrollments are partial, and all 1,045 students lack a derivable year from the legacy year aliases used by the planner. These are conservative review outcomes, not proof that every record is invalid. No plan has been executed.

## Student-scoped marks candidate

The production count was 18,414 marks and 10,158 enrollments on 25 November 2026. All 3,250 sampled marks and 4,150 sampled enrollment rows have nonblank string student IDs without surrounding whitespace and resolve against the student scan. The student scan found no document IDs with surrounding whitespace or duplicate IDs after trimming. The remaining records have not been checked, and the database can change after a scan. Firestore returned HTTP 429 during the latest bounded batch, so further production reads are paused; the response alone does not establish which quota or rate limit was reached.

Normal marks entry and bulk marks upload now normalize the student ID before writing and reject blank IDs and document paths. This prevents those write paths from introducing numeric or whitespace-padded mark IDs after validation. Backup restore and other privileged writers must still be accounted for before treating the invariant as permanent.

## Immediate dashboard safeguard

The dashboard loads users, assignments, classrooms and terms first, and does not read marks, enrollments, or students on initial open. Teachers can use assignment links immediately and choose **Load progress** to calculate progress and enable class exports. A progress request still reads the full marks and enrollment collections with the production feature flags disabled, so it can be costly and may fail while the Firestore quota is exhausted. Unassigned teachers do not need to request progress. This is an interim reduction, not a complete scoped-query rollout.

On the most recent check, Cloud Monitoring reported 49,993 successful document reads in the current Pacific day and approximately 1.48 million in the preceding 24 hours. Metrics can be delayed and differ from billed or quota usage. The audit received HTTP 429; reaching a quota is plausible but not established by the status alone. The public free-tier daily limit is 50,000 document reads and resets at midnight Pacific time; see [Firestore quotas](https://docs.cloud.google.com/firestore/quotas). No additional production document queries were attempted after the 429.

A candidate dashboard implementation queries marks in batches for students found in relevant enrollment rows. It is disabled unless **both** `REACT_APP_ENABLE_CANONICAL_SCOPED_READS` and `REACT_APP_TEACHER_DASHBOARD_STUDENT_MARKS_SCOPED` are explicitly set to `true`. It still reads all enrollments. Class report exports intentionally load complete marks and student collections. Unit tests compare dashboard progress for a synthetic subject teacher and class teacher, including an Art-to-Music change between terms. A browser test passed with the candidate enabled against synthetic Firebase Auth and Firestore emulators and the repository's emulator Rules, showing the seeded teacher's 2/2 progress and checking that the Excel export contains both students and their marks. These tests do not establish production equivalence or verify deployed Rules.

Before enabling this path, complete the ID audit, account for concurrent writes and identity normalization, reconcile selected teacher dashboard results for multiple classes, historical terms and subject changes, and verify Rules and indexes in an emulator and staging. Review export behavior and measure actual read reductions. Do not enable the flags from this sample alone.

## Remaining work

1. Keep the checkpoint private and continue the audit in explicitly bounded increments, recording each increment against the school's available daily reads. Reconcile collection totals and complete supporting reference scans. Do not assume sample reference failures are production defects.
2. Resolve class identity across classrooms, assignments, enrollments, and marks using the dashboard's existing class matching semantics, including historical classes and A/L streams. Review ambiguous and conflicting rows individually; do not silently change a student's class or enrollment.
3. Design an additive, resumable backfill with per-record preconditions, a write budget, a durable checkpoint, and a recovery plan. Revalidate records changed since the scan. The current planner is dry-run only and cannot perform a migration.
4. Verify that current and future write paths preserve the agreed fields. Compare scoped results with existing dashboard results for representative teachers, classes, terms, transfers, and subject changes in the emulator and staging. Verify Rules and required indexes.
5. Enable the scoped dashboard reads only after complete coverage and reconciliation. Measure Firestore reads after rollout. Until then the dashboard's marks and enrollment compatibility scans remain active.

The sample can be reanalyzed without further Firebase reads:

```powershell
node scripts/analyzeDashboardKeyConsistency.js audit-output/teacher-dashboard-sample.checkpoint.json
node scripts/planDashboardClassReconciliation.js audit-output/teacher-dashboard-sample.checkpoint.json
node scripts/analyzeDashboardStudentIds.js audit-output/teacher-dashboard-sample.checkpoint.json
```

The output contains aggregate counts only; the checkpoint must not be committed or shared publicly.
