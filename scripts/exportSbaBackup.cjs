"use strict";

// Read-only export of the selected project's SBA collection. Firestore REST
// values are retained in the JSON so timestamps and other types are preserved.
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { Client } = require("firebase-tools/lib/apiv2");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { decodeFirestoreFields } = require("./lib/firestoreAuditReader");

async function main() {
  const projectId = "kilinochchi-marks";
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("No authenticated Firebase CLI account is available.");
  await requireAuth({ project: projectId, projectId, user: account.user, tokens: account.tokens });
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1" });
  const documents = [];
  let cursor = "";
  for (;;) {
    const structuredQuery = { from: [{ collectionId: "sbaMarks" }], orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }], limit: 500 };
    if (cursor) structuredQuery.startAt = { before: false, values: [{ referenceValue: cursor }] };
    const response = await client.post(`/projects/${projectId}/databases/(default)/documents:runQuery`, { structuredQuery }, { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true });
    if (response.status !== 200) throw new Error(`Firestore SBA read failed (HTTP ${response.status}).`);
    const page = (response.body || []).filter((item) => item.document).map((item) => item.document);
    documents.push(...page);
    if (page.length < 500) break;
    cursor = page[page.length - 1].name;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.resolve(".local-backups");
  fs.mkdirSync(directory, { recursive: true });
  const stem = path.join(directory, `sba-marks-${timestamp}`);
  fs.writeFileSync(`${stem}.json`, JSON.stringify({ projectId, collection: "sbaMarks", exportedAt: new Date().toISOString(), count: documents.length, documents }, null, 2), { flag: "wx" });
  const rows = documents.map((document) => {
    const fields = decodeFirestoreFields(document.fields || {});
    return { documentId: document.name.split("/").pop(), ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value !== null && typeof value === "object" ? JSON.stringify(value) : value])) };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: "No SBA records found" }]), "SBA Marks");
  XLSX.writeFile(workbook, `${stem}.xlsx`);
  process.stdout.write(JSON.stringify({ count: documents.length, json: `${stem}.json`, xlsx: `${stem}.xlsx` }) + "\n");
}
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
