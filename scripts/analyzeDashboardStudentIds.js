#!/usr/bin/env node
"use strict";

// Read an existing private checkpoint only. Counts do not reveal student IDs.
const fs = require("fs");

function analyze(checkpoint) {
  const collections = checkpoint.collections || {};
  const students = collections.students?.documents || [];
  const studentIds = new Set(students.map((row) => String(row.id)));
  const normalizedStudentIds = students.map((row) => String(row.id).trim());
  const studentDocumentIdWhitespace = students.filter((row) => String(row.id) !== String(row.id).trim()).length;
  const normalizedStudentIdDuplicates = normalizedStudentIds.length - new Set(normalizedStudentIds).size;
  const output = { completeStudents: collections.students?.complete === true,
    studentDocumentIdWhitespace, normalizedStudentIdDuplicates, collections: {} };
  for (const name of ["studentSubjectEnrollments", "marks"]) {
    const state = collections[name] || {};
    const result = { sampled: (state.documents || []).length, complete: state.complete === true,
      missingId: 0, nonStringId: 0, whitespaceId: 0, unresolvedStudentId: 0 };
    for (const row of state.documents || []) {
      if (row.studentId === undefined || row.studentId === null || row.studentId === "") {
        result.missingId += 1;
        continue;
      }
      if (typeof row.studentId !== "string") result.nonStringId += 1;
      const id = String(row.studentId);
      if (id !== id.trim()) result.whitespaceId += 1;
      if (output.completeStudents && !studentIds.has(id.trim())) result.unresolvedStudentId += 1;
    }
    output.collections[name] = result;
  }
  output.studentIdsCompleteAndConsistent = output.completeStudents && !studentDocumentIdWhitespace && !normalizedStudentIdDuplicates && Object.values(output.collections).every((result) =>
    result.complete && !result.missingId && !result.nonStringId && !result.whitespaceId && !result.unresolvedStudentId);
  return output;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/analyzeDashboardStudentIds.js <checkpoint>");
    process.stdout.write(`${JSON.stringify(analyze(JSON.parse(fs.readFileSync(process.argv[2], "utf8"))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Student ID analysis failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { analyze };
