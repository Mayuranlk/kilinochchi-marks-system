import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AnalyticsRoundedIcon from "@mui/icons-material/AnalyticsRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SubjectRoundedIcon from "@mui/icons-material/SubjectRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { collection, getDocs } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

import { db } from "../firebase";
import {
  EmptyState,
  PageContainer,
  ResponsiveTableWrapper,
  StatCard,
} from "../components/ui";

const CURRENT_YEAR = new Date().getFullYear();
const ALL = "__ALL__";

const GRADE_BANDS = [
  { key: "A", description: "Distinction", min: 75, max: 100 },
  { key: "B", description: "Very Good Pass", min: 65, max: 74 },
  { key: "C", description: "Credit Pass", min: 50, max: 64 },
  { key: "S", description: "Ordinary Pass", min: 35, max: 49 },
  { key: "W", description: "Weak", min: 0, max: 34 },
];

const RANGE_BANDS = [
  { key: "0-9", min: 0, max: 9 },
  { key: "10-19", min: 10, max: 19 },
  { key: "20-29", min: 20, max: 29 },
  { key: "30-34", min: 30, max: 34 },
  { key: "35-39", min: 35, max: 39 },
  { key: "40-49", min: 40, max: 49 },
  { key: "50-59", min: 50, max: 59 },
  { key: "60-69", min: 60, max: 69 },
  { key: "70-79", min: 70, max: 79 },
  { key: "80-89", min: 80, max: 89 },
  { key: "90-100", min: 90, max: 100 },
];

const LOW_MARK_BANDS = RANGE_BANDS.filter((band) => band.max <= 34);

const TAB_CONFIG = [
  { value: "grade", label: "Grade Subject Analysis" },
  { value: "class", label: "Class Subject Analysis" },
  { value: "range", label: "Subject Mark Range" },
  { value: "threeCThreeS", label: "Below 3C 3S List" },
  { value: "lowMarks", label: "Low Mark Students" },
  { value: "sheet", label: "A3 Grading Sheet" },
];

