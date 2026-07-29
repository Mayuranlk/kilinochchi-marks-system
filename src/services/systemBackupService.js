import {
  Bytes,
  DocumentReference,
  GeoPoint,
  Timestamp,
  collection,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import firebaseApp, { db } from "../firebase";

export const BACKUP_FORMAT = "kilinochchi-marks-system-backup";
export const BACKUP_VERSION = 1;
export const RESTORE_BATCH_SIZE = 400;

// Firestore's browser SDK cannot discover collection names, so every collection
// used by this application is deliberately listed here.
export const SYSTEM_COLLECTIONS = [
  "academicTerms",
  "auditLogs",
  "classrooms",
  "classShufflePlans",
  "elections",
  "lateArrivalRecords",
  "marks",
  "practiceExams",
  "promotionHistory",
  "studentFeeAccounts",
  "students",
  "studentSubjectEnrollments",
  "subjects",
  "systemSettings",
  "teacherAssignments",
  "teachers",
  "users",
];

const TYPE_KEY = "__kilinochchiBackupType";
const MAX_BACKUP_FILE_SIZE = 200 * 1024 * 1024;

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

export function serializeFirestoreValue(value) {
  if (value instanceof Timestamp) {
    return { [TYPE_KEY]: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }

  if (value instanceof GeoPoint) {
    return { [TYPE_KEY]: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }

  if (value instanceof DocumentReference) {
    return { [TYPE_KEY]: "reference", path: value.path };
  }

  if (value instanceof Bytes) {
    return { [TYPE_KEY]: "bytes", base64: value.toBase64() };
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeFirestoreValue(nestedValue)])
    );
  }

  return value;
}

export function deserializeFirestoreValue(value, firestore = db) {
  if (Array.isArray(value)) {
    return value.map((nestedValue) => deserializeFirestoreValue(nestedValue, firestore));
  }

  if (!isPlainObject(value)) return value;

  if (value[TYPE_KEY] === "timestamp") {
    return new Timestamp(Number(value.seconds), Number(value.nanoseconds || 0));
  }

  if (value[TYPE_KEY] === "geopoint") {
    return new GeoPoint(Number(value.latitude), Number(value.longitude));
  }

  if (value[TYPE_KEY] === "reference") {
    return doc(firestore, value.path);
  }

  if (value[TYPE_KEY] === "bytes") {
    return Bytes.fromBase64String(value.base64);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      deserializeFirestoreValue(nestedValue, firestore),
    ])
  );
}

export function validateSystemBackup(payload, expectedProjectId = firebaseApp.options.projectId) {
  if (!isPlainObject(payload)) throw new Error("The selected file is not a valid backup.");
  if (payload.format !== BACKUP_FORMAT) throw new Error("This is not a Kilinochchi Marks backup file.");
  if (payload.version !== BACKUP_VERSION) {
    throw new Error(`Backup version ${payload.version ?? "unknown"} is not supported.`);
  }
  if (!payload.projectId || (expectedProjectId && payload.projectId !== expectedProjectId)) {
    throw new Error("This backup belongs to a different Firebase project.");
  }
  if (!payload.createdAt || Number.isNaN(Date.parse(payload.createdAt))) {
    throw new Error("The backup creation date is missing or invalid.");
  }
  if (!isPlainObject(payload.collections)) throw new Error("The backup contains no collections.");

  let documentCount = 0;
  const counts = {};

  Object.entries(payload.collections).forEach(([collectionName, rows]) => {
    if (!SYSTEM_COLLECTIONS.includes(collectionName)) {
      throw new Error(`Unknown collection in backup: ${collectionName}`);
    }
    if (!Array.isArray(rows)) throw new Error(`Collection ${collectionName} is damaged.`);

    const seenIds = new Set();
    rows.forEach((row) => {
      if (!isPlainObject(row) || typeof row.id !== "string" || !row.id || row.id.includes("/")) {
        throw new Error(`Collection ${collectionName} contains an invalid document ID.`);
      }
      if (!isPlainObject(row.data)) {
        throw new Error(`Document ${collectionName}/${row.id} has invalid data.`);
      }
      if (seenIds.has(row.id)) {
        throw new Error(`Duplicate document found: ${collectionName}/${row.id}`);
      }
      seenIds.add(row.id);
    });

    counts[collectionName] = rows.length;
    documentCount += rows.length;
  });

  if (Object.keys(payload.collections).length === 0) {
    throw new Error("The backup contains no collections.");
  }

  return { documentCount, collectionCount: Object.keys(counts).length, counts };
}

export async function createSystemBackup({ onProgress } = {}) {
  const collections = {};
  let documentCount = 0;

  for (let index = 0; index < SYSTEM_COLLECTIONS.length; index += 1) {
    const collectionName = SYSTEM_COLLECTIONS[index];
    onProgress?.({
      phase: "reading",
      collectionName,
      completedCollections: index,
      totalCollections: SYSTEM_COLLECTIONS.length,
      documentCount,
    });

    const snapshot = await getDocs(collection(db, collectionName));
    collections[collectionName] = snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        data: serializeFirestoreValue(documentSnapshot.data()),
      }))
      .sort((first, second) => first.id.localeCompare(second.id));
    documentCount += snapshot.size;
  }

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    projectId: firebaseApp.options.projectId,
    createdAt: new Date().toISOString(),
    source: "admin-web",
    coverage: {
      firestore: true,
      firebaseAuthentication: false,
      firebaseStorage: false,
    },
    summary: {
      collectionCount: SYSTEM_COLLECTIONS.length,
      documentCount,
    },
    collections,
  };

  onProgress?.({
    phase: "complete",
    completedCollections: SYSTEM_COLLECTIONS.length,
    totalCollections: SYSTEM_COLLECTIONS.length,
    documentCount,
  });

  return backup;
}

export function getBackupFileName(createdAt = new Date()) {
  const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, "-");
  return `kilinochchi-marks-backup-${stamp}.json`;
}

export function downloadBackupFile(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getBackupFileName(backup.createdAt);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file) {
  if (!file) throw new Error("Choose a backup file first.");
  if (file.size > MAX_BACKUP_FILE_SIZE) throw new Error("Backup file is larger than 200 MB.");

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  const validation = validateSystemBackup(payload);
  return { payload, validation };
}

export async function restoreSystemBackup(backup, { onProgress } = {}) {
  const validation = validateSystemBackup(backup);
  const documents = Object.entries(backup.collections).flatMap(([collectionName, rows]) =>
    rows.map((row) => ({ collectionName, ...row }))
  );

  let restoredCount = 0;
  for (let start = 0; start < documents.length; start += RESTORE_BATCH_SIZE) {
    const chunk = documents.slice(start, start + RESTORE_BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(({ collectionName, id, data }) => {
      // No merge: every backed-up document is returned to its exact saved fields.
      // Documents created after the backup are intentionally left untouched.
      batch.set(doc(db, collectionName, id), deserializeFirestoreValue(data), { merge: false });
    });

    await batch.commit();
    restoredCount += chunk.length;
    onProgress?.({ restoredCount, documentCount: validation.documentCount });
  }

  return { ...validation, restoredCount };
}
