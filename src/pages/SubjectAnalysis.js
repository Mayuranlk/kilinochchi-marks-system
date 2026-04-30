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

const TAB_CONFIG = [
  { value: "grade", label: "Grade Subject Analysis" },
  { value: "class", label: "Class Subject Analysis" },
  { value: "range", label: "Subject Mark Range" },
  { value: "sheet", label: "A3 Grading Sheet" },
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

  autoTable(doc, {
    startY: 44,
    head: [[
      "No",
      "Student ID",
      "Student Name",
      "Class",
      "Results",
      "Qualified",
      ...subjects.flatMap((subject) => [`${subject.subjectName} Mark`, "Gr"]),
    ]],
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
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 38, halign: "left" },
      3: { cellWidth: 12 },
      4: { cellWidth: 18, fontStyle: "bold" },
      5: { cellWidth: 12 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
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

  records.forEach((record) => {
    if (!studentMap.has(record.studentId)) {
      studentMap.set(record.studentId, {
        studentId: record.studentId,
        indexNo: record.indexNo,
        studentName: record.studentName,
        className: record.className,
        results: {},
      });
    }

    studentMap.get(record.studentId).results[record.subjectKey] = {
      mark: record.mark,
      absent: record.absent,
      symbol: record.absent ? "AB" : getGradeSymbol(record.mark),
    };
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
    records
      .filter((record) => Number(record.grade) === Number(selectedGrade))
      .forEach((record) => {
        enrolledMap.set(record.subjectKey, {
          subjectKey: record.subjectKey,
          subjectName: record.subjectName,
        });
      });

    subjects
      .filter((subject) => subjectAppliesToGrade(subject, selectedGrade))
      .forEach((subject) => {
        const subjectKey = getSubjectKey(subject);
        if (!enrolledMap.has(subjectKey)) {
          enrolledMap.set(subjectKey, {
            subjectKey,
            subjectName: getSubjectName(subject),
          });
        }
      });

    return Array.from(enrolledMap.values()).sort((a, b) =>
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
    return gradeSubjectOptions.filter((subject) => keys.has(subject.subjectKey));
  }, [gradeSubjectOptions, gradeRecords, classRecords, selectedClass]);

  const sheetRows = useMemo(() => {
    const sourceRecords = selectedClass === ALL ? gradeRecords : classRecords;
    return buildSheetRows(sourceRecords, sheetSubjects);
  }, [gradeRecords, classRecords, selectedClass, sheetSubjects]);

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
              }}
            >
              <thead>
                <tr>
                  <th style={printCellStyle}>No</th>
                  <th style={printCellStyle}>Student ID</th>
                  <th style={printCellStyle}>Student Name</th>
                  <th style={printCellStyle}>Class</th>
                  <th style={printCellStyle}>Results</th>
                  <th style={printCellStyle}>Qualified</th>
                  {subjects.map((subject) => (
                    <th key={subject.subjectKey} style={printCellStyle} colSpan={2}>
                      {subject.subjectName}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th style={printCellStyle}></th>
                  <th style={printCellStyle}></th>
                  <th style={printCellStyle}></th>
                  <th style={printCellStyle}></th>
                  <th style={printCellStyle}></th>
                  <th style={printCellStyle}></th>
                  {subjects.map((subject) => (
                    <React.Fragment key={`${subject.subjectKey}-sub`}>
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
      <td style={printCellStyle}>{row.grade11Pass?.qualified ? "Yes" : "No"}</td>
      {subjects.map((subject) => {
        const result = row.results[subject.subjectKey] || {};
        return (
          <React.Fragment key={subject.subjectKey}>
            <td style={printCellStyle}>{result.absent ? "AB" : result.mark ?? ""}</td>
            <td style={printCellStyle}>{result.symbol || ""}</td>
          </React.Fragment>
        );
      })}
    </tr>
  );
}
