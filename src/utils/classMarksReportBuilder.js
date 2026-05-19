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
import {
  buildALClassName,
  buildALDisplayClassName,
  isALGrade,
} from "../constants";

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const parseGradeValue = (value) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};
const normalizeSectionValue = (value) => {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
};

function pickValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

export function filterActiveEnrollments(enrollments = []) {
  return enrollments.filter((item) => (item.status || "").toLowerCase() !== "inactive");
}

export function filterMarksForTermYearClass(marks = [], { className, termName, year }) {
  return marks.filter((item) => {
    const markClassName = item.alClassName || item.fullClassName || item.className || "";
    const markTerm = item.termName || item.term || "";
    const markYear = Number(item.academicYear || item.year || 0);

    return (
      markClassName === className &&
      markTerm === termName &&
      markYear === Number(year)
    );
  });
}

const normalizeSection = (value) => String(value || "").trim().toUpperCase();
const getComparableClassName = (item = {}) => {
  const explicit = String(item.alClassName || item.fullClassName || "").trim();
  if (explicit) return explicit;

  const grade = Number(item.grade || 0);
  const stream = String(item.stream || "").trim();
  const section = normalizeSection(item.section || item.className);

  if ((grade === 12 || grade === 13) && stream && section) {
    return `${grade} ${stream} ${section}`;
  }

  return String(item.className || "").trim();
};

function getALClassIdentity(row = {}, fallback = {}) {
  const grade = parseGradeValue(pickValue(row.grade, fallback.grade, ""));
  const section = normalizeSectionValue(pickValue(row.section, fallback.section, row.className, fallback.className, ""));
  const stream = normalizeText(pickValue(row.stream, fallback.stream, ""));

  if (!isALGrade(grade) || !stream || !section) return "";
  return buildALClassName(grade, stream, section);
}

function getALClassDisplayIdentity(row = {}, fallback = {}) {
  const grade = parseGradeValue(pickValue(row.grade, fallback.grade, ""));
  const section = normalizeSectionValue(pickValue(row.section, fallback.section, row.className, fallback.className, ""));
  const stream = normalizeText(pickValue(row.stream, fallback.stream, ""));

  if (!isALGrade(grade) || !stream || !section) return "";
  return buildALDisplayClassName(grade, stream, section) || buildALClassName(grade, stream, section);
}

function matchesReportClass(row = {}, { grade, section, className = "", stream = "" }) {
  const targetGrade = Number(grade);
  const rowGrade = parseGradeValue(row.grade || row.className);
  const targetSection = normalizeSectionValue(section || className);
  const rowSection = normalizeSectionValue(row.section || row.className);
  const targetStream = normalizeLower(stream);
  const rowStream = normalizeLower(row.stream);
  const targetIdentity = normalizeLower(className);
  const rowIdentities = [
    row.alClassName,
    row.fullClassName,
    getALClassIdentity(row),
    getALClassDisplayIdentity(row),
    row.className,
  ]
    .map(normalizeLower)
    .filter(Boolean);

  if (isALGrade(targetGrade)) {
    if (targetIdentity && rowIdentities.includes(targetIdentity)) return true;
    if (rowGrade !== targetGrade || rowSection !== targetSection) return false;
    if (targetStream) return rowStream === targetStream;
    return true;
  }

  if (targetIdentity && rowIdentities.includes(targetIdentity)) return true;
  return rowGrade === targetGrade && rowSection === targetSection;
}

function makeALColumnKey(subject = {}) {
  const subjectNumber = normalizeText(subject.subjectNumber);
  const subjectId = normalizeText(subject.subjectId);
  const subjectName = normalizeText(subject.subjectName || subject.subject);
  const base = subjectNumber || subjectId || subjectName;
  return `AL_${base.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase()}`;
}

function normalizeALSubjectNumber(value) {
  return normalizeText(value).toUpperCase().replace(/^AL_/, "");
}

function getALSubjectNumberFromColumn(column = {}) {
  return normalizeALSubjectNumber(column.subjectNumber || column.key || "");
}

function isALGeneralColumn(column = {}) {
  const number = getALSubjectNumberFromColumn(column);
  const label = normalizeLower(column.label);
  return (
    ["12", "13", "GIT"].includes(number) ||
    label === "common general test" ||
    label === "general english" ||
    label === "general information technology" ||
    label === "git"
  );
}

