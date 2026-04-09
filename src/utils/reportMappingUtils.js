// src/utils/reportMappingUtils.js

import {
  RELIGION_REPORT_MAP,
  flattenSchemaColumns,
} from "./reportSchemas";

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/&/g, "and")
    .replace(/[()]/g, "")
    .replace(/,/g, "");
}

export function getStudentDisplayName(student = {}) {
  return student.fullName || student.name || "";
}

export function getStudentIndexNo(student = {}) {
  return student.indexNo || student.admissionNo || "";
}

export function getStudentDisplayId(student = {}) {
  return student.studentId || student.id || "";
}

export function extractMarkValue(markDoc = {}) {
  const raw =
    markDoc.marks ??
    markDoc.mark ??
    markDoc.score ??
    null;

  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAbsentMark(markDoc = {}) {
  return Boolean(markDoc.isAbsent || markDoc.absent);
}

export function resolveReligionColumnFromStudent(student = {}) {
  const religion = student.religion || "";
  return RELIGION_REPORT_MAP[religion] || null;
}

export function getStudentAestheticChoice(student = {}) {
  return student.aestheticChoice || student.aesthetic || "";
}

export function getStudentBasketChoice(student = {}, bucket = "") {
  if (bucket === "A") {
    return student.basketAChoice || student.basket1 || "";
  }

  if (bucket === "B") {
    return student.basketBChoice || student.basket2 || "";
  }

  if (bucket === "C") {
    return student.basketCChoice || student.basket3 || "";
  }

  return "";
}

export function resolveColumnKeyFromSubjectName(schema, subjectName) {
  if (!schema || !subjectName) return null;

  const normalizedSubject = normalizeText(subjectName);
  const allColumns = flattenSchemaColumns(schema);

  for (const column of allColumns) {
    const matched = (column.aliases || []).some((alias) => {
      return normalizeText(alias) === normalizedSubject;
    });

    if (matched) return column.key;
  }

  return null;
}

export function buildSchemaColumnMap(schema) {
  const allColumns = flattenSchemaColumns(schema);
  return allColumns.reduce((acc, column) => {
    acc[column.key] = column;
    return acc;
  }, {});
}

export function createEmptyMarksByColumn(schema) {
  const allColumns = flattenSchemaColumns(schema);
  return allColumns.reduce((acc, column) => {
    acc[column.key] = null;
    return acc;
  }, {});
}

export function createEmptyAttendanceByColumn(schema) {
  const allColumns = flattenSchemaColumns(schema);
  return allColumns.reduce((acc, column) => {
    acc[column.key] = false;
    return acc;
  }, {});
}

function getMappedColumnKeysFromSubjectRows(schema, rows = []) {
  return rows.reduce((keys, row) => {
    const subjectName = row?.subjectName || row?.subject || "";
    const columnKey = resolveColumnKeyFromSubjectName(schema, subjectName);

    if (columnKey) {
      keys.push(columnKey);
    }

    return keys;
  }, []);
}

export function getEligibleColumnKeysForStudent({
  schema,
  student = {},
  enrollments = [],
  marks = [],
}) {
  if (!schema || !Array.isArray(schema.groups)) return [];

  const eligibleKeys = new Set();

  schema.groups.forEach((group) => {
    if (group.key === "core" || group.key === "other") {
      (group.columns || []).forEach((column) => eligibleKeys.add(column.key));
    }
  });

  const religionColumn = resolveReligionColumnFromStudent(student);
  if (religionColumn) {
    eligibleKeys.add(religionColumn);
  }

  const aestheticColumn = resolveColumnKeyFromSubjectName(schema, getStudentAestheticChoice(student));
  if (aestheticColumn) {
    eligibleKeys.add(aestheticColumn);
  }

  ["A", "B", "C"].forEach((bucket) => {
    const basketColumn = resolveColumnKeyFromSubjectName(
      schema,
      getStudentBasketChoice(student, bucket)
    );

    if (basketColumn) {
      eligibleKeys.add(basketColumn);
    }
  });

  [...getMappedColumnKeysFromSubjectRows(schema, enrollments), ...getMappedColumnKeysFromSubjectRows(schema, marks)].forEach(
    (columnKey) => eligibleKeys.add(columnKey)
  );

  return Array.from(eligibleKeys);
}
