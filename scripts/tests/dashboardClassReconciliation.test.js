"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReview, candidateClassrooms } = require("../planDashboardClassReconciliation");

test("class mismatches remain review-only, including an existing conflicting key", () => {
  const report = buildReview({ projectId: "demo", collections: {
    classrooms: { complete: true, documents: [{ grade: 6, section: "A", fullClassName: "6A" }] },
    marks: { complete: false, documents: [
      { id: "private-id", grade: 6, section: "A", className: "A" },
      { id: "other", grade: 6, section: "A", className: "A", classKey: "different" },
    ] },
  } });
  assert.equal(report.writesEnabled, false);
  assert.equal(report.completeSources.marks, false);
  assert.equal(report.totals.marks.mismatchedDerivedKey, 2);
  assert.equal(report.totals.marks.existingKeyConflicts, 1);
  assert.equal(report.candidates.length, 2);
  assert.equal(JSON.stringify(report).includes("private-id"), false);
});

test("refuses to resolve when the classroom scan is incomplete", () => {
  const report = buildReview({ collections: {
    classrooms: { complete: false, documents: [{ grade: 6, section: "A", fullClassName: "6A" }] },
    marks: { documents: [{ id: "m", grade: 6, section: "A", className: "A" }] },
  } });
  assert.equal(report.totals.marks.reasons.classroom_audit_incomplete, 1);
});

test("A/L students require one explicit matching stream", () => {
  const rooms = [{ grade: 12, section: "A", stream: "Arts" }, { grade: 12, section: "A", stream: "Science" }];
  assert.equal(candidateClassrooms({ grade: 12, section: "A" }, rooms).reason, "missing_stream");
  assert.equal(candidateClassrooms({ grade: 12, section: "A", stream: "Commerce" }, rooms).reason, "stream_not_resolved");
  assert.equal(candidateClassrooms({ grade: 12, section: "A", stream: "Science" }, rooms).reason, "unique_classroom_for_review");
  assert.equal(candidateClassrooms({ grade: 12, section: "A", stream: "Science" }, [...rooms, rooms[1]]).reason, "ambiguous_classroom");
});
