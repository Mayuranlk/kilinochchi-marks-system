#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function option(argv, flag, fallback = "") {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : fallback;
}

function digest(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function normalizedLines(source) {
  return source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function main(argv = process.argv.slice(2)) {
  const deployedPath = option(argv, "--deployed");
  const candidatePath = option(argv, "--candidate", "firestore.rules.candidate");
  const outputPath = option(argv, "--output", path.join("audit-output", "rules-structural-comparison.json"));
  if (!deployedPath) throw new Error("--deployed is required. Retrieve actual Rules first.");
  const deployed = fs.readFileSync(deployedPath, "utf8");
  const candidate = fs.readFileSync(candidatePath, "utf8");
  const deployedLines = new Set(normalizedLines(deployed));
  const candidateLines = new Set(normalizedLines(candidate));
  const result = {
    generatedAt: new Date().toISOString(),
    deployedPath,
    candidatePath,
    deployedSha256: digest(deployed),
    candidateSha256: digest(candidate),
    identical: deployed === candidate,
    deployedLineCount: deployed.split(/\r?\n/).length,
    candidateLineCount: candidate.split(/\r?\n/).length,
    linesOnlyInDeployed: [...deployedLines].filter((line) => !candidateLines.has(line)).slice(0, 200),
    linesOnlyInCandidate: [...candidateLines].filter((line) => !deployedLines.has(line)).slice(0, 200),
    note: "Structural evidence only. Complete the authorization matrix manually and with emulator tests.",
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`Rules structural comparison written to ${outputPath}. Identical=${result.identical}\n`);
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`Rules comparison stopped safely: ${error.message}\n`); process.exitCode = 2; }
}

module.exports = { main };
