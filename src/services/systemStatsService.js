import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export const SYSTEM_STATS_COLLECTION = "systemStats";
export const SYSTEM_STATS_DOCUMENT = "overview";
const SESSION_KEY = "kilinochchi.systemStats.overview.v1";
const READY_CACHE_MS = 5 * 60 * 1000;
const MISSING_CACHE_MS = 15 * 1000;

const emptyOverview = Object.freeze({
  initialized: false,
  marksCount: null,
  studentSubjectEnrollmentsCount: null,
});

function statsRef() {
  return doc(db, SYSTEM_STATS_COLLECTION, SYSTEM_STATS_DOCUMENT);
}

function normalizeCount(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeOverview(data = {}) {
  return {
    initialized: data.initialized === true,
    marksCount: normalizeCount(data.marksCount),
    studentSubjectEnrollmentsCount: normalizeCount(data.studentSubjectEnrollmentsCount),
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || "",
  };
}

function readSessionCache() {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null");
    if (!cached?.loadedAt || !cached?.overview) return null;
    const maxAge = cached.overview.initialized ? READY_CACHE_MS : MISSING_CACHE_MS;
    return Date.now() - cached.loadedAt <= maxAge ? cached.overview : null;
  } catch {
    return null;
  }
}

function writeSessionCache(overview) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ loadedAt: Date.now(), overview: normalizeOverview(overview) })
    );
  } catch {
    // Storage can be unavailable in private browsing. Firestore remains the source of truth.
  }
}

export function clearSystemStatsSessionCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export async function getSystemStatsOverview({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = readSessionCache();
    if (cached) return cached;
  }

  const snapshot = await getDoc(statsRef());
  const overview = snapshot.exists() ? normalizeOverview(snapshot.data()) : { ...emptyOverview };
  writeSessionCache(overview);
  return overview;
}

export async function systemStatsAreInitialized() {
  try {
    const overview = await getSystemStatsOverview();
    return overview.initialized === true;
  } catch {
    // The summary is optional metadata and must never block the primary write path.
    return false;
  }
}

export function addSystemStatsDeltaToBatch(
  batch,
  { marks = 0, studentSubjectEnrollments = 0 } = {},
  { enabled = true } = {}
) {
  if (!enabled || (!marks && !studentSubjectEnrollments)) return false;

  const update = { updatedAt: serverTimestamp() };
  if (marks) update.marksCount = increment(marks);
  if (studentSubjectEnrollments) {
    update.studentSubjectEnrollmentsCount = increment(studentSubjectEnrollments);
  }
  batch.set(statsRef(), update, { merge: true });
  return true;
}

export function noteSystemStatsDeltaCommitted({ marks = 0, studentSubjectEnrollments = 0 } = {}) {
  const cached = readSessionCache();
  if (!cached?.initialized) return;
  writeSessionCache({
    ...cached,
    marksCount: Math.max(0, Number(cached.marksCount || 0) + Number(marks || 0)),
    studentSubjectEnrollmentsCount: Math.max(
      0,
      Number(cached.studentSubjectEnrollmentsCount || 0) + Number(studentSubjectEnrollments || 0)
    ),
  });
}

// Deliberately user initiated: never call this from a component mount.
// It provides a one-time baseline and an admin repair path for older clients or restores.
export async function rebuildSystemStatsOverview() {
  const [marksSnapshot, enrollmentsSnapshot] = await Promise.all([
    getCountFromServer(collection(db, "marks")),
    getCountFromServer(collection(db, "studentSubjectEnrollments")),
  ]);
  const overview = {
    initialized: true,
    marksCount: marksSnapshot.data().count,
    studentSubjectEnrollmentsCount: enrollmentsSnapshot.data().count,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
    updatedByEmail: auth.currentUser?.email || "",
  };
  await setDoc(statsRef(), overview, { merge: false });
  const normalized = normalizeOverview({ ...overview, updatedAt: new Date().toISOString() });
  writeSessionCache(normalized);
  return normalized;
}

export async function deleteWithSystemStats(documentRef, delta) {
  const enabled = await systemStatsAreInitialized();
  const batch = writeBatch(db);
  batch.delete(documentRef);
  addSystemStatsDeltaToBatch(batch, delta, { enabled });
  await batch.commit();
  if (enabled) noteSystemStatsDeltaCommitted(delta);
}
