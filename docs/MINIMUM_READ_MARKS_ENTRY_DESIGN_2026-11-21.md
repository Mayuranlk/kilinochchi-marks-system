# Minimum-read marks entry design — 21 November 2026

## Current safe changes

SBA writes use batches of four and do not read each existing SBA document during saving. The client no longer fetches the SBA settings again immediately before each save. The entry page still loads the settings initially, and Firestore rules independently check current settings and deadlines for each teacher write. A denied batch retains unsaved drafts. Existing teacher and admin revision rules reject stale updates. Firestore may bill dependent document reads made by security rules, including settings and assignment checks; these are separate from client reads.

The page loads only the selected subject's SBA records and bounded class/year enrollment scopes. Its five-minute in-memory query cache shares reads within the current authenticated session. Refresh explicitly requests fresh data. A cold session, another device, an expired cache or a changed scope can cause fresh reads. Cached data may be stale; server-side rules remain authoritative.

Administrator term marks entry no longer downloads every student on page load for the optional deletion search. Opening that search loads the full list on demand, using the existing session cache; this operation can still be expensive when used. The local browser test verifies the search remains available and the full-list read happens only after opening it.

## Next larger reduction: canonical scoped data

Existing data uses several year, grade, section and teacher-identity formats. SBA currently merges multiple queries to avoid losing records in mixed legacy data. Overlapping queries can return and bill the same document more than once, and empty queries may have a minimum read charge. Do not remove these variants until a read-only audit proves every relevant assignment and enrollment has a canonical scope and every write path maintains it.

1. Audit the coverage and consistency of a canonical teacher identifier and an enrollment key containing academic year, class, and subject. Count missing, mismatched and duplicate records before changing the read path.
2. Update all creation, import, edit and restore paths to maintain canonical fields. Plan and review any backfill, indexes, and production read/write costs separately; never silently omit legacy records.
3. After coverage is verified, switch each roster to one indexed equality-scoped query and fetch each required student once. Keep a migration fallback until coverage and results are verified.
4. Measure each workflow with controlled sessions and project quota metrics. Include document reads from rules, empty queries, index entries, cache expiration and concurrent teachers. Compare a cold open, save, refresh, and revisit; local query diagnostics alone do not measure billing.

Security and correctness take priority over eliminating all reads: do not remove authorization checks, conflict detection or current data solely to reduce quota. Rule checks can still incur reads and a zero-read end-to-end workflow is not promised. Term marks also require a separate audit of their teacher and administrator paths before changing them.
