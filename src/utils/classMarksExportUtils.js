// src/utils/classMarksExportUtils.js

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { flattenSchemaColumns, ANALYSIS_BANDS } from "./reportSchemas";

const SCHOOL_NAME = "KN/Kilinochchi Central College";

function safeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return Number.isInteger(num) ? String(num) : num.toFixed(decimals);
}

function termToRoman(termName = "") {
  const normalized = String(termName).trim().toLowerCase();
  if (normalized === "term 1") return "I";
  if (normalized === "term 2") return "II";
  if (normalized === "term 3") return "III";
  return termName;
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_");
}

function buildGroupedHeaderRows(schema) {
  const groups = schema.groups || [];
  const flatColumns = flattenSchemaColumns(schema);

  const topRow = [
    { content: "No", rowSpan: 2 },
    { content: "Student ID", rowSpan: 2 },
    { content: "Index No", rowSpan: 2 },
    { content: "Students Name", rowSpan: 2 },
  ];

  groups.forEach((group) => {
    topRow.push({
      content: group.label || " ",
      colSpan: group.columns.length,
    });
  });

  topRow.push({ content: "Total", rowSpan: 2 });
  topRow.push({ content: "Average", rowSpan: 2 });
  topRow.push({ content: "Rank", rowSpan: 2 });

  const secondRow = flatColumns.map((column) => ({
    content: column.label,
  }));

  return [topRow, secondRow];
}

function buildScheduleBody(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);

  return reportData.rows.map((row) => [
    row.rowNo,
    safeText(row.studentId),
    safeText(row.studentIndexNo),
    safeText(row.studentName),
    ...flatColumns.map((column) => {
      if (row.absencesByColumn?.[column.key]) return "AB";
      const value = row.marksByColumn?.[column.key];
      return value === null || value === undefined ? "" : value;
    }),
    formatNumber(row.total, 0),
    formatNumber(row.average, 2),
    safeText(row.rank),
  ]);
}

function buildAnalysisHead(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);
  return [["", ...flatColumns.map((column) => column.label)]];
}

function buildAnalysisBody(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);
  const { analysis } = reportData;

  const rows = [
    {
      label: "Students's Total",
      values: flatColumns.map((col) => analysis[col.key]?.total ?? 0),
    },
    {
      label: "Appeared",
      values: flatColumns.map((col) => analysis[col.key]?.appeared ?? 0),
    },
    ...ANALYSIS_BANDS.map((band) => ({
      label: band.key,
      values: flatColumns.map((col) => analysis[col.key]?.bands?.[band.key] ?? 0),
    })),
    {
      label: "Students >40marks",
      values: flatColumns.map((col) => analysis[col.key]?.passCount ?? 0),
    },
    {
      label: "Pass Percentage",
      values: flatColumns.map((col) => formatNumber(analysis[col.key]?.passPercentage ?? 0, 2)),
    },
  ];

  return rows.map((row) => [row.label, ...row.values]);
}

function drawHeader(doc, title, reportData) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${SCHOOL_NAME} - ${title}`, pageWidth / 2, 10, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(reportData.termName)}`,
    pageWidth / 2,
    16,
    { align: "center" }
  );
}

function drawFooter(doc, reportData) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 10;

  const classTeacher = reportData.classroom?.classTeacherName || "Class Teacher";
  const sectionalHead = reportData.classroom?.sectionHeadName || "Sectional Head";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(classTeacher, 15, y);
  doc.text(sectionalHead, pageWidth / 2, y, { align: "center" });
  doc.text("Principal", pageWidth - 15, y, { align: "right" });
}

function getScheduleColumnStyles(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);

  const styles = {
    0: { cellWidth: 10, halign: "center" },
    1: { cellWidth: 22, halign: "center" },
    2: { cellWidth: 20, halign: "center" },
    3: { cellWidth: 40, halign: "left" },
  };

  let currentIndex = 4;

  flatColumns.forEach((col) => {
    if ((col.label || "").length > 10) {
      styles[currentIndex] = { cellWidth: 18, halign: "center" };
    } else {
      styles[currentIndex] = { cellWidth: 13, halign: "center" };
    }
    currentIndex += 1;
  });

  styles[currentIndex] = { cellWidth: 14, halign: "center" };
  styles[currentIndex + 1] = { cellWidth: 16, halign: "center" };
  styles[currentIndex + 2] = { cellWidth: 12, halign: "center" };

  return styles;
}

function buildPdfDoc(reportData) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  drawHeader(doc, "Mark Schedule", reportData);

  autoTable(doc, {
    startY: 22,
    head: buildGroupedHeaderRows(reportData.schema),
    body: buildScheduleBody(reportData),
    theme: "grid",
    margin: { left: 6, right: 6 },
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.2,
      lineWidth: 0.1,
      lineColor: [120, 120, 120],
      textColor: 20,
      valign: "middle",
      overflow: "linebreak",
      halign: "center",
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 20,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    columnStyles: getScheduleColumnStyles(reportData),
    pageBreak: "auto",
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.halign = "left";
      }
    },
  });

  drawFooter(doc, reportData);

  doc.addPage("a4", "landscape");

  drawHeader(doc, "Mark Analysis", reportData);

  autoTable(doc, {
    startY: 22,
    head: buildAnalysisHead(reportData),
    body: buildAnalysisBody(reportData),
    theme: "grid",
    margin: { left: 6, right: 6 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.4,
      lineWidth: 0.1,
      lineColor: [120, 120, 120],
      textColor: 20,
      valign: "middle",
      halign: "center",
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 20,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 32, halign: "left" },
    },
    pageBreak: "auto",
    rowPageBreak: "avoid",
  });

  drawFooter(doc, reportData);

  return doc;
}

