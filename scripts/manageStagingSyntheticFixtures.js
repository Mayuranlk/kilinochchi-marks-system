#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("firebase-tools/lib/apiv2");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");

const APPROVED_PROJECT = "kilinochchi-marks-staging";
const AUTH_FIXTURES = [
  ["admin", "admin@app-emulator.test", "admin", true],
  ["teacher", "teacher@app-emulator.test", "teacher", true],
  ["it", "it@app-emulator.test", "it_teacher", true],
  ["sectional", "sectional@app-emulator.test", "sectional_head", true],
  ["account", "account@app-emulator.test", "account", true],
  ["prefect", "prefect@app-emulator.test", "prefect", true],
  ["capabilityTeacher", "capability-teacher@app-emulator.test", "support", true],
  ["unknown", "unknown@app-emulator.test", "unknown", true],
  ["missingProfile", "missing-profile@app-emulator.test", null, false],
  ["browserTeacher", "browser-teacher@app-emulator.test", "teacher", true],
];

const FIXED_DOCUMENTS = [
  "students/student-001", "students/student-002",
  "classrooms/class-10-a",
  "subjects/subject-mathematics", "subjects/subject-tamil",
  "academicTerms/term-2026-1", "practiceExams/practice-2026-1",
  "teacherAssignments/assignment-teacher-maths-10a", "teacherAssignments/assignment-it-maths-10a",
  "studentSubjectEnrollments/enrollment-001-maths", "studentSubjectEnrollments/enrollment-002-maths",
  "marks/mark-synthetic-001", "marks/mark-synthetic-002",
  "systemSettings/marksEntry", "studentFeeAccounts/2026_student-001",
  "lateArrivalRecords/2026-07-31_student-001",
  `lateArrivalRecords/${new Date().toISOString().slice(0, 10)}_student-002`,
  "elections/student-parliament-2026",
  "auditLogs/audit-seed", "auditLogs/seed-complete", "auditLogs/phase2-staging-admin-probe",
  "classShufflePlans/shuffle-seed", "promotionHistory/promotion-seed",
  "teachers/legacy-teacher-seed",
];

function parse(argv) {
  const result = { project: "", output: "", execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--execute") result.execute = true;
    else if (["--project", "--output"].includes(argv[index])) result[argv[index].slice(2)] = argv[++index] || "";
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (result.project !== APPROVED_PROJECT) throw new Error(`--project must be ${APPROVED_PROJECT}.`);
  if (!result.output) throw new Error("--output is required.");
  return result;
}

async function authenticate(project) {
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("No authenticated Firebase CLI account is available.");
  const identity = await requireAuth({ project, projectId: project, user: account.user, tokens: account.tokens });
  return identity || account.user.email;
}

async function main(argv = process.argv.slice(2)) {
  const options = parse(argv);
  const identity = await authenticate(options.project);
  const authClient = new Client({ urlPrefix: "https://identitytoolkit.googleapis.com", apiVersion: "v1" });
  const firestore = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1" });
  const lookup = await authClient.post(
    `/projects/${options.project}/accounts:lookup`,
    { email: AUTH_FIXTURES.map((fixture) => fixture[1]) },
    { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
  );
  const usersByEmail = new Map((lookup.body?.users || []).map((user) => [user.email, user]));
  const authManifest = AUTH_FIXTURES.map(([logicalName, email, expectedRole, expectedProfile]) => {
    const user = usersByEmail.get(email);
    return {
      type: "auth",
      logicalName,
      email,
      uid: user?.localId || null,
      expectedRole,
      expectedProfile,
      exists: Boolean(user),
      action: user ? "clean" : "create-on-reseed",
    };
  });
  const profilePaths = authManifest.filter((row) => row.uid).map((row) => `users/${row.uid}`);
  const browserTeacher = authManifest.find((row) => row.logicalName === "browserTeacher");
  const dynamicPaths = [...profilePaths, ...(browserTeacher?.uid ? [`teachers/${browserTeacher.uid}`] : [])];
  const documentPaths = [...new Set([...FIXED_DOCUMENTS, ...dynamicPaths])];
  const documents = [];
  for (const documentPath of documentPaths) {
    const response = await firestore.get(
      `/projects/${options.project}/databases/(default)/documents/${documentPath}`,
      { resolveOnHTTPError: true, skipLog: { resBody: true } }
    );
    documents.push({
      type: "firestore",
      logicalName: documentPath.replaceAll("/", "_"),
      documentPath,
      exists: response.status === 200,
      action: response.status === 200 ? "clean" : "create-on-reseed",
    });
  }

  const deletedDocuments = [];
  const deletedAuthUsers = [];
  if (options.execute) {
    for (const row of documents.filter((item) => item.exists)) {
      const response = await firestore.delete(
        `/projects/${options.project}/databases/(default)/documents/${row.documentPath}`,
        { resolveOnHTTPError: true }
      );
      if (![200, 204, 404].includes(response.status)) throw new Error(`Cleanup failed for ${row.documentPath}: HTTP ${response.status}`);
      deletedDocuments.push(row.documentPath);
    }
    for (const row of authManifest.filter((item) => item.exists)) {
      const response = await authClient.post(
        `/projects/${options.project}/accounts:delete`,
        { localId: row.uid },
        { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
      );
      if (response.status !== 200) throw new Error(`Auth cleanup failed for ${row.logicalName}: HTTP ${response.status}`);
      deletedAuthUsers.push(row.logicalName);
    }
  }

  const report = {
    projectId: options.project,
    authenticatedAccount: identity,
    mode: options.execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    exactAllowlistOnly: true,
    authFixtures: authManifest,
    documents,
    deletedDocuments,
    deletedAuthUsers,
  };
  const output = path.resolve(options.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ projectId: report.projectId, mode: report.mode, authExisting: authManifest.filter((row) => row.exists).length, documentsExisting: documents.filter((row) => row.exists).length, deletedDocuments: deletedDocuments.length, deletedAuthUsers: deletedAuthUsers.length, output: path.relative(process.cwd(), output) })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Synthetic fixture management stopped safely: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { AUTH_FIXTURES, FIXED_DOCUMENTS, main, parse };
