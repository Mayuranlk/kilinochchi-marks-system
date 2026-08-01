import { collection, getCountFromServer, getDocs } from "firebase/firestore";

// Firestore's persistent cache improves latency, but getDocs() still checks the
// server. This small session cache also deduplicates concurrent page requests so
// route changes do not repeatedly bill the same complete collection scan.
const collectionCache = new Map();
const pendingReads = new Map();
const countCache = new Map();
const collectionGenerations = new Map();
let cacheEpoch = 0;

export const DEFAULT_COLLECTION_CACHE_MS = 5 * 60 * 1000;

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

  try {
    const snapshot = await getCountFromServer(collection(db, collectionName));
    const count = snapshot.data().count;
    countCache.set(collectionName, { loadedAt: Date.now(), count });
    return count;
  } catch (error) {
    // Some existing Firestore Rules deployments allow the collection reads
    // used by this app but reject aggregation queries. Preserve compatibility
    // instead of failing the entire dashboard.
    console.warn(
      `Count aggregation failed for ${collectionName}; using collection fallback.`,
      error
    );
    const rows = await getCollectionRows(db, collectionName, { maxAgeMs, forceRefresh });
    return rows.length;
  }
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
  collectionCache.clear();
  pendingReads.clear();
  countCache.clear();
  collectionGenerations.clear();
}
