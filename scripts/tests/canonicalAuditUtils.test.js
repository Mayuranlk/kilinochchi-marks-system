"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeCanonicalCoverage, sanitizeAuditRow } = require("../lib/canonicalAuditUtils");
const { parseArguments, validateOptions } = require("../auditCanonicalCoverage");
const { decodeFirestoreFields } = require("../lib/firestoreAuditReader");
const { parseArguments: parseCountArguments } = require("../countCanonicalAuditDocuments");

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
  const missingExplicitProject = parseArguments(["--allow-production-read", "--confirm-project", "school-prod"]);
  assert.throws(() => validateOptions(missingExplicitProject), /--project is required/);
  const approved = parseArguments(["--allow-production-read", "--project", "school-prod", "--confirm-project", "school-prod"]);
  assert.doesNotThrow(() => validateOptions(approved));
});

test("coverage states are mutually exclusive and duplicate identities are unsafe", () => {
  const complete = { schemaVersion: 2, academicYearKey: "2026", gradeNumber: 10, classKey: "10-a" };
  const report = analyzeCanonicalCoverage({
    students: [
      { id: "ready", academicYear: "2026", grade: 10, fullClassName: "10 A", ...complete },
      { id: "partial", academicYear: "2026", grade: 10, fullClassName: "10 A", schemaVersion: 2 },
      { id: "legacy", academicYear: "2026", grade: 10, fullClassName: "10 A" },
      { id: "malformed", academicYear: "2026", grade: 10, fullClassName: "10 A", schemaVersion: "2" },
    ],
    marks: [
      { id: "m1", studentId: "ready", year: "2026", term: "Term 1", grade: 10, fullClassName: "10 A", subjectId: "math" },
      { id: "m2", studentId: "ready", year: "2026", term: "Term 1", grade: 10, fullClassName: "10 A", subjectId: "math" },
    ],
  });
  assert.deepEqual(report.students.coverageStates, {
    canonicalReady: 1,
    partiallyCanonical: 1,
    legacyOnly: 1,
    malformed: 1,
  });
  assert.equal(Object.values(report.students.coverageStates).reduce((sum, value) => sum + value, 0), 4);
  assert.equal(report.marks.duplicateCanonicalIdentities.documents, 2);
  assert.equal(report.marks.unsafeReasonCounts.duplicate_logical_identity, 2);
});

test("heterogeneous identity aliases are not falsely classified as ambiguous", () => {
  const report = analyzeCanonicalCoverage({
    marks: [{
      id: "m1", studentId: "s1", academicYear: "2026", year: 2026,
      term: "Term 1", termName: "Term 1", grade: 10,
      fullClassName: "10 A", className: "A", section: "A",
      subjectId: "subject-123", subjectCode: "MATH", subjectName: "Mathematics",
    }],
  });
  assert.deepEqual(report.marks.ambiguousNormalization, {});
});

test("emulator audit does not require production approval", () => {
  const options = parseArguments(["--emulator", "--confirm-project", "demo-school"]);
  assert.equal(options.emulatorHost, "127.0.0.1:8080");
  assert.doesNotThrow(() => validateOptions(options));
});

test("CLI read adapter decodes Firestore REST fields without retaining document metadata", () => {
  assert.deepEqual(decodeFirestoreFields({
    schemaVersion: { integerValue: "2" },
    academicYearKey: { stringValue: "2026" },
    active: { booleanValue: true },
    nested: { mapValue: { fields: { value: { doubleValue: 4.5 } } } },
  }), { schemaVersion: 2, academicYearKey: "2026", active: true, nested: { value: 4.5 } });
});

test("count preflight requires two exact project confirmations", () => {
  assert.throws(() => parseCountArguments(["--project", "school-prod", "--confirm-project", "other"]), /exactly equal/);
  assert.equal(parseCountArguments(["--project", "school-prod", "--confirm-project", "school-prod"]).project, "school-prod");
});
