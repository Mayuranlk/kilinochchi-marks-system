# Controlled operational verification

Verified on 2026-08-01. No production Firestore or Rules API request was made.

## Local tooling

- All authoritative specification files are present at their existing paths.
- Coverage audit, backfill planner, readiness evaluator, Rules comparator, and read estimator scripts are present and load successfully.
- Canonical scoped reads are not enabled in `.env`.
- Scoped repositories remain unreferenced by production pages.
- The backfill planner still rejects `--apply`.
- The auditor still rejects production mode without explicit production-read approval and exact project confirmation.
- React tests, Node tooling tests, and the production build pass.
- Firebase CLI 15.25.1, Firestore Emulator 1.22.0, and Java 21.0.12 are available for isolated local Rules testing.
- `firestore.rules.proposed.review` compiles and passes the synthetic authorization suite using project `demo-kilinochchi-rules` on `127.0.0.1:8085`.

## Production access determination

The deployed Rules source was later supplied through a manual Firebase Console copy and verified locally. No Rules API request was required or made. The capped canonical data audit remains **blocked and was not attempted** because:

- Google Cloud CLI is not installed;
- no Application Default Credentials signal is present;
- no `GOOGLE_APPLICATION_CREDENTIALS` signal is present;
- no Firebase token signal is present;
- no `.firebaserc` or Firestore deployment stanza identifies an approved project;
- the project ID was not assumed from client configuration.

This is the required safety outcome: the phase permits retrieval only when approved read-only access already exists.

## Emulator determination

Actual Firestore Emulator execution completed on 2026-08-01. The dedicated configuration points only to `firestore.rules.proposed.review`, uses the Firebase-safe `demo-kilinochchi-rules` project ID, binds Firestore to `127.0.0.1:8085`, and seeds synthetic data with Rules disabled only inside the emulator test environment. All 11 Rules suites passed, including role/capability boundaries, default deny, query shapes, mark validation, operational workflows, and 1/20/100/400 write batches. See `docs/FIRESTORE_RULES_EMULATOR_RESULTS.md`.

Application-level validation also completed using an emulator-configured React
production build with Authentication on `127.0.0.1:9099`. All 9 Playwright suites
passed in 66 seconds. They exercised all actual roles, all important protected
routes, canonical mark/payment/late-arrival writes, unauthorized denials,
secondary Auth user creation, and full backup/restore. All data and users were
synthetic. See `docs/FIRESTORE_STAGING_VALIDATION_ROLLBACK.md` for the next
controlled gate.

## Deployment and mutation status

- Production reads: 0.
- Production writes: 0.
- Rules API calls: 0; Rules source received by manual copy.
- Rules deployments: 0.
- Index deployments: 0.
- Backfill executions: 0.
- Scoped-query activations: 0.
- Pagination activations: 0.
- Summary-document activations: 0.
- Emulator-only synthetic writes: executed and discarded when the emulator stopped.
- Staging deployments: 0; review-only staging configuration prepared.
