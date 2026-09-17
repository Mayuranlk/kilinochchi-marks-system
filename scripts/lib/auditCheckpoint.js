"use strict";

const fs = require("fs");
const path = require("path");

function readCheckpoint(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { version: 1, collections: {} };
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (parsed.version !== 1 || typeof parsed.collections !== "object") {
    throw new Error("Unsupported or invalid audit checkpoint.");
  }
  return parsed;
}

function writeCheckpoint(filePath, checkpoint) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

module.exports = { readCheckpoint, writeCheckpoint };
