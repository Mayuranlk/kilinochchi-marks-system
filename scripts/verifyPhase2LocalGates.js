#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

function fail(message) {
  failures.push(message);
}

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  const env = read(".env");
  const forbiddenTrueFlags = [
    "REACT_APP_ENABLE_CANONICAL_SCOPED_READS",
    "REACT_APP_ENABLE_FIRESTORE_CURSOR_PAGINATION",
    "REACT_APP_ENABLE_SUMMARY_DOCUMENTS",
  ];
  for (const flag of forbiddenTrueFlags) {
    if (new RegExp(`^\\s*${flag}\\s*=\\s*true\\s*$`, "mi").test(env)) {
      fail(`${flag} must remain disabled.`);
    }
  }
}

if (fs.existsSync(path.join(root, ".firebaserc"))) {
  fail(".firebaserc must remain absent; operators must provide an explicit approved project.");
}

const normalConfig = JSON.parse(read("firebase.json"));
if (normalConfig.firestore) {
  fail("firebase.json must remain Hosting-only and must not contain a firestore target.");
}

const stagingConfig = JSON.parse(read("firebase.staging.rules.review.json"));
if (stagingConfig.firestore?.rules !== "firestore.rules.proposed.review") {
  fail("Staging review config must reference firestore.rules.proposed.review.");
}
if (stagingConfig.firestore?.indexes) {
  fail("Staging Rules review config must not deploy indexes.");
}

const sourceFiles = walk(path.join(root, "src")).filter(
  (file) => /\.[jt]sx?$/.test(file) && path.basename(file) !== "firestoreScopedRepository.js"
);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("firestoreScopedRepository")) {
    fail(`${path.relative(root, file)} imports or references the gated scoped repository.`);
  }
}

if (!read("scripts/planCanonicalBackfill.js").includes("--apply is deliberately disabled")) {
  fail("Canonical backfill planner no longer contains its explicit --apply rejection.");
}

if (failures.length) {
  process.stderr.write(`Phase 2 local activation gates: BLOCKED\n- ${failures.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    "Phase 2 local activation gates: PASS\n" +
      "Scoped reads, cursor pagination, summaries, migration execution, and remote Firestore deployment remain inactive.\n"
  );
}
