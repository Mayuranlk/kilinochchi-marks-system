// src/utils/classMarksReportBuilder.js

import { getReportSchemaByGrade, flattenSchemaColumns } from "./reportSchemas";
import {
  buildSchemaColumnMap,
  createEmptyAttendanceByColumn,
  createEmptyMarksByColumn,
  extractMarkValue,
  getEligibleColumnKeysForStudent,
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

function getHighestMarksData(schema, rows = []) {
  const flatColumns = flattenSchemaColumns(schema);
  const highestMarksByColumn = {};
  const highestStudentsByColumn = {};

  flatColumns.forEach((column) => {
    highestMarksByColumn[column.key] = null;
    highestStudentsByColumn[column.key] = [];
  });

  rows.forEach((row) => {
    flatColumns.forEach((column) => {
      const rawMark = row.marksByColumn[column.key];
      const mark = rawMark === null || rawMark === undefined ? null : Number(rawMark);
      if (!Number.isFinite(mark)) return;

      const currentHigh = highestMarksByColumn[column.key];
      if (currentHigh === null || mark > currentHigh) {
        highestMarksByColumn[column.key] = mark;
        highestStudentsByColumn[column.key] = [row.studentName];
        return;
      }

      if (mark === currentHigh) {
        highestStudentsByColumn[column.key].push(row.studentName);
      }
    });
  });

  return { highestMarksByColumn, highestStudentsByColumn };
}

function buildSubjectStats(schema, analysis, highestMarksByColumn, highestStudentsByColumn) {
  return flattenSchemaColumns(schema).reduce((acc, column) => {
    const columnAnalysis = analysis[column.key] || {};
    const average = columnAnalysis.appeared
      ? Number((columnAnalysis.marksTotal / columnAnalysis.appeared).toFixed(2))
      : 0;

    acc[column.key] = {
      average,
      highestMark: highestMarksByColumn[column.key],
      topStudents: highestStudentsByColumn[column.key] || [],
      appeared: columnAnalysis.appeared || 0,
      passCount: columnAnalysis.passCount || 0,
      passPercentage: columnAnalysis.passPercentage || 0,
    };

    return acc;
  }, {});
}

function buildGroupStats(schema, analysis) {
  return (schema.groups || []).map((group) => {
    const subjectKeys = (group.columns || []).map((column) => column.key);
    const appeared = subjectKeys.reduce((sum, key) => sum + (analysis[key]?.appeared || 0), 0);
    const marksTotal = subjectKeys.reduce((sum, key) => sum + (analysis[key]?.marksTotal || 0), 0);
    const passCount = subjectKeys.reduce((sum, key) => sum + (analysis[key]?.passCount || 0), 0);
    return {
      key: group.key,
      label: group.label || "Group",
      subjectCount: subjectKeys.length,
      appeared,
      average: appeared ? Number((marksTotal / appeared).toFixed(2)) : 0,
      passPercentage: appeared ? Number(((passCount / appeared) * 100).toFixed(2)) : 0,
    };
  });
}

function getOptimiStudents(rows = []) {
  return rows
    .filter((row) => {
      const tamil = Number(row.marksByColumn?.TAMIL ?? NaN);
      const english = Number(row.marksByColumn?.ENGLISH ?? NaN);
      const religionColumn = resolveReligionColumnFromStudent(row.student);
      const religion = Number(row.marksByColumn?.[religionColumn] ?? NaN);

      return (
        Number(row.average) >= 75 &&
        Number.isFinite(tamil) && tamil >= 75 &&
        Number.isFinite(english) && english >= 60 &&
        religionColumn &&
        Number.isFinite(religion) &&
        religion >= 75
      );
    })
    .map((row) => {
      const religionColumn = resolveReligionColumnFromStudent(row.student);
      return {
        rowNo: row.rowNo,
        studentId: row.studentId,
        studentIndexNo: row.studentIndexNo,
        studentName: row.studentName,
        total: row.total,
        average: row.average,
        tamil: row.marksByColumn?.TAMIL ?? null,
        english: row.marksByColumn?.ENGLISH ?? null,
        religionColumn,
        religionMark: row.marksByColumn?.[religionColumn] ?? null,
      };
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

    const eligibleColumnKeys = getEligibleColumnKeysForStudent({
      schema,
      student,
      enrollments: studentEnrollments,
      marks: studentMarks,
    });

    const { total, average, subjectCount } = calculateStudentTotalAndAverage(
      marksByColumn,
      schema
    );

    return {
      rowNo: index + 1,
      studentId: getStudentDisplayId(student),
      studentIndexNo: getStudentIndexNo(student),
      studentName: getStudentDisplayName(student),
      student,
      enrollments: studentEnrollments,
      eligibleColumnKeys,
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
  const { highestMarksByColumn, highestStudentsByColumn } = getHighestMarksData(
    schema,
    rankedRows
  );
  const subjectStats = buildSubjectStats(
    schema,
    analysis,
    highestMarksByColumn,
    highestStudentsByColumn
  );
  const groupStats = buildGroupStats(schema, analysis);
  const optimiStudents = getOptimiStudents(rankedRows);

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
    highestMarksByColumn,
    highestStudentsByColumn,
    subjectStats,
    groupStats,
    optimiStudents,
  };
}
