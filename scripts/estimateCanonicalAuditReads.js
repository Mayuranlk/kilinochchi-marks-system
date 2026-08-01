#!/usr/bin/env node
"use strict";

const { READ_COLLECTIONS } = require("./lib/canonicalAuditUtils");

function parseArguments(argv) {
  const options = { collections: READ_COLLECTIONS, batchSize: 100, maximumDocuments: 100, json: false };
  const valueFor = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--collections") options.collections = valueFor(index++, arg).split(",").map((v) => v.trim()).filter(Boolean);
    else if (arg === "--batch-size") options.batchSize = Number(valueFor(index++, arg));
    else if (arg === "--maximum-documents") options.maximumDocuments = Number(valueFor(index++, arg));
    else if (arg === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function estimateReads(options) {
  const unknown = options.collections.filter((name) => !READ_COLLECTIONS.includes(name));
  if (unknown.length) throw new Error(`Unsupported collections: ${unknown.join(", ")}`);
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) throw new Error("batch size must be 1-500");
  if (!Number.isSafeInteger(options.maximumDocuments) || options.maximumDocuments < 1) throw new Error("maximum documents must be positive");
  const collectionCount = options.collections.length;
  return {
    mode: "offline-estimate-only",
    collections: options.collections,
    collectionCount,
    batchSize: options.batchSize,
    maximumDocumentsPerCollection: options.maximumDocuments,
    maximumDocumentReads: collectionCount * options.maximumDocuments,
    minimumDocumentReadsIfEveryCollectionIsEmpty: collectionCount,
    maximumQueries: collectionCount * Math.ceil(options.maximumDocuments / options.batchSize),
    writes: 0,
    caveats: [
      "The maximum assumes each selected collection reaches the cap and there are no retries.",
      "Firestore charges a minimum of one document read for an empty query.",
      "Network transfer and location-specific currency pricing are not estimated.",
      "classTeacherAssignments is virtual and adds no collection query.",
    ],
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const estimate = estimateReads(options);
  if (options.json) process.stdout.write(`${JSON.stringify(estimate, null, 2)}\n`);
  else {
    process.stdout.write(
      `Offline estimate: ${estimate.collectionCount} collections, ` +
      `${estimate.minimumDocumentReadsIfEveryCollectionIsEmpty}-${estimate.maximumDocumentReads} document reads, ` +
      `0 writes, up to ${estimate.maximumQueries} queries.\n`
    );
  }
  return estimate;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`Estimate failed: ${error.message}\n`); process.exitCode = 2; }
}

module.exports = { estimateReads, main, parseArguments };
