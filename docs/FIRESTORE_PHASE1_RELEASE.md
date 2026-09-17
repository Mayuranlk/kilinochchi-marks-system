# Firestore Phase 1 release review

## Release decision

The repository passed the Phase 1 commit-readiness gates. The final classification
appears once at the end of this report and applies to committing the Phase 1
source, tests, review-only
Rules/index artifacts, and documentation to GitHub. It is not approval to deploy
the proposed Rules or indexes, run a production audit, migrate data, or activate
canonical-only queries.

Review date: 2026-08-01

## Completed work

Phase 1 now contains and verifies:

- persistent multi-tab Firestore browser caching with safe initialization
  fallback;
- a five-minute session collection cache with concurrent collection-read
  deduplication, explicit refresh, authentication-bound clearing, write-through
  marks updates, and invalidation generation guards;
- cache-first authentication profile loading with background server
  revalidation and stale-auth callback protection;
- removal of broad marks/enrollment listeners from normal dashboards and marks
  workflows;
- cached report inputs, aggregation-based dashboard counts with compatibility
  fallback, and server-filtered single-student Report Card reads;
- stable Marks Entry base loading, local selector filtering, no post-save full
  rescan, local/write-through save state, and cached deletion handling;
- Subject Analysis mark indexing by student rather than repeated full marks
  searches;
- compatible canonical dual-write fields for students, enrollments, and marks,
  while preserving legacy aliases and generated mark document IDs;
- write-path cache invalidation across management, setup, restore, generation,
  shuffle, promotion, migration, and bulk marks workflows;
- guarded, read-only canonical audit tooling and a dry-run-only backfill planner
  that deliberately rejects `--apply`;
- review-only proposed Rules and index definitions, synthetic Rules/application
  emulator validation, and staging/rollback instructions;
- client-side Students UI pagination that retains the complete locally loaded
  dataset for search, filters, statistics, print, export, and administration.

## Architecture summary

Ordinary routes share complete compatibility datasets through
`src/services/firestoreReadCache.js`; explicit Refresh actions bypass freshness.
Large count-only dashboard values use Firestore aggregation where current Rules
permit it. Normal teacher and report routes use one-time reads, while the four
remaining `onSnapshot` calls each target a singleton settings/election document.

Canonical field derivation has one implementation in
`src/shared/firestoreCanonicalCore.js`. Browser code reaches it through the
ES-module adapter in `src/utils/firestoreCanonical.js`, while Node audit tooling
loads the same CommonJS core. This is an intentional runtime adapter, not
duplicated canonical logic.

Complete reads remain only where compatibility, full-school reporting/export,
or an explicitly invoked maintenance operation requires complete data.
`src/services/firestoreScopedRepository.js` is intentionally unimported and
runtime-gated; it cannot activate canonical-only reads or cursor pagination
without a separately approved environment change and reconciliation phase.

The normal `firebase.json` is Hosting-only. It references no Rules, indexes,
candidate, proposed, emulator, or staging file. `firebase.staging.rules.review.json`
references only `firestore.rules.proposed.review` and contains no index target.

## Final architecture review findings

### Critical

None found.

### High

- The verified deployed production Rules evidence still grants every
  authenticated account read/write access to every document. This is an existing
  production security risk, not introduced by Phase 1. The proposed least-
  privilege Rules remain undeployed and require an explicitly identified
  non-production staging project, staged application validation, and rollback
  rehearsal before separate production approval.

### Medium

- Production canonical-field coverage and duplicate logical identities have not
  been measured with an approved read-only production audit. Consequently,
  canonical-only scoped reads and Firestore cursor pagination must remain off.
- The six proposed composite indexes are unique and match the planned query map,
  but none is referenced by normal Firebase configuration or deployed.
- Several report, export, live-status snapshot, and maintenance workflows still
  require complete compatibility datasets. Session caching prevents repeated
  route billing but does not remove each workflow's first uncached scan.
- Emulator and local performance evidence cannot establish production billing,
  latency, index behavior, or representative-device performance. Those require
  controlled staging and post-release monitoring.

### Low

- `getCollectionCount` caches successful aggregation results but has no separate
  in-flight Promise map or invalidation generation guard. A Strict Mode overlap
  can issue duplicate small aggregation requests, and a count resolving during
  invalidation can briefly repopulate a stale count. Collection-row reads do have
  both protections. This is bounded to dashboard counts and was documented
  rather than changed during the final review.
- `src/utils/exportFirestoreSamples.js` is an unreferenced compatibility wrapper.
  It is excluded from the production bundle. It was retained because its comment
  explicitly promises compatibility for older imports and removing that contract
  was not necessary for release safety.
- The supplied workspace has no `.git` metadata. The source is ready to commit,
  but commit/push provenance and the final staged diff must be verified in the
  actual Git checkout.

No Firestore-related TODO, FIXME, HACK, or unreachable runtime branch was found.
ESLint found no obsolete or unused imports after the low-risk test import-order
cleanup. Every cache API and invalidation API has reachable production callers;
the disabled scoped repository is intentionally staged future work. No duplicate
indexes or duplicate canonical-field implementation was found.

