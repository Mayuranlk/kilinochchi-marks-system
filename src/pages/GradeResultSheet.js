import React, { useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Tooltip,
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
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { db } from "../firebase";
import { getCollectionRows } from "../services/firestoreReadCache";
import { PageContainer } from "../components/ui";
import { buildClassMarksReportData } from "../utils/classMarksReportBuilder";
import { flattenSchemaColumns } from "../utils/reportSchemas";
import { resultRows, RESULT_CATEGORIES, resultAnalytics, formatRate } from "../utils/gradeResultLogic";
import { academicYear, classroomsForYear, grade, section, text, isActive } from "../utils/registerContext";

import GradeResultAnalytics from "../components/GradeResultAnalytics";
import { createGradeResultPdf } from "../utils/gradeResultPdf";
import { RESULT_VIEWS, failedCoreSubjects, resultClassLabel, resultSlots, resultStatus, slotEntries, subjectLabel as columnLabel } from "../utils/gradeResultPresentation";

const SCHOOL_NAME = "KN/Kilinochchi Central College";

const className = (classroom) => classroom.className;
const termName = (term) => text(term.term || term.termName || term.name);

function StatusBadge({ row }) {
  const status = resultStatus(row);
  return <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: "auto", fontSize: 11, fontWeight: 700, borderRadius: 1.5, "& .MuiChip-label": { whiteSpace: "normal", py: 0.6 } }} />;
}

function SubjectResult({ row, slot }) {
  const entries = slotEntries(row, slot);
  if (!entries.length) return <Typography variant="caption" color="text.disabled">-</Typography>;
  return <Stack spacing={0.6} alignItems="center">{entries.map((entry) => (
    <Tooltip key={entry.key} title={`${entry.fullSubject}: ${entry.grade === "-" ? "No recorded grade" : entry.grade}`}>
      <Box sx={{ textAlign: "center" }}>
        {slot.elective && <Typography component="div" variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1.2, mb: 0.3 }}>{entry.subject}</Typography>}
        <Typography component="div" sx={{ fontWeight: 800, fontSize: 13, color: ["W", "AB"].includes(entry.grade) ? "error.main" : entry.grade === "A" ? "success.main" : "text.primary" }}>{entry.grade}{entry.mark !== undefined ? ` (${entry.mark})` : ""}</Typography>
      </Box>
    </Tooltip>
  ))}</Stack>;
}

