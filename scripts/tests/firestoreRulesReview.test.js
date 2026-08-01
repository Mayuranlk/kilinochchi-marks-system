"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { validateRulesReview } = require("../validateFirestoreRulesReview");

test("deployed evidence and proposed review pass structural safety controls", () => {
  const result = validateRulesReview({
    deployedSource: fs.readFileSync("firestore.rules.deployed.review", "utf8"),
    proposedSource: fs.readFileSync("firestore.rules.proposed.review", "utf8"),
    firebaseConfig: fs.readFileSync("firebase.json", "utf8"),
  });
  assert.equal(result.valid, true, result.failures.join("; "));
});

test("validator rejects the deployed broad grant in a proposal", () => {
  const result = validateRulesReview({
    deployedSource: "allow read, write: if request.auth != null;",
    proposedSource: "allow read, write: if request.auth != null;",
    firebaseConfig: "{}",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.includes("wildcard")));
});
