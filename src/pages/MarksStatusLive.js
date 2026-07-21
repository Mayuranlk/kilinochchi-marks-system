import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { alpha, useTheme } from "@mui/material/styles";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../firebase";
import {
  filterStudentsForClass,
  matchesReportClass,
} from "../utils/classMarksReportBuilder";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_TERM = "Term 1";
const PUBLIC_MARKS_STATUS_DOC_ID = "marks-status-live";
const publicMarksStatusDocRef = doc(db, "elections", PUBLIC_MARKS_STATUS_DOC_ID);

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
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      publicMarksStatusDocRef,
      (snapshot) => {
        setLoading(false);
        if (!snapshot.exists()) {
          setBoard(null);
          setError("Live marks status has not been published yet.");
          return;
        }

        setBoard({ id: snapshot.id, ...snapshot.data() });
        setError("");
      },
      (err) => {
        console.error("Marks status live sync error:", err);
        setLoading(false);
        setError("Could not load the public marks status board. Please publish the live status again from Class Completion Report.");
      }
    );

    return () => unsubscribe();
  }, []);

  const rows = useMemo(() => (Array.isArray(board?.rows) ? board.rows : []), [board]);
  const selectedYear = board?.year || CURRENT_YEAR;
  const selectedTerm = board?.termName || DEFAULT_TERM;
  const lastUpdated = board?.updatedAtText
    ? new Date(board.updatedAtText).toLocaleString()
    : "";

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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      {loading ? <LinearProgress /> : null}

      <Box sx={{ px: { xs: 1, sm: 2.5, md: 4 }, py: { xs: 1.25, md: 2.5 }, maxWidth: 980, mx: "auto" }}>
        <Stack spacing={1.25}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, md: 2.25 },
              borderRadius: 1,
              border: "1px solid #e2e8f0",
              bgcolor: "white",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
                <Box
                  component="img"
                  src="/kcc-logo.png"
                  alt="Kilinochchi Central College"
                  sx={{ width: { xs: 46, md: 62 }, height: { xs: 46, md: 62 }, objectFit: "contain", flexShrink: 0 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                    Marks Status
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    {selectedYear} | {selectedTerm} | Public read-only view
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" color="success" label={`Green ${summary.done}`} sx={{ fontWeight: 900 }} />
                <Chip size="small" color="warning" label={`Yellow ${summary.partial}`} sx={{ fontWeight: 900 }} />
                <Chip size="small" color="error" label={`Red ${summary.missing}`} sx={{ fontWeight: 900 }} />
              </Stack>
            </Stack>
          </Paper>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Paper elevation={0} sx={{ p: 1.25, borderRadius: 1, border: "1px solid #e2e8f0", bgcolor: "white" }}>
            <Stack spacing={1.1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PublicRoundedIcon color="primary" fontSize="small" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    Live share page
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {lastUpdated || "Connecting..."}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
                  <Chip size="small" label={`Year ${selectedYear}`} />
                  <Chip size="small" label={selectedTerm} />
                  {board?.publishedByName ? (
                    <Chip size="small" variant="outlined" label={`Published by ${board.publishedByName}`} />
                  ) : null}
                </Stack>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={statusFilter} label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All Classes</MenuItem>
                    <MenuItem value="done">Green - Complete</MenuItem>
                    <MenuItem value="partial">Yellow - In progress</MenuItem>
                    <MenuItem value="missing">Red - Needs attention</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {loading && rows.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`${summary.total} classes`} />
                <Chip size="small" label={`${formatPercent(summary.completionPercent)} complete`} />
                <Chip size="small" color="error" variant="outlined" label={`${summary.missingMarks} marks missing`} />
              </Stack>

              <Stack spacing={0.8}>
                {filteredRows.map((row) => (
                  <Accordion
                    key={row.id}
                    disableGutters
                    sx={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px !important",
                      bgcolor: "white",
                      boxShadow: "none",
                      overflow: "hidden",
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreRoundedIcon />}
                      sx={{
                        px: { xs: 1.1, sm: 1.5 },
                        py: 0.6,
                        borderLeft: "6px solid",
                        borderLeftColor: `${getStatusColor(row.status)}.main`,
                        "& .MuiAccordionSummary-content": { minWidth: 0, my: 0.75 },
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", minWidth: 0, pr: 0.5 }}>
                        <StatusDot status={row.status} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
                            {row.className}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {row.completedSubjectCount}/{row.subjectCount} subjects | {formatPercent(row.completionPercent)}
                          </Typography>
                        </Box>
                        <StatusPill status={row.status} />
                      </Stack>
                    </AccordionSummary>

                    <AccordionDetails sx={{ px: { xs: 1.1, sm: 1.5 }, pt: 0, pb: 1.25 }}>
                      <Stack spacing={0.8}>
                        <Typography variant="caption" color="text.secondary">
                          {row.classTeacherName || "Class teacher not set"}
                        </Typography>

                        {row.subjectSummaries.length ? (
                          row.subjectSummaries.map((subject) => (
                            <Paper
                              key={subject.subjectKey}
                              elevation={0}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: `${getStatusColor(subject.status)}.light`,
                                bgcolor: (theme) => alpha(theme.palette[getStatusColor(subject.status)].main, 0.08),
                              }}
                            >
                              <Stack direction="row" spacing={1} alignItems="center">
                                <StatusDot status={subject.status} />
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 900 }} noWrap>
                                    {subject.subjectName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {subject.teacherName || "Teacher not assigned"}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  color={getStatusColor(subject.status)}
                                  label={`${subject.enteredCount}/${subject.enrolledCount}`}
                                  sx={{ fontWeight: 900, flexShrink: 0 }}
                                />
                              </Stack>
                            </Paper>
                          ))
                        ) : (
                          <Alert severity="warning">No enrolled subjects found for this class.</Alert>
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}

                {filteredRows.length === 0 ? (
                  <Alert severity="info">No classes match this status filter.</Alert>
                ) : null}
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
