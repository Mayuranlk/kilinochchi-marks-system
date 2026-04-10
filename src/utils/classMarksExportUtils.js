// src/utils/classMarksExportUtils.js

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  flattenSchemaColumns,
  ANALYSIS_BANDS,
  getOverallExclusionNote,
} from "./reportSchemas";

const SCHOOL_NAME = "KN/Kilinochchi Central College";
const A4_LANDSCAPE_WIDTH_MM = 297;

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

function isGradeSixToNine(reportData) {
  const grade = Number(reportData?.grade || 0);
  return grade >= 6 && grade <= 9;
}

function isGradeTenToEleven(reportData) {
  const grade = Number(reportData?.grade || 0);
  return grade >= 10 && grade <= 11;
}

function getScheduleColumnWidths(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);
  const is69 = isGradeSixToNine(reportData);
  const is1011 = isGradeTenToEleven(reportData);
  const widths = [is1011 ? 6 : 8, is1011 ? 16 : 20, is1011 ? 13 : 16, is1011 ? 28 : 32];

  flatColumns.forEach((column) => {
    const labelLength = (column.label || "").length;

    let width = 10;

    if (is69) {
      if (labelLength <= 4) width = 7;
      else if (labelLength <= 7) width = 8.5;
      else if (labelLength <= 10) width = 10;
      else width = 11.5;
    } else if (is1011) {
      if (labelLength <= 4) width = 5.6;
      else if (labelLength <= 8) width = 6.4;
      else if (labelLength <= 12) width = 7.4;
      else width = 8.6;
    } else {
      if (labelLength <= 5) width = 9;
      else if (labelLength <= 10) width = 10.5;
      else width = 12;
    }

    widths.push(width);
  });

  widths.push(is1011 ? 8.5 : 10, is1011 ? 10 : 12, is1011 ? 7.5 : 9);

  return widths;
}

function fitColumnWidthsToPage(widths, maxWidth) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  if (!maxWidth || totalWidth <= maxWidth) {
    return widths;
  }

  const scale = maxWidth / totalWidth;
  return widths.map((width) => Number((width * scale).toFixed(2)));
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
  doc.setFontSize(11.5);
  doc.text(`${SCHOOL_NAME} - ${title}`, pageWidth / 2, 9, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    `Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(reportData.termName)}`,
    pageWidth / 2,
    14.5,
    { align: "center" }
  );
}

