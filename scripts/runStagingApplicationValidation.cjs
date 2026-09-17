#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { Client } = require("firebase-tools/lib/apiv2");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { USERS, seedFirestore } = require("./seedApplicationEmulator.cjs");

const workspace = path.resolve(__dirname, "..");
const APPROVED_PROJECT = "kilinochchi-marks-staging";
const APPROVED_APP_ID = "1:571201491847:web:cce11f4d0c29f914f77922";
const MISSING_PROFILE = {
  logicalName: "missingProfile",
  email: "missing-profile@app-emulator.test",
  role: null,
  expectProfile: false,
};

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required and must be supplied at runtime.`);
  return value;
}

function assertBoundary() {
  if (required("STAGING_PROJECT_ID") !== APPROVED_PROJECT) {
    throw new Error(`Refusing staging validation: project must be ${APPROVED_PROJECT}.`);
  }
  if (required("STAGING_FIREBASE_APP_ID") !== APPROVED_APP_ID) {
    throw new Error(`Refusing staging validation: App ID must be ${APPROVED_APP_ID}.`);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Refusing staging validation while emulator host variables are present.");
  }
}

async function cliCredential() {
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("No authenticated Firebase CLI account is available.");
  const options = {
    project: APPROVED_PROJECT,
    projectId: APPROVED_PROJECT,
    user: account.user,
    tokens: account.tokens,
  };
  const identity = await requireAuth(options);
  return { identity: identity || account.user.email };
}

async function syntheticAuthUsers(apiKey, password) {
  const profiles = [...Object.values(USERS), MISSING_PROFILE];
  const adminClient = new Client({ urlPrefix: "https://identitytoolkit.googleapis.com", apiVersion: "v1" });
  const lookup = await adminClient.post(
    `/projects/${APPROVED_PROJECT}/accounts:lookup`,
    { email: profiles.map((profile) => profile.email) },
    { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
  );
  const existing = new Map((lookup.body?.users || []).map((user) => [user.email, user]));
  for (const profile of profiles) {
    const existingUser = existing.get(profile.email);
    if (existingUser) {
      const update = await adminClient.post(
        `/projects/${APPROVED_PROJECT}/accounts:update`,
        { localId: existingUser.localId, password, emailVerified: true },
        { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
      );
      if (update.status !== 200) {
        throw new Error(`Synthetic Auth update failed for ${profile.email}: HTTP ${update.status}`);
      }
      profile.uid = existingUser.localId;
      continue;
    }
    const signUp = () => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: profile.email, password, returnSecureToken: true }),
    });
    let response = await signUp();
    const body = await response.json();
    if (!response.ok || !body.localId) {
      throw new Error(`Synthetic Auth setup failed for ${profile.email}: ${body.error?.message || response.status}`);
    }
    profile.uid = body.localId;
  }
}

async function signIn(apiKey, email, password) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok || !body.localId || !body.idToken) {
    throw new Error(`sign-in not ready: ${body.error?.message || response.status}`);
  }
  return body;
}

async function profileWithUserToken(uid, idToken) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${APPROVED_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
    { headers: { authorization: `Bearer ${idToken}` } }
  );
  const body = await response.json();
  return { status: response.status, role: body.fields?.role?.stringValue ?? null };
}

async function waitForReadiness(apiKey, password) {
  const fixtures = [
    ...Object.entries(USERS).map(([logicalName, profile]) => ({
      logicalName,
      email: profile.email,
      role: profile.role,
      expectProfile: true,
    })),
    MISSING_PROFILE,
  ];
  const results = [];
  for (const fixture of fixtures) {
    const started = Date.now();
    let lastReason = "not attempted";
    while (Date.now() - started < 60000) {
      try {
        const auth = await signIn(apiKey, fixture.email, password);
        const profile = await profileWithUserToken(auth.localId, auth.idToken);
        const profileReady = fixture.expectProfile
          ? profile.status === 200 && profile.role === fixture.role
          : profile.status === 404;
        if (profileReady) {
          results.push({
            logicalName: fixture.logicalName,
            email: fixture.email,
            uid: auth.localId,
            authReady: true,
            profileExpected: fixture.expectProfile,
            profileStatus: profile.status,
            role: profile.role,
            elapsedMs: Date.now() - started,
          });
          break;
        }
        lastReason = `profile HTTP ${profile.status}, role ${String(profile.role)}`;
      } catch (error) {
        lastReason = error.message;
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    if (!results.some((result) => result.logicalName === fixture.logicalName)) {
      throw new Error(`Readiness timed out for ${fixture.logicalName}: ${lastReason}`);
    }
  }
  const output = path.join(workspace, "staging-evidence", "stabilization", "auth-profile-readiness.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({ projectId: APPROVED_PROJECT, checkedAt: new Date().toISOString(), boundedTimeoutMs: 60000, retryIntervalMs: 750, results }, null, 2)}\n`, "utf8");
  return results;
}

function firestoreFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]));
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value?.toDate === "function") return { timestampValue: value.toDate().toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (value && typeof value === "object") {
    if (value._methodName === "FieldValue.serverTimestamp") {
      return { timestampValue: new Date().toISOString() };
    }
    return { mapValue: { fields: firestoreFields(value) } };
  }
  throw new Error(`Unsupported synthetic Firestore value type: ${typeof value}`);
}

function stagingRestFirestore() {
  const writes = [];
  return {
    bulkWriter() {
      return {
        set(documentRef, data) { writes.push({ documentRef, data }); },
        async close() {
          const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1" });
          for (const { documentRef, data } of writes) {
            const response = await client.patch(
              `/projects/${APPROVED_PROJECT}/databases/(default)/documents/${documentRef.collectionName}/${documentRef.id}`,
              { fields: firestoreFields(data) },
              { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
            );
            if (response.status !== 200) {
              throw new Error(`Synthetic Firestore write failed for ${documentRef.collectionName}/${documentRef.id}: HTTP ${response.status}`);
            }
          }
        },
      };
    },
    collection(collectionName) {
      return {
        doc(id) {
          const documentRef = { collectionName, id };
          return {
            ...documentRef,
            async set(data) {
              const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1" });
              const response = await client.patch(
                `/projects/${APPROVED_PROJECT}/databases/(default)/documents/${collectionName}/${id}`,
                { fields: firestoreFields(data) },
                { skipLog: { body: true, resBody: true } }
              );
              if (response.status !== 200) throw new Error(`Synthetic Firestore write failed: HTTP ${response.status}`);
            },
          };
        },
      };
    },
  };
}

function child(command, args, env) {
  return spawnSync(command, args, { cwd: workspace, env, stdio: "inherit" });
}

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) return resolve();
        retry();
      });
      request.on("error", retry);
      request.setTimeout(1000, () => request.destroy());
    };
    const retry = () => Date.now() - started > timeoutMs
      ? reject(new Error(`Staging application server did not start at ${url}.`))
      : setTimeout(attempt, 250);
    attempt();
  });
}

async function main() {
  assertBoundary();
  const apiKey = required("STAGING_FIREBASE_API_KEY");
  const authDomain = required("STAGING_FIREBASE_AUTH_DOMAIN");
  if (authDomain !== `${APPROVED_PROJECT}.firebaseapp.com`) {
    throw new Error("Refusing staging validation: unexpected auth domain.");
  }
  const password = `Stage-${crypto.randomBytes(18).toString("base64url")}!9a`;
  const { identity } = await cliCredential();
  await syntheticAuthUsers(apiKey, password);
  const documentCount = await seedFirestore(stagingRestFirestore());
  const readiness = await waitForReadiness(apiKey, password);
  process.stdout.write(`${JSON.stringify({ projectId: APPROVED_PROJECT, identity, syntheticUsers: 9, syntheticDocuments: documentCount, readinessChecks: readiness.length })}\n`);

  const env = {
    ...process.env,
    CI: "true",
    REACT_APP_FIREBASE_API_KEY: apiKey,
    REACT_APP_FIREBASE_AUTH_DOMAIN: authDomain,
    REACT_APP_FIREBASE_PROJECT_ID: APPROVED_PROJECT,
    REACT_APP_FIREBASE_STORAGE_BUCKET: required("STAGING_FIREBASE_STORAGE_BUCKET"),
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: "571201491847",
    REACT_APP_FIREBASE_APP_ID: APPROVED_APP_ID,
    REACT_APP_USE_FIREBASE_EMULATORS: "false",
    REACT_APP_ENABLE_CANONICAL_SCOPED_READS: "false",
    STAGING_TEST_PASSWORD: password,
    EXPECTED_FIREBASE_PROJECT_ID: APPROVED_PROJECT,
    PLAYWRIGHT_REUSE_APP_SERVER: "true",
  };

  const build = child(process.execPath, [require.resolve("react-scripts/scripts/build.js")], env);
  if (build.status !== 0) process.exit(build.status ?? 1);
  const server = spawn(process.execPath, ["scripts/serveApplicationBuild.cjs"], {
    cwd: workspace,
    env,
    stdio: "inherit",
  });
  try {
    await waitForServer("http://127.0.0.1:3100");
    const tests = child(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.emulator.config.cjs"],
      env
    );
    process.exitCode = tests.status ?? 1;
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  const details = [
    error.message,
    error.status ? `HTTP ${error.status}` : "",
    error.context?.response?.body?.error?.status || "",
    error.context?.response?.body?.error?.message || "",
  ].filter(Boolean);
  process.stderr.write(`Staging application validation stopped safely: ${details.join(" | ")}\n`);
  process.exitCode = 1;
});
