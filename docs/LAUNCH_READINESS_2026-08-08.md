# Kilinochchi Marks Management System — Launch Readiness

## Classification

**READY FOR LAUNCH**

## Technical summary

No launch-blocking application, authorization, academic-workflow, export, backup, or runtime defect remains in the reviewed build. The production Firestore Rules still match the approved source, all local release gates passed, all synthetic role/browser workflows passed, the prior manual production role and negative-authorization checks remain recorded as passed, and the final optimized build contains the production Firebase project rather than staging or emulator configuration.

One deployment blocker was corrected during this audit: the React Router application had no repository-level Vercel single-page-application fallback. `vercel.json` now fixes the framework, build command, output directory, and catch-all rewrite to `index.html`. Vercel documents this rewrite as required for SPA deep links and refreshes. No Firebase deployment or application deployment was performed in this run.

The canonical-data audit and all migration-dependent improvements are explicitly deferred and are not launch gates because existing legacy-compatible reads and writes remain active.

## Release identity and scope

- Audit date: 2026-08-08
- Branch: `main`
- Starting commit: `306de76293fb39a928255a47382ca8710cd230ef`
- Production Firebase project: `kilinochchi-marks`
- Production project number: `499271151802`
- Firestore database: `(default)`
- Firestore region: `asia-southeast1`
- Launch audit mutations to production Firestore: 0
- Production Auth changes: 0
- Firebase or Vercel deployments: 0
- Migrations or deferred feature activations: 0

The working tree contains the previously reviewed Phase 2 evidence/tooling plus the launch-readiness changes listed below. Release deployment must use an intentional commit containing the exact reviewed state; do not deploy an arbitrary subset of the dirty working tree.

## Production Rules status

- Active Ruleset: `projects/kilinochchi-marks/rulesets/437fedc1-4675-45e6-85d9-83c88f381c33`
- Retrieved during this audit: 2026-08-08T09:00:12.742Z
- Active SHA-256: `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`
- Approved SHA-256: `EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`
- Source/hash parity: PASS
- Firestore Rules emulator: 11/11 passed
- Rules review validator: passed with no failures or warnings
- Production manual negative authorization: PASS
- Rollback source remains preserved under the production rollback package.

## Test and build results

| Gate | Result |
| --- | --- |
| Firestore Rules emulator | PASS — 11/11 |
| React unit/integration tests | PASS — 9 suites, 34 tests |
| Production optimized build | PASS |
| Audit-tool tests | PASS — 16/16 |
| Rules review validator | PASS — no warnings or failures |
| Application Auth/Firestore emulator browser suite | PASS — 9/9 |
| Scaled React performance browser suite | PASS — 1/1 with 500 students |
| Students pagination/export browser suite | PASS — 2/2 |
| Focused PDF/Excel browser export | PASS — 1/1 |
| `git diff --check` | PASS |

The final production build was run after all emulator builds. It produced `build/index.html`, embedded project `kilinochchi-marks`, contained no `kilinochchi-marks-staging` or `demo-kilinochchi-rules` project ID, and did not enable emulator mode.

## Role verification

Manual production smoke evidence from the completed Rules rollout:

- Admin: PASS
- Teacher: PASS
- Sectional Head: PASS
- Account: PASS
- Prefect: PASS
- Negative authorization: PASS
- Initial production monitoring: PASS

The current synthetic application suite independently authenticated Admin, Teacher, IT Teacher, Sectional Head, Account, and Prefect users; exercised permitted routes and writes; rejected unknown, missing-profile, unauthenticated, and cross-role access; and detected no legitimate `permission-denied` or console-blocking application error.

## Launch-critical workflow verification

| Area | Evidence | Status |
| --- | --- | --- |
| Admin and Teacher dashboards | Manual production smoke plus emulator route checks | PASS |
| Sectional Head dashboard | Manual production smoke plus report-route checks | PASS |
| Marks Entry existing students/enrollments/marks | Production smoke and synthetic seeded compatibility data | PASS |
| Marks create/update | Synthetic Teacher save from 74 to 82 under approved Rules | PASS |
| No post-save full rescan | Save merges returned rows into local state and shared cache via `updateCachedCollection` | PASS |
| SBA | Admin and Teacher routes loaded without browser/security errors | PASS |
| Report Card | Admin and Teacher student-scoped routes loaded | PASS |
| Class Marks Reports | Admin, IT Teacher, and Sectional Head routes loaded | PASS |
| Class Completion Report | Admin, IT Teacher, and Sectional Head routes loaded | PASS |
| Subject Analysis | Admin, IT Teacher, Sectional Head, and scaled navigation checks | PASS |
| Teacher Mark Sheets | Admin/IT Teacher routes loaded under approved Rules | PASS |
| Students By Subject | Admin route loaded | PASS |
| Bulk Marks Upload | Route and compatibility implementation compiled/loaded; legacy matching remains active | PASS |
| PDF generation | Teacher class-marks download produced a valid `%PDF` file | PASS |
| Excel exports | Teacher workbook contained Mark Schedule/Analysis sheets; Students export contained all 500 rows | PASS |
| Backup/export | Browser downloaded and validated all 17 configured collections | PASS |
| Restore | Full synthetic upload/confirmation/restore flow passed | PASS |
| Academic Terms | Admin route loaded and Rules coverage passed | PASS |
| Teacher Assignments | Admin route loaded and Rules coverage passed | PASS |
| Class Teacher Assignments | Admin route loaded; compatibility fields remain on classroom/user documents | PASS |
| Classroom Management | Admin route loaded and CRUD authorization is covered | PASS |
| Students | Production smoke, route matrix, scaled performance, desktop/mobile pagination | PASS |
| Subject Management | Production smoke and emulator route check | PASS |
| Account workflow | Production read smoke plus synthetic payment creation and access denial | PASS |
| Prefect workflow | Production read smoke plus synthetic late-arrival/handover and access denial | PASS |
| Election singleton workflows | Counting/live routes loaded; Rules tests cover singleton read/write behavior | PASS |

