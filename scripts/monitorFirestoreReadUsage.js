#!/usr/bin/env node
"use strict";

// Read Cloud Monitoring metrics only; this never queries Firestore documents.
// This is an operational estimate, not a replacement for the quota dashboard.
const { Client } = require("firebase-tools/lib/apiv2");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");

async function main() {
  const project = process.argv[2];
  if (!project || process.argv[3] !== project) throw new Error("Pass the project ID twice to confirm it.");
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("Firebase CLI is not authenticated.");
  await requireAuth({ project, projectId: project, user: account.user, tokens: account.tokens });
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const client = new Client({ urlPrefix: "https://monitoring.googleapis.com", apiVersion: "v3" });
  const filter = 'metric.type="firestore.googleapis.com/document/read_ops_count"';
  let nextPageToken = "";
  let total = 0;
  let currentPacificDayReads = 0;
  let seriesCount = 0;
  const pacificDay = (date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const currentDay = pacificDay(end);
  do {
    const queryParams = { filter, "interval.startTime": start.toISOString(), "interval.endTime": end.toISOString(), pageSize: "1000" };
    if (nextPageToken) queryParams.pageToken = nextPageToken;
    const response = await client.get(`/projects/${project}/timeSeries`, { queryParams, resolveOnHTTPError: true, skipLog: { body: true, resBody: true } });
    if (response.status !== 200) throw new Error(`Cloud Monitoring returned HTTP ${response.status}.`);
    for (const series of response.body?.timeSeries || []) {
      seriesCount += 1;
      for (const point of series.points || []) {
        const count = Number(point.value?.int64Value || 0);
        total += count;
        if (point.interval?.endTime && pacificDay(new Date(point.interval.endTime)) === currentDay) currentPacificDayReads += count;
      }
    }
    nextPageToken = response.body?.nextPageToken || "";
  } while (nextPageToken);
  process.stdout.write(`${JSON.stringify({ project, intervalStart: start.toISOString(), intervalEnd: end.toISOString(), successfulDocumentReads: total, currentPacificDay: currentDay, currentPacificDayReads, seriesCount, note: "Cloud Monitoring successful document reads are delayed and are not identical to billed or quota usage." }, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`Usage check failed: ${error.message}\n`); process.exitCode = 1; });
module.exports = { main };
