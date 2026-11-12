import { collection, getCountFromServer, getDocs } from "firebase/firestore";

// Firestore's persistent cache improves latency, but getDocs() still checks the
// server. This small session cache also deduplicates concurrent page requests so
// route changes do not repeatedly bill the same complete collection scan.
const collectionCache = new Map();
const pendingReads = new Map();
const countCache = new Map();
const pendingCountReads = new Map();
const collectionGenerations = new Map();
let cacheEpoch = 0;

export const DEFAULT_COLLECTION_CACHE_MS = 5 * 60 * 1000;

// Query cache shares collection invalidation and authentication boundaries.
const scopedCache = new Map();
const scopedPending = new Map();
const diagnostics = [];
export function recordRead(label, documents, cached = false) {
  diagnostics.push({ time: new Date().toISOString(), query: label, documents, cached });
  if (diagnostics.length > 200) diagnostics.shift();
}
export const getReadDiagnostics = () => diagnostics.map((entry) => ({ ...entry }));
if (typeof window !== "undefined") window.getFirestoreReadDiagnostics = getReadDiagnostics;

export async function getScopedRows(collectionName, key, read, { forceRefresh = false } = {}) {
  const cacheKey = JSON.stringify([collectionName, key]);
  const version = `${cacheEpoch}:${collectionGenerations.get(collectionName) || 0}`;
  const entry = scopedCache.get(cacheKey);
  if (!forceRefresh && entry?.version === version && Date.now() - entry.at < DEFAULT_COLLECTION_CACHE_MS) {
    recordRead(`${collectionName}: scoped`, 0, true);
    return entry.rows;
  }
  const pending = scopedPending.get(cacheKey);
  if (pending?.version === version) return pending.promise;
  const promise = read().then((snapshot) => {
    const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
    recordRead(`${collectionName}: scoped`, rows.length);
    if (version === `${cacheEpoch}:${collectionGenerations.get(collectionName) || 0}`) {
      scopedCache.set(cacheKey, { rows, version, at: Date.now() });
      if (scopedCache.size > 500) scopedCache.delete(scopedCache.keys().next().value);
    }
    return rows;
  }).finally(() => {
    if (scopedPending.get(cacheKey)?.promise === promise) scopedPending.delete(cacheKey);
  });
  scopedPending.set(cacheKey, { version, promise });
  return promise;
}

export async function getCollectionRows(
  db,
  collectionName,
  { maxAgeMs = DEFAULT_COLLECTION_CACHE_MS, forceRefresh = false } = {}
) {
  const cached = collectionCache.get(collectionName);
  const now = Date.now();

  if (!forceRefresh && cached && now - cached.loadedAt < maxAgeMs) {
    return cached.rows;
  }

  // Do not create duplicate requests when Refresh is clicked while the same
  // collection request is already in flight.
  if (pendingReads.has(collectionName)) {
    return pendingReads.get(collectionName);
  }

  const generation = collectionGenerations.get(collectionName) || 0;
  const epoch = cacheEpoch;
  const read = getDocs(collection(db, collectionName))
    .then((snapshot) => {
      const rows = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      recordRead(`${collectionName}: collection`, rows.length);
      // A write may invalidate the collection while this request is in flight.
      // Do not let the older response repopulate the shared cache.
      if (
        epoch === cacheEpoch &&
        generation === (collectionGenerations.get(collectionName) || 0)
      ) {
        collectionCache.set(collectionName, { loadedAt: Date.now(), rows });
      }
      return rows;
    })
    .finally(() => {
      if (pendingReads.get(collectionName) === read) {
        pendingReads.delete(collectionName);
      }
    });

  pendingReads.set(collectionName, read);
  return read;
}

export async function getCollectionCount(
  db,
  collectionName,
  { maxAgeMs = DEFAULT_COLLECTION_CACHE_MS, forceRefresh = false } = {}
) {
  const cachedRows = collectionCache.get(collectionName);
  const now = Date.now();
  if (!forceRefresh && cachedRows && now - cachedRows.loadedAt < maxAgeMs) {
    return cachedRows.rows.length;
  }

  const cachedCount = countCache.get(collectionName);
  if (!forceRefresh && cachedCount && now - cachedCount.loadedAt < maxAgeMs) {
    return cachedCount.count;
  }

  if (pendingCountReads.has(collectionName)) {
    return pendingCountReads.get(collectionName);
  }

  const generation = collectionGenerations.get(collectionName) || 0;
  const epoch = cacheEpoch;
  const read = getCountFromServer(collection(db, collectionName))
    .then((snapshot) => {
      const count = snapshot.data().count;
      // A write or authentication change may invalidate this count while the
      // aggregation is in flight. Return it to its original caller, but never
      // allow it to repopulate the shared cache after that boundary.
      if (
        epoch === cacheEpoch &&
        generation === (collectionGenerations.get(collectionName) || 0)
      ) {
        countCache.set(collectionName, { loadedAt: Date.now(), count });
      }
      return count;
    })
    .finally(() => {
      if (pendingCountReads.get(collectionName) === read) {
        pendingCountReads.delete(collectionName);
      }
    });

  pendingCountReads.set(collectionName, read);
  return read;
}

export function invalidateCollectionRows(...collectionNames) {
  collectionNames.forEach((collectionName) => {
    collectionGenerations.set(
      collectionName,
      (collectionGenerations.get(collectionName) || 0) + 1
    );
    collectionCache.delete(collectionName);
    countCache.delete(collectionName);
    pendingReads.delete(collectionName);
    pendingCountReads.delete(collectionName);
  });
}

export function updateCachedCollection(collectionName, updater) {
  const cached = collectionCache.get(collectionName);
  if (!cached) return;
  collectionCache.set(collectionName, {
    loadedAt: Date.now(),
    rows: updater(cached.rows),
  });
}

export function clearFirestoreReadCache() {
  cacheEpoch += 1;
  scopedCache.clear();
  scopedPending.clear();
  diagnostics.length = 0;
  collectionCache.clear();
  pendingReads.clear();
  countCache.clear();
  pendingCountReads.clear();
  collectionGenerations.clear();
}