export function exportClassMarksPdf(reportData) {
  const doc = buildPdfDoc(reportData);
  const fileName = `${sanitizeFilenamePart(reportData.className)}_${sanitizeFilenamePart(reportData.year)}_${sanitizeFilenamePart(reportData.termName)}_Marks_Report.pdf`;
  doc.save(fileName);
}

function makeScheduleSheetRows(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);

  const headers = [
    "No",
    "Student ID",
    "Index No",
    "Students Name",
    ...flatColumns.map((column) => column.label),
    "Total",
    "Average",
    "Rank",
  ];

  const bodyRows = reportData.rows.map((row) => [
    row.rowNo,
    row.studentId,
    row.studentIndexNo,
    row.studentName,
    ...flatColumns.map((column) =>
      row.absencesByColumn?.[column.key] ? "AB" : (row.marksByColumn?.[column.key] ?? "")
    ),
    row.total,
    row.average,
    row.rank,
  ]);

  return [
    [`${SCHOOL_NAME} - Mark Schedule`],
    [`Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(reportData.termName)}`],
    [],
    headers,
    ...bodyRows,
  ];
}

function makeAnalysisSheetRows(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);

  return [
    [`${SCHOOL_NAME} - Mark Analysis`],
    [`Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(reportData.termName)}`],
    [],
    ["Category", ...flatColumns.map((column) => column.label)],
    ["Students's Total", ...flatColumns.map((col) => reportData.analysis[col.key]?.total ?? 0)],
    ["Appeared", ...flatColumns.map((col) => reportData.analysis[col.key]?.appeared ?? 0)],
    ...ANALYSIS_BANDS.map((band) => [
      band.key,
      ...flatColumns.map((col) => reportData.analysis[col.key]?.bands?.[band.key] ?? 0),
    ]),
    ["Students >40marks", ...flatColumns.map((col) => reportData.analysis[col.key]?.passCount ?? 0)],
    ["Pass Percentage", ...flatColumns.map((col) => formatNumber(reportData.analysis[col.key]?.passPercentage ?? 0, 2))],
  ];
}

function setExcelCols(worksheet, count, firstWidths = []) {
  const cols = [];
  for (let i = 0; i < count; i += 1) {
    cols.push({ wch: firstWidths[i] || 12 });
  }
  worksheet["!cols"] = cols;
}

export function exportClassMarksExcel(reportData) {
  const workbook = XLSX.utils.book_new();
  const flatColumns = flattenSchemaColumns(reportData.schema);

  const scheduleSheet = XLSX.utils.aoa_to_sheet(makeScheduleSheetRows(reportData));
  setExcelCols(
    scheduleSheet,
    4 + flatColumns.length + 3,
    [6, 16, 16, 28, ...flatColumns.map(() => 12), 10, 10, 8]
  );

  const analysisSheet = XLSX.utils.aoa_to_sheet(makeAnalysisSheetRows(reportData));
  setExcelCols(
    analysisSheet,
    1 + flatColumns.length,
    [22, ...flatColumns.map(() => 12)]
  );

  XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Mark Schedule");
  XLSX.utils.book_append_sheet(workbook, analysisSheet, "Mark Analysis");

  const fileName = `${sanitizeFilenamePart(reportData.className)}_${sanitizeFilenamePart(reportData.year)}_${sanitizeFilenamePart(reportData.termName)}_Marks_Report.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export async function exportAllClassesReportsZip(reportDataList = [], options = {}) {
  if (!Array.isArray(reportDataList) || reportDataList.length === 0) {
    throw new Error("No report data available for bulk export.");
  }

  const zip = new JSZip();
  const includePdf = options.includePdf !== false;
  const includeExcel = options.includeExcel !== false;

  for (const reportData of reportDataList) {
    const classFolder = zip.folder(`${sanitizeFilenamePart(reportData.className)}_${sanitizeFilenamePart(reportData.year)}_${sanitizeFilenamePart(reportData.termName)}`);

    if (includePdf) {
      const doc = buildPdfDoc(reportData);
      const pdfBlob = doc.output("blob");
      classFolder.file(`${sanitizeFilenamePart(reportData.className)}_Marks_Report.pdf`, pdfBlob);
    }

    if (includeExcel) {
      const workbook = XLSX.utils.book_new();
      const flatColumns = flattenSchemaColumns(reportData.schema);

      const scheduleSheet = XLSX.utils.aoa_to_sheet(makeScheduleSheetRows(reportData));
      setExcelCols(
        scheduleSheet,
        4 + flatColumns.length + 3,
        [6, 16, 16, 28, ...flatColumns.map(() => 12), 10, 10, 8]
      );

      const analysisSheet = XLSX.utils.aoa_to_sheet(makeAnalysisSheetRows(reportData));
      setExcelCols(
        analysisSheet,
        1 + flatColumns.length,
        [22, ...flatColumns.map(() => 12)]
      );

      XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Mark Schedule");
      XLSX.utils.book_append_sheet(workbook, analysisSheet, "Mark Analysis");

      const excelArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      classFolder.file(`${sanitizeFilenamePart(reportData.className)}_Marks_Report.xlsx`, excelArray);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipName = `All_Class_Marks_Reports_${sanitizeFilenamePart(reportDataList[0]?.year || "")}_${sanitizeFilenamePart(reportDataList[0]?.termName || "")}.zip`;
  saveAs(zipBlob, zipName);
}