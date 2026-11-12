import { collection, doc, documentId, getDocs, getDocFromServer, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { getScopedRows, recordRead } from "./firestoreReadCache";
import { getClassContext, matchesClassContext } from "../utils/sbaContext";
import { buildCanonicalEnrollmentFields } from "../utils/firestoreCanonical";
import { canonicalScopedReadsEnabled } from "./firestoreScopedRepository";
import { db } from "../firebase";
import { parseSbaValue, sbaClassKey, sbaEntryLocked, sbaRecordId, sbaScopeKey, sbaYear } from "../utils/sbaLogic";
import { normalizeMarksEntrySettings } from "../utils/marksEntryAccess";

export const SBA_COLLECTION = "sbaMarks";
export const SBA_SETTINGS_ID = "sbaEntry";
const settingsRef = () => doc(db, "systemSettings", SBA_SETTINGS_ID);

// SBA never reads or writes the term/practice marks collection or its cache.
export async function loadSbaRecords(term, assignment, subjectId = "") {
  const snapshot = await getDocs(query(collection(db, SBA_COLLECTION), where("scopeKey", "==", sbaScopeKey(term, assignment)), ...(subjectId ? [where("subjectId", "==", subjectId)] : [])));
  recordRead("sbaMarks: selected scope", snapshot.docs.length);
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
}
// Query existing subject IDs rather than scanning every enrollment/student.
// Filter years locally to retain compatibility with legacy year field formats.
export async function loadSbaRosterData(subjectIds, term, assignment = null, options = {}) {
  const ids = [...new Set(subjectIds.filter(Boolean))].sort();
  const enrollments = [];
  const canonical = canonicalScopedReadsEnabled() && assignment;
  const scope = canonical ? buildCanonicalEnrollmentFields({ ...assignment, academicYear: sbaYear(term) }) : null;
  // Per-subject keys are reused across class changes and between entry/register.
  for (const subjectId of ids) {
    const constraints = canonical ? [where("academicYearKey", "==", scope.academicYearKey), where("classKey", "==", scope.classKey), where("subjectId", "==", subjectId)] : [where("subjectId", "==", subjectId)];
    const key = canonical ? [scope.academicYearKey, scope.classKey, subjectId] : [subjectId];
    const rows = await getScopedRows("studentSubjectEnrollments", key,
      () => getDocs(query(collection(db, "studentSubjectEnrollments"), ...constraints)), options);
    enrollments.push(...rows.filter((row) => sbaYear(row) === sbaYear(term)));
  }
  const context = assignment ? getClassContext(assignment) : null;
  // Only exclude a row before fetching students when it has a complete class.
  // Missing legacy fields must still be resolved using the student record.
  const candidates = enrollments.filter((row) => {
    if (!context) return true;
    const own = getClassContext(row);
    const complete = (row.fullClassName || row.alClassName || row.className) && own.grade && own.section && (own.grade < 12 || own.stream);
    return !complete || matchesClassContext(row, context);
  });
  const studentIds = [...new Set(candidates.map((row) => row.studentId).filter(Boolean))].sort();
  const students = [];
  for (let start = 0; start < studentIds.length; start += 30) {
    const batch = studentIds.slice(start, start + 30);
    students.push(...await getScopedRows("students", batch,
      () => getDocs(query(collection(db, "students"), where(documentId(), "in", batch))), options));
  }
  return { students, enrollments: candidates };
}
export async function loadSbaSettings() {
  const snapshot = await getDocFromServer(settingsRef());
  return normalizeMarksEntrySettings(snapshot.exists() ? snapshot.data() : {});
}
export async function saveSbaSettings(settings, uid) {
  const normalized = normalizeMarksEntrySettings(settings);
  const deadline = normalized.teacherEntryDeadline;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new Error("Choose a valid SBA deadline.");
  await setDoc(settingsRef(), { ...normalized,
    teacherEntryDeadlineAt: deadline ? Timestamp.fromDate(new Date(`${deadline}T23:59:59.999+05:30`)) : null,
    updatedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
  return normalized;
}

export async function saveSbaChange({ term, assignment, row, value, previous, uid, isAdmin, remove = false }) {
  const id = sbaRecordId(term.id, row.studentId, assignment.subjectId);
  const ref = doc(db, SBA_COLLECTION, id);
  const parsed = parseSbaValue(value.mark, value.absent);
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    const settings = await transaction.get(settingsRef());
    if (!isAdmin && sbaEntryLocked(settings.data())) throw new Error("SBA entry is closed. Refresh to see the current controls.");
    const actualRevision = current.exists() ? current.data().revision : null;
    if (actualRevision !== (previous?.revision ?? null)) throw new Error(`${row.studentName}: SBA marks changed in another session. Refresh before editing again.`);
    if (remove) {
      if (!isAdmin) throw new Error("Only administrators can delete an SBA record.");
      transaction.delete(ref);
      return { id, deleted: true };
    }
    const payload = {
      schemaVersion: 1, assessmentType: "sba", maxMark: 20,
      termId: term.id, year: sbaYear(term), classKey: sbaClassKey(assignment), scopeKey: sbaScopeKey(term, assignment),
      subjectId: assignment.subjectId, studentId: row.studentId,
      assignmentId: assignment.id, enrollmentId: row.enrollmentId,
      ...parsed, revision: (actualRevision || 0) + 1, updatedBy: uid, updatedAt: serverTimestamp(),
    };
    transaction.set(ref, payload);
    return { ...payload, id };
  });
}

// Small, bounded concurrency keeps Firestore rule document-access limits per
// transaction low. Successful rows are returned even if another row conflicts.
export async function saveSbaChanges(context, changes) {
  const saved = [], failed = [];
  for (let index = 0; index < changes.length; index += 4) {
    const chunk = changes.slice(index, index + 4);
    const results = await Promise.allSettled(chunk.map((change) => saveSbaChange({ ...context, ...change })));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") saved.push(result.value);
      else failed.push({ studentId: chunk[offset].row.studentId, message: result.reason.message });
    });
  }
  return { saved, failed };
}
