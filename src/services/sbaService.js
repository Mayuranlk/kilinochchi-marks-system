import { collection, doc, documentId, getDocs, getDocFromServer, limit, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { getScopedRows, invalidateCollectionRows } from "./firestoreReadCache";
import { getClassContext, matchesClassContext } from "../utils/sbaContext";
import { db } from "../firebase";
import { parseSbaValue, sbaClassKey, sbaEntryLocked, sbaRecordId, sbaScopeKey, sbaYear } from "../utils/sbaLogic";
import { normalizeMarksEntrySettings } from "../utils/marksEntryAccess";
import {
  getAcademicTermKey,
  getCalendarSlotForTerm,
  getTermCalendarNumber,
  getTermCalendarYear,
  getTermSequence,
  getTermSystem,
} from "../utils/alAcademicCycle";

export const SBA_COLLECTION = "sbaMarks";
export const SBA_SETTINGS_ID = "sbaEntry";
const MAX_SBA_SCOPE_ROWS = 200;
const MAX_SBA_REGISTER_ROWS = 2000;
const MAX_SBA_ADMIN_ASSIGNMENTS = 2500;
const settingsRef = () => doc(db, "systemSettings", SBA_SETTINGS_ID);

// SBA never reads or writes the term/practice marks collection or its cache.
export async function loadSbaRecords(term, assignment, subjectId = "", options = {}) {
  const rowLimit = subjectId ? MAX_SBA_SCOPE_ROWS : MAX_SBA_REGISTER_ROWS;
  const scope = sbaScopeKey(term, assignment);
  const rows = await getScopedRows(SBA_COLLECTION, ["sba-records", scope, subjectId], () => getDocs(query(
    collection(db, SBA_COLLECTION),
    where("scopeKey", "==", scope),
    ...(subjectId ? [where("subjectId", "==", subjectId)] : []),
    limit(rowLimit + 1)
  )), options);
  if (rows.length > rowLimit) {
    throw new Error(subjectId
      ? `The selected SBA subject has more than ${MAX_SBA_SCOPE_ROWS} saved rows. Ask an administrator to check duplicate data.`
      : `The selected SBA class register has more than ${MAX_SBA_REGISTER_ROWS} saved rows. Narrow the register or check duplicate data.`);
  }
  return rows;
}
// Existing production enrollments use legacy academicYear/year, grade and
// section fields. Query their exact class scope so opening SBA never scans an
// entire subject. The small type variants preserve compatibility during data
// migration while every individual query remains bounded.
const distinctValues = (values) => [...new Map(values.filter((value) => value !== "" && value !== null && value !== undefined).map((value) => [`${typeof value}:${value}`, value])).values()];
const assertBounded = (rows, label) => {
  if (rows.length > MAX_SBA_SCOPE_ROWS) throw new Error(`${label} returned more than ${MAX_SBA_SCOPE_ROWS} rows. Ask an administrator to check duplicate enrollment data.`);
  return rows;
};

export async function loadSbaTeacherAssignments(user, options = {}) {
  const uid = String(user?.uid || "").trim();
  const email = String(user?.email || "").trim();
  if (!uid && !email) return [];
  const identities = [
    ...(["teacherId", "teacherUid", "userId"].map((field) => [field, uid]).filter(([, value]) => value)),
    ...(["teacherEmail", "email"].map((field) => [field, email]).filter(([, value]) => value)),
  ];
  const readIdentity = async ([field, value]) => {
    const rows = await getScopedRows("teacherAssignments", ["sba-teacher", field, value],
      () => getDocs(query(collection(db, "teacherAssignments"), where(field, "==", value), limit(MAX_SBA_SCOPE_ROWS + 1))), options);
    return assertBounded(rows, "Teacher assignments");
  };
  const batches = await Promise.all(identities.map(readIdentity));
  return assertBounded([...new Map(batches.flat().map((row) => [row.id, row])).values()], "Teacher assignments");
}

export async function loadSbaAdminAssignments(term, options = {}) {
  const year = sbaYear(term);
  if (!year) return [];
  const yearValues = distinctValues([year, Number.isFinite(Number(year)) ? Number(year) : ""]);
  const variants = [
    ...yearValues.map((value) => ["academicYear", value]),
    ...yearValues.map((value) => ["year", value]),
    ["academicYearKey", year],
  ];
  const readVariant = async ([field, value]) => {
    const rows = await getScopedRows(
      "teacherAssignments",
      ["sba-admin-year", field, value],
      () => getDocs(query(
        collection(db, "teacherAssignments"),
        where(field, "==", value),
        limit(MAX_SBA_ADMIN_ASSIGNMENTS + 1)
      )),
      options
    );
    if (rows.length > MAX_SBA_ADMIN_ASSIGNMENTS) {
      throw new Error(`Teacher assignments for ${year} exceed ${MAX_SBA_ADMIN_ASSIGNMENTS} rows. Check duplicate assignment data before opening SBA.`);
    }
    return rows;
  };
  const batches = await Promise.all(variants.map(readVariant));
  const rows = [...new Map(batches.flat().map((row) => [row.id, row])).values()];
  if (rows.length > MAX_SBA_ADMIN_ASSIGNMENTS) {
    throw new Error(`Teacher assignments for ${year} exceed ${MAX_SBA_ADMIN_ASSIGNMENTS} rows. Check duplicate assignment data before opening SBA.`);
  }
  return rows;
}

export async function loadSbaRosterData(subjectIds, term, assignment = null, options = {}) {
  const ids = [...new Set(subjectIds.filter(Boolean))].sort();
  if (!ids.length) return { students: [], enrollments: [] };
  const year = sbaYear(term);
  const context = assignment ? getClassContext(assignment) : null;
  if (!year || !context?.grade || (context.grade < 12 && !context.section)) throw new Error("The selected assignment is missing its academic year, grade, or section.");

  const yearValues = distinctValues([year, Number.isFinite(Number(year)) ? Number(year) : ""]);
  const gradeValues = distinctValues([context.grade, String(context.grade)]);
  const sectionValues = context.section
    ? distinctValues([context.section, String(assignment?.section || "").trim()])
    : [""];
  const enrollmentsById = new Map();

  for (const subjectId of ids) {
    const variants = [];
    for (const yearField of ["academicYear", "year"])
      for (const yearValue of yearValues)
        for (const gradeValue of gradeValues)
          for (const sectionValue of sectionValues)
            variants.push({ yearField, yearValue, gradeValue, sectionValue });

    const readVariant = async ({ yearField, yearValue, gradeValue, sectionValue }) => {
      const key = ["sba-class-scope", yearField, yearValue, gradeValue, sectionValue, subjectId];
      const rows = await getScopedRows("studentSubjectEnrollments", key, () => getDocs(query(
        collection(db, "studentSubjectEnrollments"),
        where(yearField, "==", yearValue),
        where("grade", "==", gradeValue),
        where("section", "==", sectionValue),
        where("subjectId", "==", subjectId),
        limit(MAX_SBA_SCOPE_ROWS + 1)
      )), options);
      return assertBounded(rows, "SBA " + year + " " + context.grade + context.section + " " + subjectId);
    };
    // A nonempty result in one legacy format does not prove other formats are
    // empty. Merge every bounded variant and deduplicate document IDs.
    const batches = await Promise.all(variants.map(readVariant));
    const subjectRows = [...new Map(batches.flat().map((row) => [row.id, row])).values()];
    assertBounded(subjectRows, "SBA " + year + " " + context.grade + context.section + " " + subjectId);
    subjectRows.forEach((row) => enrollmentsById.set(row.id, row));
  }

  const candidates = [...enrollmentsById.values()].filter((row) =>
    sbaYear(row) === year && activeEnrollment(row) && matchesClassContext(row, context));
  const studentIds = [...new Set(candidates.map((row) => row.studentId).filter(Boolean))].sort();
  const students = [];
  for (let start = 0; start < studentIds.length; start += 30) {
    const batch = studentIds.slice(start, start + 30);
    students.push(...await getScopedRows("students", batch,
      () => getDocs(query(collection(db, "students"), where(documentId(), "in", batch))), options));
  }
  return { students, enrollments: candidates };
}

const activeEnrollment = (row) => !row.status || ["active", "true"].includes(String(row.status).toLowerCase());
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

export async function saveSbaChange({ term, assignment, row, value, previous, uid, isAdmin, remove = false, skipSettingsCheck = false }) {
  const id = sbaRecordId(term.id, row.studentId, assignment.subjectId);
  const ref = doc(db, SBA_COLLECTION, id);
  const parsed = parseSbaValue(value.mark, value.absent);
  const saved = await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!isAdmin && !skipSettingsCheck) {
      const settings = await transaction.get(settingsRef());
      if (sbaEntryLocked(settings.data())) throw new Error("SBA entry is closed. Refresh to see the current controls.");
    }
    const actualRevision = current.exists() ? current.data().revision : null;
    if (actualRevision !== (previous?.revision ?? null)) throw new Error(`${row.studentName}: SBA marks changed in another session. Refresh before editing again.`);
    if (remove) {
      if (!isAdmin) throw new Error("Only administrators can delete an SBA record.");
      transaction.delete(ref);
      return { id, deleted: true };
    }
    // Existing records can predate optional academic-cycle fields. Preserve
    // their immutable identity and metadata so teacher edits remain compatible
    // with the rules instead of silently rewriting historical scope.
    if (current.exists()) {
      const changes = {
        ...parsed, revision: actualRevision + 1, updatedBy: uid,
        updatedAt: serverTimestamp(), assignmentId: assignment.id,
        enrollmentId: row.enrollmentId,
      };
      transaction.set(ref, changes, { merge: true });
      return { ...current.data(), ...changes, id };
    }
    const payload = {
      schemaVersion: 1, assessmentType: "sba", maxMark: 20,
      termId: term.id,
      year: sbaYear(term),
      academicYear: sbaYear(term),
      termSystem: getTermSystem(term),
      termSequence: getTermSequence(term),
      termScopeKey: term.termScopeKey || getAcademicTermKey(term),
      calendarYear: getTermCalendarYear(term),
      calendarTerm: getTermCalendarNumber(term),
      calendarSlotKey: getCalendarSlotForTerm(term),
      phaseGrade: Number(term.phaseGrade) || 0,
      batchYear: Number(term.batchYear || assignment.batchYear || 0) || 0,
      intakeYear: Number(term.intakeYear || assignment.intakeYear || 0) || 0,
      academicScopeKey: term.academicScopeKey || assignment.academicScopeKey || "",
      classKey: sbaClassKey(assignment),
      scopeKey: sbaScopeKey(term, assignment),
      subjectId: assignment.subjectId, studentId: row.studentId,
      assignmentId: assignment.id, enrollmentId: row.enrollmentId,
      ...parsed, revision: (actualRevision || 0) + 1, updatedBy: uid, updatedAt: serverTimestamp(),
    };
    transaction.set(ref, payload);
    return { ...payload, id };
  });
  invalidateCollectionRows(SBA_COLLECTION);
  return saved;
}

// Small, bounded concurrency keeps Firestore rule document-access limits per
// transaction low. Successful rows are returned even if another row conflicts.
export async function saveSbaChanges(context, changes) {
  const saved = [], failed = [];
  if (!context.isAdmin && changes.length) {
    const settings = await getDocFromServer(settingsRef());
    if (sbaEntryLocked(settings?.data?.() || {})) {
      throw new Error("SBA entry is closed. Refresh to see the current controls.");
    }
  }
  for (let index = 0; index < changes.length; index += 4) {
    const chunk = changes.slice(index, index + 4);
    const results = await Promise.allSettled(chunk.map((change) =>
      saveSbaChange({ ...context, ...change, skipSettingsCheck: !context.isAdmin })
    ));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") saved.push(result.value);
      else failed.push({ studentId: chunk[offset].row.studentId, message: result.reason.message });
    });
  }
  return { saved, failed };
}
