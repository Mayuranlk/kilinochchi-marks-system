# Production Launch Evidence — 2026-08-08

## Classification

PRODUCTION LAUNCH SUCCESSFUL — STABILIZATION MONITORING ACTIVE

## Release identity

- Branch: `main`
- Release commit: `c0d6d253654e06ceced21e9e86893c98183d6c7a`
- Commit message: `release: production launch readiness 2026-08-08`
- GitHub repository: `Mayuranlk/kilinochchi-marks-system`
- Push status: local and remote `main` SHA parity verified.
- Production Firebase project: `kilinochchi-marks` (`499271151802`).
- No Firebase service was deployed or modified during this application launch.

## Vercel production deployment

- Project: `kilinochchi-marks-system` (`prj_WlkEJHu29cPOVSEipmqxKU6H2GIo`)
- Framework: Create React App
- Source: GitHub `Mayuranlk/kilinochchi-marks-system`, branch `main`
- Deployment: `dpl_5JiqVVYD46231Go8Hd6ztMQrgUkt`
- Deployment commit: `c0d6d253654e06ceced21e9e86893c98183d6c7a`
- Production URL: `https://kilinochchi-marks-system.vercel.app`
- Deployment ready UTC: `2026-08-08T09:48:23.857Z`
- Build result: READY; build completed in 45 seconds with no build errors.

The deployed bundle contains all six required nonempty Firebase Web configuration fields. The project ID is `kilinochchi-marks`; staging and demo project IDs are absent. Values other than the safe project ID are intentionally not recorded.

## Final release gates

- Firestore Rules emulator: PASS, 11/11.
- React tests: PASS, 34/34.
- Optimized production build: PASS.
- Audit-tool tests: PASS, 16/16.
- Rules review validator: PASS.
- Application emulator browser suite: PASS, 9/9.
- Students pagination/export: PASS, 2/2 with 500 synthetic students.
- Scaled React performance: PASS, 1/1 with 500 synthetic students.
- PDF/Excel export: PASS, 1/1.
- `.firebaserc`: absent.
- `.env`: ignored and untracked.
- Credential/private-key scan: no tracked or staged findings.

## SPA and production smoke verification

- `/login`: HTTP 200 and SPA shell loaded.
- Direct `/students` navigation: HTTP 200 and the same SPA shell loaded; no Vercel filesystem 404.
- Admin: PASS — login, Dashboard, Students, Subjects, Classrooms, Academic Terms, Reports, and existing Marks Entry load.
- Teacher: PASS — login, Teacher Dashboard, Marks Entry load, Report Card, Teacher Mark Sheets, and Subject Analysis.
- Sectional Head: PASS — login, Dashboard, and permitted reports.
- Account: PASS — login, student lookup, and fee-account read.
- Prefect: PASS — login and student lookup.
- Tests were non-destructive and used existing legitimate production accounts; no credentials were requested or stored.

## Monitoring and rollback readiness

- Stabilization monitoring started after deployment and role smoke completion.
- Vercel runtime error scans found no error clusters during the launch window.
- Continue monitoring authentication/profile loading, permission denials, unhandled browser errors, Dashboard, Marks Entry, reports, request volume, and role-specific access.
- Previous READY production deployment retained for application rollback: `dpl_GjikEi8TXMSVLbvvrebQTaufrcGS`, commit `306de76293fb39a928255a47382ca8710cd230ef`.
- Preserved Firestore Rules rollback package remains available; Rules were not changed in this launch.

## Deferred Phase 2 work

- completion of production canonical audit;
- canonical backfill dry-run;
- additive production backfill;
- composite index rollout;
- scoped canonical queries;
- server-side cursor pagination;
- summary documents;
- deterministic mark-ID migration.

These items remain frozen and were not performed during launch.