function FollowUpList({ title, description, rows, grade, failure = false }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px !important", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2.5, py: 0.6 }}>
        <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={700} variant="body2">{title}</Typography><Chip size="small" label={rows.length} sx={{ height: 22, fontWeight: 700 }} /></Stack><Typography variant="caption" color="text.secondary">{description}</Typography></Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        <TableContainer sx={{ maxHeight: 340 }}>
          <Table size="small" stickyHeader aria-label={title}>
            <TableHead><TableRow><TableCell>Student</TableCell><TableCell>Class</TableCell>{failure && <TableCell>Below S</TableCell>}<TableCell>Results</TableCell></TableRow></TableHead>
            <TableBody>{rows.map((row) => <TableRow key={row.student.id}><TableCell sx={{ fontWeight: 600 }}>{row.studentName}</TableCell><TableCell>{resultClassLabel(row, grade)}</TableCell>{failure && <TableCell>{failedCoreSubjects(row)}</TableCell>}<TableCell sx={{ whiteSpace: "nowrap" }}>{row.summary}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={failure ? 4 : 3} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>No students in this group.</TableCell></TableRow>}</TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
}

export default function GradeResultSheet() {
  const presentationAbort = useRef(null);
  const [presentationProgress, setPresentationProgress] = useState("");
  useEffect(() => () => presentationAbort.current?.abort(), []);
  const currentYear = String(new Date().getFullYear());
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [studentRows, enrollmentRows, markRows, classroomRows, termRows] = await Promise.all([
          getCollectionRows(db, "students"),
          getCollectionRows(db, "studentSubjectEnrollments"),
          getCollectionRows(db, "marks"),
          getCollectionRows(db, "classrooms"),
          getCollectionRows(db, "academicTerms"),
        ]);
        if (cancelled) return;
        const activeTerm = termRows.find((item) => item.isActive === true) || termRows[0];
        setStudents(studentRows.filter(isActive));
        setEnrollments(enrollmentRows);
        // This report is for term examinations; practice marks must not overwrite them.
        setMarks(markRows.filter((item) =>
          text(item.assessmentType).toLowerCase() !== "practice" &&
          !item.practiceExamId && !item.assessmentId &&
          !item.practiceExamName && !item.assessmentName &&
          !text(item.assessmentKey).toLowerCase().startsWith("practice")
        ));
        setClassrooms(classroomRows);
        setTerms(termRows);
        if (activeTerm) {
          setSelectedYear(academicYear(activeTerm) || String(new Date().getFullYear()));
          setSelectedTerm(termName(activeTerm));
        }
      } catch (loadError) {
        if (!cancelled) setError(`Failed to load result data: ${loadError.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const availableClassrooms = useMemo(() => classroomsForYear(classrooms, selectedYear).filter((room) => [10, 11].includes(room.grade)), [classrooms, selectedYear]);
  const availableYears = useMemo(() => [...new Set([currentYear, selectedYear, ...terms.map(academicYear), ...classrooms.map(academicYear)].filter(Boolean))].sort(), [classrooms, currentYear, selectedYear, terms]);
  const availableGrades = useMemo(() => [...new Set(availableClassrooms.map((room) => room.grade))], [availableClassrooms]);
  const selectedClassroom = useMemo(() => availableClassrooms.find((item) => item.id === selectedClassId) || null, [availableClassrooms, selectedClassId]);
  const wholeGrade = selectedClassId.startsWith("whole:") ? Number(selectedClassId.split(":")[1]) : 0;
  const reportLabel = wholeGrade ? `Whole Grade ${wholeGrade}` : selectedClassroom ? className(selectedClassroom) : "";
  const availableTerms = useMemo(() => [...new Set(terms.filter((item) => academicYear(item) === selectedYear).map(termName).filter(Boolean))], [terms, selectedYear]);
  useEffect(() => {
    if (!availableTerms.includes(selectedTerm)) setSelectedTerm(availableTerms[0] || "");
  }, [availableTerms, selectedTerm]);
  useEffect(() => {
    if (!selectedClassroom && !availableGrades.includes(wholeGrade)) setSelectedClassId(availableClassrooms[0]?.id || "");
  }, [availableClassrooms, availableGrades, selectedClassroom, wholeGrade]);
  const reportResult = useMemo(() => {
    if ((!selectedClassroom && !wholeGrade) || !availableTerms.includes(selectedTerm)) return { data: null, error: "" };
    try {
      const targetClassrooms = wholeGrade
        ? availableClassrooms.filter((item) => grade(item.grade) === wholeGrade)
        : [selectedClassroom];
      const reports = targetClassrooms.map((classroom) => buildClassMarksReportData({
        students: students.filter((student) => !academicYear(student) || academicYear(student) === selectedYear),
        enrollments,
        marks,
        classrooms,
        grade: grade(classroom.grade),
        className: className(classroom),
        section: section(classroom.section),
        stream: classroom.stream || "",
        rejectDuplicateMarks: true,
        termName: selectedTerm,
        year: selectedYear,
      }));
      if (!reports.length) return { data: null, error: "" };
      return { error: "", data: {
        ...reports[0],
        className: reportLabel,
        rows: [...new Map(reports.flatMap((report) => report.rows).map((row) => [row.student.id, row])).values()],
      } };
    } catch (buildError) {
      return { data: null, error: buildError.message };
    }
  }, [availableClassrooms, availableTerms, classrooms, enrollments, marks, reportLabel, selectedClassroom, selectedTerm, selectedYear, students, wholeGrade]);
  const reportData = reportResult.data;

  const columns = useMemo(() => {
    if (!reportData) return [];
    const eligible = new Set(reportData.rows.flatMap((row) => row.reportEligibleColumnKeys || row.eligibleColumnKeys || []));
    return flattenSchemaColumns(reportData.schema).filter((column) => eligible.has(column.key));
  }, [reportData]);
  const allRows = useMemo(() => reportData ? resultRows(reportData, columns) : [], [columns, reportData]);
  const rows = useMemo(() => {
    if (resultFilter === "incomplete") return allRows.filter((row) => row.category.provisional);
    if (resultFilter !== "all") return allRows.filter((row) => row.category.id === resultFilter);
    return allRows;
  }, [allRows, resultFilter]);
  const summaryStats = useMemo(() => {
    const total = allRows.length;
    const count = (predicate) => allRows.filter(predicate).length;
    const stats = [
      ...RESULT_CATEGORIES.map((category) => ({ ...category, value: count((row) => row.category.id === category.id) })),
    ];
    return stats.map((item) => ({
      ...item,
      percentage: total ? ((item.value / total) * 100).toFixed(1) : "0.0",
    }));
  }, [allRows]);
  const tamilMathsFailureRows = useMemo(
    () => allRows.filter((row) => row.category.id === "core-risk"),
    [allRows]
  );
  const belowThreeCThreeSRows = useMemo(
    () => allRows.filter((row) => row.category.id === "threshold-risk"),
    [allRows]
  );

  const analytics = useMemo(() => resultAnalytics(allRows, columns), [allRows, columns]);

  const slots = useMemo(() => resultSlots(reportData?.schema), [reportData]);

  function createPdf() {
    return createGradeResultPdf({
      schoolName: SCHOOL_NAME, reportLabel, year: selectedYear, term: selectedTerm,
      resultFilter, schema: reportData.schema, grade: reportData.grade,
      analytics, rows, totalStudents: allRows.length, summaryStats,
      tamilMathsFailureRows, belowThreeCThreeSRows,
    });
  }

  function exportExcel() {
    if (!reportData || !rows.length) return;
    const worksheet = XLSX.utils.aoa_to_sheet([
      [SCHOOL_NAME],
      ["Grade Result Sheet"],
      [reportLabel, selectedTerm, selectedYear],
      ["Result view", resultFilter],
      [],
      ["No", "Class", "Student Name", ...columns.map(columnLabel), "Result Summary", "Category / Notes"],
      ...rows.map((row) => [row.rowNo, resultClassLabel(row, reportData.grade), row.studentName, ...columns.map((column) => row.category.id === "excellent" && row.grades[column.key] ? `${row.grades[column.key]} (${row.marksByColumn[column.key]})` : row.grades[column.key]), row.summary, resultStatus(row).label]),
    ]);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 30 },
      ...columns.map(() => ({ wch: 12 })),
      { wch: 18 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Grade Results");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Summary for all students in selected class/grade", allRows.length],
      ["Overall measure", "Number", "Percentage"],
      ...analytics.overview.map((item) => [item.label, item.count, formatRate(item.rate)]),
      ["Absent = at least one AB, counted once per student; overlaps other groups."],
      [], ["Category", "Number", "Percentage"],
      ...summaryStats.map((item) => [item.label, item.value, `${item.percentage}%`]),
    ]), "Summary");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Subject", "Enrolled", "Sat", "Passed", "Failed", "Absent", "Pending", "Pass rate"],
      ...analytics.subjects.map((subject) => [subject.label, subject.enrolled, subject.sat, subject.passed, subject.failed, subject.absent, subject.pending, formatRate(subject.rate)]),
      [], ["Pass rate = passed / sat; absent and pending results excluded from sat."],
      ["Categories 1-3", analytics.grouped, formatRate(analytics.groupedRate)],
      ["Verified A/L eligibility", analytics.verified, formatRate(analytics.verifiedRate)],
      ["4-8 A grades alone do not guarantee Tamil/Maths passes or six total passes."],
    ]), "Subject Pass Rates");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Grade_Result_${reportLabel.replace(/\s+/g, "_")}_${selectedTerm}_${selectedYear}.xlsx`);
  }

  async function exportSheet(share = false) {
    if (!reportData || !rows.length) return;
    setExporting(true);
    try {
      const pdf = createPdf();
      const blob = pdf.output("blob");
      const fileName = `Grade_Result_${reportLabel.replace(/\s+/g, "_")}_${selectedTerm}_${selectedYear}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      const message = `${SCHOOL_NAME}\nGrade Result Sheet\n${reportLabel} - ${selectedTerm} - ${selectedYear}`;
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Grade Result Sheet", text: message, files: [file] });
      } else {
        saveAs(blob, fileName);
        if (share) window.open(`https://wa.me/?text=${encodeURIComponent(`${message}\n\nPlease attach ${fileName} in WhatsApp.`)}`, "_blank", "noopener,noreferrer");
      }
    } catch (exportError) {
      if (exportError?.name !== "AbortError") setError(`Export failed: ${exportError.message}`);
    } finally {
      setExporting(false);
    }
  }

  async function exportPresentation(language) {
    if (exporting || !reportData || !allRows.length) return;
    const controller = new AbortController();
    presentationAbort.current = controller;
    setExporting(true);
    setError("");
    setPresentationProgress("Preparing presentation...");
    try {
      const { createGradeResultSlidePdf } = await import("../utils/gradeResultSlidePdf");
      const pdf = await createGradeResultSlidePdf({ rows: allRows, columns, grade: reportData.grade, reportLabel, term: selectedTerm, year: selectedYear, language }, {
        signal: controller.signal,
        onProgress: (page, total) => setPresentationProgress(`Preparing slide ${page} of ${total}...`),
      });
      if (!controller.signal.aborted) saveAs(pdf.output("blob"), `Parent_Presentation_${reportLabel.replace(/\s+/g, "_")}_${selectedTerm}_${selectedYear}_${language === "ta" ? "Tamil" : "English"}.pdf`);
    } catch (presentationError) {
      if (presentationError.name !== "AbortError") setError(`Presentation export failed: ${presentationError.message}`);
    } finally {
      presentationAbort.current = null;
      setPresentationProgress("");
      setExporting(false);
    }
  }

  if (loading) return <PageContainer title="Grade Result Sheet"><Stack direction="row" spacing={2} alignItems="center"><CircularProgress size={24} /><Typography color="text.secondary">Preparing results...</Typography></Stack></PageContainer>;

  return (
    <PageContainer title="Grade Result Sheet" subtitle="Term results, student achievement and A/L eligibility." actions={
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "auto auto auto" }, gap: 1 }}>
        <Button variant="outlined" onClick={exportExcel} disabled={!rows.length || exporting}>Excel</Button>
        <Button variant="outlined" startIcon={<ShareRoundedIcon />} onClick={() => exportSheet(true)} disabled={!rows.length || exporting}>Share PDF</Button>
        <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={() => exportSheet(false)} disabled={!rows.length || exporting} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, gridRow: { xs: 1, sm: "auto" } }}>{exporting ? "Preparing..." : "Download PDF"}</Button>
      </Box>
    }>
      <Stack spacing={2.5}>
        {(error || reportResult.error) && <Alert severity="error">{error || reportResult.error}</Alert>}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: "14px" }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <FormControl fullWidth size="small"><InputLabel id="result-class-label">Class / grade</InputLabel><Select labelId="result-class-label" value={selectedClassId} label="Class / grade" onChange={(event) => setSelectedClassId(event.target.value)}>
                {availableGrades.map((value) => <MenuItem key={value} value={`whole:${value}`}>Whole Grade {value}</MenuItem>)}
                {availableClassrooms.map((item) => <MenuItem key={item.id} value={item.id}>{className(item)}</MenuItem>)}
              </Select></FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 3, lg: 2 }}><FormControl fullWidth size="small"><InputLabel id="result-year-label">Year</InputLabel><Select labelId="result-year-label" value={selectedYear} label="Year" onChange={(event) => setSelectedYear(event.target.value)}>{availableYears.map((item) => <MenuItem key={item} value={String(item)}>{item}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, sm: 3, lg: 2 }}><FormControl fullWidth size="small"><InputLabel id="result-term-label">Term</InputLabel><Select labelId="result-term-label" value={selectedTerm} label="Term" onChange={(event) => setSelectedTerm(event.target.value)}>{availableTerms.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 12, lg: 5 }}><FormControl fullWidth size="small"><InputLabel id="result-view-label">Result view</InputLabel><Select labelId="result-view-label" value={resultFilter} label="Result view" onChange={(event) => setResultFilter(event.target.value)}>{Object.entries(RESULT_VIEWS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl></Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography fontWeight={800}>Parent meeting presentation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Widescreen PDF slides with all six categories, student names, divisions, subject marks, follow-up guidance and performance analysis. Includes the full selected class / grade, regardless of the result filter.</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="contained" startIcon={<DownloadRoundedIcon />} disabled={exporting || !allRows.length} onClick={() => exportPresentation("en")}>English presentation PDF</Button>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={exporting || !allRows.length} onClick={() => exportPresentation("ta")}>தமிழ் விளக்கக்காட்சி PDF</Button>
            {presentationProgress && <Button color="error" onClick={() => presentationAbort.current?.abort()}>Cancel</Button>}
          </Stack>
          {presentationProgress && <Typography role="status" aria-live="polite" sx={{ mt: 1 }}>{presentationProgress}</Typography>}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Tamil Unicode is rendered into the PDF pages for reliable display without installing fonts. Names remain as recorded; slide text is not selectable.</Typography>
        </Paper>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5, gap: 1, flexWrap: "wrap" }}>
            <Box><Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.4 }}>RESULT OVERVIEW</Typography><Typography variant="caption" color="text.secondary">Six exclusive categories include every student once, with 9A students first. Pending results are provisional.</Typography><Typography variant="h6" fontWeight={800}>{reportLabel || "Select a class"}<Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}> / {selectedTerm || "Select a term"} / {selectedYear}</Box></Typography></Box>
            <Chip variant="outlined" label={`${allRows.length} students`} sx={{ fontWeight: 700 }} />
          </Stack>
          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            {analytics.overview.map((item) => <Grid size={{ xs: 6, md: 4, xl: 2 }} key={item.label}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 3, height: "100%" }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: `${item.color}.main`, fontVariantNumeric: "tabular-nums", my: 1 }}>{item.count.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">{formatRate(item.rate)} of {analytics.total} students</Typography>
              </Paper>
            </Grid>)}
          </Grid>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>Absent means absent in at least one subject, counted once per student. 9A and absent counts overlap the eligibility groups; eligible + not eligible + pending = total students.</Typography>
          <Grid container spacing={1.5}>
            {summaryStats.map((item) => <Grid size={{ xs: 6, md: 4 }} key={item.label}>
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, height: "100%", borderRadius: "14px", position: "relative", overflow: "hidden" }}>
                <Box sx={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", bgcolor: `${item.color}.main`, opacity: 0.75 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>{item.label.startsWith("Incomplete") ? "Review subjects" : item.label === "9A" ? "9A results" : item.label}</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ my: 0.8 }}><Typography sx={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1.2 }}>{item.value}</Typography><Typography variant="body2" color={`${item.color}.main`} fontWeight={700}>{item.percentage}%</Typography></Stack>
                <Typography variant="caption" color="text.secondary">Of the full class / grade</Typography>
              </Paper>
            </Grid>)}
          </Grid>
        </Box>

        <Paper variant="outlined" sx={{ borderRadius: "14px", overflow: "hidden" }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ px: 2.5, py: 2 }}>
            <Box><Typography fontWeight={800}>Student results</Typography><Typography variant="caption" color="text.secondary">{RESULT_VIEWS[resultFilter]} / {rows.length} of {allRows.length} students</Typography></Box>
            <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label="AB - absent" variant="outlined" /><Chip size="small" label="- no recorded grade" variant="outlined" /></Stack>
          </Stack>
          <TableContainer sx={{ maxHeight: "70vh", borderTop: 1, borderColor: "divider" }}>
            <Table stickyHeader size="small" aria-label="Grade result schedule" sx={{ minWidth: 1380, "& th": { fontWeight: 700, fontSize: 11, bgcolor: "background.default", py: 1.5 }, "& td": { py: 1.1, borderColor: "divider", fontSize: 12 } }}>
              <TableHead><TableRow>
                <TableCell sx={{ width: 42 }}>No.</TableCell><TableCell sx={{ width: 60 }}>Class</TableCell>
                <TableCell sx={{ minWidth: 210, position: "sticky", left: 0, zIndex: 4 }}>Student name</TableCell>
                {slots.map((slot) => <TableCell key={slot.key} align="center" sx={{ minWidth: slot.elective ? 86 : 56 }}>{slot.label}</TableCell>)}
                <TableCell sx={{ minWidth: 120 }}>Results</TableCell><TableCell sx={{ minWidth: 145 }}>Category / notes</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {rows.map((row, index) => <TableRow key={row.student.id} sx={{ bgcolor: index % 2 ? "action.hover" : "background.paper", "&:hover": { bgcolor: "action.selected" } }}>
                  <TableCell sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{row.rowNo}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{resultClassLabel(row, reportData?.grade)}</TableCell>
                  <TableCell sx={{ fontWeight: 600, position: "sticky", left: 0, zIndex: 1, bgcolor: "background.paper", borderRight: 1, borderRightColor: "divider", maxWidth: 260 }}>{row.studentName}</TableCell>
                  {slots.map((slot) => <TableCell key={slot.key} align="center"><SubjectResult row={row} slot={slot} /></TableCell>)}
                  <TableCell sx={{ fontWeight: 600 }}>{row.summary || "-"}</TableCell>
                  <TableCell><StatusBadge row={row} /></TableCell>
                </TableRow>)}
                {!rows.length && <TableRow><TableCell colSpan={slots.length + 5} sx={{ textAlign: "center", py: "48px !important", color: "text.secondary" }}>No students match this result view.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: "divider" }}><Typography variant="caption" color="text.secondary">Religion and basket cells show the selected subject and grade. Multiple choices remain visible. Row numbers retain the original result order.</Typography></Box>
        </Paper>

        <Box><Typography fontWeight={800} sx={{ mb: 0.5 }}>Students needing follow-up</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Full class / grade lists, independent of the selected result view.</Typography>
          <Stack spacing={1.5}>
            <FollowUpList title="Tamil / Maths below S" description="Meets the three-credit / six-pass threshold" rows={tamilMathsFailureRows} grade={reportData?.grade} failure />
            <FollowUpList title="Below the credit / pass threshold" description="Tamil and Maths are at least S" rows={belowThreeCThreeSRows} grade={reportData?.grade} />
          </Stack>
        </Box>
        <GradeResultAnalytics analytics={analytics} />
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>Eligibility: nine recorded subjects, at least three credits and six passes, including Tamil and Maths at S or above. Review subjects indicates incomplete results or a subject selection requiring review.</Typography>
      </Stack>
    </PageContainer>
  );
}
