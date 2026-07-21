import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { alpha, useTheme } from "@mui/material/styles";

import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { ResponsiveTableWrapper } from "../../components/ui";
import {
  filterStudentsForClass,
  matchesReportClass,
} from "../../utils/classMarksReportBuilder";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_TERM = "Term 1";
const PUBLIC_MARKS_STATUS_DOC_ID = "marks-status-live";

function normalizeText(value) {
  return String(value || "").trim();
}

function getClassroomDisplayName(classroom = {}) {
  if (Number(classroom.grade) === 12 || Number(classroom.grade) === 13) {
    return (
      classroom.displayClassName ||
      classroom.fullClassName ||
      classroom.alClassName ||
      classroom.className ||
      `${classroom.grade}${classroom.section || ""}`
    );
  }

  return classroom.className || classroom.fullClassName || `${classroom.grade}${classroom.section || ""}`;
}

function getClassroomReportName(classroom = {}) {
  if (Number(classroom.grade) === 12 || Number(classroom.grade) === 13) {
    return (
      classroom.fullClassName ||
      classroom.alClassName ||
      classroom.displayClassName ||
      classroom.className ||
      `${classroom.grade}${classroom.section || ""}`
    );
  }

  return classroom.className || classroom.fullClassName || `${classroom.grade}${classroom.section || ""}`;
}

function getAdmissionNo(student = {}) {
  return normalizeText(student.admissionNo || student.admissionNumber || student.admNo || "");
}

function getStudentSystemId(student = {}) {
  return normalizeText(
    student.emisStudentId ||
      student.emisId ||
      student.externalStudentId ||
      student.studentId ||
      ""
  );
}

