"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze } = require("../analyzeDashboardStudentIds");

test("detects student IDs that exact Firestore equality would miss", () => {
  const result = analyze({ collections: {
    students: { complete: true, documents: [{ id: "1" }] },
    marks: { complete: true, documents: [{ studentId: " 1 " }, { studentId: 1 }, { studentId: "missing" }, {}] },
    studentSubjectEnrollments: { complete: true, documents: [{ studentId: "1" }] },
  } });
  assert.equal(result.collections.marks.whitespaceId, 1);
  assert.equal(result.collections.marks.nonStringId, 1);
  assert.equal(result.collections.marks.missingId, 1);
  assert.equal(result.collections.marks.unresolvedStudentId, 1);
  assert.equal(result.studentIdsCompleteAndConsistent, false);
});

test("partial scans cannot establish full ID coverage", () => {
  const result = analyze({ collections: {
    students: { complete: true, documents: [{ id: "1" }] },
    marks: { complete: false, documents: [{ studentId: "1" }] },
    studentSubjectEnrollments: { complete: true, documents: [{ studentId: "1" }] },
  } });
  assert.equal(result.studentIdsCompleteAndConsistent, false);
});

test("whitespace and duplicate normalized student document IDs block consistency", () => {
  const result = analyze({ collections: {
    students: { complete: true, documents: [{ id: "one" }, { id: " one " }] },
    marks: { complete: true, documents: [] },
    studentSubjectEnrollments: { complete: true, documents: [] },
  } });
  assert.equal(result.studentDocumentIdWhitespace, 1);
  assert.equal(result.normalizedStudentIdDuplicates, 1);
  assert.equal(result.studentIdsCompleteAndConsistent, false);
});
