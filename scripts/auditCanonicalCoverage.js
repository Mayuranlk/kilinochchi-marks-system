#!/usr/bin/env node
"use strict";

const path = require("path");
const { COLLECTION_SPECS, READ_COLLECTIONS, analyzeCanonicalCoverage, sanitizeAuditRow } = require("./lib/canonicalAuditUtils");
const { readCheckpoint, writeCheckpoint } = require("./lib/auditCheckpoint");
const { initializeAuditFirestore, readCollectionInPages } = require("./lib/firestoreAuditReader");
const { writeJsonReport, writeMarkdownReport } = require("./lib/auditReportWriter");

function parseArguments(argv) {
  const options = {
    collections: READ_COLLECTIONS,
    batchSize: 250,
    maximumDocuments: Number.MAX_SAFE_INTEGER,
    checkpoint: path.join("audit-output", "canonical-coverage.checkpoint.json"),
    json: path.join("audit-output", "canonical-coverage.json"),
    markdown: path.join("audit-output", "canonical-coverage.md"),
    resume: false,
    allowProductionRead: false,
    confirmProject: "",
    emulatorHost: "",
    startCursor: "",
    help: false,
  };

  const valueFor = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--allow-production-read") options.allowProductionRead = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--confirm-project") options.confirmProject = valueFor(index++, arg);
    else if (arg === "--collections") options.collections = valueFor(index++, arg).split(",").map((v) => v.trim()).filter(Boolean);
    else if (arg === "--batch-size") options.batchSize = Number(valueFor(index++, arg));
    else if (arg === "--maximum-documents") options.maximumDocuments = Number(valueFor(index++, arg));
    else if (arg === "--start-cursor") options.startCursor = valueFor(index++, arg);
    else if (arg === "--checkpoint") options.checkpoint = valueFor(index++, arg);
    else if (arg === "--json") options.json = valueFor(index++, arg);
    else if (arg === "--markdown") options.markdown = valueFor(index++, arg);
    else if (arg === "--emulator") {
      const possibleHost = argv[index + 1];
      options.emulatorHost = possibleHost && !possibleHost.startsWith("--") ? argv[++index] : "127.0.0.1:8080";
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function validateOptions(options) {
  const unknown = options.collections.filter((name) => !READ_COLLECTIONS.includes(name));
  if (unknown.length) throw new Error(`Unsupported collections: ${unknown.join(", ")}`);
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error("--batch-size must be an integer from 1 to 500.");
  }
  if (!Number.isSafeInteger(options.maximumDocuments) || options.maximumDocuments < 1) {
    throw new Error("--maximum-documents must be a positive safe integer.");
  }
  if (!options.confirmProject) throw new Error("--confirm-project is required in emulator and production modes.");
  if (!options.emulatorHost && !options.allowProductionRead) {
    throw new Error("Production reads are disabled by default. Use --emulator or explicitly add --allow-production-read.");
  }
  if (options.startCursor && options.collections.length !== 1 && !options.startCursor.includes(":")) {
    throw new Error("A raw --start-cursor can only be used with one collection; otherwise use collection:documentId.");
  }
}

function startCursorFor(options, collectionName) {
  if (!options.startCursor) return "";
  if (!options.startCursor.includes(":")) return options.startCursor;
  const separator = options.startCursor.indexOf(":");
  return options.startCursor.slice(0, separator) === collectionName
    ? options.startCursor.slice(separator + 1)
    : "";
}

function usage() {
  return `Canonical Firestore coverage auditor (read-only)\n\n` +
    `Emulator:\n  node scripts/auditCanonicalCoverage.js --emulator --confirm-project demo-kilinochchi\n\n` +
    `Production (requires ADC and two explicit confirmations):\n` +
    `  node scripts/auditCanonicalCoverage.js --allow-production-read --confirm-project <firebase-project-id>\n\n` +
    `Options: --collections a,b --batch-size 250 --maximum-documents 10000\n` +
    `         --start-cursor [collection:]documentId --checkpoint file --resume\n` +
    `         --json file --markdown file\n\nNo write API is imported by this program.`;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  validateOptions(options);

  const mode = options.emulatorHost ? `emulator:${options.emulatorHost}` : "production-read-approved";
  process.stdout.write(`READ-ONLY canonical audit: project=${options.confirmProject}, mode=${mode}\n`);
  const db = initializeAuditFirestore({ projectId: options.confirmProject, emulatorHost: options.emulatorHost });
  const checkpoint = options.resume
    ? readCheckpoint(options.checkpoint)
    : { version: 1, projectId: options.confirmProject, mode, collections: {} };
  if (checkpoint.projectId && checkpoint.projectId !== options.confirmProject) {
    throw new Error("Checkpoint project does not match --confirm-project.");
  }

  let interrupted = false;
  const stop = () => { interrupted = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  for (const collectionName of options.collections) {
    if (interrupted) break;
    const saved = checkpoint.collections[collectionName] || { cursor: "", documents: [], complete: false };
    if (options.resume && saved.complete) continue;
    const initialCursor = options.resume ? saved.cursor : startCursorFor(options, collectionName);
    const previousDocuments = options.resume ? saved.documents || [] : [];
    const readDocuments = [];
    const remainingMaximum = Math.max(0, options.maximumDocuments - previousDocuments.length);
    if (!remainingMaximum) continue;

    const result = await readCollectionInPages({
      db,
      collectionName,
      batchSize: options.batchSize,
      maximumDocuments: remainingMaximum,
      startCursor: initialCursor,
      shouldStop: () => interrupted,
      onPage: async ({ cursor, complete, page }) => {
        readDocuments.push(...page.map(sanitizeAuditRow));
        checkpoint.collections[collectionName] = {
          cursor,
          complete,
          documents: [...previousDocuments, ...readDocuments],
        };
        writeCheckpoint(options.checkpoint, checkpoint);
      },
    });
    const documents = [...previousDocuments, ...readDocuments];
    checkpoint.collections[collectionName] = { cursor: result.cursor, complete: result.complete, documents };
    writeCheckpoint(options.checkpoint, checkpoint);
    process.stdout.write(`${collectionName}: ${documents.length} document(s), complete=${result.complete}\n`);
  }

  const collectionDocuments = {};
  for (const name of options.collections) {
    collectionDocuments[name] = checkpoint.collections[name]?.documents || [];
  }
  // The source schema stores class-teacher identity on classroom documents;
  // there is no classTeacherAssignments collection to query.
  if (collectionDocuments.classrooms) {
    collectionDocuments.classTeacherAssignments = collectionDocuments.classrooms
      .filter((row) => row.classTeacherId || row.classTeacherUid)
      .map((row) => ({
        ...row,
        teacherId: row.classTeacherId || row.classTeacherUid,
      }));
  }
  const report = {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    projectId: options.confirmProject,
    mode,
    interrupted,
    partial: interrupted || options.collections.some((name) => !checkpoint.collections[name]?.complete),
    collections: analyzeCanonicalCoverage(collectionDocuments),
  };
  writeJsonReport(options.json, report);
  writeMarkdownReport(options.markdown, report);
  process.stdout.write(`Reports written to ${options.json} and ${options.markdown}\n`);
  return interrupted ? 130 : 0;
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`Audit stopped safely: ${error.message}\n`);
    process.exitCode = 2;
  });
}

module.exports = { main, parseArguments, startCursorFor, validateOptions };
