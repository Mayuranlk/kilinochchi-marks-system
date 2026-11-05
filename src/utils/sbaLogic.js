import { getClassContext, matchesClassContext, normalizeAcademicYear, sortRowsInTeacherMarkSheetOrder } from "./sbaContext";
import { matchesAcademicMedium } from "./academicMediumUtils";
import { normalizeStudentName } from "./studentNameUtils";

export const activeSbaRow = (row) => !row.status || String(row.status).toLowerCase() === "active";
export const sbaYear = (row) => normalizeAcademicYear(row.academicYear || row.year);
export function sbaEntryLocked(settings = {}, now = new Date()) {
  if (settings.teacherEntryEnabled === false) return true;
  if (!settings.teacherEntryDeadline) return false;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}` > settings.teacherEntryDeadline;
}
export function sbaClassKey(row) {
  const context = getClassContext(row);
  return `${context.grade}|${context.section.toUpperCase()}|${context.grade >= 12 ? context.stream.toLowerCase() : ""}`;
}
export const sbaScopeKey = (term, assignment) => `${term.id}|${sbaClassKey(assignment)}`;
export function sbaRecordId(termId, studentId, subjectId) {
  const parts = [termId, studentId, subjectId];
  if (parts.some((part) => typeof part !== "string" || !part || /[~/]/.test(part))) {
    throw new Error("SBA requires valid term, student and subject IDs (without ~ or /).");
  }
  return parts.join("~");
}
export function parseSbaValue(value, absent = false) {
  if (absent) return { mark: null, absent: true };
  if (value === null || value === undefined || String(value).trim() === "") return { mark: null, absent: false };
  if (!/^\d+(\.\d+)?$/.test(String(value).trim())) throw new Error("Enter a number from 0 to 20.");
  const mark = Number(value);
  if (!Number.isFinite(mark) || mark < 0 || mark > 20) throw new Error("SBA marks must be between 0 and 20.");
  return { mark, absent: false };
}
export const sbaValue = (record) => record?.absent ? "AB" : record?.mark ?? "";

// The existing enrollment collection remains the roster authority. IDs, year,
// class/stream and teaching medium all participate; never infer electives.
export function indexSbaRosterData(students, enrollments) {
  const bySubject = new Map();
  for (const enrollment of enrollments) {
    if (!bySubject.has(enrollment.subjectId)) bySubject.set(enrollment.subjectId, []);
    bySubject.get(enrollment.subjectId).push(enrollment);
  }
  return { studentsById: new Map(students.map((student) => [student.id, student])), bySubject };
}
export function buildSbaRoster({ assignment, term, students, enrollments, index }) {
  if (!assignment || !term) return [];
  const { studentsById, bySubject } = index || indexSbaRosterData(students, enrollments);
  const selected = new Map();
  for (const enrollment of bySubject.get(assignment.subjectId) || []) {
    const student = studentsById.get(enrollment.studentId);
    if (!student || !activeSbaRow(student) || !activeSbaRow(enrollment)) continue;
    if (!assignment.subjectId || enrollment.subjectId !== assignment.subjectId) continue;
    if (sbaYear(enrollment) !== sbaYear(term)) continue;
    if (!matchesClassContext(enrollment, getClassContext(assignment), student)) continue;
    if (!matchesAcademicMedium(enrollment, assignment.medium || assignment.teachingMedium, student)) continue;
    const row = {
      studentId: student.id, enrollmentId: enrollment.id,
      studentName: normalizeStudentName(student.fullName || student.name || enrollment.studentName),
      admissionNo: student.admissionNo || enrollment.admissionNo || "",
      indexNo: student.indexNo || enrollment.indexNo || "",
    };
    // Deterministic choice for duplicate legacy enrollments.
    if (!selected.has(student.id) || enrollment.id < selected.get(student.id).enrollmentId) selected.set(student.id, row);
  }
  return sortRowsInTeacherMarkSheetOrder([...selected.values()]);
}

export function buildSbaRegister({ assignments, term, students, enrollments, records, index }) {
  const columns = new Map();
  const rows = new Map();
  const marks = new Map(records.map((record) => [record.id, record]));
  const rosterIndex = index || indexSbaRosterData(students, enrollments);
  for (const assignment of assignments) {
    if (!assignment.subjectId) continue;
    if (!columns.has(assignment.subjectId)) columns.set(assignment.subjectId, {
      id: assignment.subjectId, name: assignment.subjectName || assignment.subject || assignment.subjectId, teachers: new Set(),
    });
    const column = columns.get(assignment.subjectId);
    if (assignment.teacherName) column.teachers.add(assignment.teacherName);
    for (const student of buildSbaRoster({ assignment, term, index: rosterIndex })) {
      if (!rows.has(student.studentId)) rows.set(student.studentId, { ...student, values: {} });
      rows.get(student.studentId).values[assignment.subjectId] = sbaValue(marks.get(sbaRecordId(term.id, student.studentId, assignment.subjectId)));
    }
  }
  return {
    columns: [...columns.values()].map((column) => ({ ...column, teachers: [...column.teachers].join(" / ") })),
    rows: sortRowsInTeacherMarkSheetOrder([...rows.values()]),
  };
}