const A3_SUBJECT_ORDER = [
  {
    groupKey: "religion",
    aliases: ["saivam", "hinduism", "hindu"],
    shortLabel: "Saivam",
  },
  {
    groupKey: "religion",
    aliases: ["nrc", "christianity", "christian"],
    shortLabel: "NRC",
  },
  {
    groupKey: "religion",
    aliases: ["rc", "catholicism", "roman catholic", "catholic"],
    shortLabel: "RC",
  },
  {
    groupKey: "religion",
    aliases: ["islam", "muslim"],
    shortLabel: "Islam",
  },
  { groupKey: "core", aliases: ["tamil"], shortLabel: "Tamil" },
  { groupKey: "core", aliases: ["maths", "mathematics", "math"], shortLabel: "Maths" },
  { groupKey: "core", aliases: ["english"], shortLabel: "English" },
  { groupKey: "core", aliases: ["science"], shortLabel: "Science" },
  { groupKey: "core", aliases: ["history"], shortLabel: "History" },
  {
    groupKey: "basket1",
    aliases: ["citizenship", "civics", "civic education", "citizenship and governance", "citizenship & gov"],
    shortLabel: "Citizenship & Gov",
  },
  { groupKey: "basket1", aliases: ["geography"], shortLabel: "Geography" },
  {
    groupKey: "basket1",
    aliases: ["business", "business & accounting", "business and accounting", "business & accounting studies"],
    shortLabel: "Business & Acc",
  },
  {
    groupKey: "basket1",
    aliases: ["entrepreneurship", "enterpreneurship", "entrepreneurship studies"],
    shortLabel: "Entrepreneurship Stu",
  },
  { groupKey: "basket2", aliases: ["art"], shortLabel: "Art" },
  { groupKey: "basket2", aliases: ["dance", "dancing"], shortLabel: "Dance" },
  { groupKey: "basket2", aliases: ["music"], shortLabel: "Music" },
  {
    groupKey: "basket2",
    aliases: ["drama", "drama & theatre", "drama and theatre", "drama & theater"],
    shortLabel: "Drama & Theater",
  },
  {
    groupKey: "basket2",
    aliases: ["tamil literature", "appreciation of tamil"],
    shortLabel: "Tamil Literature",
  },
  {
    groupKey: "basket2",
    aliases: ["english literature", "eng-literature", "eng literature", "appreciation of english"],
    shortLabel: "Eng-Literature",
  },
  {
    groupKey: "basket3",
    aliases: ["agriculture", "agriculture & food", "agriculture & food technology"],
    shortLabel: "Agriculture & Food Tec",
  },
  {
    groupKey: "basket3",
    aliases: ["health", "health & physical", "health & physical education"],
    shortLabel: "Health & Phy",
  },
  { groupKey: "basket3", aliases: ["home economics", "home economic"], shortLabel: "Home economics" },
  { groupKey: "basket3", aliases: ["ict", "information & communication"], shortLabel: "ICT" },
  {
    groupKey: "basket3",
    aliases: ["communication & media", "media studies", "com & media"],
    shortLabel: "Com & Media Studies",
  },
  {
    groupKey: "basket3",
    aliases: ["design & construction", "design and construction"],
    shortLabel: "Design & Const Tec",
  },
  {
    groupKey: "basket3",
    aliases: ["design & mechanical", "design and mechanical"],
    shortLabel: "Design& Mech Tec",
  },
  {
    groupKey: "basket3",
    aliases: ["design, electrical", "design & electrical", "design and electrical", "electronic technology"],
    shortLabel: "Design & Elect Tec",
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function parseGrade(value) {
  const match = clean(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = clean(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function buildClassName(grade, section) {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : clean(section || "");
}

function getStudentName(student = {}) {
  return clean(student.name || student.fullName || student.studentName || student.displayName);
}

function getStudentIndex(student = {}) {
  return clean(
    student.indexNo ||
      student.indexNumber ||
      student.admissionNo ||
      student.admissionNumber ||
      student.rollNo ||
      student.studentNumber
  );
}

function getSubjectName(row = {}) {
  return clean(row.subjectName || row.subject || row.name || row.shortName || "Unknown Subject");
}

function getSubjectId(row = {}) {
  return clean(row.subjectId || row.id || "");
}

function getSubjectKey(row = {}) {
  return getSubjectId(row) || `name:${normalize(getSubjectName(row))}`;
}

function getA3SubjectConfig(subjectName = "") {
  const value = normalize(subjectName);
  const matches = A3_SUBJECT_ORDER.flatMap((item, index) =>
    item.aliases
      .filter((alias) => value === alias || value.includes(alias))
      .map((alias) => ({
        item,
        index,
        aliasLength: alias.length,
        exact: value === alias,
      }))
  );

  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (a.aliasLength !== b.aliasLength) return b.aliasLength - a.aliasLength;
    return a.index - b.index;
  });

  return matches[0]?.item || null;
}

function getSubjectGroupKey(subject = {}) {
  const configured = getA3SubjectConfig(getSubjectName(subject));
  if (configured?.groupKey) return configured.groupKey;

  const category = normalize(subject.category);
  const basketGroup = clean(subject.basketGroup || subject.basket || subject.group).toUpperCase();

  if (category === "religion") return "religion";
  if (category === "basket") {
    if (basketGroup === "A" || basketGroup === "1" || basketGroup === "I") return "basket1";
    if (basketGroup === "B" || basketGroup === "2" || basketGroup === "II") return "basket2";
    if (basketGroup === "C" || basketGroup === "3" || basketGroup === "III") return "basket3";
  }
  if (category === "basket_a") return "basket1";
  if (category === "basket_b") return "basket2";
  if (category === "basket_c") return "basket3";

  return "core";
}

function getSubjectGroupLabel(groupKey) {
  const labels = {
    religion: "Religion",
    core: "",
    basket1: "Basket - I",
    basket2: "Basket - II",
    basket3: "Basket - III",
  };

  return labels[groupKey] ?? "";
}

function getSubjectGroupOrder(groupKey) {
  const order = {
    religion: 1,
    core: 2,
    basket1: 3,
    basket2: 4,
    basket3: 5,
  };
  return order[groupKey] || 99;
}

function getA3SubjectOrder(subject = {}) {
  const subjectName = getSubjectName(subject) || subject.subjectName || "";
  const configured = getA3SubjectConfig(subjectName);
  const configuredIndex = configured ? A3_SUBJECT_ORDER.indexOf(configured) : -1;

  if (configuredIndex >= 0) return configuredIndex + 1;
  return getSubjectGroupOrder(subject.groupKey || getSubjectGroupKey(subject)) * 100;
}

function getA3SubjectLabel(subject = {}) {
  const subjectName = subject.subjectName || getSubjectName(subject);
  const configured = getA3SubjectConfig(subjectName);
  if (configured?.shortLabel) return configured.shortLabel;

  const explicitShort = clean(subject.shortName);
  if (explicitShort) return explicitShort;

  return subjectName
    .replace(/ and /gi, " & ")
    .replace(/technology/gi, "Tec")
    .replace(/studies/gi, "Stu")
    .replace(/education/gi, "Edu");
}

function getA3CanonicalSubjectKey(subject = {}) {
  const configured = getA3SubjectConfig(subject.subjectName || getSubjectName(subject));
  const groupKey = subject.groupKey || getSubjectGroupKey(subject);
  if (configured) {
    return `${groupKey}__${normalize(configured.shortLabel)}`;
  }

  return `${groupKey}__${getSubjectKey(subject)}`;
}

function getEnrollmentClassName(enrollment = {}) {
  const explicit = clean(enrollment.fullClassName || enrollment.alClassName || enrollment.className);
  if (/^\d+[A-Z]+$/i.test(explicit)) return explicit.toUpperCase();
  return buildClassName(enrollment.grade, enrollment.section || explicit);
}

function getMarkClassName(mark = {}) {
  const explicit = clean(mark.fullClassName || mark.alClassName || mark.className);
  if (/^\d+[A-Z]+$/i.test(explicit)) return explicit.toUpperCase();
  return buildClassName(mark.grade, mark.section || explicit);
}

function getAcademicYear(row = {}) {
  return clean(row.academicYear || row.year || "");
}

function isActive(row = {}) {
  return normalize(row.status || "active") !== "inactive";
}

function getMarkValue(mark = {}) {
  const raw = mark.marks ?? mark.mark ?? mark.value ?? mark.score ?? "";
  if (raw === "" || raw === null || raw === undefined) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function isAbsent(mark = {}) {
  const value = mark.absent ?? mark.isAbsent ?? mark.attendance;
  if (typeof value === "boolean") return value;
  return ["absent", "ab", "true", "yes", "1"].includes(normalize(value));
}

function getGradeSymbol(mark) {
  const number = Number(mark);
  if (!Number.isFinite(number)) return "";
  return GRADE_BANDS.find((band) => number >= band.min && number <= band.max)?.key || "W";
}

function getRangeKey(mark) {
  const number = Number(mark);
  if (!Number.isFinite(number)) return "";
  return RANGE_BANDS.find((band) => number >= band.min && number <= band.max)?.key || "";
}

function formatNumber(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return Number.isInteger(number) ? String(number) : number.toFixed(decimals);
}

function sanitizeFilename(value) {
  return clean(value)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeReportFileName(title, context) {
  return `${sanitizeFilename(title)}_${sanitizeFilename(getReportScopeLabel(context))}_${sanitizeFilename(
    context.term || ""
  )}_${sanitizeFilename(context.year || "")}.pdf`;
}

function getReportScopeLabel({ grade, className, subjectName = "" }) {
  const scope = className && className !== ALL ? `Grade ${className}` : `Whole Grade ${grade}`;
  return subjectName ? `${scope} - ${subjectName}` : scope;
}

function drawPdfHeader(doc, { title, context, pageLabel }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("KILINOCHCHI CENTRAL COLLEGE", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(10.5);
  doc.text(title, pageWidth / 2, 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const metaY = 25;
  doc.text(getReportScopeLabel(context), 10, metaY);
  doc.text(`Term: ${context.term || "-"}`, pageWidth / 2, metaY, { align: "center" });
  doc.text(`Year: ${context.year || "-"}`, pageWidth - 10, metaY, { align: "right" });
}

function addPdfFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 10, pageHeight - 8, {
    align: "right",
  });
}

function createSubjectStatsPdf({ title, context, rows }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  drawPdfHeader(doc, { title, context, pageLabel: "A4 Landscape" });

  autoTable(doc, {
    startY: 34,
    head: [[
      "Subject",
      "Enrolled",
      "Appeared",
      "Absent",
      "Average",
      "Highest",
      "Pass %",
      ...GRADE_BANDS.map((band) => band.key),
    ]],
    body: rows.map((row) => [
      row.subjectName,
      row.enrolled,
      row.appeared,
      row.absent,
      formatNumber(row.average),
      formatNumber(row.highest, 0),
      `${formatNumber(row.passPercentage)}%`,
      ...GRADE_BANDS.map((band) => row.gradeCounts[band.key] || 0),
    ]),
    theme: "grid",
    styles: {
      fontSize: 7.4,
      cellPadding: 1.1,
      valign: "middle",
      halign: "center",
      lineWidth: 0.12,
      lineColor: [40, 40, 40],
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 239, 245],
      textColor: 20,
      fontStyle: "bold",
      lineWidth: 0.14,
      lineColor: [30, 30, 30],
    },
    columnStyles: { 0: { cellWidth: 52, halign: "left", fontStyle: "bold" } },
    margin: { left: 8, right: 8 },
  });

  addPdfFooter(doc);
  return doc;
}

function createRangeStatsPdf({ title, context, rows }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  drawPdfHeader(doc, { title, context, pageLabel: "A4 Landscape" });

  autoTable(doc, {
    startY: 34,
    head: [["Subject", "Appeared", ...RANGE_BANDS.map((band) => band.key)]],
    body: rows.map((row) => [
      row.subjectName,
      row.appeared,
      ...RANGE_BANDS.map((band) => row.rangeCounts[band.key] || 0),
    ]),
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1,
      valign: "middle",
      halign: "center",
      lineWidth: 0.12,
      lineColor: [40, 40, 40],
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 239, 245],
      textColor: 20,
      fontStyle: "bold",
      lineWidth: 0.14,
      lineColor: [30, 30, 30],
    },
    columnStyles: {
      0: { cellWidth: 52, halign: "left", fontStyle: "bold" },
      1: { cellWidth: 16 },
    },
    margin: { left: 8, right: 8 },
  });

  addPdfFooter(doc);
  return doc;
}

function createThreeCThreeSPdf({ title, context, rows }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  drawPdfHeader(doc, { title, context, pageLabel: "A4 Landscape" });

  autoTable(doc, {
    startY: 34,
    head: [["No", "Name", "Grade", "Division", "Results", "W Subjects"]],
    body: rows.map((row, index) => [
      index + 1,
      row.studentName,
      row.grade,
      row.division,
      row.resultCode || "-",
      row.wSubjects || "-",
    ]),
    theme: "grid",
    styles: {
      fontSize: 7.4,
      cellPadding: 1.1,
      valign: "middle",
      halign: "center",
      lineWidth: 0.12,
      lineColor: [40, 40, 40],
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 239, 245],
      textColor: 20,
      fontStyle: "bold",
      lineWidth: 0.14,
      lineColor: [30, 30, 30],
    },
    columnStyles: {
      1: { cellWidth: 58, halign: "left", fontStyle: "bold" },
      5: { cellWidth: 110, halign: "left" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5 && rows[data.row.index]?.hasCoreWSubject) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 8, right: 8 },
  });

  addPdfFooter(doc);
  return doc;
}

function createLowMarkStudentsPdf({ title, context, rows }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  drawPdfHeader(doc, { title, context, pageLabel: "A4 Portrait" });

  autoTable(doc, {
    startY: 34,
    head: [["No", "Range", "Name", "Marks", "Grade", "Division"]],
    body: rows.map((row, index) => [
      index + 1,
      row.rangeKey,
      row.studentName,
      row.mark,
      row.grade,
      row.division,
    ]),
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.2,
      valign: "middle",
      halign: "center",
      lineWidth: 0.12,
      lineColor: [40, 40, 40],
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 239, 245],
      textColor: 20,
      fontStyle: "bold",
      lineWidth: 0.14,
      lineColor: [30, 30, 30],
    },
    columnStyles: {
      2: { cellWidth: 72, halign: "left", fontStyle: "bold" },
    },
    margin: { left: 8, right: 8 },
  });

  addPdfFooter(doc);
  return doc;
}

