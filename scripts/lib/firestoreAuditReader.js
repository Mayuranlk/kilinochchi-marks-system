"use strict";

const { applicationDefault, getApps, initializeApp } = require("firebase-admin/app");
const { FieldPath, getFirestore } = require("firebase-admin/firestore");

function decodeFirestoreValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("bytesValue" in value) return "[bytes]";
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

async function initializeFirebaseCliReadOnlyFirestore({ projectId, maxAttempts = 8 }) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 8) {
    throw new Error("maxAttempts must be an integer from 1 to 8.");
  }
  const { Client } = require("firebase-tools/lib/apiv2");
  const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
  const { requireAuth } = require("firebase-tools/lib/requireAuth");
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("No authenticated Firebase CLI account is available.");
  const identity = await requireAuth({ project: projectId, projectId, user: account.user, tokens: account.tokens });
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1" });
  const postReadWithRetry = async (resourcePath, body) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response;
      try {
        response = await client.post(
          resourcePath,
          body,
          { skipLog: { body: true, resBody: true }, resolveOnHTTPError: true }
        );
      } catch (error) {
        if (attempt === maxAttempts - 1) throw new Error("Read-only Firestore request failed after bounded transport retries.");
        await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * (2 ** attempt))));
        continue;
      }
      if (response.status === 200) return response;
      if (response.status !== 429 && response.status < 500) return response;
      if (attempt === maxAttempts - 1) return response;
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * (2 ** attempt))));
    }
    throw new Error("Read-only request retry loop ended unexpectedly.");
  };
  return {
    auditIdentity: identity || account.user.email,
    pageDelayMs: 100,
    async countCollection(collectionName) {
      const response = await postReadWithRetry(
        `/projects/${projectId}/databases/(default)/documents:runAggregationQuery`,
        {
          structuredAggregationQuery: {
            structuredQuery: { from: [{ collectionId: collectionName }] },
            aggregations: [{ alias: "documentCount", count: {} }],
          },
        }
      );
      if (response.status !== 200) throw new Error(`Read-only count failed with HTTP ${response.status}.`);
      const value = response.body?.[0]?.result?.aggregateFields?.documentCount?.integerValue;
      if (value === undefined) throw new Error("Read-only count response did not contain documentCount.");
      return Number(value);
    },
    async readCollectionPage({ collectionName, limit, startCursor = "" }) {
      const query = {
        from: [{ collectionId: collectionName }],
        orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
        limit,
      };
      if (startCursor) {
        query.startAt = {
          before: false,
          values: [{ referenceValue: `projects/${projectId}/databases/(default)/documents/${collectionName}/${startCursor}` }],
        };
      }
      const response = await postReadWithRetry(
        `/projects/${projectId}/databases/(default)/documents:runQuery`,
        { structuredQuery: query }
      );
      if (response.status !== 200) {
        throw new Error(`Read-only Firestore query failed with HTTP ${response.status}.`);
      }
      const documents = (response.body || [])
        .filter((item) => item.document)
        .map((item) => {
          const name = item.document.name;
          return { id: name.slice(name.lastIndexOf("/") + 1), ...decodeFirestoreFields(item.document.fields) };
        });
      return { documents, complete: documents.length < limit };
    },
  };
}

function initializeAuditFirestore({ projectId, emulatorHost = "" }) {
  if (!projectId) throw new Error("A confirmed Firebase project ID is required.");
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;

  const app = getApps()[0] || initializeApp(
    emulatorHost ? { projectId } : { projectId, credential: applicationDefault() }
  );
  return getFirestore(app);
}

async function readCollectionInPages({
  db,
  collectionName,
  batchSize,
  maximumDocuments,
  startCursor = "",
  onPage,
  shouldStop,
}) {
  const documents = [];
  let cursor = startCursor;
  let complete = false;

  while (!complete && documents.length < maximumDocuments && !shouldStop()) {
    const remaining = maximumDocuments - documents.length;
    if (typeof db.readCollectionPage === "function") {
      const limit = Math.min(batchSize, remaining);
      const result = await db.readCollectionPage({ collectionName, limit, startCursor: cursor });
      const page = result.documents;
      if (!page.length) {
        complete = true;
        break;
      }
      documents.push(...page);
      cursor = page[page.length - 1].id;
      complete = result.complete;
      await onPage?.({ collectionName, cursor, documentsRead: documents.length, complete, page });
      if (!complete && db.pageDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, db.pageDelayMs));
      }
      continue;
    }
    let query = db.collection(collectionName)
      .orderBy(FieldPath.documentId())
      .limit(Math.min(batchSize, remaining));
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) {
      complete = true;
      break;
    }

    const page = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    documents.push(...page);
    cursor = snapshot.docs[snapshot.docs.length - 1].id;
    complete = snapshot.size < Math.min(batchSize, remaining);
    await onPage?.({ collectionName, cursor, documentsRead: documents.length, complete, page });
  }

  return { documents, cursor, complete };
}

module.exports = {
  decodeFirestoreFields,
  decodeFirestoreValue,
  initializeAuditFirestore,
  initializeFirebaseCliReadOnlyFirestore,
  readCollectionInPages,
};