function getStudentName(student = {}) {
  return normalizeText(student.fullName || student.name || "Unnamed Student");
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function isActiveStatus(value) {
  return normalizeLower(value || "active") === "active";
}

function getEnrollmentSubjectKey(row = {}) {
  const subjectId = normalizeLower(row.subjectId);
  const subjectNumber = normalizeLower(row.subjectNumber);
  const subjectName = normalizeLower(row.subjectName || row.subject);

  if (subjectId) return `id:${subjectId}`;
  if (subjectNumber) return `no:${subjectNumber}`;
  return subjectName ? `name:${subjectName}` : "";
}

function subjectsMatch(left = {}, right = {}) {
  const leftId = normalizeLower(left.subjectId);
  const rightId = normalizeLower(right.subjectId);
  const leftNumber = normalizeLower(left.subjectNumber);
  const rightNumber = normalizeLower(right.subjectNumber);
  const leftName = normalizeLower(left.subjectName || left.subject);
  const rightName = normalizeLower(right.subjectName || right.subject);

  if (leftId && rightId) return leftId === rightId;
  if (leftNumber && rightNumber) return leftNumber === rightNumber;
  if (leftName && rightName) return leftName === rightName;
  return false;
}

function getStatusColor(status) {
  if (status === "done") return "success";
  if (status === "partial") return "warning";
  return "error";
}

function getStatusLabel(status) {
  if (status === "done") return "Green - Fully Done";
  if (status === "partial") return "Yellow - Check";
  return "Red - Not Okay";
}

function buildMissingNames(students = [], predicate) {
  return students
    .filter(predicate)
    .slice(0, 6)
    .map((student) => getStudentName(student))
    .join(", ");
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Math.round(Number(value))}%`;
}

function formatPendingSubjects(row = {}) {
  return (row.subjectSummaries || [])
    .filter((subject) => subject.status !== "done")
    .map((subject) => {
      const missingText = subject.missingCount ? ` (${subject.missingCount} missing)` : "";
      return `${subject.subjectName}${missingText}`;
    })
    .join(", ");
}

function buildPublicMarksStatusRows(rows = []) {
  return rows.map((row) => ({
    id: normalizeText(row.id),
    grade: Number(row.grade || 0),
    className: normalizeText(row.className),
    classTeacherName: normalizeText(row.classTeacherName),
    studentCount: Number(row.studentCount || 0),
    subjectCount: Number(row.subjectCount || 0),
    expectedMarkCount: Number(row.expectedMarkCount || 0),
    enteredMarkCount: Number(row.enteredMarkCount || 0),
    missingMarkCount: Number(row.missingMarksCount || row.missingMarkCount || 0),
    completedSubjectCount: Number(row.completedSubjectCount || 0),
    partialSubjectCount: Number(row.partialSubjectCount || 0),
    pendingSubjectCount: Number(row.pendingSubjectCount || 0),
    completionPercent:
      Number(row.expectedMarkCount || 0) > 0
        ? (Number(row.enteredMarkCount || 0) / Number(row.expectedMarkCount || 0)) * 100
        : 0,
    status: normalizeText(row.status || "missing"),
    subjectSummaries: (row.subjectSummaries || []).map((subject) => ({
      subjectKey: normalizeText(subject.subjectKey),
      subjectName: normalizeText(subject.subjectName),
      subjectNumber: normalizeText(subject.subjectNumber),
      teacherName: normalizeText(subject.teacherName),
      enrolledCount: Number(subject.enrolledCount || 0),
      enteredCount: Number(subject.enteredCount || 0),
      missingCount: Number(subject.missingCount || 0),
      status: normalizeText(subject.status || "missing"),
    })),
  }));
}

function buildPendingSubjectRows(rows = []) {
  return rows.flatMap((row) =>
    (row.subjectSummaries || [])
      .filter((subject) => subject.status !== "done")
      .map((subject) => ({
        classId: row.id,
        grade: row.grade,
        className: row.className,
        subjectKey: subject.subjectKey,
        subjectName: subject.subjectName,
        subjectNumber: subject.subjectNumber,
        subjectId: subject.subjectId,
        status: subject.status,
        enrolledCount: subject.enrolledCount,
        enteredCount: subject.enteredCount,
        missingCount: subject.missingCount,
      }))
  );
}

function buildClassSubjectCompletion({ classEnrollments, classMarks }) {
  const subjectMap = new Map();

  classEnrollments.forEach((enrollment) => {
    const studentId = normalizeText(enrollment.studentId);
    const subjectKey = getEnrollmentSubjectKey(enrollment);
    if (!studentId || !subjectKey) return;

    if (!subjectMap.has(subjectKey)) {
      subjectMap.set(subjectKey, {
        subjectKey,
        subjectName: normalizeText(enrollment.subjectName || enrollment.subject || "Unnamed Subject"),
        subjectId: normalizeText(enrollment.subjectId),
        subjectNumber: normalizeText(enrollment.subjectNumber),
        enrolledStudentIds: new Set(),
      });
    }

    subjectMap.get(subjectKey).enrolledStudentIds.add(studentId);
  });

  return Array.from(subjectMap.values())
    .map((subject) => {
      const enteredStudentIds = new Set();

      classMarks.forEach((mark) => {
        const studentId = normalizeText(mark.studentId);
        if (!studentId || !subject.enrolledStudentIds.has(studentId)) return;
        if (!subjectsMatch(mark, subject)) return;
        enteredStudentIds.add(studentId);
      });

      const enrolledCount = subject.enrolledStudentIds.size;
      const enteredCount = enteredStudentIds.size;
      const missingCount = Math.max(0, enrolledCount - enteredCount);
      const status =
        enrolledCount === 0
          ? "skipped"
          : enteredCount === enrolledCount
          ? "done"
          : enteredCount > 0
          ? "partial"
          : "missing";

      return {
        ...subject,
        enrolledCount,
        enteredCount,
        missingCount,
        status,
      };
    })
    .filter((subject) => subject.enrolledCount > 0)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: "base" }));
}

function buildClassCompletionRows({ classrooms, students, enrollments, marks, year, termName }) {
  const studentsById = new Map(students.map((student) => [normalizeText(student.id), student]));

  return classrooms.map((classroom) => {
    const grade = Number(classroom.grade);
    const className = getClassroomReportName(classroom);
    const section = classroom.section;
    const stream = classroom.stream || "";
    const reportContext = { grade, section, className, stream };

    const classStudents = filterStudentsForClass(students, grade, section, className, stream);
    const classEnrollments = enrollments.filter((enrollment) => {
      const enrollmentYear = Number(enrollment.academicYear || enrollment.year || 0);
      return (
        isActiveStatus(enrollment.status) &&
        matchesReportClass(enrollment, reportContext) &&
        enrollmentYear === Number(year)
      );
    });
    const classMarks = marks.filter((mark) => {
      const markTerm = mark.termName || mark.term || "";
      const markYear = Number(mark.academicYear || mark.year || 0);

      return (
        matchesReportClass(mark, reportContext) &&
        markTerm === termName &&
        markYear === Number(year)
      );
    });
    const markedStudentIds = new Set(
      classMarks.map((mark) => normalizeText(mark.studentId)).filter(Boolean)
    );
    const enrolledStudentIds = new Set(
      classEnrollments.map((enrollment) => normalizeText(enrollment.studentId)).filter(Boolean)
    );
    const enrolledStudents = Array.from(enrolledStudentIds)
      .map((studentId) => studentsById.get(studentId))
      .filter(Boolean);
    const identityStudents = enrolledStudents.length ? enrolledStudents : classStudents;
    const subjectSummaries = buildClassSubjectCompletion({ classEnrollments, classMarks });
    const expectedMarkCount = subjectSummaries.reduce((sum, subject) => sum + subject.enrolledCount, 0);
    const enteredMarkCount = subjectSummaries.reduce((sum, subject) => sum + subject.enteredCount, 0);
    const missingMarkCount = Math.max(0, expectedMarkCount - enteredMarkCount);
    const completedSubjectCount = subjectSummaries.filter((subject) => subject.status === "done").length;
    const partialSubjectCount = subjectSummaries.filter((subject) => subject.status === "partial").length;
    const pendingSubjectCount = subjectSummaries.filter((subject) => subject.status === "missing").length;

    const missingAdmissionStudents = identityStudents.filter((student) => !getAdmissionNo(student));
    const missingStudentIdStudents = identityStudents.filter((student) => !getStudentSystemId(student));
    const hasStudents = identityStudents.length > 0;
    const hasExpectedMarks = expectedMarkCount > 0;
    const allExpectedMarksEntered = hasExpectedMarks && missingMarkCount === 0;
    const identitiesComplete =
      hasStudents &&
      missingAdmissionStudents.length === 0 &&
      missingStudentIdStudents.length === 0;

    let status = "missing";
    if (hasStudents && hasExpectedMarks && allExpectedMarksEntered && identitiesComplete) {
      status = "done";
    } else if (hasStudents || hasExpectedMarks || enteredMarkCount > 0) {
      status = "partial";
    }

    return {
      id: classroom.id,
      grade,
      className: getClassroomDisplayName(classroom),
      classTeacherName: normalizeText(classroom.classTeacherName),
      studentCount: identityStudents.length,
      markedStudentCount: markedStudentIds.size,
      marksCount: classMarks.length,
      expectedMarkCount,
      enteredMarkCount,
      missingMarksCount: missingMarkCount,
      subjectCount: subjectSummaries.length,
      completedSubjectCount,
      partialSubjectCount,
      pendingSubjectCount,
      missingAdmissionCount: missingAdmissionStudents.length,
      missingStudentIdCount: missingStudentIdStudents.length,
      status,
      notes: [
        !hasStudents ? "No students uploaded" : "",
        hasStudents && !hasExpectedMarks ? "No subject enrollments for this class" : "",
        hasExpectedMarks && !allExpectedMarksEntered ? `${missingMarkCount} subject marks missing` : "",
        pendingSubjectCount ? `${pendingSubjectCount} subjects not started` : "",
        partialSubjectCount ? `${partialSubjectCount} subjects partially entered` : "",
        missingAdmissionStudents.length ? `${missingAdmissionStudents.length} missing Admission No` : "",
        missingStudentIdStudents.length ? `${missingStudentIdStudents.length} missing Student ID` : "",
      ]
        .filter(Boolean)
        .join("; "),
      missingMarksNames: buildMissingNames(
        identityStudents,
        (student) => !markedStudentIds.has(normalizeText(student.id))
      ),
      missingIdentityNames: buildMissingNames(
        identityStudents,
        (student) => !getAdmissionNo(student) || !getStudentSystemId(student)
      ),
      subjectSummaries,
    };
  });
}

function exportRows(rows, { year, termName, summary, pendingSubjectRows }) {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Status: getStatusLabel(row.status),
      Grade: row.grade,
      Class: row.className,
      "Uploaded Students": row.studentCount,
      "Students With Any Marks": row.markedStudentCount,
      "Subjects": row.subjectCount,
      "Subjects Completed": row.completedSubjectCount,
      "Subjects Partial": row.partialSubjectCount,
      "Subjects Pending": row.pendingSubjectCount,
      "Expected Subject Marks": row.expectedMarkCount,
      "Entered Subject Marks": row.enteredMarkCount,
      "Mark Records": row.marksCount,
      "Missing Subject Marks": row.missingMarksCount,
      "Missing Admission No": row.missingAdmissionCount,
      "Missing Student ID": row.missingStudentIdCount,
      Notes: row.notes || "Fully done",
      "Pending Subjects": formatPendingSubjects(row),
      "Students Without Marks Names": row.missingMarksNames,
      "Missing Identity Names": row.missingIdentityNames,
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Class Completion");

  if (summary) {
    const summarySheet = XLSX.utils.json_to_sheet([
      { Metric: "Year", Value: year },
      { Metric: "Term", Value: termName },
      { Metric: "Classes", Value: summary.total },
      { Metric: "Green Classes", Value: summary.done },
      { Metric: "Yellow Classes", Value: summary.partial },
      { Metric: "Red Classes", Value: summary.missing },
      { Metric: "Total Expected Marks", Value: summary.expectedMarks },
      { Metric: "Total Entered Marks", Value: summary.enteredMarks },
      { Metric: "Total Missing Marks", Value: summary.missingMarks },
      { Metric: "Completion Percentage", Value: formatPercent(summary.completionPercent) },
      { Metric: "Pending Subjects", Value: summary.pendingSubjects },
      { Metric: "Partial Subjects", Value: summary.partialSubjects },
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Whole School Summary");
  }

  if (pendingSubjectRows?.length) {
    const pendingSheet = XLSX.utils.json_to_sheet(
      pendingSubjectRows.map((row) => ({
        Status: getStatusLabel(row.status),
        Grade: row.grade,
        Class: row.className,
        Subject: row.subjectName,
        "Subject No": row.subjectNumber,
        "Subject ID": row.subjectId,
        "Enrolled Students": row.enrolledCount,
        "Marks Entered": row.enteredCount,
        "Missing Marks": row.missingCount,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, pendingSheet, "Pending Subjects");
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, `class_completion_report_${year}_${termName.replace(/\s+/g, "_")}.xlsx`);
}

function buildCompletionPdfFileName({ year, termName }) {
  return `class_completion_report_${year}_${termName.replace(/\s+/g, "_")}.pdf`;
}

function getStatusPdfFillColor(status) {
  if (status === "done") return [232, 245, 233];
  if (status === "partial") return [255, 248, 225];
  return [255, 235, 238];
}

function createCompletionPdf(rows, { year, termName, summary }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Kilinochchi Central College", 148.5, 12, { align: "center" });
  doc.setFontSize(11);
  doc.text("Class Completion Report", 148.5, 19, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Year: ${year}`, 10, 28);
  doc.text(`Term: ${termName}`, 55, 28);
  doc.text(`Classes: ${summary.total}`, 112, 28);
  doc.text(`Green: ${summary.done}`, 160, 28);
  doc.text(`Yellow: ${summary.partial}`, 205, 28);
  doc.text(`Red: ${summary.missing}`, 252, 28);
  doc.text(
    `Whole School Completion: ${formatPercent(summary.completionPercent)} | Missing Marks: ${summary.missingMarks}`,
    10,
    33
  );

  autoTable(doc, {
    startY: 39,
    head: [[
      "Status",
      "Class",
      "Uploaded",
      "Subjects",
      "Done",
      "Partial",
      "Pending",
      "Expected",
      "Entered",
      "Mark Records",
      "Missing Marks",
      "Missing Adm No",
      "Missing Student ID",
      "Pending Subjects",
      "Action Needed",
    ]],
    body: rows.map((row) => [
      getStatusLabel(row.status),
      row.className,
      row.studentCount,
      row.subjectCount,
      row.completedSubjectCount,
      row.partialSubjectCount,
      row.pendingSubjectCount,
      row.expectedMarkCount,
      row.enteredMarkCount,
      row.marksCount,
      row.missingMarksCount,
      row.missingAdmissionCount,
      row.missingStudentIdCount,
      formatPendingSubjects(row),
      row.notes || "Fully done",
    ]),
    theme: "grid",
    styles: {
      fontSize: 7.2,
      cellPadding: 1.2,
      valign: "middle",
      lineWidth: 0.1,
      lineColor: [80, 80, 80],
      textColor: 20,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [235, 239, 245],
      textColor: 20,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
      1: { cellWidth: 15, fontStyle: "bold" },
      2: { cellWidth: 13, halign: "right" },
      3: { cellWidth: 13, halign: "right" },
      4: { cellWidth: 12, halign: "right" },
      5: { cellWidth: 12, halign: "right" },
      6: { cellWidth: 13, halign: "right" },
      7: { cellWidth: 14, halign: "right" },
      8: { cellWidth: 14, halign: "right" },
      9: { cellWidth: 14, halign: "right" },
      10: { cellWidth: 16, halign: "right" },
      11: { cellWidth: 16, halign: "right" },
      12: { cellWidth: 18, halign: "right" },
      13: { cellWidth: 34 },
      14: { cellWidth: 38 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (!row) return;
      data.cell.styles.fillColor = getStatusPdfFillColor(row.status);
    },
    margin: { left: 8, right: 8 },
  });

  if (Array.isArray(summary.pendingSubjectRows) && summary.pendingSubjectRows.length) {
    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 39) + 8,
      head: [["Class", "Subject", "Status", "Enrolled", "Entered", "Missing"]],
      body: summary.pendingSubjectRows.slice(0, 60).map((row) => [
        row.className,
        row.subjectName,
        getStatusLabel(row.status),
        row.enrolledCount,
        row.enteredCount,
        row.missingCount,
      ]),
      theme: "grid",
      styles: {
        fontSize: 7.2,
        cellPadding: 1.2,
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [80, 80, 80],
        textColor: 20,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [255, 248, 225],
        textColor: 20,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: "bold" },
        1: { cellWidth: 76 },
        2: { cellWidth: 30, fontStyle: "bold" },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 18, halign: "right" },
      },
      margin: { left: 8, right: 8 },
      didDrawPage: (data) => {
        if (data.pageNumber === 1) return;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Pending Subjects", 10, 10);
      },
    });
  }

  const finalY = doc.lastAutoTable?.finalY || 185;
  const signatureY = Math.min(finalY + 18, 194);
  doc.setFontSize(8.5);
  doc.text("Prepared By", 28, signatureY);
  doc.text("Sectional Head", 138, signatureY);
  doc.text("Principal", 252, signatureY);
  doc.setFontSize(7.5);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 289, 203, { align: "right" });

  return doc;
}

