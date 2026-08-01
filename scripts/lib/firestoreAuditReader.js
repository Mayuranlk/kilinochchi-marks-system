"use strict";

const { applicationDefault, getApps, initializeApp } = require("firebase-admin/app");
const { FieldPath, getFirestore } = require("firebase-admin/firestore");

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

module.exports = { initializeAuditFirestore, readCollectionInPages };
