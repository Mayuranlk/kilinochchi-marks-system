"use strict";

const fs = require("fs");
const path = require("path");

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function writeJsonReport(filePath, report) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function objectSummary(value) {
  const entries = Object.entries(value || {});
  return entries.length ? entries.map(([key, count]) => `${key}: ${typeof count === "object" ? JSON.stringify(count) : count}`).join("; ") : "None";
}

function writeMarkdownReport(filePath, report) {
  ensureParent(filePath);
  const lines = [
    "# Canonical Firestore coverage audit",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Confirmed project: \`${report.projectId}\``,
    `- Mode: ${report.mode}`,
    `- Interrupted: ${report.interrupted ? "yes" : "no"}`,
    "- Personal data: intentionally excluded",
    "",
    "| Collection | Read | Ready | Coverage | Unsafe | Duplicate groups |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [name, result] of Object.entries(report.collections || {})) {
    lines.push(`| \`${name}\` | ${result.totalDocuments} | ${result.canonicalReadyDocuments} | ${result.coveragePercentage}% | ${result.recordsUnsafeForAutomaticMigration} | ${result.duplicateCanonicalIdentities.groups} |`);
  }
  for (const [name, result] of Object.entries(report.collections || {})) {
    lines.push(
      "",
      `## ${name}`,
      "",
      `- Missing canonical fields: ${objectSummary(result.missingCanonicalFields)}`,
      `- Coverage states: ${objectSummary(result.coverageStates)}`,
      `- Null canonical fields: ${objectSummary(result.nullFields)}`,
      `- Blank canonical fields: ${objectSummary(result.blankFields)}`,
      `- Invalid field types: ${objectSummary(result.invalidFieldTypes)}`,
      `- Conflicting canonical fields: ${objectSummary(result.conflictingCanonicalFields)}`,
      `- Mixed field types: ${objectSummary(result.mixedFieldTypes)}`,
      `- Legacy alias usage: ${objectSummary(result.legacyAliasUsage)}`,
      `- Unresolved references: ${objectSummary(result.unresolvedReferences)}`,
      `- Ambiguous normalization: ${objectSummary(result.ambiguousNormalization)}`,
      `- Unsafe reasons: ${objectSummary(result.unsafeReasonCounts)}`
    );
    if (result.generatedDocumentIds !== undefined) {
      lines.push(`- Generated/non-logical document IDs: ${result.generatedDocumentIds} (informational; IDs are not migration targets)`);
      lines.push(`- Invalid numeric marks: ${result.invalidNumericMarks}`);
      lines.push(`- Attendance inconsistencies: ${result.attendanceInconsistencies}`);
    }
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = { writeJsonReport, writeMarkdownReport };
