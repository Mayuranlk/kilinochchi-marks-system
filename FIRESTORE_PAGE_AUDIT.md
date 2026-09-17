# Firestore page-by-page architecture audit

## Audit basis

This audit covers all 39 page modules (42,132 lines) and the supporting contexts, components, and services in the supplied repository. The review traced direct Firestore calls, calls routed through services, React effects and callback dependencies, client-side joins and filters, write batching, cache invalidation, listener scope, exports, and legacy compatibility behavior. The complete JavaScript source reviewed is 53,884 lines.

The source workspace has no Git metadata. The original page audit was completed before deployed Rules were supplied; a later manual Console copy is now stored as `firestore.rules.deployed.review`. No production data, rules, or indexes were changed or deployed. Candidate and proposed Rules remain review-only.

Status meanings:

- **Optimized**: ordinary navigation uses scoped or shared cached reads and its writes keep caches coherent.
- **Compatible/gated**: safe improvements are active, but initial full compatible data is still required until canonical-field coverage is verified.
- **Intentional maintenance scan**: the route's explicit purpose requires complete-data inspection; it is not a normal navigation data source.
- **No Firestore data load**: authentication, navigation, or presentation only.

## Every page

| Page | Firestore architecture result | Status |
| --- | --- | --- |
| `AcademicDataHealth.js` | Explicitly scans students, subjects, enrollments, and marks to validate cross-collection integrity. It does not subscribe or write. Broad reads are intrinsic to a manually opened health audit. | Intentional maintenance scan |
| `AcademicTerms.js` | Terms use the shared collection cache. Create, edit, activate, and delete paths invalidate the terms cache. | Optimized |
| `AccountLogin.js` | Firebase Authentication flow only; no Firestore collection load. | No Firestore data load |
| `AdminTeachers.js` | Users, classrooms, and assignment compatibility data use shared/deduplicated reads. Mutations force coherent refresh and invalidate users, classrooms, and assignments. Secondary Auth app behavior is preserved. | Optimized |
| `BulkMarksUpload.js` | Base collections share the cache. A forced marks refresh is retained before compatibility upsert because generated IDs and mixed aliases prevent a safe unique query. Existing marks are indexed by student rather than repeatedly scanning the full array. Saves/deletes invalidate marks. | Compatible/gated |
| `ClassDataManagement.js` | Classroom list is cached. Preview/reset service scans are executed only after an explicit administrative action because deletion safety requires complete related-document discovery. Service writes invalidate every affected collection. | Intentional maintenance scan |
| `ClassReport.js` | Shares students, marks, classrooms, enrollments, and terms with other reports. Existing ranking/calculation and export behavior is unchanged. Canonical coverage is required before class/year/term server scoping can replace the initial compatibility set. | Compatible/gated |
| `ClassroomManagement.js` | Classrooms, users, and teachers share cached reads. Add/edit/delete paths invalidate classrooms. | Optimized |
| `ClassShuffle.js` | Students are queried by grade instead of school-wide. Writes are chunked below Firestore's batch limit, dual-write the canonical student class fields, and invalidate students. Plan and audit-log writes remain explicit. | Optimized |
| `ClassTeacherAssignments.js` | Read-only assignment view reuses cached classrooms and users; filtering is over small metadata collections. | Optimized |
| `ClasswiseStudentList.js` | Students and classrooms share cached reads. Complete student rows remain necessary for current all-class export behavior. | Compatible/gated |
| `Dashboard.js` | Uses cached required rows and server count aggregation for large totals, with a compatibility fallback for deployed rules that reject aggregation. Marks-entry configuration is a singleton document. | Optimized |
| `ElectionCount.js` | One listener targets one election document. Transactional counting and singleton setup are appropriate real-time/atomic operations. | Optimized |
| `ElectionLiveResults.js` | One listener targets one election document; no collection listener exists. | Optimized |
| `ExportFirestoreSamples.js` | Administrative backup/export surface; complete collection traversal is user-initiated through the backup service. | Intentional maintenance scan |
| `GenerateSubjectEnrollments.js` | Generation/rebuild uses explicit complete compatibility datasets because it must reconcile missing, inactive, and duplicate records. Service writes are chunked; cleanup invalidates marks and enrollments. | Intentional maintenance scan |
| `Login.js` | Firebase Authentication flow only; no Firestore collection load. | No Firestore data load |
| `MarksEntry.js` | Shared base data, stable selection effects, local validation, student-indexed mark matching, no broad enrollment/marks listener, no post-save rescan, local/write-through optimistic state, and singleton settings listener. Canonical keys are dual-written while generated IDs remain compatible. | Optimized |
| `MarksStatusLive.js` | Six whole-collection listeners were replaced by one-time shared reads. The page no longer incurs continuing listener billing, but its complete status matrix still needs compatible source rows on first uncached load. | Compatible/gated |
| `MigrateStudentSubjects.js` | Explicit legacy cleanup scan/write. Successful writes invalidate students. It is not used during ordinary navigation. | Intentional maintenance scan |
| `PracticeExams.js` | Exams and subjects share cached reads. Create/edit/delete invalidates exams. | Optimized |
| `PrefectDashboard.js` | Students share the cache; record writes update React state optimistically. Late-arrival history remains an ordered complete query because outstanding legacy book records can be arbitrarily old and no verified canonical status/date migration exists. | Compatible/gated |
| `PrefectLogin.js` | Authentication flow only; no Firestore collection load. | No Firestore data load |
| `ReportCard.js` | Student is read by document ID; marks and enrollments are server-filtered by `studentId`; terms share the cache. This avoids school-wide marks/enrollment downloads for one card. | Optimized |
| `reports/ClassCompletionReport.js` | All inputs share cached/deduplicated reads and Refresh explicitly revalidates. Complete compatibility rows remain necessary for unchanged completion calculations and exports until canonical coverage. | Compatible/gated |
| `reports/ClassMarksReports.js` | All inputs share cached/deduplicated reads and Refresh explicitly revalidates. Existing multi-class exports require complete compatible data. | Compatible/gated |
| `SBAForm.js` | Reuses cached students/enrollments and stable metadata reads. Selector changes filter local compatible data instead of rereading Firestore. | Optimized |
| `SectionalHeadDashboard.js` | Reuses shared cached/deduplicated collections and performs local role-scope calculations without listeners. | Optimized |
| `SetupSchoolDefaults.js` | UI invokes explicit setup/repair services. Subject/student repair writes now invalidate relevant cached collections. Complete scans are restricted to the requested maintenance operation. | Intentional maintenance scan |
| `StudentAccounts.js` | Students and fee accounts share cached reads. Deterministic account document writes invalidate fee accounts before reload. | Optimized |
| `Students.js` | Ordinary students/classroom/subject reads share cache. Add/edit/bulk writes dual-write canonical student keys and invalidate students/enrollments. Only the explicit identity repair tool still scans related enrollments/marks. | Optimized; maintenance scan isolated |
| `StudentsBySubject.js` | Students, enrollments, marks, and terms share cached reads. Existing compatibility matching and exports are unchanged. | Compatible/gated |
| `StudentSubjectEnrollments.js` | Students, subjects, and enrollments share cached reads; maps replace repeated lookup scans. | Compatible/gated |
| `SubjectAnalysis.js` | Seven compatible inputs share cached reads. Marks are indexed by student, reducing the dominant join from all-marks-per-enrollment to marks-per-student. Initial server scoping awaits canonical coverage. | Compatible/gated |
| `SubjectManagement.js` | Subjects share cached reads. Add/edit/status writes invalidate subjects. | Optimized |
| `TeacherAssignments.js` | Teachers are server-filtered by role; subjects, assignments, and classrooms share cache. Create/delete/clear paths invalidate assignments. | Optimized |
| `TeacherDashboard.js` | Base/progress collections share cache; term changes recalculate locally. Broad marks/enrollment listeners are removed. The only listener is the singleton marks-entry setting. | Optimized |
| `TeacherMarkSheets.js` | Students, enrollments, and terms share cache. Manual reload is explicit. Full compatible data is retained for unchanged multi-sheet export behavior. | Compatible/gated |
| `YearEndPromotion.js` | Complete students/classrooms/enrollments are intentionally loaded for a controlled promotion operation. Writes are now split into 400-operation batches, update canonical student class keys, and invalidate students/enrollments. | Intentional maintenance scan |