function createA3GradingPdf({ title, context, rows, subjects, qualifiedCount }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
  drawPdfHeader(doc, { title, context, pageLabel: "A3 Landscape" });

  const totalStudents = rows.length;
  doc.setFontSize(8.5);
  doc.text(`Number of Students: ${totalStudents}`, 10, 34);
  doc.text(
    `Qualified: ${qualifiedCount} (${totalStudents ? formatNumber((qualifiedCount / totalStudents) * 100) : "0"}%)`,
    95,
    34
  );
  doc.text(
    "Qualification requires passes in 6 subjects including Tamil and Mathematics. A/B/C/S are passes. W is fail.",
    10,
    39
  );

  const groupedHeaders = buildA3SubjectHeaderRows(subjects);
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - 12;
  const baseColumnWidths = [8, 21, 36, 11, 17, 12];
  const subjectColumnWidth = Math.max(
    5.2,
    (availableWidth - baseColumnWidths.reduce((sum, width) => sum + width, 0)) /
      Math.max(subjects.length * 2, 1)
  );
  const columnStyles = {
    0: { cellWidth: baseColumnWidths[0] },
    1: { cellWidth: baseColumnWidths[1] },
    2: { cellWidth: baseColumnWidths[2], halign: "left" },
    3: { cellWidth: baseColumnWidths[3] },
    4: { cellWidth: baseColumnWidths[4], fontStyle: "bold" },
    5: { cellWidth: baseColumnWidths[5] },
  };

  subjects.forEach((subject, index) => {
    const markColumnIndex = 6 + index * 2;
    columnStyles[markColumnIndex] = { cellWidth: subjectColumnWidth };
    columnStyles[markColumnIndex + 1] = { cellWidth: subjectColumnWidth, fontStyle: "bold" };
  });

  autoTable(doc, {
    startY: 44,
    head: groupedHeaders.pdfHead,
    body: rows.map((row, index) => [
      index + 1,
      row.indexNo || row.studentId,
      row.studentName,
      row.className,
      row.resultCode,
      row.grade11Pass?.qualified ? "Yes" : "No",
      ...subjects.flatMap((subject) => {
        const result = row.results[subject.subjectKey] || {};
        return [result.absent ? "AB" : result.mark ?? "", result.symbol || ""];
      }),
    ]),
    theme: "grid",
    styles: {
      fontSize: 5.4,
      cellPadding: 0.55,
      valign: "middle",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [35, 35, 35],
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 239, 245],
      textColor: 20,
      fontStyle: "bold",
      fontSize: 5.2,
      lineWidth: 0.12,
      lineColor: [25, 25, 25],
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 5 && data.cell.raw === "Yes") {
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.cell.raw === "W") {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 6, right: 6 },
    pageBreak: "auto",
    rowPageBreak: "avoid",
  });

  addPdfFooter(doc);
  return doc;
}

function subjectAppliesToGrade(subject, grade) {
  const targetGrade = Number(grade);
  if (!targetGrade) return false;

  const directGrade = parseGrade(subject.grade);
  if (directGrade) return directGrade === targetGrade;

  const grades = Array.isArray(subject.grades) ? subject.grades.map(Number) : [];
  if (grades.length) return grades.includes(targetGrade);

  const minGrade = parseGrade(subject.minGrade);
  const maxGrade = parseGrade(subject.maxGrade);
  if (minGrade || maxGrade) {
    return targetGrade >= (minGrade || -Infinity) && targetGrade <= (maxGrade || Infinity);
  }

  return true;
}

function createEmptyStats(label, extra = {}) {
  return {
    label,
    ...extra,
    enrolled: 0,
    appeared: 0,
    absent: 0,
    marksTotal: 0,
    highest: null,
    lowest: null,
    gradeCounts: GRADE_BANDS.reduce((acc, band) => ({ ...acc, [band.key]: 0 }), {}),
    rangeCounts: RANGE_BANDS.reduce((acc, band) => ({ ...acc, [band.key]: 0 }), {}),
  };
}

function addToStats(stats, record) {
  stats.enrolled += 1;

  if (record.absent) {
    stats.absent += 1;
    return;
  }

  if (!Number.isFinite(Number(record.mark))) return;

  const mark = Number(record.mark);
  const symbol = getGradeSymbol(mark);
  const range = getRangeKey(mark);

  stats.appeared += 1;
  stats.marksTotal += mark;
  stats.gradeCounts[symbol] += 1;
  if (range) stats.rangeCounts[range] += 1;
  stats.highest = stats.highest === null ? mark : Math.max(stats.highest, mark);
  stats.lowest = stats.lowest === null ? mark : Math.min(stats.lowest, mark);
}

function finishStats(stats) {
  const passCount = stats.gradeCounts.A + stats.gradeCounts.B + stats.gradeCounts.C + stats.gradeCounts.S;
  return {
    ...stats,
    passCount,
    average: stats.appeared ? stats.marksTotal / stats.appeared : 0,
    passPercentage: stats.appeared ? (passCount / stats.appeared) * 100 : 0,
  };
}

function findMatchingMark(marks, enrollment, termName, year) {
  const studentId = clean(enrollment.studentId);
  const subjectId = getSubjectId(enrollment);
  const subjectName = normalize(getSubjectName(enrollment));
  const className = getEnrollmentClassName(enrollment);

  return marks.find((mark) => {
    if (clean(mark.studentId) !== studentId) return false;
    if (clean(mark.termName || mark.term) !== clean(termName)) return false;
    if (getAcademicYear(mark) && Number(getAcademicYear(mark)) !== Number(year)) return false;
    if (getMarkClassName(mark) && getMarkClassName(mark) !== className) return false;

    const markSubjectId = clean(mark.subjectId);
    const markSubjectName = normalize(mark.subjectName || mark.subject);
    return (subjectId && markSubjectId === subjectId) || (!!subjectName && markSubjectName === subjectName);
  });
}

function buildRecords({ enrollments, studentsById, marks, termName, year }) {
  return enrollments
    .filter((enrollment) => isActive(enrollment))
    .filter((enrollment) => !getAcademicYear(enrollment) || Number(getAcademicYear(enrollment)) === Number(year))
    .map((enrollment) => {
      const student = studentsById.get(clean(enrollment.studentId)) || {};
      const markDoc = findMatchingMark(marks, enrollment, termName, year);
      const grade = parseGrade(enrollment.grade || student.grade || enrollment.className);
      const section = normalizeSection(enrollment.section || student.section || enrollment.className);
      const className = getEnrollmentClassName(enrollment) || buildClassName(grade, section);
      const mark = markDoc ? getMarkValue(markDoc) : null;

      return {
        enrollmentId: enrollment.id,
        studentId: clean(enrollment.studentId),
        studentName: getStudentName(student) || clean(enrollment.studentName),
        indexNo: getStudentIndex(student) || clean(enrollment.indexNo),
        grade,
        section,
        className,
        subjectId: getSubjectId(enrollment),
        subjectName: getSubjectName(enrollment),
        subjectKey: getSubjectKey(enrollment),
        mark,
        absent: markDoc ? isAbsent(markDoc) : false,
      };
    })
    .filter((record) => record.grade && record.className && record.subjectName);
}

function aggregateBySubject(records) {
  const map = new Map();

  records.forEach((record) => {
    if (!map.has(record.subjectKey)) {
      map.set(record.subjectKey, createEmptyStats(record.subjectName, {
        subjectKey: record.subjectKey,
        subjectName: record.subjectName,
      }));
    }

    addToStats(map.get(record.subjectKey), record);
  });

  return Array.from(map.values())
    .map(finishStats)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, undefined, { numeric: true }));
}

function getStudentResultCode(subjectResults) {
  const counts = subjectResults.reduce(
    (acc, result) => {
      if (result.symbol) acc[result.symbol] += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0, S: 0, W: 0 }
  );

  return ["A", "B", "C", "S", "W"]
    .filter((symbol) => counts[symbol] > 0)
    .map((symbol) => `${counts[symbol]}${symbol}`)
    .join(" ");
}

function isPassOrAbove(symbol) {
  return ["A", "B", "C", "S"].includes(symbol);
}

