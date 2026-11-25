#!/usr/bin/env node
"use strict";

// Aggregate-only diagnostic. A sampled checkpoint cannot prove coverage or
// justify a migration, and the checkpoint itself must remain private.
const fs = require("fs");
const canonical = require("../src/shared/firestoreCanonicalCore");

function analyze(checkpoint) {
  const collections = checkpoint.collections || {};
  const classrooms = collections.classrooms?.documents || [];
  const terms = collections.academicTerms?.documents || [];
  const classIndex = new Map();
  for (const classroom of classrooms) {
    const grade = canonical.gradeNumber(classroom.grade);
    const section = canonical.slug(classroom.section || classroom.className);
    if (!grade || !section) continue;
    const identity = `${grade}__${section}`;
    const entries = classIndex.get(identity) || [];
    entries.push(classroom);
    classIndex.set(identity, entries);
  }
  const result = {};
  for (const name of ["studentSubjectEnrollments", "marks", "teacherAssignments"]) {
    const rows = collections[name]?.documents || [];
    const summary = { sampled: rows.length, classComparable: 0, classKeyMismatch: 0, termComparable: 0, termKeyMismatch: 0 };
    for (const row of rows) {
      const identity = `${canonical.gradeNumber(row.grade)}__${canonical.slug(row.section)}`;
      const matches = classIndex.get(identity) || [];
      // Multiple streams can share grade and section; do not assume a match.
      if (matches.length === 1) {
        const rowKey = canonical.buildCanonicalAcademicFields(row).classKey;
        const classKey = canonical.buildCanonicalAcademicFields(matches[0]).classKey;
        if (rowKey && classKey) {
          summary.classComparable += 1;
          if (rowKey !== classKey) summary.classKeyMismatch += 1;
        }
      }
      const rowYear = canonical.academicYearKey(row.academicYear || row.year);
      const rowTerm = canonical.slug(row.term || row.termName);
      const termMatches = terms.filter((term) =>
        canonical.academicYearKey(term.academicYear || term.year) === rowYear &&
        canonical.slug(term.term || term.termName || term.name) === rowTerm
      );
      if (rowTerm && termMatches.length === 1) {
        const recordKey = canonical.buildCanonicalAcademicFields(row).termKey;
        const termKey = canonical.buildCanonicalAcademicFields(termMatches[0]).termKey;
        if (recordKey && termKey) {
          summary.termComparable += 1;
          if (recordKey !== termKey) summary.termKeyMismatch += 1;
        }
      }
    }
    result[name] = summary;
  }
  return { sampleOnly: true, completeClassrooms: collections.classrooms?.complete === true,
    completeTerms: collections.academicTerms?.complete === true, collections: result };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/analyzeDashboardKeyConsistency.js <checkpoint>");
    const checkpoint = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    process.stdout.write(`${JSON.stringify(analyze(checkpoint), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Key consistency analysis failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { analyze };
