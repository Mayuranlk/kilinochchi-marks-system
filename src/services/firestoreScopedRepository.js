import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const MAX_PAGE_SIZE = 100;

export function canonicalScopedReadsEnabled() {
  return process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS === "true";
}

function assertEnabled() {
  if (!canonicalScopedReadsEnabled()) {
    throw new Error("Canonical scoped reads are disabled until production reconciliation is approved.");
  }
}

function requireText(value, field) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${field} is required for a canonical scoped query.`);
  return normalized;
}

function rows(snapshot) {
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

export async function queryMarksByScope({ academicYearKey, termKey, classKey, assessmentKey, subjectKey }) {
  assertEnabled();
  const scopedQuery = query(
    collection(db, "marks"),
    where("academicYearKey", "==", requireText(academicYearKey, "academicYearKey")),
    where("termKey", "==", requireText(termKey, "termKey")),
    where("classKey", "==", requireText(classKey, "classKey")),
    where("assessmentKey", "==", requireText(assessmentKey, "assessmentKey")),
    where("subjectKey", "==", requireText(subjectKey, "subjectKey"))
  );
  return rows(await getDocs(scopedQuery));
}

export async function queryEnrollmentsByScope({ academicYearKey, classKey, subjectKey, status = "active" }) {
  assertEnabled();
  const scopedQuery = query(
    collection(db, "studentSubjectEnrollments"),
    where("academicYearKey", "==", requireText(academicYearKey, "academicYearKey")),
    where("classKey", "==", requireText(classKey, "classKey")),
    where("subjectKey", "==", requireText(subjectKey, "subjectKey")),
    where("status", "==", requireText(status, "status"))
  );
  return rows(await getDocs(scopedQuery));
}

export async function queryStudentRosterPage({ academicYearKey, classKey, status = "Active", pageSize = 50, cursor = null }) {
  assertEnabled();
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || 50));
  const constraints = [
    where("academicYearKey", "==", requireText(academicYearKey, "academicYearKey")),
    where("classKey", "==", requireText(classKey, "classKey")),
    where("status", "==", requireText(status, "status")),
    orderBy("admissionNo"),
    limit(safePageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, "students"), ...constraints));
  return {
    rows: rows(snapshot),
    cursor: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.size === safePageSize,
  };
}

export async function queryTeacherAssignmentsByScope({ teacherId, academicYearKey, status = "active" }) {
  assertEnabled();
  const scopedQuery = query(
    collection(db, "teacherAssignments"),
    where("teacherId", "==", requireText(teacherId, "teacherId")),
    where("academicYearKey", "==", requireText(academicYearKey, "academicYearKey")),
    where("status", "==", requireText(status, "status"))
  );
  return rows(await getDocs(scopedQuery));
}
