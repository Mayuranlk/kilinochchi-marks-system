"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze } = require("../analyzeDashboardKeyConsistency");

test("reports incompatible class and term keys without exposing identities", () => {
  const result = analyze({ collections: {
    classrooms: { complete: true, documents: [{ grade: 6, section: "A", fullClassName: "6A" }] },
    academicTerms: { complete: true, documents: [{ year: "2026", term: "Term 2" }] },
    studentSubjectEnrollments: { documents: [{ studentId: "private", grade: 6, section: "A", className: "A" }] },
    marks: { documents: [{ grade: 6, section: "A", fullClassName: "6A", year: "2026", term: "Term 2", termId: "random-id" }] },
  } });
  assert.equal(result.collections.studentSubjectEnrollments.classKeyMismatch, 1);
  assert.equal(result.collections.marks.classKeyMismatch, 0);
  assert.equal(result.collections.marks.termKeyMismatch, 1);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("does not guess when grade and section match multiple classrooms", () => {
  const result = analyze({ collections: {
    classrooms: { documents: [{ grade: 12, section: "A", stream: "Science" }, { grade: 12, section: "A", stream: "Arts" }] },
    marks: { documents: [{ grade: 12, section: "A", stream: "Science" }] },
  } });
  assert.equal(result.collections.marks.classComparable, 0);
  assert.equal(result.completeClassrooms, false);
});
