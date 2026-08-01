"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeCanonicalCoverage, sanitizeAuditRow } = require("../lib/canonicalAuditUtils");
const { parseArguments, validateOptions } = require("../auditCanonicalCoverage");

test("sanitizer excludes direct personal fields", () => {
  const row = sanitizeAuditRow({
    id: "student-1",
    studentId: "student-1",
    studentName: "Private Name",
    email: "private@example.com",
    phone: "0700000000",
    academicYear: "2026",
  });
  assert.equal(row.studentId, "student-1");
  assert.equal(row.academicYear, "2026");
  assert.equal(row.studentName, undefined);
  assert.equal(row.email, undefined);
  assert.equal(row.phone, undefined);
});

test("marks audit reports coverage, duplicates, range, and attendance conflicts", () => {
  const base = {
    schemaVersion: 2,
    studentId: "s1",
    academicYearKey: "2026",
    termKey: "term-1",
    gradeNumber: 10,
    classKey: "10-a",
    subjectKey: "math",
    assessmentKey: "term",
    markKey: "s1__2026__term-1__term__math",
  };
  const report = analyzeCanonicalCoverage({
    students: [{ id: "s1", schemaVersion: 2, academicYearKey: "2026", gradeNumber: 10, classKey: "10-a" }],
    subjects: [{ id: "math", schemaVersion: 2, subjectKey: "math" }],
    marks: [
      { id: "generated-1", ...base, subjectId: "math", mark: 101, absent: false },
      { id: "generated-2", ...base, subjectId: "math", mark: 80, absent: true },
    ],
  });
  assert.equal(report.marks.coveragePercentage, 100);
  assert.equal(report.marks.duplicateCanonicalIdentities.groups, 1);
  assert.equal(report.marks.invalidNumericMarks, 1);
  assert.equal(report.marks.attendanceInconsistencies, 1);
  assert.equal(report.marks.generatedDocumentIds, 2);
  assert.equal(report.marks.duplicateCanonicalIdentities.identityHashes[0].identityHash.length, 16);
});

test("production audit is rejected unless explicitly approved and confirmed", () => {
  const missingApproval = parseArguments(["--confirm-project", "school-prod"]);
  assert.throws(() => validateOptions(missingApproval), /Production reads are disabled/);
  const approved = parseArguments(["--allow-production-read", "--confirm-project", "school-prod"]);
  assert.doesNotThrow(() => validateOptions(approved));
});

test("emulator audit does not require production approval", () => {
  const options = parseArguments(["--emulator", "--confirm-project", "demo-school"]);
  assert.equal(options.emulatorHost, "127.0.0.1:8080");
  assert.doesNotThrow(() => validateOptions(options));
});