function getALDisplayLabel(subject = {}) {
  const number = normalizeALSubjectNumber(subject.subjectNumber || subject.subjectId);
  const name = normalizeText(subject.subjectName || subject.subject);

  if (number === "13" || normalizeLower(name) === "english") return "General English";
  if (number === "12") return "Common General Test";
  if (number === "GIT") return "General Information Technology";

  return name;
}

function getALColumnSortRank(column = {}) {
  const label = normalizeLower(column.label);
  const number = getALSubjectNumberFromColumn(column);

  if (label === "tamil" || number === "72") return 1;
  if (label === "geography" || number === "22") return 2;
  if (label.includes("history") || number.startsWith("25")) return 3;
  if (isALGeneralColumn(column)) return 900;
  return 100;
}

function sortALColumns(left, right) {
  const rankDiff = getALColumnSortRank(left) - getALColumnSortRank(right);
  if (rankDiff !== 0) return rankDiff;

  const numberCompare = getALSubjectNumberFromColumn(left).localeCompare(
    getALSubjectNumberFromColumn(right),
    undefined,
    { numeric: true, sensitivity: "base" }
  );
  if (numberCompare !== 0) return numberCompare;
  return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
}

function isALMainColumn(column = {}) {
  return !isALGeneralColumn(column);
}

function calculateTotalAndAverageForKeys(marksByColumn, schema, keys = []) {
  if (Array.isArray(keys) && keys.length === 0) {
    return { total: 0, average: 0, subjectCount: 0 };
  }

  return calculateStudentTotalAndAverage(marksByColumn, schema, keys);
}

function buildALReportSchema(activeEnrollments = []) {
  const map = new Map();

  activeEnrollments.forEach((enrollment) => {
    const subjectName = getALDisplayLabel(enrollment);
    if (!subjectName) return;

    const subjectNumber = normalizeText(enrollment.subjectNumber);
    const subjectId = normalizeText(enrollment.subjectId);
    const key = makeALColumnKey({ subjectNumber, subjectId, subjectName });

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: subjectName,
        aliases: [subjectName, enrollment.subjectName, enrollment.subject, subjectNumber, subjectId].filter(Boolean),
        subjectNumber,
      });
    }
  });

  const columns = Array.from(map.values()).sort(sortALColumns);

  return {
    id: "AL_STREAM",
    title: "Grades 12 to 13 A/L",
    groups: [
      {
        key: "al",
        label: "A/L Subjects",
        columns,
      },
    ],
  };
}