function downloadCompletionPdf(rows, context) {
  const doc = createCompletionPdf(rows, context);
  doc.save(buildCompletionPdfFileName(context));
}

async function shareCompletionPdf(rows, context) {
  const doc = createCompletionPdf(rows, context);
  const blob = doc.output("blob");
  const fileName = buildCompletionPdfFileName(context);
  const file = new File([blob], fileName, { type: "application/pdf" });
  const text = [
    "Kilinochchi Central College",
    "Class Completion Report",
    `Term: ${context.termName} | Year: ${context.year}`,
    `Classes: ${context.summary.total}`,
    `Green: ${context.summary.done} | Yellow: ${context.summary.partial} | Red: ${context.summary.missing}`,
  ].join("\n");

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Kilinochchi Central College - Class Completion Report",
        text,
        files: [file],
      });
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
    console.warn("Class completion PDF share fallback triggered:", err);
  }

  saveAs(blob, fileName);
  window.open(
    `https://wa.me/?text=${encodeURIComponent(
      `${text}\n\nThe PDF has been downloaded. Please attach ${fileName} in WhatsApp.`
    )}`,
    "_blank",
    "noopener,noreferrer"
  );
  window.alert(
    "This browser cannot attach a generated PDF directly to WhatsApp. The PDF has been downloaded; please attach it in WhatsApp manually."
  );
}

