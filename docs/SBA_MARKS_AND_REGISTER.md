# SBA marks and A3 register

SBA final marks are out of 20. The existing `/sba` and `/teacher/sba` blank five-assessment worksheet remains unchanged in purpose. No conversion from that worksheet is performed.

## Routes and workflow

- Admin: `/sba-marks`, `/sba-register`.
- Subject teachers: `/teacher/sba-marks`, `/teacher/sba-register`.
- Use the existing term/year, class, teacher subject assignments and active subject enrollments. Medium and A/L stream are respected. Each student has one final mark per subject and academic term.
- Enter 0–20 (including decimals), blank for pending, or Absent. Enter advances to the next enabled input. Admins can delete individual SBA results using a confirmation dialog.
- Admins manage independent SBA entry enabled/deadline controls. Deadlines end at midnight in Sri Lanka. Admin access remains available when teacher entry is closed.
- The register combines subjects for the selected assigned class. It uses English headings and vertical English subject labels (original name for unmapped subjects), 35 rows, subject teachers and signatures. More than 35 students or 22 subject columns create additional pages. Print / Save A3 PDF opens the browser print dialog. Use A3 landscape with browser headers/footers disabled.

## Storage boundary

`src/services/sbaService.js` exclusively owns SBA writes to `sbaMarks`. It never reads, modifies, deletes or invalidates the `marks` collection. Entry controls live at `systemSettings/sbaEntry`, independent of `systemSettings/marksEntry`.

The deterministic document ID is `termDocumentId~studentId~subjectId`. IDs containing `~` or `/` are rejected. Documents store scope (term ID, year and grade/section/stream class key), assignment/enrollment references, mark, absence, maximum 20, updater, timestamp and revision. No legacy term/practice mark migration is required. Teacher reassignment does not create another result ID.

Base assignments, terms, students and enrollments reuse the existing five-minute collection cache. SBA results use a single-field `scopeKey` query for the selected class and term, so no new composite index is required. Changing subject within that class reuses the scoped result. Refresh explicitly reloads base data, controls and results.

Saves update only changed students. Each transaction checks the saved revision and SBA controls before writing. At most four transactions run concurrently. Conflicts do not overwrite another session's marks, and partial failures retain unsaved rows. Successful results update local state without rescanning collections. Offline transactions fail and leave edits available.

Selectors lock while edits are unsaved; discard is explicit. Browser unload, layout navigation and logout warn about unsaved changes. The app uses BrowserRouter: browser Back/Forward navigation is not blocked by these layout guards, so save before using browser history.

## Rules and release

The SBA rules are in `firestore.rules.proposed.review`, used by the local emulator and the explicit production review config. They enforce mark range/absence, immutable identity, revision increments, real assignment/enrollment/year/class/medium matching, SBA deadlines and admin-only deletion. Academic roles can read SBA results, matching the existing academic-read policy; account/prefect/anonymous sessions cannot. Admin restore can preserve historical records and timestamps.

The reviewed SBA rules were deployed with explicit user approval to `kilinochchi-marks` on November 4, 2026. The normal `firebase.json` remains hosting-only. No production records were changed or migrated. Freshly retrieved live rules were verified byte-for-byte against the reviewed candidate; removing the added SBA block reproduces the previous live rules exactly. Term-mark permissions remain unchanged.

Release: `projects/kilinochchi-marks/rulesets/122e3e21-60d8-47a8-bd07-6092386149f0`. SHA256: `5d7b2a7b49bd18336f067801909abc4d90053d7d920daa8c0e95b5bb851adcab`. Deployment log, before/after rules, metadata and rollback config are in `audit-output/sba-release/`.

Assignments and enrollments need valid subject IDs and grade/section fields (plus A/L stream where applicable). Legacy records without these fields must be corrected in existing setup tools; subjects are not guessed. The roster uses current active student records and year-specific enrollments, so it does not reconstruct past placements after student promotion or deletion.

`sbaMarks` is included in system backups. Term deletion/cleanup services do not include it. A full system restore intentionally includes both independent collections.

## Verification

- `src/utils/sbaLogic.test.js`: range, absence, scope, medium, stream, duplicate enrollments, deadline, register and pagination.
- `src/services/sbaService.test.js`: isolated paths, revision conflicts, controls, deletion and partial failures.
- `src/pages/SBAMarks.test.js`: failed-read guards, dirty edits, failed saves and closed entry.
- `scripts/tests/firestoreRulesEmulator.test.cjs`: server-enforced SBA permissions and unchanged term marks.
- `e2e/sba-emulator.spec.cjs`: synthetic teacher save/reload, invalid values, conflict, zero/absence, responsive layout, A3 PDF, closed entry and admin deletion.