## Global providers and route architecture

- `App.js` lazy-loads every page. No report or dashboard collection is loaded globally.
- `AuthContext.js` is the only global data provider. It reads one `users/{uid}` document, tries persistent cache first, revalidates in the background, guards against stale auth callbacks, and clears the session read cache when the authenticated UID changes.
- `firebase.js` uses persistent multi-tab Firestore browser cache with a compatibility fallback to the normal Firestore initializer.
- React Strict Mode remains enabled. Concurrent request deduplication prevents duplicated effects from becoming duplicated collection reads.
- Layout and metadata components do not load Firestore collections.

## Shared service findings

| Service | Result |
| --- | --- |
| `firestoreReadCache.js` | Five-minute collection/count cache, concurrent request deduplication, explicit refresh, aggregation fallback, write-through support, auth clearing, and generation guards preventing invalidated in-flight reads from restoring stale cache data. |
| `enrollmentGenerator.js` | Uses deterministic enrollment IDs and compatible matching, chunks writes, dual-writes canonical enrollment fields, supports student-scoped reconciliation, and invalidates enrollment cache after writes. Complete reads remain only for explicit school-wide generation. |
| `classDataService.js` | Broad reads are restricted to destructive preview/reset workflows. Related deletions are chunked and all affected caches are invalidated. |
| `systemBackupService.js` | Complete reads/writes are intrinsic to backup/restore. Restore is chunked and clears all read caches after completion. |
| `setupDefaultsService.js` | Complete scans are explicit repair/setup operations. Updated collections are invalidated after writes. |

## Remaining production gates

The following work cannot be completed safely from source code alone:

1. Export and reconcile the actual deployed Firestore Rules. The repository's candidate must not replace them directly.
2. Review and deploy the proposed indexes in staging and then production through the controlled Firebase process.
3. Run an explicitly approved, dry-run-first canonical-field backfill. No automatic backfill exists in the application.
4. Reconcile counts and prove canonical coverage for every academic year/term/class before removing compatibility reads.
5. After coverage is proven, convert compatible/gated list routes to `where`, `orderBy`, `limit`, and `startAfter`. Adding cursor limits before that point would silently truncate reports, rankings, completion results, or exports.

## Static acceptance metrics

- Page modules audited: 39.
- Page source lines audited: 42,132.
- JavaScript source lines included in the architectural review: 53,884.
- Literal `getDocs(collection(...))` sites: reduced from approximately 71 to 24.
- Remaining `onSnapshot` calls: 4, all singleton documents.
- Production `limit()`/`startAfter()` calls: intentionally 0 until canonical compatibility coverage is proven.
- Cache invalidation call sites: 25 before the final maintenance-path coherence pass, with additional invalidation now present in promotion, shuffle, migration, restore, defaults, and class-reset workflows.
