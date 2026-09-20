import { buildALClassName, isALGrade } from "../constants";
import { matchesReportClass } from "./classMarksReportBuilder";

export const text = (value) => String(value ?? "").trim();
export const grade = (value) => Number(text(value).match(/\d+/)?.[0] || 0);
export const section = (value) => text(value).toUpperCase();
export const academicYear = (row) => text(row.academicYear || row.year).match(/\d{4}/)?.[0] || "";
export const isActive = (row) => row.isActive !== false && (!row.status || text(row.status).toLowerCase() === "active");

export function normalizeClassroom(row) {
  const classGrade = grade(row.grade);
  const classSection = section(row.section || row.division || text(row.className).match(/\d+\s*([A-Za-z]+)$/)?.[1]);
  const className = isALGrade(classGrade)
    ? row.alClassName || row.fullClassName || buildALClassName(classGrade, row.stream, classSection)
    : `${classGrade}${classSection}`;
  return { ...row, grade: classGrade, section: classSection, className };
}

export function classroomsForYear(classrooms, year) {
  // Prefer a dated record over an undated legacy duplicate.
  const byClass = new Map();
  classrooms.filter((row) => isActive(row) && (!academicYear(row) || academicYear(row) === text(year)))
    .forEach((row) => {
      const room = normalizeClassroom(row);
      if (!room.id || !room.grade || !room.section || !room.className) return;
      const key = room.className.toLowerCase();
      if (!byClass.has(key) || academicYear(room)) byClass.set(key, room);
    });
  return [...byClass.values()].sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className, undefined, { numeric: true }));
}

export function matchesRegisterClass(student, classroom, year) {
  if (!isActive(student) || (academicYear(student) && academicYear(student) !== text(year))) return false;
  if (student.classroomId) return student.classroomId === classroom.id;
  return matchesReportClass(student, classroom);
}

export function monthDays(year, month) {
  return Array.from({ length: new Date(Number(year), Number(month), 0).getDate() }, (_, index) => ({
    date: `${year}-${text(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    label: String(index + 1).padStart(2, "0"),
  }));
}

export function displayMonth(year, month) {
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}
