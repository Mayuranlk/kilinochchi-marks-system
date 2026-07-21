import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
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
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { alpha, useTheme } from "@mui/material/styles";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../firebase";
import StatCard from "../components/ui/StatCard";
import {
  filterStudentsForClass,
  matchesReportClass,
} from "../utils/classMarksReportBuilder";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_TERM = "Term 1";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function isActiveStatus(value) {
  return normalizeLower(value || "active") === "active";
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

function getAssignmentGroupKey(row = {}) {
  return [
    Number(row.grade || 0),
    normalizeLower(row.section || row.className),
    normalizeLower(row.stream),
    getEnrollmentSubjectKey(row),
  ].join("|");
}

function getStatusColor(status) {
  if (status === "done") return "success";
  if (status === "partial") return "warning";
  return "error";
}

function getStatusLabel(status) {
  if (status === "done") return "Green";
  if (status === "partial") return "Yellow";
  return "Red";
}

function getStatusText(status) {
  if (status === "done") return "Complete";
  if (status === "partial") return "In progress";
  return "Needs attention";
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Math.round(Number(value))}%`;
}

function buildSubjectCompletion({ classEnrollments, classMarks, assignmentByKey, reportContext }) {
  const subjectMap = new Map();

  classEnrollments.forEach((enrollment) => {
    const studentId = normalizeText(enrollment.studentId);
    const subjectKey = getEnrollmentSubjectKey(enrollment);
    if (!studentId || !subjectKey) return;

    if (!subjectMap.has(subjectKey)) {
      const assignmentKey = [
        reportContext.grade,
        normalizeLower(reportContext.section),
        normalizeLower(reportContext.stream),
        subjectKey,
      ].join("|");
      const assignment = assignmentByKey.get(assignmentKey) || {};

      subjectMap.set(subjectKey, {
        subjectKey,
        subjectName: normalizeText(enrollment.subjectName || enrollment.subject || "Unnamed Subject"),
        subjectId: normalizeText(enrollment.subjectId),
        subjectNumber: normalizeText(enrollment.subjectNumber),
        teacherName: normalizeText(assignment.teacherName),
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

function buildLiveRows({ classrooms, students, enrollments, marks, assignments, year, termName }) {
  const assignmentByKey = new Map(
    assignments
      .filter((assignment) => isActiveStatus(assignment.status))
      .map((assignment) => [getAssignmentGroupKey(assignment), assignment])
  );

  return classrooms
    .filter((classroom) => {
      const grade = Number(classroom.grade);
      const yearValue = Number(classroom.year || classroom.academicYear || 0);
      return yearValue === Number(year) && grade >= 6 && grade <= 13;
    })
    .sort((a, b) => {
      const gradeDiff = Number(a.grade) - Number(b.grade);
      if (gradeDiff !== 0) return gradeDiff;
      return getClassroomDisplayName(a).localeCompare(getClassroomDisplayName(b), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map((classroom) => {
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
      const subjectSummaries = buildSubjectCompletion({
        classEnrollments,
        classMarks,
        assignmentByKey,
        reportContext,
      });
      const expectedMarkCount = subjectSummaries.reduce((sum, subject) => sum + subject.enrolledCount, 0);
      const enteredMarkCount = subjectSummaries.reduce((sum, subject) => sum + subject.enteredCount, 0);
      const missingMarkCount = Math.max(0, expectedMarkCount - enteredMarkCount);
      const completedSubjectCount = subjectSummaries.filter((subject) => subject.status === "done").length;
      const partialSubjectCount = subjectSummaries.filter((subject) => subject.status === "partial").length;
      const pendingSubjectCount = subjectSummaries.filter((subject) => subject.status === "missing").length;
      const hasStudents = classStudents.length > 0 || classEnrollments.length > 0;
      const hasExpectedMarks = expectedMarkCount > 0;

      let status = "missing";
      if (hasStudents && hasExpectedMarks && missingMarkCount === 0) {
        status = "done";
      } else if (hasStudents || hasExpectedMarks || enteredMarkCount > 0) {
        status = "partial";
      }

      return {
        id: classroom.id,
        grade,
        className: getClassroomDisplayName(classroom),
        classTeacherName: normalizeText(classroom.classTeacherName),
        subjectSummaries,
        studentCount: classStudents.length,
        subjectCount: subjectSummaries.length,
        expectedMarkCount,
        enteredMarkCount,
        missingMarkCount,
        completedSubjectCount,
        partialSubjectCount,
        pendingSubjectCount,
        completionPercent: expectedMarkCount > 0 ? (enteredMarkCount / expectedMarkCount) * 100 : 0,
        status,
      };
    });
}

function StatusDot({ status, large = false }) {
  const theme = useTheme();
  const palette = theme.palette[getStatusColor(status)] || theme.palette.error;

  return (
    <Box
      sx={{
        width: large ? 18 : 12,
        height: large ? 18 : 12,
        borderRadius: "50%",
        bgcolor: palette.main,
        boxShadow: `0 0 0 4px ${alpha(palette.main, 0.16)}`,
        flex: "0 0 auto",
      }}
    />
  );
}

function StatusPill({ status }) {
  return (
    <Chip
      size="small"
      color={getStatusColor(status)}
      label={`${getStatusLabel(status)} - ${getStatusText(status)}`}
      sx={{ fontWeight: 900 }}
    />
  );
}

export default function MarksStatusLive() {
  const [data, setData] = useState({
    students: [],
    enrollments: [],
    marks: [],
    classrooms: [],
    terms: [],
    assignments: [],
  });
  const [loadingCollections, setLoadingCollections] = useState(new Set([
    "students",
    "studentSubjectEnrollments",
    "marks",
    "classrooms",
    "academicTerms",
    "teacherAssignments",
  ]));
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedTerm, setSelectedTerm] = useState(DEFAULT_TERM);
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const collections = {
      students: "students",
      enrollments: "studentSubjectEnrollments",
      marks: "marks",
      classrooms: "classrooms",
      terms: "academicTerms",
      assignments: "teacherAssignments",
    };

    const unsubscribers = Object.entries(collections).map(([stateKey, collectionName]) =>
      onSnapshot(
        collection(db, collectionName),
        (snapshot) => {
          setData((prev) => ({
            ...prev,
            [stateKey]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
          }));
          setLoadingCollections((prev) => {
            const next = new Set(prev);
            next.delete(collectionName);
            return next;
          });
          setLastUpdated(new Date().toLocaleString());
          setError("");
        },
        (err) => {
          console.error("Marks status live sync error:", err);
          setError("Could not load live marks status. Check Firestore read access for this public page.");
          setLoadingCollections((prev) => {
            const next = new Set(prev);
            next.delete(collectionName);
            return next;
          });
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    const activeTerm = data.terms.find((term) => term.isActive) || data.terms[0] || null;
    if (activeTerm?.term) setSelectedTerm(activeTerm.term);
  }, [data.terms]);

  const loading = loadingCollections.size > 0;

  const availableYears = useMemo(() => {
    const years = new Set([
      CURRENT_YEAR,
      ...data.classrooms.map((item) => Number(item.year || item.academicYear || 0)),
      ...data.marks.map((item) => Number(item.year || item.academicYear || 0)),
    ].filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [data.classrooms, data.marks]);

  const rows = useMemo(
    () =>
      buildLiveRows({
        classrooms: data.classrooms,
        students: data.students,
        enrollments: data.enrollments,
        marks: data.marks,
        assignments: data.assignments,
        year: selectedYear,
        termName: selectedTerm,
      }),
    [data, selectedTerm, selectedYear]
  );

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const summary = useMemo(() => {
    const expected = rows.reduce((sum, row) => sum + row.expectedMarkCount, 0);
    const entered = rows.reduce((sum, row) => sum + row.enteredMarkCount, 0);
    const missing = Math.max(0, expected - entered);

    return {
      total: rows.length,
      done: rows.filter((row) => row.status === "done").length,
      partial: rows.filter((row) => row.status === "partial").length,
      missing: rows.filter((row) => row.status === "missing").length,
      expected,
      entered,
      missingMarks: missing,
      completionPercent: expected > 0 ? (entered / expected) * 100 : 0,
      pendingSubjects: rows.reduce((sum, row) => sum + row.pendingSubjectCount + row.partialSubjectCount, 0),
    };
  }, [rows]);

  const urgentSubjects = useMemo(
    () =>
      rows
        .flatMap((row) =>
          row.subjectSummaries
            .filter((subject) => subject.status !== "done")
            .map((subject) => ({
              ...subject,
              className: row.className,
              grade: row.grade,
              classStatus: row.status,
            }))
        )
        .sort((a, b) => b.missingCount - a.missingCount || a.className.localeCompare(b.className))
        .slice(0, 12),
    [rows]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      {loading ? <LinearProgress /> : null}

      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 4 }, py: { xs: 2, md: 3 }, maxWidth: 1560, mx: "auto" }}>
        <Stack spacing={2.25}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 1,
              border: "1px solid #e2e8f0",
              background: "linear-gradient(135deg, rgba(22,101,52,0.10), rgba(185,28,28,0.07), rgba(30,64,175,0.06))",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  component="img"
                  src="/kcc-logo.png"
                  alt="Kilinochchi Central College"
                  sx={{ width: { xs: 62, md: 82 }, height: { xs: 62, md: 82 }, objectFit: "contain" }}
                />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                    Marks Updating Status
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 800, mt: 0.5 }}>
                    Kilinochchi Central College Live Board
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedYear} | {selectedTerm} | Public read-only view
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip color="success" label="GREEN COMPLETE" sx={{ fontWeight: 900 }} />
                <Chip color="warning" label="YELLOW PARTIAL" sx={{ fontWeight: 900 }} />
                <Chip color="error" label="RED PENDING" sx={{ fontWeight: 900 }} />
                <Box sx={{ textAlign: { xs: "left", md: "right" }, width: { xs: "100%", md: "auto" } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Last updated
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                    {lastUpdated || "Connecting..."}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Paper elevation={0} sx={{ p: 2, borderRadius: 1, border: "1px solid #e2e8f0" }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <PublicRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      Share URL
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Open this page on a TV, projector, or staff phone for live tracking.
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={4} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select value={selectedYear} label="Year" onChange={(event) => setSelectedYear(Number(event.target.value))}>
                    {availableYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Term</InputLabel>
                  <Select value={selectedTerm} label="Term" onChange={(event) => setSelectedTerm(event.target.value)}>
                    {(data.terms.length ? data.terms : [{ id: DEFAULT_TERM, term: DEFAULT_TERM }]).map((term) => (
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
                  <Select value={statusFilter} label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All Classes</MenuItem>
                    <MenuItem value="done">Green - Complete</MenuItem>
                    <MenuItem value="partial">Yellow - In progress</MenuItem>
                    <MenuItem value="missing">Red - Needs attention</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {loading && rows.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={6} md={2}>
                  <StatCard title="Classes" value={summary.total} icon={<AssessmentRoundedIcon />} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <StatCard title="Green" value={summary.done} icon={<FactCheckRoundedIcon />} color="success" />
                </Grid>
                <Grid item xs={6} md={2}>
                  <StatCard title="Yellow" value={summary.partial} icon={<WarningAmberRoundedIcon />} color="warning" />
                </Grid>
                <Grid item xs={6} md={2}>
                  <StatCard title="Red" value={summary.missing} icon={<WarningAmberRoundedIcon />} color="error" />
                </Grid>
                <Grid item xs={6} md={2}>
                  <StatCard title="Completion" value={formatPercent(summary.completionPercent)} icon={<AssessmentRoundedIcon />} color="primary" />
                </Grid>
                <Grid item xs={6} md={2}>
                  <StatCard title="Missing Marks" value={summary.missingMarks} icon={<WarningAmberRoundedIcon />} color="error" />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={8}>
                  <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 1, border: "1px solid #e2e8f0" }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                      <AssessmentRoundedIcon color="primary" />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                          Class Status Board
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Green is fully entered. Yellow is partially entered. Red has no marks, students, or enrollments to resolve.
                        </Typography>
                      </Box>
                    </Stack>

                    <Grid container spacing={1.25}>
                      {filteredRows.map((row) => (
                        <Grid item xs={12} sm={6} md={4} key={row.id}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: `${getStatusColor(row.status)}.light`,
                              bgcolor: (theme) => alpha(theme.palette[getStatusColor(row.status)].main, 0.08),
                              height: "100%",
                            }}
                          >
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                  <StatusDot status={row.status} large />
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.05 }} noWrap>
                                      {row.className}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {row.classTeacherName || "Class teacher not set"}
                                    </Typography>
                                  </Box>
                                </Stack>
                                <StatusPill status={row.status} />
                              </Stack>

                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                <Chip size="small" label={`${formatPercent(row.completionPercent)} done`} />
                                <Chip size="small" label={`${row.completedSubjectCount}/${row.subjectCount} subjects`} />
                                <Chip size="small" color="error" variant="outlined" label={`${row.missingMarkCount} missing`} />
                              </Stack>
                            </Stack>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    {filteredRows.length === 0 ? (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        No classes match this status filter.
                      </Alert>
                    ) : null}
                  </Paper>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 1, border: "1px solid #e2e8f0", height: "100%" }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                      <WarningAmberRoundedIcon color="warning" />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                          Needs Attention
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Subjects with missing marks, highest missing count first.
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack spacing={1}>
                      {urgentSubjects.length ? (
                        urgentSubjects.map((subject) => (
                          <Paper key={`${subject.className}-${subject.subjectKey}`} elevation={0} sx={{ p: 1.25, borderRadius: 1, border: "1px solid #e2e8f0" }}>
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                              <StatusDot status={subject.status} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                  {subject.className} | {subject.subjectName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                  {subject.teacherName || "Teacher not assigned"}
                                </Typography>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                                  <Chip size="small" color={getStatusColor(subject.status)} label={getStatusText(subject.status)} />
                                  <Chip size="small" label={`${subject.enteredCount}/${subject.enrolledCount} entered`} />
                                  <Chip size="small" color="error" variant="outlined" label={`${subject.missingCount} missing`} />
                                </Stack>
                              </Box>
                            </Stack>
                          </Paper>
                        ))
                      ) : (
                        <Alert severity="success">All visible subjects are complete.</Alert>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>

              <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 1, border: "1px solid #e2e8f0" }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>
                  Subject-Level Live Table
                </Typography>
                <TableContainer sx={{ maxHeight: 620 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Class</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Teacher</TableCell>
                        <TableCell align="right">Enrolled</TableCell>
                        <TableCell align="right">Entered</TableCell>
                        <TableCell align="right">Missing</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows.flatMap((row) =>
                        row.subjectSummaries.map((subject) => (
                          <TableRow key={`${row.id}-${subject.subjectKey}`} hover>
                            <TableCell>
                              <StatusPill status={subject.status} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>{row.className}</TableCell>
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
                            <TableCell>{subject.teacherName || "-"}</TableCell>
                            <TableCell align="right">{subject.enrolledCount}</TableCell>
                            <TableCell align="right">{subject.enteredCount}</TableCell>
                            <TableCell align="right">{subject.missingCount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