function SummaryTile({ label, value, color }) {
  const theme = useTheme();
  const palette = theme.palette[color] || theme.palette.primary;

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        bgcolor: alpha(palette.main, 0.08),
        borderColor: alpha(palette.main, 0.25),
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 900, color: palette.dark }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function ClassCompletionReport() {
  const { isSectionalHead, assignedGrades, profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [publishingLive, setPublishingLive] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedTerm, setSelectedTerm] = useState(DEFAULT_TERM);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDetailClassId, setSelectedDetailClassId] = useState("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [studentsSnap, enrollmentsSnap, marksSnap, classroomsSnap, termsSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "marks")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "academicTerms")),
      ]);

      const studentsData = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const enrollmentsData = enrollmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const marksData = marksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const classroomsData = classroomsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const termsData = termsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setStudents(studentsData);
      setEnrollments(enrollmentsData);
      setMarks(marksData);
      setClassrooms(classroomsData);
      setTerms(termsData);

      const activeTerm = termsData.find((item) => item.isActive) || termsData[0] || null;
      if (activeTerm?.term) setSelectedTerm(activeTerm.term);
    } catch (err) {
      console.error("Failed to load class completion report:", err);
      setError(err.message || "Failed to load class completion report.");
    } finally {
      setLoading(false);
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set([
      ...classrooms.map((item) => Number(item.year || item.academicYear || 0)),
      ...marks.map((item) => Number(item.year || item.academicYear || 0)),
    ].filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [classrooms, marks]);

  const reportClassrooms = useMemo(() => {
    const assignedGradeSet = new Set((assignedGrades || []).map(Number));

    return classrooms
      .filter((classroom) => {
        const grade = Number(classroom.grade);
        const year = Number(classroom.year || classroom.academicYear || 0);
        return (
          year === Number(selectedYear) &&
          grade >= 6 &&
          grade <= 13 &&
          (!isSectionalHead || assignedGradeSet.has(grade))
        );
      })
      .sort((a, b) => {
        const gradeDiff = Number(a.grade) - Number(b.grade);
        if (gradeDiff !== 0) return gradeDiff;
        return getClassroomDisplayName(a).localeCompare(getClassroomDisplayName(b), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [assignedGrades, classrooms, isSectionalHead, selectedYear]);

  const rows = useMemo(
    () =>
      buildClassCompletionRows({
        classrooms: reportClassrooms,
        students,
        enrollments,
        marks,
        year: selectedYear,
        termName: selectedTerm,
      }),
    [enrollments, marks, reportClassrooms, selectedTerm, selectedYear, students]
  );

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.id === selectedDetailClassId)) {
      setSelectedDetailClassId(rows[0].id);
    }
  }, [rows, selectedDetailClassId]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const pendingSubjectRows = useMemo(() => buildPendingSubjectRows(rows), [rows]);

  const filteredPendingSubjectRows = useMemo(() => {
    if (statusFilter === "all") return pendingSubjectRows;
    if (statusFilter === "done") return [];
    return pendingSubjectRows.filter((row) => row.status === statusFilter);
  }, [pendingSubjectRows, statusFilter]);

  const summary = useMemo(() => {
    const expectedMarks = rows.reduce((sum, row) => sum + row.expectedMarkCount, 0);
    const enteredMarks = rows.reduce((sum, row) => sum + row.enteredMarkCount, 0);
    const missingMarks = rows.reduce((sum, row) => sum + row.missingMarksCount, 0);
    const completionPercent = expectedMarks > 0 ? (enteredMarks / expectedMarks) * 100 : 0;

    return {
      done: rows.filter((row) => row.status === "done").length,
      partial: rows.filter((row) => row.status === "partial").length,
      missing: rows.filter((row) => row.status === "missing").length,
      total: rows.length,
      expectedMarks,
      enteredMarks,
      missingMarks,
      completionPercent,
      completedSubjects: rows.reduce((sum, row) => sum + row.completedSubjectCount, 0),
      partialSubjects: rows.reduce((sum, row) => sum + row.partialSubjectCount, 0),
      pendingSubjects: rows.reduce((sum, row) => sum + row.pendingSubjectCount, 0),
      pendingSubjectRows,
    };
  }, [pendingSubjectRows, rows]);

  const detailRow = useMemo(
    () => rows.find((row) => row.id === selectedDetailClassId) || rows[0] || null,
    [rows, selectedDetailClassId]
  );

  const pdfContext = useMemo(
    () => ({
      year: selectedYear,
      termName: selectedTerm,
      summary,
    }),
    [selectedTerm, selectedYear, summary]
  );

  async function handleSharePdf() {
    try {
      setError("");
      await shareCompletionPdf(filteredRows, pdfContext);
    } catch (err) {
      console.error("Class completion PDF share failed:", err);
      setError(err.message || "Failed to share class completion PDF.");
    }
  }

  async function handlePublishLiveStatus() {
    try {
      setPublishingLive(true);
      setError("");

      const updatedAtText = new Date().toISOString();
      await setDoc(doc(db, "elections", PUBLIC_MARKS_STATUS_DOC_ID), {
        type: "marks-status-live",
        year: Number(selectedYear),
        termName: selectedTerm,
        rows: buildPublicMarksStatusRows(rows),
        summary: {
          total: summary.total,
          done: summary.done,
          partial: summary.partial,
          missing: summary.missing,
          expected: summary.expectedMarks,
          entered: summary.enteredMarks,
          missingMarks: summary.missingMarks,
          completionPercent: summary.completionPercent,
          pendingSubjects: summary.pendingSubjects + summary.partialSubjects,
        },
        updatedAtText,
        publishedAt: serverTimestamp(),
        publishedByUid: user?.uid || "",
        publishedByName: profile?.name || profile?.fullName || user?.email || "Staff",
      });

      setError("");
      window.alert("Live marks status published. The public share page can now load without staff login.");
    } catch (err) {
      console.error("Publish live marks status failed:", err);
      setError(err.message || "Failed to publish live marks status.");
    } finally {
      setPublishingLive(false);
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Class Completion Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Check which classes uploaded students, entered marks, and completed Admission No plus Student ID details.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Year"
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                  >
                    {(availableYears.length ? availableYears : [CURRENT_YEAR]).map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Term</InputLabel>
                  <Select
                    value={selectedTerm}
                    label="Term"
                    onChange={(event) => setSelectedTerm(event.target.value)}
                  >
                    {(terms.length ? terms : [{ id: DEFAULT_TERM, term: DEFAULT_TERM }]).map((term) => (
                      <MenuItem key={term.id} value={term.term}>
                        {term.term}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="done">Green - Fully Done</MenuItem>
                    <MenuItem value="partial">Yellow - Check</MenuItem>
                    <MenuItem value="missing">Red - Not Okay</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={1} justifyContent={{ xs: "stretch", md: "flex-end" }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={loadData}
                    disabled={loading}
                    fullWidth
                  >
                    Reload
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={() =>
                      exportRows(filteredRows, {
                        year: selectedYear,
                        termName: selectedTerm,
                        summary,
                        pendingSubjectRows: filteredPendingSubjectRows,
                      })
                    }
                    disabled={loading || filteredRows.length === 0}
                    fullWidth
                  >
                    Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={() => downloadCompletionPdf(filteredRows, pdfContext)}
                    disabled={loading || filteredRows.length === 0}
                    fullWidth
                  >
                    PDF
                  </Button>
                  <Button
                    variant="outlined"
                    color="success"
                    startIcon={<ShareRoundedIcon />}
                    onClick={handleSharePdf}
                    disabled={loading || filteredRows.length === 0}
                    fullWidth
                  >
                    Share
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={publishingLive ? <CircularProgress size={16} color="inherit" /> : <ShareRoundedIcon />}
                    onClick={handlePublishLiveStatus}
                    disabled={loading || rows.length === 0 || publishingLive}
                    fullWidth
                  >
                    {publishingLive ? "Publishing" : "Publish Live"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {loading ? (
          <Box sx={{ py: 5, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <SummaryTile label="Classes" value={summary.total} color="primary" />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryTile label="Green" value={summary.done} color="success" />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryTile label="Yellow" value={summary.partial} color="warning" />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryTile label="Red" value={summary.missing} color="error" />
              </Grid>
            </Grid>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Whole School Completion Summary
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total completion for all visible classes in {selectedYear} - {selectedTerm}.
                    </Typography>
                  </Box>
                  <Chip
                    label={`${formatPercent(summary.completionPercent)} complete`}
                    color={summary.missingMarks === 0 && summary.expectedMarks > 0 ? "success" : "warning"}
                    sx={{ alignSelf: { xs: "flex-start", md: "center" }, fontWeight: 900 }}
                  />
                </Stack>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  <Grid item xs={6} md={3}>
                    <SummaryTile label="Expected Marks" value={summary.expectedMarks} color="primary" />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <SummaryTile label="Entered Marks" value={summary.enteredMarks} color="success" />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <SummaryTile label="Missing Marks" value={summary.missingMarks} color="error" />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <SummaryTile
                      label="Pending Subjects"
                      value={summary.pendingSubjects + summary.partialSubjects}
                      color="warning"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                  <AssessmentRoundedIcon color="warning" />
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Classwise Pending Subjects
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Every subject that still needs marks, across the whole school view.
                    </Typography>
                  </Box>
                </Stack>

                {filteredPendingSubjectRows.length ? (
                  <ResponsiveTableWrapper minWidth={860}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Status</TableCell>
                          <TableCell>Class</TableCell>
                          <TableCell>Subject</TableCell>
                          <TableCell align="right">Enrolled Students</TableCell>
                          <TableCell align="right">Marks Entered</TableCell>
                          <TableCell align="right">Missing Marks</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredPendingSubjectRows.map((row) => (
                          <TableRow key={`${row.classId}-${row.subjectKey}`} hover>
                            <TableCell>
                              <Chip
                                label={getStatusLabel(row.status)}
                                color={getStatusColor(row.status)}
                                size="small"
                                sx={{ fontWeight: 800 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {row.className}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Grade {row.grade}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {row.subjectName}
                              </Typography>
                              {row.subjectNumber || row.subjectId ? (
                                <Typography variant="caption" color="text.secondary">
                                  {[row.subjectNumber, row.subjectId].filter(Boolean).join(" | ")}
                                </Typography>
                              ) : null}
                            </TableCell>
                            <TableCell align="right">{row.enrolledCount}</TableCell>
                            <TableCell align="right">{row.enteredCount}</TableCell>
                            <TableCell align="right">{row.missingCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableWrapper>
                ) : (
                  <Alert severity="success">
                    No pending subjects found for this filter.
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Grid item xs={12} md={7}>
                    <Typography variant="h6" fontWeight={800}>
                      Class Subject Completion
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Select a class to see each enrolled subject as completed, partial, or pending. Subjects with no enrolled students are skipped.
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Class</InputLabel>
                      <Select
                        value={detailRow?.id || ""}
                        label="Class"
                        onChange={(event) => setSelectedDetailClassId(event.target.value)}
                      >
                        {rows.map((row) => (
                          <MenuItem key={row.id} value={row.id}>
                            {row.className} - {getStatusLabel(row.status)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {detailRow?.subjectSummaries?.length ? (
                  <ResponsiveTableWrapper minWidth={760}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Status</TableCell>
                          <TableCell>Subject</TableCell>
                          <TableCell align="right">Enrolled Students</TableCell>
                          <TableCell align="right">Marks Entered</TableCell>
                          <TableCell align="right">Missing</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailRow.subjectSummaries.map((subject) => (
                          <TableRow key={subject.subjectKey} hover>
                            <TableCell>
                              <Chip
                                label={getStatusLabel(subject.status)}
                                color={getStatusColor(subject.status)}
                                size="small"
                                sx={{ fontWeight: 800 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {subject.subjectName}
                              </Typography>
                              {subject.subjectNumber || subject.subjectId ? (
                                <Typography variant="caption" color="text.secondary">
                                  {[subject.subjectNumber, subject.subjectId].filter(Boolean).join(" | ")}
                                </Typography>
                              ) : null}
                            </TableCell>
                            <TableCell align="right">{subject.enrolledCount}</TableCell>
                            <TableCell align="right">{subject.enteredCount}</TableCell>
                            <TableCell align="right">{subject.missingCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableWrapper>
                ) : (
                  <Alert severity="warning">
                    No enrolled subjects found for {detailRow?.className || "this class"}.
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                  <AssessmentRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Class Status
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Green means all enrolled subject marks are entered. Yellow means some subject marks or identity details are missing. Red means students or subject enrollments are missing.
                    </Typography>
                  </Box>
                </Stack>

                <ResponsiveTableWrapper minWidth={1420}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Class</TableCell>
                        <TableCell align="right">Uploaded Students</TableCell>
                        <TableCell align="right">Subjects</TableCell>
                        <TableCell align="right">Done</TableCell>
                        <TableCell align="right">Partial</TableCell>
                        <TableCell align="right">Pending</TableCell>
                        <TableCell align="right">Expected Marks</TableCell>
                        <TableCell align="right">Entered Marks</TableCell>
                        <TableCell align="right">Mark Records</TableCell>
                        <TableCell align="right">Missing Marks</TableCell>
                        <TableCell align="right">Missing Admission No</TableCell>
                        <TableCell align="right">Missing Student ID</TableCell>
                        <TableCell>Pending Subjects</TableCell>
                        <TableCell>Action Needed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(row.status)}
                              color={getStatusColor(row.status)}
                              size="small"
                              sx={{ fontWeight: 800 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {row.className}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Grade {row.grade}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{row.studentCount}</TableCell>
                          <TableCell align="right">{row.subjectCount}</TableCell>
                          <TableCell align="right">{row.completedSubjectCount}</TableCell>
                          <TableCell align="right">{row.partialSubjectCount}</TableCell>
                          <TableCell align="right">{row.pendingSubjectCount}</TableCell>
                          <TableCell align="right">{row.expectedMarkCount}</TableCell>
                          <TableCell align="right">{row.enteredMarkCount}</TableCell>
                          <TableCell align="right">{row.marksCount}</TableCell>
                          <TableCell align="right">{row.missingMarksCount}</TableCell>
                          <TableCell align="right">{row.missingAdmissionCount}</TableCell>
                          <TableCell align="right">{row.missingStudentIdCount}</TableCell>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Typography variant="body2">
                              {formatPendingSubjects(row) || "None"}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 360 }}>
                            <Typography variant="body2">
                              {row.notes || "Fully done"}
                            </Typography>
                            {row.missingIdentityNames ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                Identity: {row.missingIdentityNames}
                              </Typography>
                            ) : null}
                            {row.missingMarksNames ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                No marks: {row.missingMarksNames}
                              </Typography>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableWrapper>

                {filteredRows.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No classes match this filter.
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Box>
  );
}
