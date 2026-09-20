# Grade results and attendance review

## Current attendance scope

Attendance is now a printable template only. The page reads the existing students and classrooms, displays blank daily cells, and exports an A4 PDF for manual marking. It does not read or write attendanceRegisters. No attendance database rule or Firebase reauthentication is required. The online attendance implementation described below is historical and has been superseded.

Reviewed against `FIRESTORE_PERFORMANCE.md`, the shared report builder, student-name normalization, admin route guards, backup service, and proposed Firestore rules.

## Corrected

- Attendance could keep the previous register after a failed read and then save it under the newly selected class/month. Editing, saving, and export now require a successful read of the exact selected register.
- Attendance cells remained editable during loading/saving. They now use accessible buttons with loading/save guards. Unsaved edits lock the selectors, offer explicit discard, and trigger a browser unload warning.
- Whole-document attendance saves could overwrite another administrator's changes. Transactions now merge only changed cells and reject conflicting edits to the same cell.
- Class matching could mix A/L streams. Attendance now uses the shared report class matcher, explicit classroom IDs, academic-year aliases, and normalized student names.
- Attendance export titles always showed 2024. They now use the selected year.
- The result report applied O/L qualification to unrelated grades. It is now explicitly a Grade 10/11 term-exam report, retaining the page's existing three-credit/six-pass rule with Tamil and Maths passes.
- Practice marks could replace term marks in the shared builder input. They are excluded from this report.
- A result-building exception called `setState` during rendering. Calculation now returns an error value without side effects.
- Missing results were labelled as failures. A separate incomplete/review state now requires nine recorded results: five core subjects, one religion, and one subject per basket. Explicit absence is a recorded result, not a missing mark.
- Decimal marks between integer grade bands could fall through to W. This report floors valid marks before calling the existing integer-band utility; invalid marks remain blank and require review.
- Classrooms from different years and undated duplicates could duplicate whole-grade rows. Selectors are year-scoped, deduplicate classroom identities, and reset invalid class/term selections. Whole-grade rows also deduplicate by student document ID.
- Summary and filtered-export scopes were ambiguous. PDF/Excel identify the result view, and Excel includes a separate full-class/grade summary.
- Attendance was absent from the system backup list and proposed security rules. Both now include `attendanceRegisters`, with admin-only rule access.

## Operational boundaries

- Existing App, Layout, and PageMeta changes are preserved; both routes remain admin-only.
- Cached complete reads remain intentional, matching the project's compatibility and canonical-migration gates.
- Firestore rules changes are local in `firestore.rules.proposed.review`. They must be included in the normal rules deployment before attendance works against a backend that currently denies this collection. No production rules or data were changed during this review.
- Student records are the available roster source. These pages do not reconstruct historical placements after promotion. Reliable past-year rosters require enrollment/promotion snapshots with an agreed historical roster policy.
- Attendance unsaved-edit protection covers selector changes and browser unload. Internal SPA navigation is not blocked; save before leaving the page.
- PDF generation uses Helvetica. Tamil-script font embedding remains outside this review. The September 19 presentation update visually verified pagination against the supplied English-name PDF.

## Regression coverage

- O/L nine-subject eligibility, absent/missing/zero distinctions, decimal marks, invalid marks, conflicting subject selections, and credit/pass thresholds.
- Attendance transaction merge, same-cell conflicts, invalid statuses, class/year deduplication, A/L stream separation, and leap years.
- Attendance component loading, failed-load save/export protection, unsaved selector locks, and save locks.
- Admin-only attendance access in the Firestore emulator suite.

Validation: the full 18-suite unit run passed 83 tests, and the separate attendance component run passed both additional tests (85 total). All 12 Firestore emulator tests passed, including the new admin-only attendance test. The final calculation regression run passed all 11 tests. Targeted ESLint passed and the final production build compiled successfully. The build still reports the existing outdated Browserslist data notice.

## September 19 presentation redesign

The result page and PDF now use a compact nine-subject schedule: five core subjects plus religion and three baskets. Every recorded elective choice remains visible inside its group, including conflicting choices. No grading, filtering, ordering, total, or eligibility functions changed. Class labels use `10A`/`11A` throughout the page, PDF, and Excel.

PDFs have an overview, a subject abbreviation key, a separate student schedule, follow-up lists, repeated school/term headers, and page counters. Subject labels use schema keys to avoid the previous Drama/Math and technology abbreviation collisions. Colour is limited to status and relevant grade cells rather than entire rows.

The supplied four-page export was reconstructed locally into a readable nine-page preview, preserving its 90 student rows and 34 follow-up entries. Automated PDF inspection found no missing student names or text outside page margins. Desktop and 390px mobile layouts were inspected with isolated synthetic data; neither had document-level horizontal overflow. Preview files are in the ignored `audit-output/grade-result-redesign/` directory; no production records were accessed or modified for this redesign.
