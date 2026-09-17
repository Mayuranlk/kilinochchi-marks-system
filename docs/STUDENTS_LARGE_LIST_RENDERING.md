# Students Large-List Rendering Decision

## Decision

The Students page now uses client-side Material UI pagination with 50 rows per page by default and options for 25, 50, or 100. Firestore still loads and caches the complete collection exactly as before. Search, filters, statistics, exports, bulk operations, and print preparation continue to operate on the complete locally loaded or complete filtered dataset.

Viewport virtualization was measured but not selected. It mounted fewer nodes, but the real desktop rows and mobile cards have variable heights, offscreen semantic rows would be absent from the accessibility tree, and focus behavior becomes less predictable when an action row is unmounted. Pagination retained native table/card semantics and delivered most of the measured gain without adding a dependency.

## Comparison method

All three modes used the same production Students code, Firestore cache path, sort order, row component, action handlers, and synthetic emulator fixture:

- 500 students;
- 500 subject enrollments;
- 500 marks;
- eight synthetic users;
- 1,524 emulator-only documents total;
- Chromium at 1440 x 1000;
- production-optimized emulator build.

The virtualization candidate used a 650-pixel viewport, estimated 61-pixel rows, and eight overscan rows. It was removed after the comparison. The control and pagination numbers are directly comparable single runs; browser timing variance still applies.

## Measured results

| Measurement | Full-render control | Pagination candidate | Virtualization candidate | Final pagination |
| --- | ---: | ---: | ---: | ---: |
| Mounted student rows | 500 | 50 | 28 | 50 |
| Students-page DOM nodes | 15,968 | 2,042 | 1,307 | 2,043 |
| Students navigation usable | 2,410 ms | 1,066 ms | 1,119 ms | 989 ms |
| Edit-dialog input | 363 ms | 133 ms | 77 ms | 93 ms |
| Search to one result | 226 ms | 91 ms | 47 ms | 50 ms |
| Long-task total | 1,282 ms | 538 ms | 436 ms | 463 ms |
| JS heap after workflow | 97.4 MB | 33.1 MB | 35.1 MB | 33.1 MB |

Compared with the measured control, the final pagination run reduced Students-page DOM nodes by approximately 87%, route readiness time by approximately 59%, long-task time by approximately 64%, and the observed heap by approximately 66%.

## Preserved behavior

- `students` remains the complete locally loaded collection.
- `filtered` remains the complete search/class/status result and is the source for totals and Identity Fix export.
- Only `renderedStudentRows.rows` is sliced for interactive desktop rows or mobile cards.
- Filtering or searching resets to page one; a synchronous safe-page calculation prevents a transient empty page when result counts shrink.
- Global row numbering is preserved: page two starts at row 51, not row 1.
- Existing Edit and Mark as Left actions receive the original student object and handlers.
- Material UI Dialog focus restoration was verified after closing an Edit dialog.
- Pagination buttons work from the keyboard and retain focus after activation.
- Screen readers receive explicit first/previous/next/last labels and an `aria-live` announcement such as “Showing students 51 to 100 of 500 filtered results.”
- Pagination is shared by desktop rows and mobile cards.
- The Identity Fix Excel export was decoded in the browser test and contained one header plus all 500 filtered student records, even though only 50 were mounted.
- Browser `beforeprint` temporarily renders the complete filtered result; `afterprint` restores the 50-row interactive page. Pagination controls are not part of the print-time dataset.
- No selected-row state or delete handler exists in the current Students page. No row action was removed or renamed.
- No Students-specific PDF export path exists in the current source. Existing Excel generation and all other report/PDF pages were unchanged.

## Files

- `src/pages/Students.js`: client-side pagination, safe page clamping, accessible labels/live status, global row numbering, mobile parity, and print-time full rendering.
- `e2e/react-performance.spec.cjs`: the scaled performance check now asserts 50 mounted interactive rows.
- `e2e/students-pagination.spec.cjs`: desktop/mobile pagination, full-data Excel export, print parity, search across off-page data, keyboard operation, numbering, and focus restoration.

## Safety boundary

This is UI pagination only. It does not use Firestore `limit()`, `startAfter()`, cursors, new queries, new reads, or a second data source. No Firestore Rules, indexes, collection names, persisted fields, generated IDs, academic logic, report calculations, or production data were changed.

No virtualization or data-grid dependency was installed.