function isTamilSubject(subjectName = "") {
  const value = normalize(subjectName);
  return value === "tamil" || value.includes("tamil language");
}

function isMathsSubject(subjectName = "") {
  const value = normalize(subjectName);
  return (
    value === "maths" ||
    value === "mathematics" ||
    value.includes("math")
  );
}

function getGrade11PassStatus(student, subjects) {
  const subjectResults = subjects.map((subject) => ({
    subjectName: subject.subjectName,
    ...(student.results[subject.subjectKey] || {}),
  }));

  const passOrAboveCount = subjectResults.filter((result) =>
    isPassOrAbove(result.symbol)
  ).length;

  const tamilResult = subjectResults.find((result) => isTamilSubject(result.subjectName));
  const mathsResult = subjectResults.find((result) => isMathsSubject(result.subjectName));

  const tamilPass = isPassOrAbove(tamilResult?.symbol);
  const mathsPass = isPassOrAbove(mathsResult?.symbol);

  return {
    passOrAboveCount,
    tamilPass,
    mathsPass,
    qualified:
      passOrAboveCount >= 6 &&
      tamilPass &&
      mathsPass,
  };
}

function buildSheetRows(records, subjects) {
  const studentMap = new Map();
  const subjectLookup = new Map();

  subjects.forEach((subject) => {
    (subject.sourceSubjectKeys || [subject.subjectKey]).forEach((key) => {
      subjectLookup.set(key, subject);
    });
  });

  records.forEach((record) => {
    const sheetSubject = subjectLookup.get(record.subjectKey);
    if (!sheetSubject) return;

    if (!studentMap.has(record.studentId)) {
      studentMap.set(record.studentId, {
        studentId: record.studentId,
        indexNo: record.indexNo,
        studentName: record.studentName,
        className: record.className,
        results: {},
      });
    }

    const currentResult = studentMap.get(record.studentId).results[sheetSubject.subjectKey];
    const nextResult = {
      mark: record.mark,
      absent: record.absent,
      symbol: record.absent ? "AB" : getGradeSymbol(record.mark),
    };

    if (
      !currentResult ||
      (!Number.isFinite(Number(currentResult.mark)) && Number.isFinite(Number(nextResult.mark))) ||
      (currentResult.absent && !nextResult.absent)
    ) {
      studentMap.get(record.studentId).results[sheetSubject.subjectKey] = nextResult;
    }
  });

  return Array.from(studentMap.values())
    .map((student) => {
      const subjectResults = subjects.map((subject) => student.results[subject.subjectKey] || {});
      return {
        ...student,
        resultCode: getStudentResultCode(subjectResults),
        grade11Pass: getGrade11PassStatus(student, subjects),
      };
    })
    .sort((a, b) => {
      const classDiff = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (classDiff !== 0) return classDiff;
      const indexDiff = clean(a.indexNo).localeCompare(clean(b.indexNo), undefined, { numeric: true });
      if (indexDiff !== 0) return indexDiff;
      return a.studentName.localeCompare(b.studentName);
    });
}

function getDivisionFromClassName(className = "") {
  return normalizeSection(className);
}

function getThreeCThreeSStatus(student, subjects) {
  const subjectResults = subjects.map((subject) => ({
    subjectName: subject.shortLabel || subject.subjectName,
    groupKey: subject.groupKey || getSubjectGroupKey(subject),
    ...(student.results[subject.subjectKey] || {}),
  }));

  const creditOrAboveCount = subjectResults.filter((result) =>
    ["A", "B", "C"].includes(result.symbol)
  ).length;
  const passOrAboveCount = subjectResults.filter((result) =>
    isPassOrAbove(result.symbol)
  ).length;
  const wSubjects = subjectResults
    .filter((result) => result.symbol === "W")
    .map((result) => ({
      name: result.subjectName,
      isCore: result.groupKey === "core",
    }))
    .filter((subject) => subject.name);

  const wSubjectNames = wSubjects
    .map((subject) => subject.name)
    .filter(Boolean);

  return {
    creditOrAboveCount,
    passOrAboveCount,
    wSubjects,
    wSubjectNames,
    hasCoreWSubject: wSubjects.some((subject) => subject.isCore),
    achieved: creditOrAboveCount >= 3 && passOrAboveCount >= 6,
  };
}

function buildThreeCThreeSRows(rows, subjects) {
  return rows
    .map((row) => {
      const status = getThreeCThreeSStatus(row, subjects);
      return {
        ...row,
        grade: parseGrade(row.className),
        division: getDivisionFromClassName(row.className),
        wSubjectItems: status.wSubjects,
        wSubjects: status.wSubjectNames.join(", "),
        hasCoreWSubject: status.hasCoreWSubject,
        threeCThreeS: status,
      };
    })
    .filter((row) => !row.threeCThreeS.achieved)
    .sort((a, b) => {
      const classDiff = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (classDiff !== 0) return classDiff;
      const indexDiff = clean(a.indexNo).localeCompare(clean(b.indexNo), undefined, { numeric: true });
      if (indexDiff !== 0) return indexDiff;
      return a.studentName.localeCompare(b.studentName);
    });
}

function getLowMarkBand(mark) {
  const number = Number(mark);
  if (!Number.isFinite(number)) return null;
  return LOW_MARK_BANDS.find((band) => number >= band.min && number <= band.max) || null;
}

function buildLowMarkStudentRows(records, selectedSubjectKey) {
  if (!selectedSubjectKey || selectedSubjectKey === ALL) return [];

  return records
    .filter((record) => record.subjectKey === selectedSubjectKey)
    .map((record) => {
      const band = getLowMarkBand(record.mark);
      if (!band) return null;

      return {
        studentId: record.studentId,
        studentName: record.studentName,
        grade: record.grade,
        division: record.section || getDivisionFromClassName(record.className),
        className: record.className,
        subjectName: record.subjectName,
        mark: record.mark,
        symbol: getGradeSymbol(record.mark),
        rangeKey: band.key,
        rangeOrder: LOW_MARK_BANDS.findIndex((item) => item.key === band.key),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.rangeOrder !== b.rangeOrder) return a.rangeOrder - b.rangeOrder;
      const markDiff = Number(a.mark) - Number(b.mark);
      if (markDiff !== 0) return markDiff;
      const classDiff = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (classDiff !== 0) return classDiff;
      return a.studentName.localeCompare(b.studentName);
    });
}

