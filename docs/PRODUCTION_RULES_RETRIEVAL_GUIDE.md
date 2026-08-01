# Controlled retrieval of deployed Firestore Rules

Current status: a manual Firebase Console copy is now stored as `firestore.rules.deployed.review` and structurally compared. This guide remains the controlled process for recording project/release provenance or refreshing that evidence later.

The deployed Rules are not available locally. Retrieval must be read-only; do not click **Publish** and do not run any deploy command.

## Preferred: Firebase Console

1. Confirm the Firebase project ID with the project owner and record it in the change ticket.
2. Open Firebase Console, select that exact project, then open **Firestore Database → Rules**.
3. Select the `(default)` database if a database selector is present.
4. Copy the complete currently published Rules source into a new local file named `firestore.rules.deployed.review`.
5. Do not modify the editor and do not click **Publish**.
6. Record the retrieval time, project ID, database ID, and operator in the ticket—not in the Rules file if that would expose personal information.
7. Compare the retrieved file to `firestore.rules.candidate`; keep both files separate until emulator tests and approval are complete.

Create a non-semantic structural comparison artifact with:

```powershell
npm.cmd run audit:compare-rules -- `
  --deployed firestore.rules.deployed.review `
  --candidate firestore.rules.candidate `
  --output audit-output/rules-structural-comparison.json
```

This records hashes and structural line differences. It does not replace the authorization matrix or emulator tests.

Firebase documents that Console and local CLI Rules can conflict, and that a CLI deployment overwrites Console Rules. See [Firebase CLI deployment conflicts](https://firebase.google.com/docs/cli#security_rules_deployment_conflicts).

## Approved API retrieval

For an operator with read-only Firebase Rules IAM permissions and Google Cloud CLI access:

```powershell
$projectId = "CONFIRMED_PROJECT_ID"
$token = gcloud auth print-access-token
$release = Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } `
  -Uri "https://firebaserules.googleapis.com/v1/projects/$projectId/releases/cloud.firestore"
$ruleset = Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } `
  -Uri "https://firebaserules.googleapis.com/v1/$($release.rulesetName)"
$ruleset.source.files | ConvertTo-Json -Depth 20
```

Review the JSON in memory first. Store only the Rules source in `firestore.rules.deployed.review`. Do not store access tokens, service-account keys, or credential output. The relevant read-only resources are documented in the [Firebase Rules REST API](https://firebase.google.com/docs/reference/rules/rest).

## Commands prohibited during retrieval

Do not run:

```text
firebase deploy
firebase deploy --only firestore
firebase deploy --only firestore:rules
firebase init firestore
```

`firebase init firestore` may create or overwrite local configuration and is unnecessary for retrieval.

## Acceptance evidence

- Exact confirmed project and database IDs.
- Complete deployed source, not a screenshot or partial excerpt.
- Retrieval timestamp and Rules release/ruleset name when obtained via API.
- No deployment performed.
- `docs/FIRESTORE_RULES_COMPARISON.md` updated from **Blocked** to evidence-backed findings.