function drawFooter(doc, reportData, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 8;
  const overallExclusionNote = options.showOverallExclusionNote
    ? getOverallExclusionNote(reportData.schema)
    : "";

  const classTeacher = reportData.classroom?.classTeacherName || "Class Teacher";
  const sectionalHead = reportData.classroom?.sectionHeadName || "Sectional Head";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  if (overallExclusionNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(overallExclusionNote, 10, y - 4, {
      maxWidth: pageWidth - 20,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
  }

  doc.text(classTeacher, 10, y);
  doc.text(sectionalHead, pageWidth / 2, y, { align: "center" });
  doc.text("Principal", pageWidth - 10, y, { align: "right" });
}

function getScheduleTableSettings(reportData) {
  const is69 = isGradeSixToNine(reportData);
  const is1011 = isGradeTenToEleven(reportData);

  const base = {
    marginLeft: 4,
    marginRight: 4,
    startY: 18,
    fontSize: 6.2,
    cellPadding: 0.65,
    headerFontSize: 6.1,
    topHeaderFontSize: 6.3,
  };

  if (is69) {
    base.fontSize = 6.4;
    base.cellPadding = 0.7;
    base.headerFontSize = 6.2;
    base.topHeaderFontSize = 6.5;
  }

  if (is1011) {
    base.marginLeft = 3;
    base.marginRight = 3;
    base.startY = 17.5;
    base.fontSize = 5.1;
    base.cellPadding = 0.35;
    base.headerFontSize = 4.95;
    base.topHeaderFontSize = 5.15;
  }

  const availableTableWidth = A4_LANDSCAPE_WIDTH_MM - base.marginLeft - base.marginRight;
  const fittedWidths = fitColumnWidthsToPage(
    getScheduleColumnWidths(reportData),
    availableTableWidth
  );
  const columnStyles = fittedWidths.reduce((styles, width, index) => {
    styles[index] = {
      cellWidth: width,
      halign: index === 3 ? "left" : "center",
    };
    return styles;
  }, {});

  return {
    ...base,
    columnStyles,
    tableWidth: Number(fittedWidths.reduce((sum, width) => sum + width, 0).toFixed(2)),
  };
}

export function getClassMarksSchedulePreviewLayout(reportData) {
  if (!isGradeTenToEleven(reportData)) {
    return {
      compact: false,
      fontSize: 12,
      cellPadding: "6px 8px",
      minWidth: 1200,
      tableWidth: null,
      columnWidths: [],
    };
  }

  const previewScale = 5.5;
  const columnWidths = getScheduleColumnWidths(reportData).map((width) =>
    Math.round(width * previewScale)
  );
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  return {
    compact: true,
    fontSize: 10.5,
    cellPadding: "4px 5px",
    minWidth: tableWidth,
    tableWidth,
    columnWidths,
  };
}

function getAnalysisTableSettings(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);
  const is69 = isGradeSixToNine(reportData);
  const is1011 = isGradeTenToEleven(reportData);

  const settings = {
    marginLeft: 6,
    marginRight: 6,
    startY: 18,
    fontSize: 6.7,
    cellPadding: 0.8,
    firstColumnWidth: 28,
    dataColumnWidth: 10,
  };

  if (is69) {
    settings.fontSize = 6.6;
    settings.cellPadding = 0.75;
    settings.firstColumnWidth = 28;
    settings.dataColumnWidth = 9.6;
  }

  if (is1011) {
    settings.fontSize = 5.6;
    settings.cellPadding = 0.5;
    settings.firstColumnWidth = 25;
    settings.dataColumnWidth = 7.2;
  }

  const columnStyles = {
    0: { cellWidth: settings.firstColumnWidth, halign: "left" },
  };

  for (let i = 0; i < flatColumns.length; i += 1) {
    columnStyles[i + 1] = {
      cellWidth: settings.dataColumnWidth,
      halign: "center",
    };
  }

  return {
    ...settings,
    columnStyles,
  };
}

function buildPdfDoc(reportData) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const flatColumns = flattenSchemaColumns(reportData.schema);
  const subjectColumnStart = 4;
  const subjectColumnEnd = 4 + flatColumns.length - 1;
  const scheduleSettings = getScheduleTableSettings(reportData);

  drawHeader(doc, "Mark Schedule", reportData);

  autoTable(doc, {
    startY: scheduleSettings.startY,
    head: buildGroupedHeaderRows(reportData.schema),
    body: buildScheduleBody(reportData),
    theme: "grid",
    tableWidth: scheduleSettings.tableWidth,
    margin: {
      left: scheduleSettings.marginLeft,
      right: scheduleSettings.marginRight,
    },
    styles: {
      font: "helvetica",
      fontSize: scheduleSettings.fontSize,
      cellPadding: scheduleSettings.cellPadding,
      lineWidth: 0.08,
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
      fontSize: scheduleSettings.headerFontSize,
      minCellHeight: 6,
    },
    columnStyles: scheduleSettings.columnStyles,
    pageBreak: "auto",
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.overflow = "linebreak";
        if (data.row.index === 0) {
          data.cell.styles.fontSize = scheduleSettings.topHeaderFontSize;
        }
      }

      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.halign = "left";
      }

      if (
        data.section === "body" &&
        data.column.index >= subjectColumnStart &&
        data.column.index <= subjectColumnEnd
      ) {
        const columnIndex = data.column.index - subjectColumnStart;
        const column = flatColumns[columnIndex];
        const markValue = Number(data.cell.raw);
        const highest = reportData.highestMarksByColumn?.[column.key];

        if (Number.isFinite(markValue) && highest !== null && markValue === highest) {
          data.cell.styles.fillColor = [255, 249, 196];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const scheduleNoteY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 4 : doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Highest marks are highlighted in yellow in the Mark Schedule.",
    scheduleSettings.marginLeft,
    scheduleNoteY
  );

  drawFooter(doc, reportData, { showOverallExclusionNote: true });

  doc.addPage("a4", "landscape");

  const analysisSettings = getAnalysisTableSettings(reportData);

  drawHeader(doc, "Mark Analysis", reportData);

  autoTable(doc, {
    startY: analysisSettings.startY,
    head: buildAnalysisHead(reportData),
    body: buildAnalysisBody(reportData),
    theme: "grid",
    margin: {
      left: analysisSettings.marginLeft,
      right: analysisSettings.marginRight,
    },
    styles: {
      font: "helvetica",
      fontSize: analysisSettings.fontSize,
      cellPadding: analysisSettings.cellPadding,
      lineWidth: 0.08,
      lineColor: [120, 120, 120],
      textColor: 20,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 20,
      fontStyle: "bold",
      minCellHeight: 6,
    },
    columnStyles: analysisSettings.columnStyles,
    pageBreak: "auto",
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.overflow = "linebreak";
      }
    },
  });

  if (Array.isArray(reportData.optimiStudents) && reportData.optimiStudents.length > 0) {
    doc.addPage("a4", "landscape");
    drawHeader(doc, "Optimi Students", reportData);

    const optimiRows = reportData.optimiStudents.map((student) => [
      student.rank,
      student.studentId,
      student.studentIndexNo,
      student.studentName,
      student.average,
      student.tamil,
      student.english,
      student.religionMark,
    ]);

    autoTable(doc, {
      startY: 18,
      head: [[
        "Rank",
        "Student ID",
        "Index No",
        "Student Name",
        "Average",
        "Tamil",
        "English",
        "Religion",
      ]],
      body: optimiRows,
      theme: "grid",
      margin: {
        left: 10,
        right: 10,
      },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.08,
        lineColor: [120, 120, 120],
        textColor: 20,
        valign: "middle",
        halign: "center",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 20,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", cellWidth: 30 },
        2: { halign: "left", cellWidth: 22 },
        3: { halign: "left", cellWidth: 48 },
        4: { halign: "center", cellWidth: 18 },
        5: { halign: "center", cellWidth: 18 },
        6: { halign: "center", cellWidth: 18 },
        7: { halign: "center", cellWidth: 18 },
      },
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });
  } else {
    doc.addPage("a4", "landscape");
    drawHeader(doc, "Optimi Students", reportData);
    doc.setFontSize(9);
    doc.text("No Optimi students qualified for this class.", 14, 26);
  }

  drawFooter(doc, reportData);

  return doc;
}

