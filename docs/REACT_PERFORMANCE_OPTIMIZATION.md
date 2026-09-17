# React Performance Optimization

## Scope and safety

This phase changed frontend rendering and loading behavior only. It did not change Firestore Rules, indexes, queries, persisted fields, generated mark IDs, academic calculations, permissions, reports, exports, routes, or production data. All browser measurements used synthetic data in the local Authentication and Firestore emulators.

## Measured baseline

The production build and a Chromium browser run were measured before the application changes. The scaled fixture contained 500 students, 500 subject enrollments, 500 marks, eight synthetic users, and 24 supporting documents (1,524 Firestore documents total).

| Measurement | Baseline |
| --- | ---: |
| Authenticated shell usable | 2,372 ms |
| Students navigation and 500 rows visible | 1,542 ms |
| Student search reduced to one row | 139 ms |
| Subject Analysis client navigation | 451 ms |
| Loaded script transfer | 2,218,077 bytes |
| Long tasks | 5 / 1,149 ms total |
| Main production bundle (gzip) | 329.44 kB |

The scaled Students page produced 15,968 DOM nodes for 500 rows. This was the clearest remaining large-list rendering constraint at the end of this phase. Database pagination, UI pagination, and virtualization were intentionally not enabled during this phase; the later controlled comparison and client-side pagination decision are recorded in `docs/STUDENTS_LARGE_LIST_RENDERING.md`.

## Evidence-backed changes

### Loading architecture

- Removed the duplicate `CssBaseline` mounted in `src/index.js`; the themed baseline in `App.js` remains authoritative.
- Kept the full-screen startup state for unresolved Authentication, but changed lazy route loading to a workspace-sized loading state. Navigation no longer replaces the visible application shell with a full-viewport “Preparing your workspace” screen.
- Kept the existing skeleton, progress, accessibility status, and error-boundary behavior.

### Navigation shell

- Stabilized the admin navigation definition with `useMemo`.
- Memoized flattened searchable navigation items and active-route resolution.
- This prevents drawer, search, profile-menu, online-status, and color-mode state updates from repeatedly rebuilding and sorting the complete navigation model.

### Students page

- Memoized search and class/status filtering so unrelated dialog/form state no longer rescans every student.
- Consolidated Active and Left totals into one memoized pass instead of two collection scans on every render.
- Memoized the quick-stat model.
- Stabilized data reload and row action callbacks.
- Extracted desktop student rows into a deliberately targeted `React.memo` boundary. Editing form fields, opening dialogs, and showing notifications no longer reconcile every unchanged row. All 500 rows, fields, chips, and actions remain present.
- A trial using `useDeferredValue` was measured and removed because it increased end-to-end search completion time in this table; it is not part of the final implementation.

### Dashboard and subject list calculations

- Teacher Dashboard now computes assigned-class, completed-subject, and pending-subject totals in one memoized pass and reuses the result in mobile and desktop sections.
- Students by Subject now computes average, pass, and fail totals in one memoized pass instead of three repeated scans.
- No grading threshold or average calculation was changed.

## Post-change emulator evidence

Two post-change scaled runs completed. Browser timings naturally vary, so these figures are evidence of regression safety and direction, not a production-network SLA.

| Measurement | Post-change observed |
| --- | ---: |
| Authenticated shell usable | 2,392–2,407 ms |
| Students navigation and 500 rows visible | 1,530–1,604 ms |
| Student search reduced to one row | 141–225 ms |
| Subject Analysis client navigation | 133–154 ms |
| Edit-dialog input workflow | 422 ms in the instrumented run |
| Loaded script transfer | 2,218,463–2,218,668 bytes |
| Main production bundle (gzip) | 329.50 kB |

Startup and Students first-render values are within normal single-machine variance and were not represented as improvements. The changes primarily remove repeated work after the page is mounted and improve the lazy-route loading experience. The Subject Analysis route was consistently faster in both post-change runs, but staging measurements should confirm the effect under real network conditions.

## Regression harness

- `APP_EMULATOR_STUDENT_COUNT` scales synthetic students, enrollments, and marks from 2 through 1,000 without using production data.
- `PLAYWRIGHT_TEST_MATCH=react-performance.spec.cjs` selects the performance workflow.
- `e2e/react-performance.spec.cjs` covers authenticated shell readiness, 500-row Students rendering, edit-dialog input, search, Subject Analysis navigation, script transfer, long tasks, DOM size, and heap telemetry.
- `playwright.emulator.config.cjs` has a 15-second action timeout so selector regressions fail quickly instead of consuming the full suite timeout.

Example PowerShell command:

```powershell
$env:APP_EMULATOR_STUDENT_COUNT='500'
$env:PLAYWRIGHT_TEST_MATCH='react-performance.spec.cjs'
npm.cmd run test:app-emulator
```

The Firebase CLI may require `XDG_CONFIG_HOME` to point to a writable temporary directory in restricted environments. This affects only CLI update metadata, not emulator data or application configuration.

## Remaining controlled opportunities

- The initial application chunk remains approximately 329.5 kB gzip and is dominated by React, Material UI, routing, Firebase, the authenticated Layout, and theme code. PDF, canvas, ZIP, and spreadsheet libraries are already route-split. Moving the authenticated Layout out of the initial chunk could make login lighter but can delay the post-login shell; it was not changed without a network-profile win.
- The later approved Students large-list phase compared the full-render control, viewport virtualization, and client-side UI pagination. It selected client-side pagination while retaining the complete local dataset for search, filtering, statistics, printing, export, and administrative actions. See `docs/STUDENTS_LARGE_LIST_RENDERING.md` for the measurements and parity checks.
- Production Web Vitals and Vercel asset/network telemetry are not available from the local emulator. Staging should capture LCP, INP, long tasks, route transition duration, and JS heap on representative school hardware before further bundle or table architecture changes.

The subsequent controlled comparison and selected client-side pagination architecture are documented in `docs/STUDENTS_LARGE_LIST_RENDERING.md`.

## Verification boundary

No production service was contacted or modified. The proposed Rules SHA-256 remained:

`EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`
