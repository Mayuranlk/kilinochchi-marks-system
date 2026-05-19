import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
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

function buildClassCompletionRows({ classrooms, students, marks, year, termName }) {
  return classrooms.map((classroom) => {
    const grade = Number(classroom.grade);
    const className = getClassroomReportName(classroom);
    const section = classroom.section;
    const stream = classroom.stream || "";
    const reportContext = { grade, section, className, stream };

    const classStudents = filterStudentsForClass(students, grade, section, className, stream);
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

    const missingAdmissionStudents = classStudents.filter((student) => !getAdmissionNo(student));
    const missingStudentIdStudents = classStudents.filter((student) => !getStudentSystemId(student));
    const missingMarksStudents = classStudents.filter(
      (student) => !markedStudentIds.has(normalizeText(student.id))
    );

    const hasStudents = classStudents.length > 0;
    const allStudentsHaveMarks = hasStudents && missingMarksStudents.length === 0;
    const identitiesComplete =
      hasStudents &&
      missingAdmissionStudents.length === 0 &&
      missingStudentIdStudents.length === 0;

    let status = "missing";
    if (hasStudents && allStudentsHaveMarks && identitiesComplete) {
      status = "done";
    } else if (hasStudents) {
      status = "partial";
    }

    return {
      id: classroom.id,
      grade,
      className: getClassroomDisplayName(classroom),
      studentCount: classStudents.length,
      markedStudentCount: markedStudentIds.size,
      marksCount: classMarks.length,
      missingMarksCount: missingMarksStudents.length,
      missingAdmissionCount: missingAdmissionStudents.length,
      missingStudentIdCount: missingStudentIdStudents.length,
      status,
      notes: [
        !hasStudents ? "No students uploaded" : "",
        hasStudents && !allStudentsHaveMarks ? `${missingMarksStudents.length} students without marks` : "",
        missingAdmissionStudents.length ? `${missingAdmissionStudents.length} missing Admission No` : "",
        missingStudentIdStudents.length ? `${missingStudentIdStudents.length} missing Student ID` : "",
      ]
        .filter(Boolean)
        .join("; "),
      missingMarksNames: buildMissingNames(
        classStudents,
        (student) => !markedStudentIds.has(normalizeText(student.id))
      ),
      missingIdentityNames: buildMissingNames(
        classStudents,
        (student) => !getAdmissionNo(student) || !getStudentSystemId(student)
      ),
    };
  });
}

function exportRows(rows, { year, termName }) {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Status: getStatusLabel(row.status),
      Grade: row.grade,
      Class: row.className,
      "Uploaded Students": row.studentCount,
      "Students With Marks": row.markedStudentCount,
      "Mark Records": row.marksCount,
      "Students Without Marks": row.missingMarksCount,
      "Missing Admission No": row.missingAdmissionCount,
      "Missing Student ID": row.missingStudentIdCount,
      Notes: row.notes || "Fully done",
      "Students Without Marks Names": row.missingMarksNames,
      "Missing Identity Names": row.missingIdentityNames,
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Class Completion");
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

  autoTable(doc, {
    startY: 34,
    head: [[
      "Status",
      "Class",
      "Uploaded",
      "With Marks",
      "Mark Records",
      "No Marks",
      "Missing Adm No",
      "Missing Student ID",
      "Action Needed",
    ]],
    body: rows.map((row) => [
      getStatusLabel(row.status),
      row.className,
      row.studentCount,
      row.markedStudentCount,
      row.marksCount,
      row.missingMarksCount,
      row.missingAdmissionCount,
      row.missingStudentIdCount,
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
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 21, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 25, halign: "right" },
      8: { cellWidth: 99 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
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
  const { isSectionalHead, assignedGrades } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedTerm, setSelectedTerm] = useState(DEFAULT_TERM);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [studentsSnap, marksSnap, classroomsSnap, termsSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "marks")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "academicTerms")),
      ]);

      const studentsData = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const marksData = marksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const classroomsData = classroomsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const termsData = termsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setStudents(studentsData);
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
        marks,
        year: selectedYear,
        termName: selectedTerm,
      }),
    [marks, reportClassrooms, selectedTerm, selectedYear, students]
  );

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const summary = useMemo(
    () => ({
      done: rows.filter((row) => row.status === "done").length,
      partial: rows.filter((row) => row.status === "partial").length,
      missing: rows.filter((row) => row.status === "missing").length,
      total: rows.length,
    }),
    [rows]
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
                    onClick={() => exportRows(filteredRows, { year: selectedYear, termName: selectedTerm })}
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
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                  <AssessmentRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Class Status
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Green means everything is complete. Yellow means some data is missing. Red means students are not uploaded.
                    </Typography>
                  </Box>
                </Stack>

                <ResponsiveTableWrapper minWidth={1120}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Class</TableCell>
                        <TableCell align="right">Uploaded Students</TableCell>
                        <TableCell align="right">Students With Marks</TableCell>
                        <TableCell align="right">Mark Records</TableCell>
                        <TableCell align="right">No Marks</TableCell>
                        <TableCell align="right">Missing Admission No</TableCell>
                        <TableCell align="right">Missing Student ID</TableCell>
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
                          <TableCell align="right">{row.markedStudentCount}</TableCell>
                          <TableCell align="right">{row.marksCount}</TableCell>
                          <TableCell align="right">{row.missingMarksCount}</TableCell>
                          <TableCell align="right">{row.missingAdmissionCount}</TableCell>
                          <TableCell align="right">{row.missingStudentIdCount}</TableCell>
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
