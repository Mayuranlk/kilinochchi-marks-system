import React, { useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { db } from "../firebase";
import { getCollectionRows } from "../services/firestoreReadCache";
import { PageContainer } from "../components/ui";

import { academicYear, classroomsForYear, matchesRegisterClass, monthDays, displayMonth, text, isActive } from "../utils/registerContext";
import { getStudentDisplayName } from "../utils/reportMappingUtils";

const SCHOOL_NAME = "KN/Kilinochchi Central College";

const studentName = (student) => getStudentDisplayName(student) || "Unnamed Student";
const studentId = (student) => text(student.id);

function fileName(classroom, year, month) {
  return `Attendance_${text(classroom.className || `${classroom.grade}${classroom.section}`)}_${year}-${String(month).padStart(2, "0")}.pdf`;
}

function buildShareText(classroom, year, month, studentCount) {
  return `${SCHOOL_NAME}\nAttendance Register\nClass ${text(classroom.className)} - ${displayMonth(year, month)}\n${studentCount} students`;
}

export default function AttendanceRegister() {
  const currentDate = new Date();
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [studentRows, classroomRows] = await Promise.all([
          getCollectionRows(db, "students"),
          getCollectionRows(db, "classrooms"),
        ]);
        if (cancelled) return;
        setStudents(studentRows.filter(isActive));
        setClassrooms(classroomRows);
      } catch (error) {
        if (!cancelled) setMessage({ type: "error", text: `Failed to load classes and students: ${error.message}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const availableClassrooms = useMemo(() => classroomsForYear(classrooms, selectedYear), [classrooms, selectedYear]);
  const availableYears = useMemo(() => [...new Set([String(new Date().getFullYear()), selectedYear, ...classrooms.map(academicYear).filter(Boolean)])].sort(), [classrooms, selectedYear]);
  useEffect(() => {
    if (!availableClassrooms.some((room) => room.id === selectedClassId)) setSelectedClassId(availableClassrooms[0]?.id || "");
  }, [availableClassrooms, selectedClassId]);
  const selectedClassroom = useMemo(
    () => availableClassrooms.find((classroom) => classroom.id === selectedClassId) || null,
    [availableClassrooms, selectedClassId]
  );
  const days = useMemo(() => monthDays(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const classStudents = useMemo(
    () => students.filter((student) => selectedClassroom && matchesRegisterClass(student, selectedClassroom, selectedYear)).sort((a, b) => studentName(a).localeCompare(studentName(b))),
    [students, selectedClassroom, selectedYear]
  );

  function createPdf() {
    const pdf = new jsPDF("l", "mm", "a4");
    const header = `${SCHOOL_NAME} - Attendance Register`;
    const subtitle = `Class ${selectedClassroom.className} - ${displayMonth(selectedYear, selectedMonth)}`;
    autoTable(pdf, {
      startY: 19,
      head: [["No", "Student Name", ...days.map((day) => day.label)]],
      body: classStudents.map((student, index) => [
        index + 1,
        studentName(student),
        ...days.map(() => ""),
      ]),
      theme: "grid",
      styles: { fontSize: 5.2, cellPadding: 1, minCellHeight: 6, textColor: [0, 0, 0], lineColor: [100, 100, 100], lineWidth: 0.1, halign: "center" },
      headStyles: { fillColor: [232, 240, 245], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 54, halign: "left" } },
      margin: { left: 10, right: 10, top: 19, bottom: 14 },
      rowPageBreak: "avoid",
      willDrawPage: () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(header, 10, 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(subtitle, 10, 15);
      },
      didDrawPage: (data) => {
        pdf.setFontSize(7);
        pdf.text(`P = Present   A = Absent   L = Leave`, 10, pdf.internal.pageSize.getHeight() - 7);
        pdf.text(`Page ${data.pageNumber}`, pdf.internal.pageSize.getWidth() - 25, pdf.internal.pageSize.getHeight() - 7);
      },
    });
    return pdf;
  }

  async function handleExport(share = false) {
    if (!selectedClassroom || !classStudents.length) {
      setMessage({ type: "warning", text: "Select a class with students before exporting." });
      return;
    }
    setExporting(true);
    try {
      const pdf = createPdf();
      const blob = pdf.output("blob");
      const name = fileName(selectedClassroom, selectedYear, selectedMonth);
      const file = new File([blob], name, { type: "application/pdf" });
      const shareText = buildShareText(selectedClassroom, selectedYear, selectedMonth, classStudents.length);
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Attendance Register", text: shareText, files: [file] });
      } else {
        saveAs(blob, name);
        if (share) window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n\nThe PDF has been downloaded. Please attach ${name} in WhatsApp.`)}`, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setMessage({ type: "error", text: `Export failed: ${error.message}` });
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <PageContainer title="Attendance Register"><CircularProgress /></PageContainer>;

  return (
    <PageContainer
      title="Attendance Register"
      subtitle="Select a class, year and month to download a blank attendance register for printing."

    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => handleExport(false)} disabled={exporting || !selectedClassroom || !classStudents.length}>{exporting ? "Preparing..." : "A4 PDF"}</Button>
        <Button variant="contained" startIcon={<ShareRoundedIcon />} onClick={() => handleExport(true)} disabled={exporting || !selectedClassroom || !classStudents.length}>WhatsApp Export</Button>
      </Stack>
        {message.text ? <Alert severity={message.type || "info"}>{message.text}</Alert> : null}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Class & Division</InputLabel>
                <Select disabled={exporting} value={selectedClassId} label="Class & Division" onChange={(event) => setSelectedClassId(event.target.value)}>
                  {availableClassrooms.map((classroom) => <MenuItem key={classroom.id} value={classroom.id}>{classroom.className}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select disabled={exporting} value={selectedYear} label="Year" onChange={(event) => setSelectedYear(event.target.value)}>
                  {availableYears.map((year) => <MenuItem key={year} value={String(year)}>{year}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select disabled={exporting} value={selectedMonth} label="Month" onChange={(event) => setSelectedMonth(event.target.value)}>
                  {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => <MenuItem key={month} value={month}>{new Date(2024, Number(month) - 1, 1).toLocaleString("en", { month: "long" })}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarMonthRoundedIcon color="primary" />
          <Typography variant="body2" color="text.secondary">Blank daily cells are provided for marking attendance by hand.</Typography>
          <Typography variant="body2" sx={{ ml: "auto", fontWeight: 700 }}>{classStudents.length} students</Typography>
        </Stack>
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
          <Table stickyHeader size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>
              <TableCell sx={{ minWidth: 55, fontWeight: 800 }}>No</TableCell>
              <TableCell sx={{ minWidth: 240, fontWeight: 800 }}>Student Name</TableCell>
              {days.map((day) => <TableCell key={day.date} align="center" sx={{ minWidth: 38, px: 0.5, fontWeight: 800 }}>{day.label}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {classStudents.map((student, index) => <TableRow key={studentId(student) || index} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{studentName(student)}</TableCell>
                {days.map((day) => <TableCell key={day.date} aria-label={`${studentName(student)}, ${day.date}: blank`} sx={{ px: 0.5, height: 36 }} />)}
              </TableRow>)}
              {!classStudents.length ? <TableRow><TableCell colSpan={days.length + 2}><Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>No active students found for this class and division.</Typography></TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </PageContainer>
  );
}