## Low-risk final-review cleanup

- Reordered imports in `src/services/firestoreReadCache.test.js` to satisfy the
  repository ESLint rules; runtime code was not changed.
- Updated stale page/source line counts in `FIRESTORE_PAGE_AUDIT.md`.
- Corrected the earlier React performance report so it no longer describes
  Students pagination as future work after the completed large-list phase.
- Removed the obsolete `.txt` deployed-Rules copy, an unreferenced whitespace-only
  duplicate of the authoritative `firestore.rules.deployed.review` evidence.

## Files modified

Principal Phase 1 runtime architecture files include:

- `src/firebase.js`
- `src/context/AuthContext.js`
- `src/services/firestoreReadCache.js`
- `src/shared/firestoreCanonicalCore.js`
- `src/utils/firestoreCanonical.js`
- `src/services/enrollmentGenerator.js`
- `src/services/classDataService.js`
- `src/services/setupDefaultsService.js`
- `src/services/systemBackupService.js`
- the dashboard, Marks Entry, Subject Analysis, report, management, shuffle,
  promotion, migration, and bulk-upload pages listed in
  `FIRESTORE_PAGE_AUDIT.md`;
- the Rules, index, emulator, audit, migration-planning, and documentation files
  referenced by this report.

Files changed only by this final review:

- `src/services/firestoreReadCache.test.js`
- `FIRESTORE_PAGE_AUDIT.md`
- `docs/REACT_PERFORMANCE_OPTIMIZATION.md`
- `docs/FIRESTORE_PHASE1_RELEASE.md`
- deleted the obsolete `.txt` deployed-Rules duplicate

## Performance improvements

- Literal `getDocs(collection(...))` sites were reduced from approximately 71
  to 24. Remaining calls are shared infrastructure or explicit complete-data
  maintenance/compatibility workflows.
- Marks Entry selection changes use already loaded datasets and saves perform no
  post-save Firestore rescan.
- Teacher Dashboard no longer initializes broad marks/enrollment listeners or
  reloads base collections on term changes.
- Admin Dashboard count-only values use aggregation instead of downloading full
  marks, subjects, and enrollment documents when Rules permit it.
- Subject Analysis changed its dominant client join from all-marks-per-enrollment
  to marks-per-student indexing.
- The 500-student rendering phase reduced mounted rows from 500 to 50 and measured
  DOM nodes from 15,968 to approximately 2,043, with the complete local dataset
  retained for full-data behavior.

These are architectural and synthetic-test results, not a production billing
guarantee. Exact quota reduction must be established from Firebase Usage after
an approved release.

## Verification evidence

- ESLint over `src`: passed with zero errors and warnings.
- React/Jest: 9 suites, 32 tests passed.
- Audit/migration safety tools: 12 tests passed.
- Rules structural review validator: valid, zero failures/warnings.
- Firestore Rules emulator: 11 tests passed.
- React application emulator: 9 browser suites passed with synthetic users/data,
  including role routes and backup/restore.
- Production React build: compiled successfully; main bundle 329.52 kB gzip.

The proposed Rules hash remained:

`EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969`

## Known limitations

- Session collection data may remain up to five minutes behind writes performed
  by another browser unless the user explicitly refreshes.
- Generated mark IDs and legacy aliases remain supported; logical canonical keys
  are not yet enforced as document IDs or uniqueness constraints.
- Compatibility reports still calculate from full client datasets.
- Proposed Rules/indexes have emulator evidence but no approved staging-project
  deployment evidence.
- No production canonical coverage, quota, or latency measurement was performed.

## Production safety confirmation

This review did not contact Firebase production, deploy Rules/indexes/Hosting,
read or write production documents, run a migration, enable scoped reads,
activate Firestore pagination, change generated IDs, or alter academic/UI/export
behavior. Normal Firebase configuration remains isolated from all candidate and
review-only files. The backfill planner cannot execute writes, and the canonical
auditor imports no write API and refuses remote reads without explicit approval
and exact project confirmation.

## Recommended Phase 2 roadmap

1. Create/approve a synthetic-only staging Firebase project and rehearse proposed
   Rules deployment and rollback with the existing staging runbook.
2. Review staging Rules behavior, dependent profile-read cost, query denials,
   billing, and latency without weakening authorization.
3. Obtain separate approval for a capped read-only production canonical coverage
   audit; reconcile counts, conflicts, and duplicate logical identities.
4. Review and stage the six proposed composite indexes through a separate change.
5. Design and approve an additive, checkpointed canonical backfill only after
   audit evidence; retain legacy compatibility and rollback evidence.
6. Enable scoped queries route-by-route only after 100% safe coverage and output
   reconciliation. Keep full exports explicit and complete.
7. Consider count-request in-flight deduplication and generation protection as a
   small isolated cache hardening change with dedicated concurrency tests.
8. Monitor Firebase reads per active user/hour/day and representative frontend
   latency before claiming production quota savings.

## Final classification

**✅ READY FOR GITHUB COMMIT**
