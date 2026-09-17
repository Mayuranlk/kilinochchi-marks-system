#!/usr/bin/env node
"use strict";

const fs = require("fs");

const REQUIRED_MATCHES = [
  "users", "students", "subjects", "classrooms", "academicTerms", "practiceExams",
  "teacherAssignments", "studentSubjectEnrollments", "marks", "systemSettings",
  "studentFeeAccounts", "lateArrivalRecords", "elections", "auditLogs",
  "classShufflePlans", "promotionHistory", "teachers",
];

function validateRulesReview({ deployedSource, proposedSource, firebaseConfig }) {
  const failures = [];
  const warnings = [];
  const normalizedDeployed = deployedSource.replace(/\s+/g, " ").trim();
  if (!normalizedDeployed.includes("allow read, write: if request.auth != null;")) {
    failures.push("deployed review does not contain the verified authenticated wildcard grant");
  }
  if (proposedSource.includes("allow read, write: if request.auth != null;")) {
    failures.push("proposed rules retain the deployed authenticated wildcard grant");
  }
  for (const collectionName of REQUIRED_MATCHES) {
    if (!proposedSource.includes(`match /${collectionName}/`)) {
      failures.push(`proposed rules omit ${collectionName}`);
    }
  }
  if (!/match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/.test(proposedSource)) {
    failures.push("proposed fallback is not explicit default deny");
  }
  for (const requiredMarkControl of [
    "data.mark >= 0", "data.mark <= 100", "data.absent == data.isAbsent",
    "data.teacherId == request.auth.uid", "teacherPreservesMarkIdentity()",
  ]) {
    if (!proposedSource.includes(requiredMarkControl)) failures.push(`missing mark control: ${requiredMarkControl}`);
  }
  if (firebaseConfig.includes("firestore.rules.proposed.review")) {
    failures.push("firebase.json references the proposed review rules");
  }
  if (!proposedSource.includes("REVIEW ONLY")) warnings.push("proposed file lacks review-only banner");
  return { valid: failures.length === 0, failures, warnings };
}

function main() {
  const result = validateRulesReview({
    deployedSource: fs.readFileSync("firestore.rules.deployed.review", "utf8"),
    proposedSource: fs.readFileSync("firestore.rules.proposed.review", "utf8"),
    firebaseConfig: fs.readFileSync("firebase.json", "utf8"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
  return result;
}

if (require.main === module) main();

module.exports = { REQUIRED_MATCHES, validateRulesReview };
