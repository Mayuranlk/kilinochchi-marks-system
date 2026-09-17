#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { analyzeCanonicalCoverage } = require("./lib/canonicalAuditUtils");
const { writeJsonReport, writeMarkdownReport } = require("./lib/auditReportWriter");

function parseArguments(argv) {
  const options = { checkpoint: "", project: "", json: "", markdown: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--checkpoint", "--project", "--json", "--markdown"].includes(flag) || !value || value.startsWith("--")) {
      throw new Error(`Invalid or incomplete argument: ${flag}`);
    }
    options[flag.slice(2)] = value;
    index += 1;
  }
  if (!options.checkpoint || !options.project || !options.json || !options.markdown) {
    throw new Error("--checkpoint, --project, --json, and --markdown are required.");
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const checkpoint = JSON.parse(fs.readFileSync(options.checkpoint, "utf8"));
  if (checkpoint.projectId !== options.project) throw new Error("Checkpoint project does not match --project.");
  const collectionDocuments = {};
  for (const [name, state] of Object.entries(checkpoint.collections || {})) {
    collectionDocuments[name] = state.documents || [];
  }
  if (collectionDocuments.classrooms) {
    collectionDocuments.classTeacherAssignments = collectionDocuments.classrooms
      .filter((row) => row.classTeacherId || row.classTeacherUid)
      .map((row) => ({ ...row, teacherId: row.classTeacherId || row.classTeacherUid }));
  }
  const report = {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    projectId: options.project,
    mode: "offline-summary-of-temporary-production-read-checkpoint",
    interrupted: true,
    partial: true,
    completion: Object.fromEntries(Object.entries(checkpoint.collections || {}).map(([name, state]) => [name, {
      documentsRead: (state.documents || []).length,
      complete: Boolean(state.complete),
      cursorPresent: Boolean(state.cursor),
    }])),
    collections: analyzeCanonicalCoverage(collectionDocuments),
  };
  writeJsonReport(options.json, report);
  writeMarkdownReport(options.markdown, report);
  process.stdout.write(`Partial aggregate-only reports written; project=${options.project}, writes=0.\n`);
  return report;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`Checkpoint summary stopped safely: ${error.message}\n`); process.exitCode = 2; }
}

module.exports = { main, parseArguments };
