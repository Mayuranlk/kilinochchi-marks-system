#!/usr/bin/env node
"use strict";

// Offline review only. This program never imports a Firestore client or writes
// to the database. A classroom match is evidence for review, not a migration.
const fs = require("fs");
const canonical = require("../src/shared/firestoreCanonicalCore");
const { hashIdentity } = require("./lib/canonicalAuditUtils");

const SOURCES = ["studentSubjectEnrollments", "marks", "teacherAssignments"];

function candidateClassrooms(row, classrooms) {
  const grade = canonical.gradeNumber(row.grade);
  const section = canonical.slug(row.section);
  if (!grade || !section) return { reason: "missing_grade_or_section", matches: [] };
  const matches = classrooms.filter((room) =>
    canonical.gradeNumber(room.grade) === grade &&
    canonical.slug(room.section || room.className) === section
  );
  if (!matches.length) return { reason: "no_matching_classroom", matches: [] };
  const stream = canonical.slug(row.stream);
  // For A/L, never assume a stream when the record or classroom omits it.
  if (grade >= 12) {
    if (!stream) return { reason: "missing_stream", matches: [] };
    const exact = matches.filter((room) => canonical.slug(room.stream) === stream);
    if (exact.length !== 1) return { reason: exact.length ? "ambiguous_classroom" : "stream_not_resolved", matches: exact };
    return { reason: "unique_classroom_for_review", matches: exact };
  }
  return matches.length === 1
    ? { reason: "unique_classroom_for_review", matches }
    : { reason: "ambiguous_classroom", matches };
}

function buildReview(checkpoint) {
  const collections = checkpoint.collections || {};
  const classrooms = collections.classrooms?.documents || [];
  const completeClassrooms = collections.classrooms?.complete === true;
  const totals = {};
  const candidates = [];
  for (const name of SOURCES) {
    const rows = collections[name]?.documents || [];
    const summary = { sampled: rows.length, reasons: {}, mismatchedDerivedKey: 0, existingKeyConflicts: 0 };
    for (const row of rows) {
      const resolved = candidateClassrooms(row, classrooms);
      let reason = completeClassrooms ? resolved.reason : "classroom_audit_incomplete";
      const room = completeClassrooms && resolved.matches.length === 1 ? resolved.matches[0] : null;
      const expected = room ? canonical.buildCanonicalAcademicFields(room).classKey : "";
      const inferred = canonical.buildCanonicalAcademicFields(row).classKey;
      const existing = canonical.text(row.classKey);
      if (room && !expected) reason = "classroom_key_missing";
      if (room && expected && inferred && inferred !== expected) summary.mismatchedDerivedKey += 1;
      if (room && expected && existing && existing !== expected) {
        summary.existingKeyConflicts += 1;
        reason = "existing_class_key_conflict";
      }
      summary.reasons[reason] = (summary.reasons[reason] || 0) + 1;
      if (reason !== "unique_classroom_for_review" || (expected && inferred !== expected)) {
        candidates.push({ collection: name, documentIdHash: hashIdentity(row.id || ""), reason,
          derivedKeyDiffers: Boolean(room && expected && inferred && inferred !== expected) });
      }
    }
    totals[name] = summary;
  }
  return {
    mode: "offline-review-only", writesEnabled: false,
    sourceProjectId: checkpoint.projectId || "", completeClassrooms,
    completeSources: Object.fromEntries(SOURCES.map((name) => [name, collections[name]?.complete === true])),
    totals, candidates,
  };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/planDashboardClassReconciliation.js <checkpoint>");
    const checkpoint = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const report = buildReview(checkpoint);
    // Print only aggregate counts; candidate hashes stay out of terminal logs.
    process.stdout.write(`${JSON.stringify({ ...report, candidates: report.candidates.length }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Class reconciliation review failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { buildReview, candidateClassrooms };
