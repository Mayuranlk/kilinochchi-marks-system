#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { evaluateAllPages } = require("./lib/queryReadinessGates");

function argument(argv, flag, fallback = "") {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : fallback;
}

function main(argv = process.argv.slice(2)) {
  const auditPath = argument(argv, "--audit");
  const reconciliationPath = argument(argv, "--reconciliation");
  const outputPath = argument(argv, "--output", path.join("audit-output", "query-readiness.json"));
  if (!auditPath) throw new Error("--audit is required.");
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const reconciliation = reconciliationPath
    ? JSON.parse(fs.readFileSync(reconciliationPath, "utf8"))
    : {};
  const pages = evaluateAllPages(audit, reconciliation);
  const result = {
    generatedAt: new Date().toISOString(),
    projectId: audit.projectId,
    allReady: pages.every((page) => page.ready),
    pages,
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${result.allReady ? "READY" : "BLOCKED"}: ${pages.filter((page) => page.ready).length}/${pages.length} page gates passed.\n`);
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`Readiness evaluation failed safely: ${error.message}\n`); process.exitCode = 2; }
}

module.exports = { main };
