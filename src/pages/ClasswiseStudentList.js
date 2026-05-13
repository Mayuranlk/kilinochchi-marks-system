import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { isALGrade } from "../constants";
import { PageContainer, ResponsiveTableWrapper, StatCard } from "../components/ui";

const CURRENT_YEAR = new Date().getFullYear();
const PURPOSE_OPTIONS = [
  "Parents Meeting Signature",
  "Custom Purpose",
];
const REPORT_MODES = {
  classList: "classList",
  uploadStatus: "uploadStatus",
};

function text(value) {
  return String(value || "").trim();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = text(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function normalizeStatus(value) {
  return text(value || "Active").toLowerCase();
}

function getStudentName(student = {}) {
  return text(student.fullName || student.name || "Unnamed Student");
}

function getAdmissionNo(student = {}) {
  return text(student.admissionNo || student.indexNo || "");
}

function getTelephoneNumber(student = {}) {
  return text(
    student.telephone ||
      student.phone ||
      student.mobile ||
      student.contactNo ||
      student.contactNumber ||
      student.parentPhone ||
      student.guardianPhone ||
      ""
  );
}

function getClassDisplayName(classroom = {}) {
  if (isALGrade(classroom.grade)) {
    return (
      text(classroom.fullClassName) ||
      text(classroom.alClassName) ||
      text(classroom.displayClassName) ||
      text(classroom.className) ||
      `${classroom.grade}${classroom.section}`
    );
  }

  return text(classroom.className || classroom.fullClassName) || `${classroom.grade}${classroom.section}`;
}

function getClassYear(classroom = {}) {
  return Number(classroom.year || classroom.academicYear || CURRENT_YEAR);
}

function getClassTeacherName(classroom = {}) {
  return text(
    classroom.classTeacherName ||
      classroom.teacherName ||
      classroom.classTeacher ||
      classroom.assignedTeacherName ||
      ""
  );
}

function getEmisStudentId(student = {}) {
  return text(student.emisStudentId || student.emisId || student.externalStudentId || "");
}

function hasEmisStudentId(student = {}) {
  return Boolean(getEmisStudentId(student));
}

function getClassMatchKeyFromClassroom(classroom = {}) {
  const grade = parseGrade(classroom.grade);
  const section = normalizeSection(classroom.section || classroom.className);
  const stream = text(classroom.stream);
  return isALGrade(grade) ? `${grade}__${section}__${stream}` : `${grade}__${section}`;
}

function getClassMatchKeyFromStudent(student = {}) {
  const grade = parseGrade(student.grade);
  const section = normalizeSection(student.section || student.className);
  const stream = text(student.stream);
  return isALGrade(grade) ? `${grade}__${section}__${stream}` : `${grade}__${section}`;
}

function sortStudents(list = []) {
  return [...list].sort((a, b) => {
    const admissionA = getAdmissionNo(a);
    const admissionB = getAdmissionNo(b);
    if (admissionA || admissionB) {
      const admissionCompare = admissionA.localeCompare(admissionB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (admissionCompare !== 0) return admissionCompare;
    }

    return getStudentName(a).localeCompare(getStudentName(b), undefined, {
      sensitivity: "base",
    });
  });
}

function makeSafeFileName(value) {
  return text(value).replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStatusPdfFillColor(status) {
  if (status === "Completed") return [200, 230, 201];
  if (status === "Partial") return [255, 249, 196];
  return [255, 205, 210];
}

function makeUploadStatusFileName(year) {
  return `student_upload_status_${year}.pdf`;
}

export default function ClasswiseStudentList() {
  const { isSectionalHead, assignedGrades } = useAuth();
  const printRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [reportMode, setReportMode] = useState(REPORT_MODES.classList);
  const [purpose, setPurpose] = useState(PURPOSE_OPTIONS[0]);
  const [customPurpose, setCustomPurpose] = useState("");

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === selectedClassId) || null,
    [classrooms, selectedClassId]
  );

  const availableYears = useMemo(() => {
    const years = new Set(
      classrooms.map((item) => getClassYear(item)).filter(Boolean)
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    const assignedGradeSet = new Set((assignedGrades || []).map(Number));
    return classrooms
      .filter(
        (item) =>
          getClassYear(item) === Number(selectedYear) &&
          (!isSectionalHead || assignedGradeSet.has(parseGrade(item.grade)))
      )
      .sort((a, b) => {
        const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
        if (gradeDiff !== 0) return gradeDiff;
        return getClassDisplayName(a).localeCompare(getClassDisplayName(b), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [classrooms, selectedYear, isSectionalHead, assignedGrades]);

  const selectedPurpose = purpose === "Custom Purpose" ? customPurpose : purpose;

  const classStudents = useMemo(() => {
    if (!selectedClassroom) return [];

    const grade = parseGrade(selectedClassroom.grade);
    const section = normalizeSection(selectedClassroom.section || selectedClassroom.className);
    const stream = text(selectedClassroom.stream);

    return sortStudents(
      students.filter((student) => {
        const sameGrade = parseGrade(student.grade) === grade;
        const sameSection = normalizeSection(student.section || student.className) === section;
        const sameStream = !isALGrade(grade) || text(student.stream) === stream;
        const isActive = normalizeStatus(student.status) === "active";
        return sameGrade && sameSection && sameStream && isActive;
      })
    );
  }, [students, selectedClassroom]);

  const classStudentCounts = useMemo(() => {
    const counts = new Map();

    students.forEach((student) => {
      if (normalizeStatus(student.status) !== "active") return;
      const key = getClassMatchKeyFromStudent(student);
      const current = counts.get(key) || { total: 0, emisAvailable: 0 };
      current.total += 1;
      if (hasEmisStudentId(student)) current.emisAvailable += 1;
      counts.set(key, current);
    });

    return counts;
  }, [students]);

  const uploadStatusRows = useMemo(() => {
    return filteredClassrooms.map((classroom) => {
      const key = getClassMatchKeyFromClassroom(classroom);
      const counts = classStudentCounts.get(key) || { total: 0, emisAvailable: 0 };
      const studentCount = counts.total;
      const emisAvailableCount = counts.emisAvailable;
      const classTeacherName = getClassTeacherName(classroom);
      const isComplete = studentCount > 0 && emisAvailableCount === studentCount && Boolean(classTeacherName);
      const isPartial = studentCount > 0 && !isComplete;

      return {
        id: classroom.id,
        className: getClassDisplayName(classroom),
        grade: parseGrade(classroom.grade),
        section: normalizeSection(classroom.section || classroom.className),
        stream: text(classroom.stream),
        classTeacherName,
        studentCount,
        emisAvailableCount,
        emisMissingCount: Math.max(studentCount - emisAvailableCount, 0),
        classTeacherAvailable: Boolean(classTeacherName),
        status: isComplete ? "Completed" : isPartial ? "Partial" : "Not Uploaded",
        statusColor: isComplete ? "#c8e6c9" : isPartial ? "#fff9c4" : "#ffcdd2",
        uploaded: studentCount > 0,
      };
    });
  }, [filteredClassrooms, classStudentCounts]);

  const uploadedClassCount = uploadStatusRows.filter((row) => row.uploaded).length;
  const completedClassCount = uploadStatusRows.filter((row) => row.status === "Completed").length;
  const partialClassCount = uploadStatusRows.filter((row) => row.status === "Partial").length;
  const missingClassCount = uploadStatusRows.length - uploadedClassCount;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (filteredClassrooms.length > 0 && !filteredClassrooms.some((item) => item.id === selectedClassId)) {
      setSelectedClassId(filteredClassrooms[0].id);
    }
  }, [filteredClassrooms, selectedClassId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [studentSnap, classroomSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classrooms")),
      ]);

      const loadedStudents = studentSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      const loadedClassrooms = classroomSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setStudents(loadedStudents);
      setClassrooms(loadedClassrooms);

      const defaultYear =
        loadedClassrooms.some((item) => getClassYear(item) === CURRENT_YEAR)
          ? CURRENT_YEAR
          : getClassYear(loadedClassrooms[0] || {});

      if (defaultYear) {
        setSelectedYear(defaultYear);
      }

      const assignedGradeSet = new Set((assignedGrades || []).map(Number));
      const firstClass = loadedClassrooms
        .filter(
          (item) =>
            getClassYear(item) === (defaultYear || CURRENT_YEAR) &&
            (!isSectionalHead || assignedGradeSet.has(parseGrade(item.grade)))
        )
        .sort((a, b) => {
          const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
          if (gradeDiff !== 0) return gradeDiff;
          return getClassDisplayName(a).localeCompare(getClassDisplayName(b), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        })[0];

      if (firstClass) {
        setSelectedClassId(firstClass.id);
      }
    } catch (err) {
      console.error("Failed to load classwise student list:", err);
      setError(err.message || "Failed to load classwise student list.");
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    if (reportMode === REPORT_MODES.uploadStatus) {
      exportUploadStatusExcel();
      return;
    }

    if (!selectedClassroom) return;

    const headingRows = [
      ["Kilinochchi Central College"],
      [selectedPurpose || "Classwise Student List"],
      [`Class: ${getClassDisplayName(selectedClassroom)}`, `Year: ${selectedYear}`],
      [],
    ];

    const rows = classStudents.map((student, index) => [
      index + 1,
      getAdmissionNo(student),
      getStudentName(student),
      text(student.gender),
      getTelephoneNumber(student),
      "",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([
      ...headingRows,
      ["No", "Admission No", "Student Name", "Gender", "Telephone Number", "Signature"],
      ...rows,
    ]);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 34 },
      { wch: 12 },
      { wch: 20 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Class List");
    const fileName = `${makeSafeFileName(getClassDisplayName(selectedClassroom))}_${makeSafeFileName(selectedPurpose || "class_list")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  function exportUploadStatusExcel() {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Kilinochchi Central College"],
      ["Student Details Upload Status Report"],
      [`Year: ${selectedYear}`],
      [],
      ["No", "Class", "Class Teacher", "Active Students", "EMIS ID Available", "EMIS ID Missing", "Status", "Instruction"],
      ...uploadStatusRows.map((row, index) => [
        index + 1,
        row.className,
        row.classTeacherName || "Not Provided",
        row.studentCount,
        row.emisAvailableCount,
        row.emisMissingCount,
        row.status,
        row.status === "Completed" ? "" : "Ask class teacher to complete student details and EMIS IDs",
      ]),
    ]);

    uploadStatusRows.forEach((row, index) => {
      const excelRow = index + 6;
      const fillColor =
        row.status === "Completed" ? "C8E6C9" : row.status === "Partial" ? "FFF9C4" : "FFCDD2";

      ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((column) => {
        const cell = worksheet[`${column}${excelRow}`];
        if (!cell) return;
        cell.s = {
          ...(cell.s || {}),
          fill: { fgColor: { rgb: fillColor } },
        };
      });
    });

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 40 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Upload Status");
    XLSX.writeFile(workbook, `student_upload_status_${selectedYear}.xlsx`);
  }

  function createUploadStatusPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Kilinochchi Central College", 148.5, 12, { align: "center" });
    doc.setFontSize(11);
    doc.text("Student Details Upload Status Report", 148.5, 19, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Year: ${selectedYear}`, 10, 28);
    doc.text(`Classes: ${uploadStatusRows.length}`, 82, 28);
    doc.text(`Completed: ${completedClassCount}`, 154, 28);
    doc.text(`Partial: ${partialClassCount}`, 210, 28);
    doc.text(`Not Uploaded: ${missingClassCount}`, 252, 28);

    autoTable(doc, {
      startY: 34,
      head: [[
        "No",
        "Class",
        "Class Teacher",
        "Active Students",
        "EMIS ID Available",
        "EMIS ID Missing",
        "Status",
        "Instruction",
      ]],
      body: uploadStatusRows.map((row, index) => [
        index + 1,
        row.className,
        row.classTeacherName || "Not Provided",
        row.studentCount,
        row.emisAvailableCount,
        row.emisMissingCount,
        row.status,
        row.status === "Completed" ? "" : "Ask class teacher to complete student details and EMIS IDs",
      ]),
      theme: "grid",
      styles: {
        fontSize: 7.4,
        cellPadding: 1.2,
        valign: "middle",
        lineWidth: 0.12,
        lineColor: [60, 60, 60],
        textColor: 20,
      },
      headStyles: {
        fillColor: [235, 239, 245],
        textColor: 20,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 9, halign: "center" },
        1: { cellWidth: 38, fontStyle: "bold" },
        2: { cellWidth: 42 },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 22, fontStyle: "bold" },
        7: { cellWidth: 88 },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const row = uploadStatusRows[data.row.index];
        if (!row) return;
        data.cell.styles.fillColor = getStatusPdfFillColor(row.status);
      },
      margin: { left: 8, right: 8 },
    });

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

  function downloadUploadStatusPdf() {
    const doc = createUploadStatusPdf();
    doc.save(makeUploadStatusFileName(selectedYear));
  }

  async function shareUploadStatusPdf() {
    try {
      const doc = createUploadStatusPdf();
      const blob = doc.output("blob");
      const file = new File([blob], makeUploadStatusFileName(selectedYear), {
        type: "application/pdf",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          title: "Student Details Upload Status Report",
          text: `Student details upload status report - ${selectedYear}`,
          files: [file],
        });
        return;
      }

      saveAs(blob, makeUploadStatusFileName(selectedYear));
      setError("This browser cannot attach the PDF directly to WhatsApp. The PDF was downloaded; attach it in WhatsApp manually.");
    } catch (err) {
      setError(err.message || "Failed to share upload status PDF.");
    }
  }

  function printList() {
    if (!printRef.current) return;
    if (reportMode === REPORT_MODES.classList && !selectedClassroom) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title =
      reportMode === REPORT_MODES.uploadStatus
        ? "Student Details Upload Status Report"
        : selectedPurpose || "Classwise Student List";

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #000; padding: 18px; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
            h2 { font-size: 15px; text-align: center; margin: 0 0 12px; font-weight: 600; }
            .meta { display: flex; justify-content: space-between; margin: 12px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #333; padding: 7px 6px; }
            th { background: #f2f2f2; }
            .status-completed td { background: #c8e6c9; }
            .status-partial td { background: #fff9c4; }
            .status-empty td { background: #ffcdd2; }
            .signature { height: 28px; }
            .footer { display: flex; justify-content: space-between; margin-top: 32px; font-size: 12px; }
            @page { size: A4 portrait; margin: 12mm; }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <PageContainer
      title="Classwise Student List"
      subtitle="Print or export class lists for meetings, distribution, and signatures."
    >
      <Stack spacing={2.5}>
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Report</InputLabel>
                  <Select
                    value={reportMode}
                    label="Report"
                    onChange={(event) => setReportMode(event.target.value)}
                  >
                    <MenuItem value={REPORT_MODES.classList}>Class List</MenuItem>
                    <MenuItem value={REPORT_MODES.uploadStatus}>Upload Status</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Year"
                    onChange={(event) => {
                      setSelectedYear(Number(event.target.value));
                      setSelectedClassId("");
                    }}
                  >
                    {availableYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={selectedClassId}
                    label="Class"
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    disabled={reportMode === REPORT_MODES.uploadStatus}
                  >
                    {filteredClassrooms.map((classroom) => (
                      <MenuItem key={classroom.id} value={classroom.id}>
                        {getClassDisplayName(classroom)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Purpose</InputLabel>
                  <Select
                    value={purpose}
                    label="Purpose"
                    onChange={(event) => setPurpose(event.target.value)}
                    disabled={reportMode === REPORT_MODES.uploadStatus}
                  >
                    {PURPOSE_OPTIONS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Custom Purpose"
                  value={customPurpose}
                  onChange={(event) => setCustomPurpose(event.target.value)}
                  disabled={reportMode === REPORT_MODES.uploadStatus || purpose !== "Custom Purpose"}
                />
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadData}
                disabled={loading}
              >
                Reload
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={printList}
                disabled={
                  reportMode === REPORT_MODES.uploadStatus
                    ? uploadStatusRows.length === 0
                    : !selectedClassroom || classStudents.length === 0
                }
              >
                {reportMode === REPORT_MODES.uploadStatus ? "Print Report" : "Print List"}
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<DownloadIcon />}
                onClick={exportExcel}
                disabled={
                  reportMode === REPORT_MODES.uploadStatus
                    ? uploadStatusRows.length === 0
                    : !selectedClassroom || classStudents.length === 0
                }
              >
                Export Excel
              </Button>
              {reportMode === REPORT_MODES.uploadStatus && (
                <>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={downloadUploadStatusPdf}
                    disabled={uploadStatusRows.length === 0}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<WhatsAppIcon />}
                    onClick={shareUploadStatusPdf}
                    disabled={uploadStatusRows.length === 0}
                  >
                    WhatsApp
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!!error && <Alert severity="error">{error}</Alert>}

        {!loading && reportMode === REPORT_MODES.uploadStatus && (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <StatCard title="Classes" value={uploadStatusRows.length} />
              </Grid>
              <Grid item xs={12} md={4}>
                <StatCard title="Completed" value={completedClassCount} color="success" />
              </Grid>
              <Grid item xs={12} md={4}>
                <StatCard title="Partial / Empty" value={`${partialClassCount} / ${missingClassCount}`} color="warning" />
              </Grid>
            </Grid>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box ref={printRef}>
                  <Typography variant="h6" align="center" fontWeight={800}>
                    Kilinochchi Central College
                  </Typography>
                  <Typography variant="subtitle1" align="center" sx={{ mb: 1 }}>
                    Student Details Upload Status Report
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="body2">Year: {selectedYear}</Typography>
                    <Typography variant="body2">Classes: {uploadStatusRows.length}</Typography>
                    <Typography variant="body2">Completed: {completedClassCount}</Typography>
                  </Stack>

                  <ResponsiveTableWrapper>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell align="center">No</TableCell>
                          <TableCell>Class</TableCell>
                          <TableCell>Class Teacher</TableCell>
                          <TableCell align="right">Active Students</TableCell>
                          <TableCell align="right">EMIS ID Available</TableCell>
                          <TableCell align="right">EMIS ID Missing</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Instruction</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadStatusRows.map((row, index) => (
                          <TableRow
                            key={row.id}
                            hover
                            className={
                              row.status === "Completed"
                                ? "status-completed"
                                : row.status === "Partial"
                                ? "status-partial"
                                : "status-empty"
                            }
                            sx={{ backgroundColor: row.statusColor }}
                          >
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell>{row.className}</TableCell>
                            <TableCell>{row.classTeacherName || "Not Provided"}</TableCell>
                            <TableCell align="right">{row.studentCount}</TableCell>
                            <TableCell align="right">{row.emisAvailableCount}</TableCell>
                            <TableCell align="right">{row.emisMissingCount}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell>
                              {row.status === "Completed" ? "" : "Ask class teacher to complete student details and EMIS IDs"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableWrapper>

                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
                    <Typography variant="body2">Prepared By</Typography>
                    <Typography variant="body2">Sectional Head</Typography>
                    <Typography variant="body2">Principal</Typography>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && reportMode === REPORT_MODES.classList && selectedClassroom && (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <StatCard title="Class" value={getClassDisplayName(selectedClassroom)} />
              </Grid>
              <Grid item xs={12} md={4}>
                <StatCard title="Active Students" value={classStudents.length} color="success" />
              </Grid>
              <Grid item xs={12} md={4}>
                <StatCard title="Purpose" value={selectedPurpose || "Class List"} color="warning" />
              </Grid>
            </Grid>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box ref={printRef}>
                  <Typography variant="h6" align="center" fontWeight={800}>
                    Kilinochchi Central College
                  </Typography>
                  <Typography variant="subtitle1" align="center" sx={{ mb: 1 }}>
                    {selectedPurpose || "Classwise Student List"}
                  </Typography>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 1.5 }}
                  >
                    <Typography variant="body2">
                      Class: {getClassDisplayName(selectedClassroom)}
                    </Typography>
                    <Typography variant="body2">Year: {selectedYear}</Typography>
                    <Typography variant="body2">Students: {classStudents.length}</Typography>
                  </Stack>

                  <ResponsiveTableWrapper>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell align="center">No</TableCell>
                          <TableCell>Admission No</TableCell>
                          <TableCell>Student Name</TableCell>
                          <TableCell>Gender</TableCell>
                          <TableCell>Telephone Number</TableCell>
                          <TableCell>Signature</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {classStudents.map((student, index) => (
                          <TableRow key={student.id}>
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell>{getAdmissionNo(student)}</TableCell>
                            <TableCell>{getStudentName(student)}</TableCell>
                            <TableCell>{text(student.gender)}</TableCell>
                            <TableCell>{getTelephoneNumber(student)}</TableCell>
                            <TableCell sx={{ minWidth: 150, height: 42 }} />
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableWrapper>

                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
                    <Typography variant="body2">Class Teacher</Typography>
                    <Typography variant="body2">Sectional Head</Typography>
                    <Typography variant="body2">Principal</Typography>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && reportMode === REPORT_MODES.classList && selectedClassroom && classStudents.length === 0 && (
          <Alert severity="info">No active students found for the selected class.</Alert>
        )}

        {!loading && reportMode === REPORT_MODES.uploadStatus && uploadStatusRows.length === 0 && (
          <Alert severity="info">No classrooms found for the selected year.</Alert>
        )}
      </Stack>
    </PageContainer>
  );
}