export function exportClassMarksPdf(reportData) {
  const doc = buildPdfDoc(reportData);
  const fileName = `${sanitizeFilenamePart(reportData.className)}_${sanitizeFilenamePart(
    reportData.year
  )}_${sanitizeFilenamePart(reportData.termName)}_Marks_Report.pdf`;
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
      row.absencesByColumn?.[column.key] ? "AB" : row.marksByColumn?.[column.key] ?? ""
    ),
    row.total,
    row.average,
    row.rank,
  ]);

  return [
    [`${SCHOOL_NAME} - Mark Schedule`],
    [
      `Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(
        reportData.termName
      )}`,
    ],
    [],
    headers,
    ...bodyRows,
    ...(getOverallExclusionNote(reportData.schema) ? [[], [getOverallExclusionNote(reportData.schema)]] : []),
  ];
}

function makeAnalysisSheetRows(reportData) {
  const flatColumns = flattenSchemaColumns(reportData.schema);

  return [
    [`${SCHOOL_NAME} - Mark Analysis`],
    [
      `Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(
        reportData.termName
      )}`,
    ],
    [],
    ["Category", ...flatColumns.map((column) => column.label)],
    ["Students's Total", ...flatColumns.map((col) => reportData.analysis[col.key]?.total ?? 0)],
    ["Appeared", ...flatColumns.map((col) => reportData.analysis[col.key]?.appeared ?? 0)],
    ...ANALYSIS_BANDS.map((band) => [
      band.key,
      ...flatColumns.map((col) => reportData.analysis[col.key]?.bands?.[band.key] ?? 0),
    ]),
    ["Students >40marks", ...flatColumns.map((col) => reportData.analysis[col.key]?.passCount ?? 0)],
    [
      "Pass Percentage",
      ...flatColumns.map((col) =>
        formatNumber(reportData.analysis[col.key]?.passPercentage ?? 0, 2)
      ),
    ],
  ];
}

