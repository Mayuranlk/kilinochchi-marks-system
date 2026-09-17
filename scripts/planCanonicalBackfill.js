#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { COLLECTION_SPECS, canonicalFor, hashIdentity } = require("./lib/canonicalAuditUtils");

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
      if (!row.id) reasons.push("missing_document_id");
      if (!identity || String(identity).split("__").some((part) => part === "")) reasons.push("incomplete_logical_identity");
      if (identity && identityGroups.get(identity) > 1) reasons.push("duplicate_logical_identity");
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
