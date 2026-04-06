// src/utils/reportAnalysisUtils.js

import { ANALYSIS_BANDS, flattenSchemaColumns } from "./reportSchemas";

export function calculateStudentTotalAndAverage(marksByColumn = {}) {
  const validMarks = Object.values(marksByColumn).filter(
    (value) => value !== null && value !== undefined && Number.isFinite(Number(value))
  );

  const total = validMarks.reduce((sum, value) => sum + Number(value), 0);
  const average = validMarks.length ? total / validMarks.length : 0;

  return {
    total,
    average,
    subjectCount: validMarks.length,
  };
}

export function assignRanks(rows = []) {
  const sorted = [...rows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.studentName.localeCompare(b.studentName);
  });

  let currentRank = 1;

  return sorted.map((row, index) => {
    if (index > 0) {
      const prev = sorted[index - 1];
      if (prev.total !== row.total) {
        currentRank = index + 1;
      }
    }

    return {
      ...row,
      rank: currentRank,
    };
  });
}

export function buildEmptyAnalysisForSchema(schema) {
  const result = {};
  const allColumns = flattenSchemaColumns(schema);

  allColumns.forEach((column) => {
    result[column.key] = {
      total: 0,
      appeared: 0,
      passCount: 0,
      passPercentage: 0,
      bands: ANALYSIS_BANDS.reduce((acc, band) => {
        acc[band.key] = 0;
        return acc;
      }, {}),
    };
  });

  return result;
}

export function calculateAnalysis(rows = [], schema) {
  const analysis = buildEmptyAnalysisForSchema(schema);
  const allColumns = flattenSchemaColumns(schema);

  for (const row of rows) {
    for (const column of allColumns) {
      const mark = row.marksByColumn[column.key];

      if (mark === null || mark === undefined || !Number.isFinite(Number(mark))) {
        continue;
      }

      const numericMark = Number(mark);
      const item = analysis[column.key];

      item.total += numericMark;
      item.appeared += 1;

      for (const band of ANALYSIS_BANDS) {
        if (numericMark >= band.min && numericMark <= band.max) {
          item.bands[band.key] += 1;
          break;
        }
      }

      if (numericMark > 40) {
        item.passCount += 1;
      }
    }
  }

  Object.values(analysis).forEach((item) => {
    item.passPercentage =
      item.appeared > 0 ? Number(((item.passCount / item.appeared) * 100).toFixed(2)) : 0;
  });

  return analysis;
}