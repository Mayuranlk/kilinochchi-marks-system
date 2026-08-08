#!/usr/bin/env node
"use strict";

const { READ_COLLECTIONS } = require("./lib/canonicalAuditUtils");
const { initializeFirebaseCliReadOnlyFirestore } = require("./lib/firestoreAuditReader");

function parseArguments(argv) {
  const options = { project: "", confirmProject: "", collections: READ_COLLECTIONS };
  const valueFor = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") options.project = valueFor(index++, arg);
    else if (arg === "--confirm-project") options.confirmProject = valueFor(index++, arg);
    else if (arg === "--collections") options.collections = valueFor(index++, arg).split(",").map((value) => value.trim()).filter(Boolean);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.project || options.project !== options.confirmProject) {
    throw new Error("--project and --confirm-project must be present and exactly equal.");
  }
  const unknown = options.collections.filter((name) => !READ_COLLECTIONS.includes(name));
  if (unknown.length) throw new Error(`Unsupported collections: ${unknown.join(", ")}`);
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const db = await initializeFirebaseCliReadOnlyFirestore({ projectId: options.project });
  const collections = {};
  for (const name of options.collections) collections[name] = await db.countCollection(name);
  const totalDocuments = Object.values(collections).reduce((sum, count) => sum + count, 0);
  process.stdout.write(`${JSON.stringify({
    mode: "read-only-count-aggregation",
    projectId: options.project,
    authenticatedIdentity: db.auditIdentity,
    generatedAt: new Date().toISOString(),
    collections,
    totalDocuments,
    writes: 0,
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Canonical count stopped safely: ${error.message}\n`);
    process.exitCode = 2;
  });
}

module.exports = { main, parseArguments };
