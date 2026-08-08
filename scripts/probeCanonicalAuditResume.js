#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { initializeFirebaseCliReadOnlyFirestore } = require("./lib/firestoreAuditReader");

function parseArguments(argv) {
  const options = { project: "", confirmProject: "", checkpoint: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--project", "--confirm-project", "--checkpoint"].includes(flag) || !value || value.startsWith("--")) {
      throw new Error(`Invalid or incomplete argument: ${flag}`);
    }
    options[flag === "--confirm-project" ? "confirmProject" : flag.slice(2)] = value;
    index += 1;
  }
  if (!options.project || options.project !== options.confirmProject) {
    throw new Error("--project and --confirm-project must be present and exactly equal.");
  }
  if (!options.checkpoint) throw new Error("--checkpoint is required.");
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const checkpoint = JSON.parse(fs.readFileSync(options.checkpoint, "utf8"));
  const marks = checkpoint.collections?.marks;
  if (checkpoint.projectId !== options.project || !marks?.cursor || marks.complete) {
    throw new Error("Checkpoint identity or Marks resume state is invalid.");
  }
  const db = await initializeFirebaseCliReadOnlyFirestore({ projectId: options.project, maxAttempts: 1 });
  const result = await db.readCollectionPage({ collectionName: "marks", limit: 1, startCursor: marks.cursor });
  process.stdout.write(JSON.stringify({
    projectId: options.project,
    authenticatedIdentity: db.auditIdentity,
    documentsReturned: result.documents.length,
    checkpointDocuments: marks.documents.length,
    checkpointChanged: false,
    writes: 0,
  }, null, 2) + "\n");
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Read-only resume probe stopped safely: ${error.message}\n`);
    process.exitCode = 2;
  });
}

module.exports = { main, parseArguments };