function makeOptimiSheetRows(reportData) {
  const rows = [
    [`${SCHOOL_NAME} - Optimi Students`],
    [
      `Grade - ${reportData.className} Year - ${reportData.year} Term - ${termToRoman(
        reportData.termName
      )}`,
    ],
    [],
  ];

  if (!Array.isArray(reportData.optimiStudents) || reportData.optimiStudents.length === 0) {
    rows.push(["No Optimi students qualified for this class."]);
    return rows;
  }

  rows.push([
    "Rank",
    "Student ID",
    "Index No",
    "Student Name",
    "Average",
    "Tamil",
    "English",
    "Religion",
  ]);

  reportData.optimiStudents.forEach((student) => {
    rows.push([
      student.rank,
      student.studentId,
      student.studentIndexNo,
      student.studentName,
      student.average,
      student.tamil,
      student.english,
      student.religionMark,
    ]);
  });

  return rows;
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

  const optimiSheet = XLSX.utils.aoa_to_sheet(makeOptimiSheetRows(reportData));
  setExcelCols(optimiSheet, 8, [8, 16, 16, 28, 12, 12, 12, 12]);

  XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Mark Schedule");
  XLSX.utils.book_append_sheet(workbook, analysisSheet, "Mark Analysis");
  XLSX.utils.book_append_sheet(workbook, optimiSheet, "Optimi Students");

  const fileName = `${sanitizeFilenamePart(reportData.className)}_${sanitizeFilenamePart(
    reportData.year
  )}_${sanitizeFilenamePart(reportData.termName)}_Marks_Report.xlsx`;

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
    const classFolder = zip.folder(
      `${sanitizeFilenamePart(reportData.className)}_${sanitizeFilenamePart(
        reportData.year
      )}_${sanitizeFilenamePart(reportData.termName)}`
    );

    if (includePdf) {
      const doc = buildPdfDoc(reportData);
      const pdfBlob = doc.output("blob");
      classFolder.file(
        `${sanitizeFilenamePart(reportData.className)}_Marks_Report.pdf`,
        pdfBlob
      );
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

      const optimiSheet = XLSX.utils.aoa_to_sheet(makeOptimiSheetRows(reportData));
      setExcelCols(optimiSheet, 8, [8, 16, 16, 28, 12, 12, 12, 12]);

      XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Mark Schedule");
      XLSX.utils.book_append_sheet(workbook, analysisSheet, "Mark Analysis");
      XLSX.utils.book_append_sheet(workbook, optimiSheet, "Optimi Students");

      const excelArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      classFolder.file(
        `${sanitizeFilenamePart(reportData.className)}_Marks_Report.xlsx`,
        excelArray
      );
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipName = `All_Class_Marks_Reports_${sanitizeFilenamePart(
    reportDataList[0]?.year || ""
  )}_${sanitizeFilenamePart(reportDataList[0]?.termName || "")}.zip`;

  saveAs(zipBlob, zipName);
}
