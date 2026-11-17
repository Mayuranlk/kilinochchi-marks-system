# Firestore aggregation and broad-read audit - 17 November 2026

## Finding

Query Insights identified the admin Dashboard as the caller of the repeated aggregation scans:

- `src/pages/Dashboard.js` previously called `getCollectionCount(db, "marks")` at line 272 during its mount effect. It matched about 17,861-17,898 index entries and billed about 18 reads per execution.
- The same effect previously called `getCollectionCount(db, "studentSubjectEnrollments")` at line 274. It matched about 10,128-10,131 index entries and billed about 11 reads per execution.
- `getCollectionCount` was implemented by `getCountFromServer(collection(db, collectionName))` in `src/services/firestoreReadCache.js:120`.
- The effect dependency array was stable (`[]`), but every page reload, new tab, fresh browser session, or remount of the admin Dashboard issued the aggregations again. The five-minute cache was memory-only and could not survive those boundaries.

Firestore bills aggregation queries by index entries scanned in batches of up to 1,000. Therefore 17,861 index entries are about 18 billed reads, not 17,861 document reads. The two Query Insights rows explain about 29 reads per Dashboard execution. Larger 10K document-read spikes required the separate broad `getDocs()` / `getCollectionRows()` paths also listed below.

## Before and after

| Affected workflow | Before | After |
| --- | --- | --- |
| Admin Dashboard | Global `marks` and `studentSubjectEnrollments` count aggregations on every mount | One `getDoc(systemStats/overview)` read, cached in `sessionStorage`; no large aggregation runs on mount |
| Summary baseline | Counts were recomputed automatically | Admin explicitly selects **Initialize** or **Repair summary counts**; this is the only runtime path that runs the two full aggregations (`src/services/systemStatsService.js:132-133`) |
| Teacher/admin term mark entry | New records changed `marks` only | The same write batch increments `systemStats/overview.marksCount`; existing mark edits do not change the count (`src/pages/MarksEntry.js:1520`) |
| Bulk mark upload/delete | Loaded all marks before filtering and changed marks without a summary | Reads only the selected academic year and attaches the new/deleted document delta to each batch (`src/pages/BulkMarksUpload.js:1932,2021,2057,2089`) |
| Enrollment generation | Read all historical enrollments and filtered the year in JavaScript | Queries the selected academic year and increments the enrollment document count in the same batch (`src/services/enrollmentGenerator.js:779,855`) |
| Duplicate cleanup | Loaded all marks and enrollments | Queries the selected academic year and decrements the matching summary field in each delete batch (`src/pages/GenerateSubjectEnrollments.js:288-289,363-364`) |
| Student identity repair | Loaded all marks and enrollments | Uses `where("studentId", "in", ...)` chunks for only the selected students (`src/pages/Students.js:1955-1956`) |
| Class/student deletion | Loaded both complete collections before deleting related rows | Uses student-ID equality scopes and updates summary counts in the delete batches (`src/services/classDataService.js:240,253,327-328,368-369`) |
| Result/report pages | Loaded all historical mark/enrollment documents on mount | Load the selected academic year using equality `where()` queries and refresh those rows when the year selector changes |
| Backup/restore | Explicitly reads every configured collection | Remains an intentional admin maintenance scan; restore explicitly rebuilds the summary after completion (`src/services/systemBackupService.js:267`) |

## Repository search result

Runtime Firestore aggregation calls now fall into three categories:

1. `src/pages/Dashboard.js:270,272` contains filtered student-status and teacher-role counts. These are equality-scoped and do not scan `marks` or `studentSubjectEnrollments`.
2. `src/services/firestoreReadCache.js:120` remains a generic helper for small collection totals. No runtime caller now passes `marks` or `studentSubjectEnrollments`.
3. `src/services/systemStatsService.js:132-133` contains the explicit administrator baseline/repair action. It is not called by a mount effect, listener, or render.

The repository has no Cloud Functions source or deployed Functions configuration. The count maintenance is therefore implemented in the existing client write batches. Rules permit administrators to initialize or repair the summary. Teachers may only increase `marksCount` by at most eight, matching the eight-row teacher save batches; they cannot create/delete the summary or change enrollment totals.

No literal runtime call remains that performs `getDocs(collection(db, "marks"))`, `getDocs(collection(db, "studentSubjectEnrollments"))`, `getCollectionRows(db, "marks")`, or `getCollectionRows(db, "studentSubjectEnrollments")`. Full reads remain only in the explicit system backup implementation, where whole-database coverage is the requested operation.

## Cache and rerender behavior

- `src/firebase.js` already initializes Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` in production.
- `systemStats/overview` adds a five-minute per-tab `sessionStorage` cache and concurrent Firestore state remains safe because counters use atomic `increment()` transforms.
- Missing summary metadata is cached for only 15 seconds. It never blocks marks or enrollment writes; if the summary rules are not deployed yet or the document is missing, primary writes continue and an administrator can rebuild the summary later.
- No large count is inside `onSnapshot`. Dashboard loading uses one stable mount effect.

## Deployment order

1. Deploy `firestore.rules.proposed.review` with the `systemStats` rule block.
2. Deploy the application bundle.
3. Open Admin Dashboard and select **Initialize** once. This performs one final aggregation baseline, then ordinary writes maintain the summary incrementally.
4. Use **Repair summary counts** only after an old client session, console edit, restore, or suspected drift.

Deploying the application before the rules is safe: summary permission errors are treated as optional metadata and do not block primary mark/enrollment writes. Counts remain unavailable until the rules are deployed and the administrator initializes the baseline.

## Verification

- Production build: passed.
- Focused Jest: 5 suites, 22 tests passed after the final focused rerun (including three summary-service tests).
- Firestore rules emulator: 14 tests passed, including summary permission boundaries.
- Static audit: no unfiltered literal full reads of `marks` or `studentSubjectEnrollments` remain in normal runtime pages.