Run browser verification with `APP_EMULATOR_STUDENT_COUNT=36`, `PLAYWRIGHT_TEST_MATCH=sba-emulator.spec.cjs` and the existing `test:app-emulator` workflow. If Playwright's bundled browser is unavailable, set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome. All browser data stays in the `demo-kilinochchi-rules` project on loopback emulators.

### Verified November 3–4, 2026

- All 24 targeted tests passed across six suites (SBA logic, service, page, backup, navigation and layout).
- All 12 Firestore emulator tests passed, including the SBA permission and term-isolation assertions.
- Both Chrome end-to-end tests passed against the final emulator build, including the mobile entry table without horizontal scrolling and admin SBA deletion with unchanged term documents.
- The normal production build compiled successfully and replaced the emulator-configured `build/` output. No hosting or rules deployment was performed during initial implementation verification; the subsequent approved rules release is recorded above.
- The 36-student, 22-subject export produced two A3 landscape pages. PDF inspection confirmed the full long student name and final student were retained, with no text blocks outside page boundaries.
- Synthetic preview: `audit-output/sba/register-22-subjects.pdf`. Browser evidence and screenshots are in `audit-output/sba/`; no production records were used.

## English PDF, sharing and optional term prerequisite (November 5, 2026)

The register preview, print headings, signatures and known subject labels are English. Names are preserved as recorded. Grey cells mean no matching active subject enrollment; white blank cells mean pending marks; AB means absent. The legend appears above the preview and on exported pages.

Share PDF and WhatsApp prepare an A3 landscape PDF locally using the existing jsPDF libraries. The download contains selectable English text, 35 student rows and up to 22 subjects per page. A second explicit Share PDF file click preserves browser user activation. File sharing uses the device share menu; WhatsApp cannot be selected automatically. Unsupported browsers offer Download PDF and Open WhatsApp for manual document attachment. No document is uploaded or sent automatically.

Admin Dashboard > teacher marks access > **Require completed SBA before term marks** > **Save Access** controls `systemSettings/marksEntry.requireSbaCompletion`, default false. For teachers, the main term entry screen checks the whole current active roster for the selected academic term ID, class/stream, subject and teaching medium. Zero and Absent count as completed; blank or missing results do not. It listens for SBA changes and checks saved server data again before saving. The warning links to SBA marks entry. Admins and practice assessments are exempt. Turning the requirement off restores the existing entry/deadline behavior.

SBA data remains exclusively in `sbaMarks`. Term documents contain only a new `academicTermId` reference for prerequisite lookup, never an SBA mark or a combined score. The term write reads SBA completion without modifying it. Deleting or clearing SBA relocks entry when the requirement is enabled, without deleting existing term marks.

Database enforcement boundary: the prepared Firestore rule checks the matching student's saved SBA for each term-mark write. Whole-roster completion is checked by the application; Firestore rules cannot query arbitrary class rosters. This is not a server-certified whole-class completion workflow. Term writes use batches of eight to stay within rule document-access limits; successfully committed rows are retained if a later batch fails.

The optional term prerequisite rules were released with explicit user approval on November 5, 2026. No production setting was enabled by this implementation.

### November 5 verification and release status

- 26 focused application tests passed (including four live-gate lifecycle tests).
- All 13 database-rule emulator tests passed.
- The two SBA entry/PDF browser workflows passed. The additional admin-gate workflow passed after correcting its transient-message assertion and adding the missing grade to the synthetic practice fixture. It verified a 36-student term save, SBA deletion relocking, practice exemption and disabling the requirement.
- Both emulator and production builds compiled successfully. The normal `build/` was refreshed from the verified production build; no emulator configuration is present in it.
- `audit-output/sba/english-share-register.pdf`: two A3 landscape pages, 22 subjects, full long student name retained, all text inside the page. This synthetic PDF was visually inspected.
- Candidate rules SHA256: `db9e64b3096d22cca2d81394d5e0b11de0940bdf924ee6cae607e3b8c71d3d34`.
- Initial production deployment was blocked pending explicit approval. The user then approved the release, and deployment succeeded on November 5, 2026. The retrieved live rules match the tested candidate byte-for-byte. Release: `projects/kilinochchi-marks/rulesets/baa205ad-248b-49ea-b2fb-337ed35ba376`. No production marks or admin setting values were changed. Hosting was not deployed.
- Exact pre-release rules and rollback configuration: `audit-output/sba-release/before-gate.rules`, `before-gate.json`, `gate-rollback.json`.