export function filterStudentsForClass(students = [], grade, section, className = "", stream = "") {
  const targetClassName = String(className || "").trim();
  const targetSection = normalizeSection(section);

  return students.filter((student) => {
    if (Number(student.grade) !== Number(grade)) return false;

    if (isALGrade(grade)) {
      return matchesReportClass(student, { grade, section, className: targetClassName, stream });
    }

    if (targetClassName) {
      const studentClassName = getComparableClassName(student);
      if (studentClassName && studentClassName === targetClassName) return true;
      if (targetClassName.includes(" ")) return false;
    }

    return normalizeSection(student.section || student.className) === targetSection;
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
  stream = "",
  termName,
  year,
}) {
  const reportContext = { grade, section, className, stream };
  let classStudents = filterStudentsForClass(students, grade, section, className, stream);
  const activeEnrollments = filterActiveEnrollments(enrollments).filter((item) => {
    return (
      matchesReportClass(item, reportContext) &&
      Number(item.academicYear || item.year || 0) === Number(year)
    );
  });

  if (isALGrade(grade)) {
    const enrolledStudentIds = new Set(activeEnrollments.map((item) => normalizeText(item.studentId)).filter(Boolean));
    classStudents = students.filter((student) => enrolledStudentIds.has(normalizeText(student.id)));
  }

  const schema = getReportSchemaByGrade(grade) || (isALGrade(grade) ? buildALReportSchema(activeEnrollments) : null);
  if (!schema || !schema.groups?.some((group) => group.columns?.length)) {
    throw new Error(`Unsupported grade for report schema: ${grade}`);
  }

  const schemaColumnMap = buildSchemaColumnMap(schema);
  const classMarks = marks.filter((item) => {
    const markTerm = item.termName || item.term || "";
    const markYear = Number(item.academicYear || item.year || 0);
    return (
      matchesReportClass(item, reportContext) &&
      markTerm === termName &&
      markYear === Number(year)
    );
  });

  const classroom =
    classrooms.find(
      (item) =>
        matchesReportClass(item, reportContext) &&
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

  const heldColumnKeys = new Set();
  classMarks.forEach((markDoc) => {
    const subjectName = markDoc.subjectName || markDoc.subject || "";
    const columnKey = resolveColumnKeyFromSubjectName(schema, subjectName);
    if (columnKey && schemaColumnMap[columnKey]) heldColumnKeys.add(columnKey);
  });

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

    const heldEligibleColumnKeys = isALGrade(grade)
      ? eligibleColumnKeys.filter((key) => heldColumnKeys.has(key))
      : eligibleColumnKeys;

    const mainEligibleColumnKeys = isALGrade(grade)
      ? heldEligibleColumnKeys.filter((key) => isALMainColumn(schemaColumnMap[key]))
      : heldEligibleColumnKeys;

    const mainResult = isALGrade(grade)
      ? calculateTotalAndAverageForKeys(marksByColumn, schema, mainEligibleColumnKeys)
      : calculateStudentTotalAndAverage(
      marksByColumn,
      schema,
      mainEligibleColumnKeys
    );
    const overallResult = isALGrade(grade)
      ? calculateTotalAndAverageForKeys(marksByColumn, schema, heldEligibleColumnKeys)
      : mainResult;

    const total = mainResult.total;
    const average = mainResult.average;
    const subjectCount = mainResult.subjectCount;

    const overallTotal = overallResult.total;
    const overallAverage = overallResult.average;
    const overallSubjectCount = overallResult.subjectCount;

    const hasSeparateOverallTotal =
      isALGrade(grade) &&
      overallSubjectCount > subjectCount;

    const rankBasis = isALGrade(grade) ? "main_3_subjects" : "overall";

    const reportEligibleColumnKeys = isALGrade(grade)
      ? mainEligibleColumnKeys
      : heldEligibleColumnKeys;

    const overallEligibleColumnKeys = isALGrade(grade)
      ? heldEligibleColumnKeys
      : reportEligibleColumnKeys;

    const mainSubjectColumnKeys = isALGrade(grade)
      ? mainEligibleColumnKeys
      : reportEligibleColumnKeys;

    const generalSubjectColumnKeys = isALGrade(grade)
      ? heldEligibleColumnKeys.filter((key) => !mainEligibleColumnKeys.includes(key))
      : [];

    const rankNote = isALGrade(grade)
      ? "Rank is calculated from A/L main subjects only."
      : "";

    const overallNote =
      isALGrade(grade) && hasSeparateOverallTotal
        ? "Overall total includes held A/L main and general subjects."
        : "";

    const nextRow = {
      rowNo: index + 1,
      studentId: getStudentDisplayId(student),
      studentIndexNo: getStudentIndexNo(student),
      studentName: getStudentDisplayName(student),
      student,
      enrollments: studentEnrollments,
      eligibleColumnKeys,
      reportEligibleColumnKeys,
      overallEligibleColumnKeys,
      mainSubjectColumnKeys,
      generalSubjectColumnKeys,
      marksByColumn,
      absencesByColumn,
      total,
      average: Number(average.toFixed(2)),
      subjectCount,
      overallTotal,
      overallAverage: Number(overallAverage.toFixed(2)),
      overallSubjectCount,
      hasSeparateOverallTotal,
      rankBasis,
      rankNote,
      overallNote,
      rank: null,
    };

    return nextRow;
  });

  const rankedRows = assignRanks(rows).map((row, index) => ({
    ...row,
    rowNo: index + 1,
  }));

  const hasSeparateOverallTotal = rankedRows.some((row) => row.hasSeparateOverallTotal);
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
    hasSeparateOverallTotal,
    rankBasis: isALGrade(grade) ? "main_3_subjects" : "overall",
  };
}
