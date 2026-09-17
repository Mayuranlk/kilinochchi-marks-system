#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const rules = require("firebase-tools/lib/gcp/rules");

function parseArguments(argv) {
  const options = { project: "", output: "", metadata: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--project", "--output", "--metadata"].includes(flag) || !value || value.startsWith("--")) {
      throw new Error(`Invalid or incomplete argument: ${flag}`);
    }
    options[flag.slice(2)] = value;
    index += 1;
  }
  if (!options.project) throw new Error("--project is required.");
  if (!options.output) throw new Error("--output is required.");
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("No authenticated Firebase CLI account is available.");

  const authOptions = {
    project: args.project,
    projectId: args.project,
    user: account.user,
    tokens: account.tokens,
  };
  const identity = await requireAuth(authOptions);
  const releases = await rules.listAllReleases(args.project);
  const rulesetName = await rules.getLatestRulesetName(args.project, "cloud.firestore", releases);
  if (!rulesetName) throw new Error(`No active cloud.firestore Rules release exists for ${args.project}.`);
  const files = await rules.getRulesetContent(rulesetName);
  if (!Array.isArray(files) || files.length !== 1 || typeof files[0].content !== "string") {
    throw new Error("Expected exactly one deployed Firestore Rules source file.");
  }

  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, files[0].content, "utf8");

  const metadata = {
    projectId: args.project,
    authenticatedAccount: identity || account.user.email,
    releaseName: `projects/${args.project}/releases/cloud.firestore`,
    rulesetName,
    retrievedAt: new Date().toISOString(),
    sourceFileName: files[0].name,
    output: path.relative(process.cwd(), outputPath),
  };
  if (args.metadata) {
    const metadataPath = path.resolve(args.metadata);
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
    fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Rules retrieval stopped safely: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments };
