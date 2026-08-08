#!/usr/bin/env node
"use strict";

const { Client } = require("firebase-tools/lib/apiv2");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");

const APPROVED_PROJECT = "kilinochchi-marks-staging";

async function main(argv = process.argv.slice(2)) {
  const projectIndex = argv.indexOf("--project");
  const project = projectIndex >= 0 ? argv[projectIndex + 1] : "";
  if (project !== APPROVED_PROJECT) throw new Error(`--project must be ${APPROVED_PROJECT}.`);
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("No authenticated Firebase CLI account is available.");
  await requireAuth({ project, projectId: project, user: account.user, tokens: account.tokens });

  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1" });
  const response = await client.patch(
    `/projects/${project}/databases/(default)/documents/auditLogs/phase2-staging-admin-probe`,
    {
      fields: {
        action: { stringValue: "phase2-staging-admin-access-probe" },
        synthetic: { booleanValue: true },
        createdAtText: { stringValue: new Date().toISOString() },
      },
    },
    { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
  );
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}: ${response.body?.error?.status || "UNKNOWN"} ${response.body?.error?.message || ""}`.trim());
  }
  process.stdout.write(`${JSON.stringify({ projectId: project, status: response.status, syntheticDocument: "auditLogs/phase2-staging-admin-probe" })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Staging Firestore Admin probe stopped safely: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