export default function SubjectAnalysis() {
  const [tab, setTab] = useState("grade");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [terms, setTerms] = useState([]);

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState(6);
  const [selectedClass, setSelectedClass] = useState(ALL);
  const [selectedSubject, setSelectedSubject] = useState(ALL);
  const [printTarget, setPrintTarget] = useState("");
  const [printSize, setPrintSize] = useState("A4 landscape");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [studentsSnap, subjectsSnap, enrollmentsSnap, marksSnap, classroomsSnap, termsSnap] =
        await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "subjects")),
          getDocs(collection(db, "studentSubjectEnrollments")),
          getDocs(collection(db, "marks")),
          getDocs(collection(db, "classrooms")),
          getDocs(collection(db, "academicTerms")),
        ]);

      const nextStudents = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const nextSubjects = subjectsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isActive);
      const nextEnrollments = enrollmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isActive);
      const nextMarks = marksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const nextClassrooms = classroomsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const nextTerms = termsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setStudents(nextStudents);
      setSubjects(nextSubjects);
      setEnrollments(nextEnrollments);
      setMarks(nextMarks);
      setClassrooms(nextClassrooms);
      setTerms(nextTerms);

      const activeTerm = nextTerms.find((term) => term.isActive) || nextTerms[0] || null;
      if (activeTerm?.term) {
        setSelectedTerm((current) => current || activeTerm.term);
        setSelectedYear((current) => Number(activeTerm.year || current || CURRENT_YEAR));
      }
    } catch (err) {
      console.error("Subject analysis load failed:", err);
      setError(err.message || "Failed to load analysis data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const studentsById = useMemo(
    () => new Map(students.map((student) => [clean(student.id), student])),
    [students]
  );

  const records = useMemo(() => {
    if (!selectedTerm) return [];
    return buildRecords({ enrollments, studentsById, marks, termName: selectedTerm, year: selectedYear });
  }, [enrollments, studentsById, marks, selectedTerm, selectedYear]);

  const yearOptions = useMemo(() => {
    const years = new Set([
      CURRENT_YEAR,
      ...terms.map((term) => Number(term.year || term.academicYear || 0)),
      ...classrooms.map((room) => Number(room.year || room.academicYear || 0)),
      ...enrollments.map((row) => Number(getAcademicYear(row))),
    ].filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [terms, classrooms, enrollments]);

  const gradeOptions = useMemo(() => {
    const grades = new Set(records.map((record) => record.grade).filter(Boolean));
    return Array.from(grades).sort((a, b) => a - b);
  }, [records]);

  const classOptions = useMemo(() => {
    const classes = new Set(
      records
        .filter((record) => Number(record.grade) === Number(selectedGrade))
        .map((record) => record.className)
    );
    return Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records, selectedGrade]);

  const gradeSubjectOptions = useMemo(() => {
    const enrolledMap = new Map();
    const subjectMetaByName = new Map(
      subjects.map((subject) => [normalize(getSubjectName(subject)), subject])
    );

    records
      .filter((record) => Number(record.grade) === Number(selectedGrade))
      .forEach((record) => {
        const subjectMeta = subjectMetaByName.get(normalize(record.subjectName)) || {};
        const groupKey = getSubjectGroupKey({
          ...subjectMeta,
          subjectName: record.subjectName,
        });

        enrolledMap.set(record.subjectKey, {
          subjectKey: record.subjectKey,
          subjectName: record.subjectName,
          groupKey,
          groupLabel: getSubjectGroupLabel(groupKey),
          shortLabel: getA3SubjectLabel({
            ...subjectMeta,
            subjectName: record.subjectName,
          }),
        });
      });

    subjects
      .filter((subject) => subjectAppliesToGrade(subject, selectedGrade))
      .forEach((subject) => {
        const subjectKey = getSubjectKey(subject);
        const groupKey = getSubjectGroupKey(subject);
        const existing = enrolledMap.get(subjectKey);
        const subjectPayload = {
          subjectKey,
          subjectName: getSubjectName(subject),
          groupKey,
          groupLabel: getSubjectGroupLabel(groupKey),
          shortLabel: getA3SubjectLabel(subject),
        };

        if (existing) {
          enrolledMap.set(subjectKey, {
            ...existing,
            ...subjectPayload,
          });
          return;
        }

        if (!enrolledMap.has(subjectKey)) {
          enrolledMap.set(subjectKey, subjectPayload);
        }
      });

    return Array.from(enrolledMap.values()).sort((a, b) =>
      getSubjectGroupOrder(a.groupKey) - getSubjectGroupOrder(b.groupKey) ||
      getA3SubjectOrder(a) - getA3SubjectOrder(b) ||
      a.subjectName.localeCompare(b.subjectName, undefined, { numeric: true })
    );
  }, [records, subjects, selectedGrade]);

  const gradeRecords = useMemo(
    () => records.filter((record) => Number(record.grade) === Number(selectedGrade)),
    [records, selectedGrade]
  );

  const classRecords = useMemo(
    () => gradeRecords.filter((record) => selectedClass === ALL || record.className === selectedClass),
    [gradeRecords, selectedClass]
  );

  const gradeSubjectRows = useMemo(() => aggregateBySubject(gradeRecords), [gradeRecords]);
  const classSubjectRows = useMemo(() => aggregateBySubject(classRecords), [classRecords]);

  const selectedSubjectName = useMemo(
    () => gradeSubjectOptions.find((subject) => subject.subjectKey === selectedSubject)?.subjectName || "",
    [gradeSubjectOptions, selectedSubject]
  );

  useEffect(() => {
    if (gradeOptions.length && !gradeOptions.includes(Number(selectedGrade))) {
      setSelectedGrade(gradeOptions[0]);
    }
  }, [gradeOptions, selectedGrade]);

  useEffect(() => {
    setSelectedClass(ALL);
    setSelectedSubject(ALL);
  }, [selectedGrade]);

  const rangeRows = useMemo(() => {
    const sourceRecords = selectedClass === ALL ? gradeRecords : classRecords;
    const sourceSubjectKeys = new Set(sourceRecords.map((record) => record.subjectKey));
    const sourceSubjects =
      selectedSubject === ALL
        ? gradeSubjectOptions.filter((subject) => sourceSubjectKeys.has(subject.subjectKey))
        : gradeSubjectOptions.filter(
            (subject) =>
              subject.subjectKey === selectedSubject &&
              sourceSubjectKeys.has(subject.subjectKey)
          );

    return sourceSubjects.map((subject) => {
      const stats = createEmptyStats(subject.subjectName, {
        subjectKey: subject.subjectKey,
        subjectName: subject.subjectName,
      });

      sourceRecords
        .filter((record) => record.subjectKey === subject.subjectKey)
        .forEach((record) => addToStats(stats, record));

      return finishStats(stats);
    });
  }, [gradeRecords, classRecords, gradeSubjectOptions, selectedClass, selectedSubject]);

  const sheetSubjects = useMemo(() => {
    const sourceRecords = selectedClass === ALL ? gradeRecords : classRecords;
    const keys = new Set(sourceRecords.map((record) => record.subjectKey));
    const canonicalMap = new Map();

    gradeSubjectOptions
      .filter((subject) => keys.has(subject.subjectKey))
      .forEach((subject) => {
        const canonicalKey = getA3CanonicalSubjectKey(subject);
        const existing = canonicalMap.get(canonicalKey);

        if (existing) {
          existing.sourceSubjectKeys.push(subject.subjectKey);
          existing.subjectName = existing.shortLabel || existing.subjectName;
          return;
        }

        canonicalMap.set(canonicalKey, {
          ...subject,
          subjectKey: canonicalKey,
          sourceSubjectKeys: [subject.subjectKey],
          shortLabel: subject.shortLabel || getA3SubjectLabel(subject),
          subjectName: subject.shortLabel || getA3SubjectLabel(subject),
        });
      });

    return Array.from(canonicalMap.values()).sort((a, b) =>
      getSubjectGroupOrder(a.groupKey) - getSubjectGroupOrder(b.groupKey) ||
      getA3SubjectOrder(a) - getA3SubjectOrder(b) ||
      a.subjectName.localeCompare(b.subjectName, undefined, { numeric: true })
    );
  }, [gradeSubjectOptions, gradeRecords, classRecords, selectedClass]);

  const sheetRows = useMemo(() => {
    const sourceRecords = selectedClass === ALL ? gradeRecords : classRecords;
    return buildSheetRows(sourceRecords, sheetSubjects);
  }, [gradeRecords, classRecords, selectedClass, sheetSubjects]);

  const threeCThreeSRows = useMemo(
    () => buildThreeCThreeSRows(sheetRows, sheetSubjects),
    [sheetRows, sheetSubjects]
  );

  const lowMarkStudentRows = useMemo(() => {
    const sourceRecords = selectedClass === ALL ? gradeRecords : classRecords;
    return buildLowMarkStudentRows(sourceRecords, selectedSubject);
  }, [gradeRecords, classRecords, selectedClass, selectedSubject]);

  const selectedRecordsForStats = useMemo(() => {
    if (tab === "grade") return gradeRecords;
    return selectedClass === ALL ? gradeRecords : classRecords;
  }, [tab, gradeRecords, classRecords, selectedClass]);

  const selectedStats = useMemo(() => {
    return finishStats(
      selectedRecordsForStats.reduce((stats, record) => {
        if (tab === "range" && selectedSubject !== ALL && record.subjectKey !== selectedSubject) {
          return stats;
        }
        addToStats(stats, record);
        return stats;
      }, createEmptyStats("Selected"))
    );
  }, [selectedRecordsForStats, selectedSubject, tab]);

  const qualifiedCount = useMemo(
    () => sheetRows.filter((row) => row.grade11Pass?.qualified).length,
    [sheetRows]
  );

  const shareContext = useMemo(() => ({
    year: selectedYear,
    term: selectedTerm,
    grade: selectedGrade,
    className: selectedClass,
    subjectName: selectedSubjectName,
  }), [selectedYear, selectedTerm, selectedGrade, selectedClass, selectedSubjectName]);

  const handlePrint = (target, size = "A4 landscape") => {
    setPrintTarget(target);
    setPrintSize(size);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintTarget(""), 500);
    }, 100);
  };

  return (
    <PageContainer
      title="Subject Analysis"
      subtitle="Grade, class, mark range, and A3 grading reports from allocated student subjects."
      actions={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadData} disabled={loading}>
            Reload
          </Button>
        </Stack>
      }
    >
      <style>
        {`
          @media print {
            @page { size: ${printSize}; margin: 8mm; }
            body * { visibility: hidden; }
            .analysis-print-active, .analysis-print-active * { visibility: visible; }
            .analysis-print-active {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              font-family: "Times New Roman", serif;
              color: #000;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
            }
            .analysis-print-active .MuiCardContent-root {
              padding: 0 !important;
            }
            .analysis-print-active table { page-break-inside: auto; }
            .analysis-print-active tr { page-break-inside: avoid; page-break-after: auto; }
            .analysis-no-print { display: none !important; }
          }
        `}
      </style>

      <Stack spacing={2.5}>
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select value={selectedYear} label="Year" onChange={(event) => setSelectedYear(Number(event.target.value))}>
                    {yearOptions.map((year) => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Term</InputLabel>
                  <Select value={selectedTerm} label="Term" onChange={(event) => setSelectedTerm(event.target.value)}>
                    {terms.map((term) => (
                      <MenuItem key={term.id} value={term.term}>{term.term}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Grade</InputLabel>
                  <Select value={selectedGrade} label="Grade" onChange={(event) => setSelectedGrade(Number(event.target.value))}>
                    {gradeOptions.map((grade) => (
                      <MenuItem key={grade} value={grade}>Grade {grade}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Division / Class</InputLabel>
                  <Select value={selectedClass} label="Division / Class" onChange={(event) => setSelectedClass(event.target.value)}>
                    <MenuItem value={ALL}>Whole Grade {selectedGrade}</MenuItem>
                    {classOptions.map((className) => (
                      <MenuItem key={className} value={className}>{className}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Subject</InputLabel>
                  <Select value={selectedSubject} label="Subject" onChange={(event) => setSelectedSubject(event.target.value)}>
                    <MenuItem value={ALL}>All Subjects</MenuItem>
                    {gradeSubjectOptions.map((subject) => (
                      <MenuItem key={subject.subjectKey} value={subject.subjectKey}>{subject.subjectName}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Tabs
          value={tab}
          onChange={(event, nextTab) => setTab(nextTab)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {TAB_CONFIG.map((item) => (
            <Tab key={item.value} value={item.value} label={item.label} />
          ))}
        </Tabs>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Enrolled Entries" value={selectedStats.enrolled} icon={<SchoolRoundedIcon />} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Appeared" value={selectedStats.appeared} icon={<AnalyticsRoundedIcon />} color="success" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Average" value={formatNumber(selectedStats.average)} icon={<SubjectRoundedIcon />} color="warning" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Pass %" value={`${formatNumber(selectedStats.passPercentage)}%`} icon={<AnalyticsRoundedIcon />} color="info" />
              </Grid>
            </Grid>

            {tab === "grade" && (
              <SubjectStatsTable
                title={`Whole Grade ${selectedGrade} - Subject Analysis`}
                reportId="grade-subject-analysis"
                activePrint={printTarget === "grade-subject-analysis"}
                context={shareContext}
                onPrint={() => handlePrint("grade-subject-analysis", "A4 landscape")}
                rows={gradeSubjectRows}
                emptyText="No subject analysis found for this grade."
              />
            )}

            {tab === "class" && (
              <SubjectStatsTable
                title={`${selectedClass === ALL ? `Whole Grade ${selectedGrade}` : selectedClass} - Class Subject Analysis`}
                reportId="class-subject-analysis"
                activePrint={printTarget === "class-subject-analysis"}
                context={shareContext}
                onPrint={() => handlePrint("class-subject-analysis", "A4 landscape")}
                rows={classSubjectRows}
                emptyText="No class subject analysis found. Select a division/class with enrolled subjects."
              />
            )}

            {tab === "range" && (
              <RangeStatsTable
                title={`Grade ${selectedGrade} ${selectedSubjectName ? `- ${selectedSubjectName}` : "- Subject Mark Range Analysis"}`}
                reportId="subject-range-analysis"
                activePrint={printTarget === "subject-range-analysis"}
                context={shareContext}
                onPrint={() => handlePrint("subject-range-analysis", "A4 landscape")}
                rows={rangeRows}
              />
            )}

            {tab === "threeCThreeS" && (
              <ThreeCThreeSReport
                title={`${selectedClass === ALL ? `Whole Grade ${selectedGrade}` : selectedClass} - Below 3C 3S List`}
                reportId="below-3c-3s-list"
                activePrint={printTarget === "below-3c-3s-list"}
                context={shareContext}
                onPrint={() => handlePrint("below-3c-3s-list", "A4 landscape")}
                rows={threeCThreeSRows}
              />
            )}

            {tab === "lowMarks" && (
              <LowMarkStudentsReport
                title={`${selectedClass === ALL ? `Whole Grade ${selectedGrade}` : selectedClass} - ${
                  selectedSubjectName || "Selected Subject"
                } Low Mark Students`}
                reportId="low-mark-students"
                activePrint={printTarget === "low-mark-students"}
                context={shareContext}
                onPrint={() => handlePrint("low-mark-students", "A4 portrait")}
                rows={lowMarkStudentRows}
                selectedSubject={selectedSubject}
              />
            )}

            {tab === "sheet" && (
              <A3GradingSheet
                year={selectedYear}
                term={selectedTerm}
                grade={selectedGrade}
                className={selectedClass}
                subjects={sheetSubjects}
                rows={sheetRows}
                qualifiedCount={qualifiedCount}
                activePrint={printTarget === "a3-grading-sheet"}
                context={shareContext}
                onPrint={() => handlePrint("a3-grading-sheet", "A3 landscape")}
              />
            )}
          </>
        )}
      </Stack>
    </PageContainer>
  );
}

function buildShareText({ title, context, rowsCount, extra = "" }) {
  const scope = getReportScopeLabel(context);
  return [
    "Kilinochchi Central College",
    title,
    `Scope: ${scope}`,
    `Term: ${context.term || "-"} | Year: ${context.year || "-"}`,
    `Rows: ${rowsCount}`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

async function makePdfFile({ title, context, createPdf }) {
  const doc = createPdf();
  const blob = doc.output("blob");
  const fileName = makeReportFileName(title, context);
  return {
    blob,
    fileName,
    file: new File([blob], fileName, { type: "application/pdf" }),
  };
}

async function handlePdfDownload({ title, context, createPdf }) {
  const { blob, fileName } = await makePdfFile({ title, context, createPdf });
  saveAs(blob, fileName);
}

async function handleEmailShare({ title, context, rowsCount, extra, createPdf }) {
  await handlePdfDownload({ title, context, createPdf });
  const subject = encodeURIComponent(`Kilinochchi Central College - ${title}`);
  const body = encodeURIComponent(
    `${buildShareText({ title, context, rowsCount, extra })}\n\nThe PDF has been downloaded. Please attach it to this email.`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function handleWhatsAppShare({ title, context, rowsCount, extra, createPdf }) {
  const { blob, fileName, file } = await makePdfFile({ title, context, createPdf });
  const text = buildShareText({ title, context, rowsCount, extra });

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: `Kilinochchi Central College - ${title}`,
      text,
      files: [file],
    });
    return;
  }

  saveAs(blob, fileName);
  window.alert(
    "This browser cannot attach a generated PDF directly to WhatsApp. The PDF has been downloaded; please attach it in WhatsApp manually."
  );
}

function ReportHeader({ title, context }) {
  return (
    <Box sx={{ mb: 2, textAlign: "center" }}>
      <Typography sx={{ fontFamily: "Times New Roman, serif", fontWeight: 800, fontSize: 18 }}>
        KILINOCHCHI CENTRAL COLLEGE
      </Typography>
      <Typography sx={{ fontFamily: "Times New Roman, serif", fontWeight: 700 }}>
        {title}
      </Typography>
      <Box
        sx={{
          mt: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          alignItems: "center",
          columnGap: 2,
        }}
      >
        <Typography variant="body2" sx={{ textAlign: "left" }}>
          {getReportScopeLabel(context)}
        </Typography>
        <Typography variant="body2" sx={{ textAlign: "center" }}>
          Term: {context.term || "-"}
        </Typography>
        <Typography variant="body2" sx={{ textAlign: "right" }}>
          Year: {context.year || "-"}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, textAlign: "right" }}>
        Generated: {new Date().toLocaleString()}
      </Typography>
    </Box>
  );
}

function ReportActions({ title, context, rowsCount, onPrint, createPdf, extra = "" }) {
  return (
    <Stack
      className="analysis-no-print"
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      justifyContent="flex-end"
      sx={{ mb: 1.5 }}
    >
      <Button size="small" variant="outlined" startIcon={<PrintRoundedIcon />} onClick={onPrint}>
        Print / Save PDF
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<PrintRoundedIcon />}
        onClick={() => handlePdfDownload({ title, context, createPdf })}
      >
        Download PDF
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<EmailRoundedIcon />}
        onClick={() => handleEmailShare({ title, context, rowsCount, extra, createPdf })}
      >
        Email PDF
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="success"
        startIcon={<WhatsAppIcon />}
        onClick={() => handleWhatsAppShare({ title, context, rowsCount, extra, createPdf })}
      >
        WhatsApp PDF
      </Button>
    </Stack>
  );
}

const borderedReportTableSx = {
  borderRadius: 0,
  "& table": {
    borderCollapse: "collapse",
    border: "1px solid #1f2937",
  },
  "& th, & td": {
    border: "1px solid #1f2937",
    padding: "7px 8px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  "& th:first-of-type, & td:first-of-type": {
    textAlign: "left",
    whiteSpace: "normal",
    fontWeight: 800,
  },
  "@media print": {
    overflow: "visible",
    "& table": {
      width: "100%",
      minWidth: "0 !important",
      tableLayout: "fixed",
      fontSize: "8.4px",
    },
    "& th, & td": {
      padding: "3px 4px",
      border: "1px solid #000",
      lineHeight: 1.15,
    },
    "& th:first-of-type, & td:first-of-type": {
      width: "24%",
    },
  },
};

const rangeReportTableSx = {
  ...borderedReportTableSx,
  "@media print": {
    ...borderedReportTableSx["@media print"],
    "& th:first-of-type, & td:first-of-type": {
      width: "22%",
    },
    "& th:not(:first-of-type), & td:not(:first-of-type)": {
      width: "6.5%",
    },
  },
};

function SubjectStatsTable({
  title,
  rows,
  emptyText,
  reportId,
  activePrint,
  context,
  onPrint,
}) {
  if (!rows.length) {
    return <EmptyState title="No analysis data" description={emptyText} />;
  }

  const createPdf = () => createSubjectStatsPdf({ title, context, rows });

  return (
    <Card id={reportId} className={activePrint ? "analysis-print-active" : ""}>
      <CardContent>
        <ReportActions
          title={title}
          context={context}
          rowsCount={rows.length}
          onPrint={onPrint}
          createPdf={createPdf}
        />
        <ReportHeader title={title} context={context} />
        <ResponsiveTableWrapper minWidth={980} sx={rangeReportTableSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Subject</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Enrolled</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Appeared</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Absent</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Average</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Highest</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Pass %</TableCell>
                {GRADE_BANDS.map((band) => (
                  <TableCell key={band.key} align="right" sx={{ fontWeight: 800 }}>{band.key}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.subjectKey} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{row.subjectName}</TableCell>
                  <TableCell align="right">{row.enrolled}</TableCell>
                  <TableCell align="right">{row.appeared}</TableCell>
                  <TableCell align="right">{row.absent}</TableCell>
                  <TableCell align="right">{formatNumber(row.average)}</TableCell>
                  <TableCell align="right">{formatNumber(row.highest, 0)}</TableCell>
                  <TableCell align="right">{formatNumber(row.passPercentage)}%</TableCell>
                  {GRADE_BANDS.map((band) => (
                    <TableCell key={band.key} align="right">{row.gradeCounts[band.key]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableWrapper>
      </CardContent>
    </Card>
  );
}

function RangeStatsTable({ title, rows, reportId, activePrint, context, onPrint }) {
  if (!rows.length) {
    return <EmptyState title="No range data" description="Select a grade and subject with entered marks." />;
  }

  const createPdf = () => createRangeStatsPdf({ title, context, rows });

  return (
    <Card id={reportId} className={activePrint ? "analysis-print-active" : ""}>
      <CardContent>
        <ReportActions
          title={title}
          context={context}
          rowsCount={rows.length}
          onPrint={onPrint}
          createPdf={createPdf}
        />
        <ReportHeader title={title} context={context} />
        <ResponsiveTableWrapper minWidth={980} sx={borderedReportTableSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Subject</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Appeared</TableCell>
                {RANGE_BANDS.map((band) => (
                  <TableCell key={band.key} align="right" sx={{ fontWeight: 800 }}>{band.key}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.subjectKey} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{row.subjectName}</TableCell>
                  <TableCell align="right">{row.appeared}</TableCell>
                  {RANGE_BANDS.map((band) => (
                    <TableCell key={band.key} align="right">{row.rangeCounts[band.key]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableWrapper>
      </CardContent>
    </Card>
  );
}

function ThreeCThreeSReport({ title, rows, reportId, activePrint, context, onPrint }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No below 3C 3S students"
        description="Every listed student in this scope has at least 3 credits and 6 passes."
      />
    );
  }

  const createPdf = () => createThreeCThreeSPdf({ title, context, rows });

  return (
    <Card id={reportId} className={activePrint ? "analysis-print-active" : ""}>
      <CardContent>
        <ReportActions
          title={title}
          context={context}
          rowsCount={rows.length}
          onPrint={onPrint}
          createPdf={createPdf}
          extra="Below 3C 3S means fewer than 3 A/B/C results or fewer than 6 A/B/C/S passes."
        />
        <ReportHeader title={title} context={context} />
        <ResponsiveTableWrapper minWidth={980} sx={borderedReportTableSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>No</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Grade</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Division</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Results</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>W Subjects</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.studentId || `${row.studentName}-${index}`} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{row.studentName}</TableCell>
                  <TableCell align="center">{row.grade}</TableCell>
                  <TableCell align="center">{row.division}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{row.resultCode || "-"}</TableCell>
                  <TableCell>
                    {row.wSubjectItems?.length ? (
                      row.wSubjectItems.map((subject, subjectIndex) => (
                        <React.Fragment key={`${row.studentId}-${subject.name}-${subjectIndex}`}>
                          {subjectIndex > 0 ? ", " : ""}
                          <Box component="span" sx={{ fontWeight: subject.isCore ? 800 : 400 }}>
                            {subject.name}
                          </Box>
                        </React.Fragment>
                      ))
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableWrapper>
      </CardContent>
    </Card>
  );
}

function LowMarkStudentsReport({
  title,
  rows,
  reportId,
  activePrint,
  context,
  onPrint,
  selectedSubject,
}) {
  if (selectedSubject === ALL) {
    return (
      <EmptyState
        title="Select a subject"
        description="Choose one subject to list students in the 0-9, 10-19, 20-29, and 30-34 mark ranges."
      />
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        title="No low-mark students"
        description="No students were found in the 0-34 mark range for this subject and scope."
      />
    );
  }

  const createPdf = () => createLowMarkStudentsPdf({ title, context, rows });

  return (
    <Card id={reportId} className={activePrint ? "analysis-print-active" : ""}>
      <CardContent>
        <ReportActions
          title={title}
          context={context}
          rowsCount={rows.length}
          onPrint={onPrint}
          createPdf={createPdf}
          extra="Low mark ranges: 0-9, 10-19, 20-29, 30-34."
        />
        <ReportHeader title={title} context={context} />
        <ResponsiveTableWrapper minWidth={820} sx={borderedReportTableSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>No</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Range</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Marks</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Grade</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Division</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.studentId}-${row.rangeKey}-${index}`} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell align="center">{row.rangeKey}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{row.studentName}</TableCell>
                  <TableCell align="right">{formatNumber(row.mark, 0)}</TableCell>
                  <TableCell align="center">{row.grade}</TableCell>
                  <TableCell align="center">{row.division}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableWrapper>
      </CardContent>
    </Card>
  );
}

function buildA3SubjectHeaderRows(subjects = []) {
  const groups = [];
  let currentGroup = null;

  subjects.forEach((subject) => {
    const groupKey = subject.groupKey || "core";
    const groupLabel = subject.groupLabel ?? getSubjectGroupLabel(groupKey);

    if (!currentGroup || currentGroup.key !== groupKey || currentGroup.label !== groupLabel) {
      currentGroup = {
        key: groupKey,
        label: groupLabel,
        subjects: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.subjects.push(subject);
  });

  const baseTop = [
    { content: "No", rowSpan: 3 },
    { content: "Student ID", rowSpan: 3 },
    { content: "Student Name", rowSpan: 3 },
    { content: "Class", rowSpan: 3 },
    { content: "Results", rowSpan: 3 },
    { content: "Qualified", rowSpan: 3 },
  ];

  const pdfHead = [
    [
      ...baseTop,
      ...groups.map((group) => ({
        content: group.label || " ",
        colSpan: group.subjects.length * 2,
      })),
    ],
    subjects.flatMap((subject) => [
      { content: subject.shortLabel || getA3SubjectLabel(subject), colSpan: 2 },
    ]),
    subjects.flatMap(() => ["Mark", "Gr"]),
  ];

  return {
    groups,
    pdfHead,
  };
}

function A3GradingSheet({
  year,
  term,
  grade,
  className,
  subjects,
  rows,
  qualifiedCount,
  activePrint,
  context,
  onPrint,
}) {
  const scopeLabel = className === ALL ? `Grade ${grade}` : `Grade ${className}`;
  const totalStudents = rows.length;
  const weakTotals = rows.reduce((sum, row) => {
    return sum + subjects.filter((subject) => row.results[subject.subjectKey]?.symbol === "W").length;
  }, 0);
  const title = `${scopeLabel} - A3 Grading Sheet`;
  const groupedHeaders = buildA3SubjectHeaderRows(subjects);
  const createPdf = () =>
    createA3GradingPdf({
      title,
      context,
      rows,
      subjects,
      qualifiedCount,
    });

  return (
    <Paper
      id="a3-grading-sheet"
      className={activePrint ? "analysis-print-active" : ""}
      sx={{ p: 2, borderRadius: 2, overflowX: "auto" }}
    >
      <Stack spacing={1.5}>
        <ReportActions
          title={title}
          context={context}
          rowsCount={rows.length}
          onPrint={onPrint}
          createPdf={createPdf}
          extra={`Qualified with passes in 6 subjects including Tamil and Mathematics: ${qualifiedCount}`}
        />
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontFamily: "Times New Roman, serif", fontWeight: 800, fontSize: 18 }}>
            KILINOCHCHI CENTRAL COLLEGE
          </Typography>
          <Typography sx={{ fontFamily: "Times New Roman, serif", fontWeight: 700 }}>
            A3 Grading Sheet - {scopeLabel}
          </Typography>
          <Box
            sx={{
              mt: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "center",
              columnGap: 2,
            }}
          >
            <Typography variant="body2" sx={{ textAlign: "left" }}>
              Grade: {className === ALL ? grade : className}
            </Typography>
            <Typography variant="body2" sx={{ textAlign: "center" }}>
              Term: {term}
            </Typography>
            <Typography variant="body2" sx={{ textAlign: "right" }}>
              Year: {year}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ display: "block", mt: 0.5, textAlign: "right" }}>
            Generated: {new Date().toLocaleString()}
          </Typography>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="body2">Number of Students: {totalStudents}</Typography>
            <Typography variant="body2">
              Qualified: {qualifiedCount} ({totalStudents ? formatNumber((qualifiedCount / totalStudents) * 100) : "0"}%)
            </Typography>
            <Typography variant="body2">Weak Subject Entries: {weakTotals}</Typography>
          </Stack>
          <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
            Qualification requires passes in 6 subjects including Tamil and Mathematics. A/B/C/S are passes. W is fail.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {GRADE_BANDS.map((band) => (
            <Chip
              key={band.key}
              size="small"
              label={`${band.min}-${band.max} ${band.description}: ${band.key}`}
              variant="outlined"
            />
          ))}
        </Stack>

        {subjects.length === 0 || rows.length === 0 ? (
          <EmptyState title="No grading sheet data" description="Select a grade or division with enrolled subjects and marks." />
        ) : (
          <Box
            sx={{
              overflowX: "auto",
              "& table": {
                border: "1px solid #1f2937",
                tableLayout: "fixed",
              },
              "& th, & td": {
                border: "1px solid #1f2937",
              },
              "@media print": {
                overflow: "visible",
                "& table": {
                  minWidth: "0 !important",
                  width: "100%",
                  tableLayout: "fixed",
                  fontSize: "6.2px !important",
                },
                "& th, & td": {
                  padding: "2px 3px !important",
                  border: "1px solid #000 !important",
                  lineHeight: 1.1,
                },
                "& th:nth-of-type(5), & td:nth-of-type(5)": {
                  fontWeight: "800 !important",
                },
              },
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: Math.max(1100, 420 + subjects.length * 95),
                borderCollapse: "collapse",
                fontSize: 11,
                fontFamily: "Times New Roman, serif",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "28px" }} />
                <col style={{ width: "92px" }} />
                <col style={{ width: "170px" }} />
                <col style={{ width: "48px" }} />
                <col style={{ width: "72px" }} />
                <col style={{ width: "62px" }} />
                {subjects.flatMap((subject) => [
                  <col key={`${subject.subjectKey}-mark-col`} style={{ width: "48px" }} />,
                  <col key={`${subject.subjectKey}-grade-col`} style={{ width: "34px" }} />,
                ])}
              </colgroup>
              <thead>
                <tr>
                  <th style={printCellStyle} rowSpan={3}>No</th>
                  <th style={printCellStyle} rowSpan={3}>Student ID</th>
                  <th style={printCellStyle} rowSpan={3}>Student Name</th>
                  <th style={printCellStyle} rowSpan={3}>Class</th>
                  <th style={printCellStyle} rowSpan={3}>Results</th>
                  <th style={printCellStyle} rowSpan={3}>Qualified</th>
                  {groupedHeaders.groups.map((group, index) => (
                    <th
                      key={`${group.key}-${index}`}
                      style={printCellStyle}
                      colSpan={group.subjects.length * 2}
                    >
                      {group.label || ""}
                    </th>
                  ))}
                </tr>
                <tr>
                  {subjects.map((subject) => (
                    <th key={`${subject.subjectKey}-subject`} style={printCellStyle} colSpan={2}>
                      {subject.shortLabel || getA3SubjectLabel(subject)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {subjects.map((subject) => (
                    <React.Fragment key={`${subject.subjectKey}-mark-grade`}>
                      <th style={printCellStyle}>Mark</th>
                      <th style={printCellStyle}>Gr</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <TableRowForPrint key={row.studentId || index} row={row} index={index} subjects={subjects} />
                ))}
              </tbody>
            </table>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          {scopeLabel} grading sheet generated from active student subject enrollments and saved marks.
        </Typography>
      </Stack>
    </Paper>
  );
}

const printCellStyle = {
  border: "1px solid #222",
  padding: "3px 4px",
  textAlign: "center",
  verticalAlign: "middle",
};

function TableRowForPrint({ row, index, subjects }) {
  return (
    <tr>
      <td style={printCellStyle}>{index + 1}</td>
      <td style={printCellStyle}>{row.indexNo || row.studentId}</td>
      <td style={{ ...printCellStyle, textAlign: "left", minWidth: 160 }}>{row.studentName}</td>
      <td style={printCellStyle}>{row.className}</td>
      <td style={{ ...printCellStyle, fontWeight: 800 }}>{row.resultCode}</td>
      <td
        style={{
          ...printCellStyle,
          fontWeight: row.grade11Pass?.qualified ? 800 : 400,
        }}
      >
        {row.grade11Pass?.qualified ? "Yes" : "No"}
      </td>
      {subjects.map((subject) => {
        const result = row.results[subject.subjectKey] || {};
        return (
          <React.Fragment key={subject.subjectKey}>
            <td style={printCellStyle}>{result.absent ? "AB" : result.mark ?? ""}</td>
            <td
              style={{
                ...printCellStyle,
                fontWeight: result.symbol === "W" ? 800 : 400,
              }}
            >
              {result.symbol || ""}
            </td>
          </React.Fragment>
        );
      })}
    </tr>
  );
}
