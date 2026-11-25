"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBackfillPlan, main: planBackfill } = require("../planCanonicalBackfill");
const { evaluatePageReadiness } = require("../lib/queryReadinessGates");
const { estimateReads } = require("../estimateCanonicalAuditReads");

test("backfill plan is additive, idempotent, and skips duplicate identities", () => {
  const checkpoint = {
    projectId: "demo-school",
    collections: {
      students: {
        complete: true,
        documents: [{ id: "s1", academicYear: "2026", grade: "10", section: "A" }],
      },
      marks: {
        complete: true,
        documents: [
          { id: "m1", studentId: "s1", year: "2026", term: "Term 1", grade: 10, section: "A", fullClassName: "10 A", subjectId: "math", mark: 70 },
          { id: "m2", studentId: "s1", year: "2026", term: "Term 1", grade: 10, section: "A", fullClassName: "10 A", subjectId: "math", mark: 80 },
        ],
      },
      studentSubjectEnrollments: { documents: [] },
      classrooms: { complete: true, documents: [{ grade: 10, section: "A", fullClassName: "10 A" }] },
      subjects: { complete: true, documents: [{ id: "math" }] },
      academicTerms: { complete: true, documents: [] },
    },
  };
  const plan = buildBackfillPlan(checkpoint, ["students", "marks"]);
  assert.equal(plan.additiveOnly, true);
  assert.equal(plan.idempotent, true);
  assert.equal(plan.operations.length, 1);
  assert.equal(plan.operations[0].collection, "students");
  assert.equal(plan.operations[0].patch.classKey, "10-a");
  assert.equal(plan.skipped.length, 2);
  assert.ok(plan.skipped.every((row) => row.reasons.includes("duplicate_logical_identity")));
});

test("backfill plan excludes incomplete scans and conflicting class identities", () => {
  const checkpoint = { projectId: "demo-school", collections: {
    students: { complete: true, documents: [{ id: "s1" }] },
    subjects: { complete: true, documents: [{ id: "math" }] },
    academicTerms: { complete: true, documents: [] },
    classrooms: { complete: true, documents: [{ grade: 10, section: "A", fullClassName: "10 A" }] },
    marks: { complete: false, documents: [{ id: "m1", studentId: "s1", year: "2026", term: "Term 1", grade: 10, section: "A", className: "A", subjectId: "math" }] },
  } };
  const plan = buildBackfillPlan(checkpoint, ["marks"]);
  assert.equal(plan.executionAllowed, false);
  assert.deepEqual(plan.incompleteCollections, ["marks"]);
  assert.equal(plan.operations.length, 0);
  assert.ok(plan.skipped[0].reasons.includes("source_collection_incomplete"));
  assert.ok(plan.skipped[0].reasons.includes("class_key_mismatch_requires_review"));
});

test("backfill plan skips unresolved identities and conflicting term aliases", () => {
  const checkpoint = { collections: {
    students: { complete: true, documents: [{ id: "known" }] },
    subjects: { complete: true, documents: [{ id: "math" }] },
    academicTerms: { complete: true, documents: [] },
    classrooms: { complete: true, documents: [{ grade: 10, section: "A", fullClassName: "10 A" }] },
    marks: { complete: true, documents: [{ id: "m", studentId: "unknown", year: "2026", term: "Term 1", termName: "Term 2", grade: 10, section: "A", fullClassName: "10 A", subjectId: "unknown-subject" }] },
  } };
  const plan = buildBackfillPlan(checkpoint, ["marks"]);
  assert.equal(plan.operations.length, 0);
  for (const reason of ["unresolved_student_reference", "unresolved_subject_reference", "conflicting_term_aliases"]) assert.ok(plan.skipped[0].reasons.includes(reason));
});

test("backfill planner refuses apply mode", () => {
  assert.throws(() => planBackfill(["--apply"]), /deliberately disabled/);
});

test("page gate requires complete safe coverage and reconciliation", () => {
  const collections = {};
  for (const name of ["students", "studentSubjectEnrollments", "marks", "classrooms", "academicTerms"]) {
    collections[name] = {
      coveragePercentage: 100,
      duplicateCanonicalIdentities: { groups: 0 },
      recordsUnsafeForAutomaticMigration: 0,
    };
  }
  const ready = evaluatePageReadiness("ClassReport", { partial: false, collections }, { ClassReport: { status: "passed" } });
  assert.equal(ready.ready, true);
  collections.marks.coveragePercentage = 99.5;
  const blocked = evaluatePageReadiness("ClassReport", { partial: false, collections }, { ClassReport: { status: "passed" } });
  assert.equal(blocked.ready, false);
  assert.match(blocked.failures.join(" "), /marks/);
});

test("capped production audit estimate counts only real queried collections", () => {
  const estimate = estimateReads({
    collections: ["students", "studentSubjectEnrollments", "marks", "classrooms", "subjects", "academicTerms", "teacherAssignments"],
    batchSize: 100,
    maximumDocuments: 100,
  });
  assert.equal(estimate.collectionCount, 7);
  assert.equal(estimate.minimumDocumentReadsIfEveryCollectionIsEmpty, 7);
  assert.equal(estimate.maximumDocumentReads, 700);
  assert.equal(estimate.maximumQueries, 7);
  assert.equal(estimate.writes, 0);
});