No destructive production workflow was executed. Promotion, shuffle, restore, maintenance, setup, migration, deletion, and bulk production writes remained out of scope.

## Cache, listener, and compatibility safeguards

- Persistent multi-tab Firestore browser caching remains active for non-emulator builds.
- The five-minute shared collection/count cache remains active.
- Concurrent collection and count requests remain deduplicated.
- Collection-generation and cache-epoch guards prevent invalidated in-flight reads from restoring stale data.
- Auth UID changes clear collection and count caches.
- Targeted write-path invalidation remains in place.
- Exactly four `onSnapshot` calls remain: two singleton `systemSettings/marksEntry` listeners and two singleton election-document listeners.
- No collection-wide Marks or Enrollment listener was reintroduced.
- Canonical scoped reads remain behind a default-off environment gate.
- Cursor query code remains inside the same disabled repository module and is not used by active application pages.
- Existing generated Mark IDs and legacy fields remain unchanged.

## Vercel deployment readiness

`vercel.json` now provides:

- framework preset: `create-react-app`;
- build command: `npm run build`;
- output directory: `build`;
- rewrite: `/(.*)` to `/index.html`.

The file parses as valid JSON and the configured build/output pair was verified locally. The rewrite prevents direct navigation or refresh of React Router paths from returning a Vercel filesystem 404, consistent with the [Vercel SPA routing guidance](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404).

The repository has no `.vercel/project.json`, so remote Vercel dashboard settings were not introspected or changed. Before promotion, the release operator must confirm that the Vercel project uses this repository root, deploys the exact reviewed release commit, and provides the six production `REACT_APP_FIREBASE_*` values. The current ignored local configuration has all six values and points to `kilinochchi-marks`.

## Repository and configuration hygiene

- `.firebaserc`: absent
- `.env`: ignored and untracked
- Service-account/private-key/credential material in reviewed source/evidence: none detected
- Staging Firebase Web SDK project ID in production bundle: absent
- Emulator project ID in production bundle: absent
- Emulator activation environment setting in production configuration: absent
- The tracked staging Rules review config and staging-only tools are release evidence/tooling; they are not imported by `src`, included as Firebase Web SDK configuration, or used by the production build.

## Backup, restore, and rollback readiness

- Backup format and project-ID validation are covered by unit tests.
- Backup exports the configured 17 collections and includes a document summary.
- Synthetic UI download, validation, upload, explicit `RESTORE` confirmation, and restore completed successfully.
- Restore remains a controlled administrative operation and must not be used as a routine launch smoke test in production.
- Firestore Rules rollback source/hash and rules-only config remain preserved.
- If launch produces widespread legitimate `permission-denied`, authentication/profile failures, or broken critical routes, pause the application rollout first. Roll back application deployment independently from Rules unless evidence identifies the Rules as the cause.
- Never weaken Rules in the Firebase Console or restore production data without incident approval.

## Deferred Phase 2 work

The following are explicitly frozen and are not launch blockers:

- completion of production canonical audit;
- canonical backfill dry-run;
- additive production backfill;
- composite index rollout;
- scoped canonical queries;
- server-side cursor pagination;
- summary documents;
- deterministic mark-ID migration.

Also deferred: removing legacy fields, canonical-only reads, academic calculation changes, grading/ranking changes, report redesign, and destructive maintenance.

## Launch procedure and monitoring checklist

1. Create an intentional release commit containing the exact reviewed application changes, `vercel.json`, and required test fixes; exclude logs, temporary browser artifacts, and credentials.
2. Confirm the Vercel production project is linked to the correct repository/root and that all production Firebase environment variables target `kilinochchi-marks`.
3. Deploy the reviewed commit through the normal Vercel production workflow. Do not deploy Firebase Rules, indexes, Hosting, Functions, Storage, or migrations.
4. Verify `/login` and direct-load at least one protected deep link to confirm the SPA rewrite.
5. Run non-destructive Admin, Teacher, Sectional Head, Account, and Prefect login/read smoke checks.
6. Monitor authentication failures, profile-loading failures, `permission-denied`, unhandled browser errors, Dashboard/Marks/report failures, and unusual Firestore request volume.
7. Keep the application rollback target and preserved Firestore Rules rollback package available through the first school day.
8. Check peak-period login, Marks Entry, reporting, fee-account, and prefect workflows; record incidents by role and route without personal data.
9. Do not reopen deferred Phase 2 work during launch stabilization.

## Limitations and open questions

- This run did not deploy to Vercel and did not inspect private Vercel dashboard environment values. Deployment operators must confirm them at promotion.
- Production manual smoke checks intentionally avoided data-changing operations; write-path evidence comes from the approved Rules emulator and full synthetic application suite.
- The production canonical audit remains incomplete by design and does not affect current legacy-compatible launch behavior.
- First-school-day monitoring remains required even though initial Rules monitoring passed.
