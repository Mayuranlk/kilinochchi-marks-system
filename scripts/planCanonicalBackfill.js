#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { COLLECTION_SPECS, canonicalFor, hashIdentity } = require("./lib/canonicalAuditUtils");
const { candidateClassrooms } = require("./planDashboardClassReconciliation");
const canonical = require("../src/shared/firestoreCanonicalCore");

const MIGRATABLE_COLLECTIONS = ["students", "studentSubjectEnrollments", "marks"];

function parseArguments(argv) {
  const options = { checkpoint: "", output: path.join("audit-output", "canonical-backfill-plan.json"), collections: MIGRATABLE_COLLECTIONS, apply: false };
  const valueFor = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--checkpoint") options.checkpoint = valueFor(index++, arg);
    else if (arg === "--output") options.output = valueFor(index++, arg);
    else if (arg === "--collections") options.collections = valueFor(index++, arg).split(",").map((v) => v.trim());
    else if (arg === "--apply") options.apply = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function sameValue(left, right) {
  return left === right || (Number.isNaN(left) && Number.isNaN(right));
}

function buildBackfillPlan(checkpoint, selectedCollections = MIGRATABLE_COLLECTIONS) {
  const operations = [];
  const skipped = [];
  const collections = checkpoint.collections || {};
  const complete = (name) => collections[name]?.complete === true;
  const studentIds = new Set((collections.students?.documents || []).map((row) => String(row.id)));
  const subjectIds = new Set((collections.subjects?.documents || []).map((row) => String(row.id)));
  const classrooms = collections.classrooms?.documents || [];
  const terms = collections.academicTerms?.documents || [];
  const incompleteCollections = [...new Set([...selectedCollections, "classrooms", "students", "subjects", "academicTerms"])]
    .filter((name) => !complete(name));
  for (const collectionName of selectedCollections) {
    if (!MIGRATABLE_COLLECTIONS.includes(collectionName)) throw new Error(`Backfill is not approved for ${collectionName}.`);
    const rows = checkpoint.collections?.[collectionName]?.documents || [];
    const spec = COLLECTION_SPECS[collectionName];
    const identityGroups = new Map();
    const derivedRows = rows.map((row) => {
      const derived = canonicalFor(collectionName, row);
      const identity = derived[spec.identity] || row.id;
      if (identity) identityGroups.set(identity, (identityGroups.get(identity) || 0) + 1);
      return { row, derived, identity };
    });

    for (const { row, derived, identity } of derivedRows) {
      const reasons = [];
      if (!complete(collectionName)) reasons.push("source_collection_incomplete");
      if (!complete("classrooms")) reasons.push("classrooms_incomplete");
      if (!complete("students")) reasons.push("students_incomplete");
      if (!complete("subjects")) reasons.push("subjects_incomplete");
      if (!complete("academicTerms")) reasons.push("academic_terms_incomplete");
      if (!row.id) reasons.push("missing_document_id");
      if (!identity || String(identity).split("__").some((part) => part === "")) reasons.push("incomplete_logical_identity");
      if (identity && identityGroups.get(identity) > 1) reasons.push("duplicate_logical_identity");
      if (collectionName !== "students") {
        if (!canonical.text(row.studentId)) reasons.push("missing_student_identity");
        else if (complete("students") && !studentIds.has(canonical.text(row.studentId))) reasons.push("unresolved_student_reference");
        if (row.subjectId && complete("subjects") && !subjectIds.has(canonical.text(row.subjectId))) reasons.push("unresolved_subject_reference");
      }
      if (row.academicYear && row.year && canonical.academicYearKey(row.academicYear) !== canonical.academicYearKey(row.year)) reasons.push("conflicting_year_aliases");
      if (row.term && row.termName && canonical.slug(row.term) !== canonical.slug(row.termName)) reasons.push("conflicting_term_aliases");
      if (collectionName === "marks") {
        const rawMark = row.mark ?? row.marks ?? row.score;
        const hasMark = rawMark !== undefined && rawMark !== null && rawMark !== "";
        if (hasMark && (!Number.isFinite(Number(rawMark)) || Number(rawMark) < 0 || Number(rawMark) > 100)) reasons.push("invalid_numeric_mark");
        if ((row.absent === true || row.isAbsent === true) && hasMark) reasons.push("absent_with_mark");
        if (complete("academicTerms")) {
          const termName = canonical.slug(row.term || row.termName);
          const year = canonical.academicYearKey(row.academicYear || row.year);
          const matches = terms.filter((term) => canonical.academicYearKey(term.academicYear || term.year) === year &&
            canonical.slug(term.term || term.termName || term.name) === termName);
          if (matches.length !== 1) reasons.push("academic_term_not_uniquely_resolved");
          else if (canonical.buildCanonicalAcademicFields(matches[0]).termKey !== derived.termKey) reasons.push("term_key_mismatch_requires_review");
        }
      }
      if (complete("classrooms")) {
        const match = candidateClassrooms(row, classrooms);
        if (match.reason !== "unique_classroom_for_review") reasons.push(`class_${match.reason}`);
        else if (canonical.buildCanonicalAcademicFields(match.matches[0]).classKey !== derived.classKey) reasons.push("class_key_mismatch_requires_review");
      }
      const patch = {};
      for (const field of spec.required) {
        const expected = derived[field];
        if (expected === undefined || expected === null || expected === "") {
          reasons.push(`cannot_derive_${field}`);
          continue;
        }
        const current = row[field];
        if (current === undefined || current === null || current === "") patch[field] = expected;
        else if (!sameValue(current, expected)) reasons.push(`conflicting_${field}`);
      }
      if (reasons.length) {
        skipped.push({ collection: collectionName, documentIdHash: hashIdentity(row.id), reasons: [...new Set(reasons)] });
      } else if (Object.keys(patch).length) {
        operations.push({ collection: collectionName, documentId: row.id, patch });
      }
    }
  }
  return {
    planVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceProjectId: checkpoint.projectId || "unknown",
    mode: "dry-run-only",
    executionAllowed: false,
    incompleteCollections,
    additiveOnly: true,
    idempotent: true,
    operationCount: operations.length,
    skippedCount: skipped.length,
    operations,
    skipped,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.apply) throw new Error("--apply is deliberately disabled. This tool creates a dry-run plan only; production execution requires a separately reviewed migration runner and change approval.");
  if (!options.checkpoint) throw new Error("--checkpoint is required.");
  const checkpoint = JSON.parse(fs.readFileSync(options.checkpoint, "utf8"));
  const plan = buildBackfillPlan(checkpoint, options.collections);
  fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  process.stdout.write(`Dry-run plan only: ${plan.operationCount} additive operation(s), ${plan.skippedCount} skipped.\n`);
  return plan;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`Backfill planning stopped safely: ${error.message}\n`); process.exitCode = 2; }
}

module.exports = { buildBackfillPlan, main, parseArguments };
