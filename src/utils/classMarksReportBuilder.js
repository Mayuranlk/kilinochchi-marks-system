// src/utils/classMarksReportBuilder.js

import { getReportSchemaByGrade } from "./reportSchemas";
import {
  buildSchemaColumnMap,
  createEmptyAttendanceByColumn,
  createEmptyMarksByColumn,
  extractMarkValue,
  getStudentDisplayId,
  getStudentDisplayName,
  getStudentIndexNo,
  isAbsentMark,
  resolveColumnKeyFromSubjectName,
  resolveReligionColumnFromStudent,
} from "./reportMappingUtils";
import {
  assignRanks,
  calculateAnalysis,
  calculateStudentTotalAndAverage,
} from "./reportAnalysisUtils";

export function filterActiveEnrollments(enrollments = []) {
  return enrollments.filter((item) => (item.status || "").toLowerCase() !== "inactive");
}

export function filterMarksForTermYearClass(marks = [], { className, termName, year }) {
  return marks.filter((item) => {
    const markClassName = item.className || "";
    const markTerm = item.termName || item.term || "";
    const markYear = Number(item.academicYear || item.year || 0);

    return (
      markClassName === className &&
      markTerm === termName &&
      markYear === Number(year)
    );
  });
}

export function filterStudentsForClass(students = [], grade, section) {
  return students.filter((student) => {
    return Number(student.grade) === Number(grade) && String(student.section || "") === String(section);
  });
}

export function buildClassMarksReportData({
  students = [],
  enrollments = [],
  marks = [],
  classrooms = [],
  grade,
  className,
  section,
  termName,
  year,
}) {
  const schema = getReportSchemaByGrade(grade);
  if (!schema) {
    throw new Error(`Unsupported grade for report schema: ${grade}`);
  }

  const schemaColumnMap = buildSchemaColumnMap(schema);
  const classStudents = filterStudentsForClass(students, grade, section);
  const activeEnrollments = filterActiveEnrollments(enrollments).filter((item) => {
    return (
      Number(item.grade) === Number(grade) &&
      String(item.className || "") === String(className) &&
      String(item.section || "") === String(section) &&
      Number(item.academicYear || 0) === Number(year)
    );
  });

  const classMarks = filterMarksForTermYearClass(marks, {
    className,
    termName,
    year,
  });

  const classroom =
    classrooms.find(
      (item) =>
        String(item.className || "") === String(className) &&
        Number(item.grade) === Number(grade) &&
        String(item.section || "") === String(section) &&
        Number(item.year || item.academicYear || 0) === Number(year)
    ) || null;

  const enrollmentsByStudent = activeEnrollments.reduce((acc, item) => {
    if (!acc[item.studentId]) acc[item.studentId] = [];
    acc[item.studentId].push(item);
    return acc;
  }, {});

  const marksByStudent = classMarks.reduce((acc, item) => {
    if (!acc[item.studentId]) acc[item.studentId] = [];
    acc[item.studentId].push(item);
    return acc;
  }, {});

  const rows = classStudents.map((student, index) => {
    const studentEnrollments = enrollmentsByStudent[student.id] || [];
    const studentMarks = marksByStudent[student.id] || [];

    const marksByColumn = createEmptyMarksByColumn(schema);
    const absencesByColumn = createEmptyAttendanceByColumn(schema);

    const religionColumn = resolveReligionColumnFromStudent(student);

    studentMarks.forEach((markDoc) => {
      const subjectName = markDoc.subjectName || markDoc.subject || "";
      const columnKey = resolveColumnKeyFromSubjectName(schema, subjectName);

      if (!columnKey || !schemaColumnMap[columnKey]) return;

      if (isAbsentMark(markDoc)) {
        absencesByColumn[columnKey] = true;
        marksByColumn[columnKey] = null;
        return;
      }

      const numericMark = extractMarkValue(markDoc);
      if (numericMark !== null) {
        marksByColumn[columnKey] = numericMark;
      }
    });

    if (religionColumn && marksByColumn[religionColumn] === null) {
      const religionEnrollment = studentEnrollments.find(
        (item) => resolveReligionColumnFromStudent({ religion: item.subjectName }) === religionColumn
      );
      if (religionEnrollment) {
        // no action needed, just confirming relevant religion slot
      }
    }

    const { total, average, subjectCount } = calculateStudentTotalAndAverage(marksByColumn);

    return {
      rowNo: index + 1,
      studentId: getStudentDisplayId(student),
      studentIndexNo: getStudentIndexNo(student),
      studentName: getStudentDisplayName(student),
      student,
      enrollments: studentEnrollments,
      marksByColumn,
      absencesByColumn,
      total,
      average: Number(average.toFixed(2)),
      subjectCount,
      rank: null,
    };
  });

  const rankedRows = assignRanks(rows).map((row, index) => ({
    ...row,
    rowNo: index + 1,
  }));

  const analysis = calculateAnalysis(rankedRows, schema);

  return {
    schema,
    classroom,
    grade: Number(grade),
    className,
    section,
    termName,
    year: Number(year),
    rows: rankedRows,
    analysis,
  };
}