import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ReplayIcon from "@mui/icons-material/Replay";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  ENROLLMENT_MODES,
  fullRebuildEnrollments,
  generateMissingEnrollments,
  regenerateSingleStudent,
} from "../services/enrollmentGenerator";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const BATCH_LIMIT = 400;

function currentAcademicYear() {
  return String(new Date().getFullYear());
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeLoose(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function normalizeAcademicYear(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  return match ? match[0] : currentAcademicYear();
}

function normalizeGrade(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function normalizeClassIdentity(row = {}) {
  const fullClass = String(
    row?.fullClassName || row?.alClassName || row?.className || ""
  ).trim();

  if (fullClass) return normalizeLoose(fullClass);

  const grade = normalizeGrade(row?.grade);
  const section = normalizeSection(row?.section || row?.className || "");
  const stream = String(row?.stream || "").trim();

  if (grade && section && stream) {
    return normalizeLoose(`${grade}_${stream}_${section}`);
  }

  if (grade && section) {
    return normalizeLoose(`${grade}_${section}`);
  }

  return normalizeLoose(String(row?.className || ""));
}

function canonicalSubjectKey(row = {}) {
  const subjectCode = normalizeLoose(row?.subjectCode || "");
  const subjectNumber = normalizeLoose(row?.subjectNumber || "");
  const subjectName = normalizeLoose(row?.subjectName || row?.subject || "");
  const subjectCategory = normalizeLoose(row?.subjectCategory || row?.category || "");

  return [
    subjectCode || subjectNumber || subjectName,
    subjectCategory || "",
  ].join("__");
}

function canonicalEnrollmentKey(row = {}) {
  return [
    normalizeAcademicYear(row?.academicYear || row?.year),
    String(row?.studentId || "").trim(),
    canonicalSubjectKey(row),
    normalizeClassIdentity(row),
  ].join("__");
}

function canonicalMarkKey(row = {}) {
  return [
    normalizeAcademicYear(row?.academicYear || row?.year),
    normalizeLoose(row?.term || row?.termName || ""),
    String(row?.studentId || "").trim(),
    canonicalSubjectKey(row),
    normalizeClassIdentity(row),
  ].join("__");
}

function getStudentName(student) {
  return student?.fullName || student?.name || "Unnamed";
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className);
}

function getStudentGrade(student) {
  return normalizeGrade(student?.grade);
}

function getStudentClassLabel(student) {
  const grade = getStudentGrade(student);
  const section = getStudentSection(student);

  if (grade && section) return `G${grade}-${section}`;
  if (grade) return `G${grade}`;
  if (section) return section;
  return "No Class";
}

function getStudentOptionLabel(student) {
  const name = getStudentName(student);
  const classLabel = getStudentClassLabel(student);
  const admissionNo = String(student?.admissionNo || "").trim();

  return `${name}${admissionNo ? ` (${admissionNo})` : ""} - ${classLabel}`;
}

function isStudentActive(student) {
  if (typeof student?.isActive === "boolean") return student.isActive;

  if (student?.status) {
    return normalize(student.status) === "active";
  }

  return true;
}

function parseComparableTimestamp(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getMarkNumericValue(row = {}) {
  const value = row?.mark ?? row?.marks ?? row?.score ?? null;
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasRealMark(row = {}) {
  return getMarkNumericValue(row) !== null || Boolean(row?.absent || row?.isAbsent);
}

function choosePreferredEnrollment(current, candidate) {
  const currentActive = normalize(current?.status || "active") !== "inactive";
  const candidateActive = normalize(candidate?.status || "active") !== "inactive";

  if (candidateActive && !currentActive) return candidate;
  if (!candidateActive && currentActive) return current;

  const currentUpdated = parseComparableTimestamp(
    current?.updatedAt || current?.createdAt
  );
  const candidateUpdated = parseComparableTimestamp(
    candidate?.updatedAt || candidate?.createdAt
  );

  if (candidateUpdated > currentUpdated) return candidate;
  return current;
}

function choosePreferredMark(current, candidate) {
  const currentHasReal = hasRealMark(current);
  const candidateHasReal = hasRealMark(candidate);

  if (candidateHasReal && !currentHasReal) return candidate;
  if (!candidateHasReal && currentHasReal) return current;

  const currentUpdated = parseComparableTimestamp(
    current?.updatedAt || current?.createdAt
  );
  const candidateUpdated = parseComparableTimestamp(
    candidate?.updatedAt || candidate?.createdAt
  );

  if (candidateUpdated > currentUpdated) return candidate;
  return current;
}

async function fetchStudents() {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function StatCard({ title, value }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function buildErrorSummary(mode, error) {
  return {
    mode,
    totalProcessed: 0,
    created: 0,
    reactivated: 0,
    updated: 0,
    deactivated: 0,
    skipped: 0,
    errors: 1,
    deletedEnrollments: 0,
    deletedMarks: 0,
    enrollmentDuplicateGroups: 0,
    markDuplicateGroups: 0,
    logs: [
      {
        type: "error",
        message: "Operation failed",
        details: error?.message || "Unknown error",
      },
    ],
  };
}

async function commitDeleteOperations(refs = []) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function cleanupDuplicateEnrollmentAndMarkEntries({ academicYear }) {
  const normalizedYear = normalizeAcademicYear(academicYear);

  const [enrollmentsSnap, marksSnap] = await Promise.all([
    getDocs(collection(db, "studentSubjectEnrollments")),
    getDocs(collection(db, "marks")),
  ]);

  const enrollments = enrollmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const marks = marksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const targetEnrollments = enrollments.filter(
    (row) => normalizeAcademicYear(row?.academicYear || row?.year) === normalizedYear
  );

  const targetMarks = marks.filter(
    (row) => normalizeAcademicYear(row?.academicYear || row?.year) === normalizedYear
  );

  const enrollmentGroups = new Map();
  for (const row of targetEnrollments) {
    const key = canonicalEnrollmentKey(row);
    if (!enrollmentGroups.has(key)) enrollmentGroups.set(key, []);
    enrollmentGroups.get(key).push(row);
  }

  const markGroups = new Map();
  for (const row of targetMarks) {
    const key = canonicalMarkKey(row);
    if (!markGroups.has(key)) markGroups.set(key, []);
    markGroups.get(key).push(row);
  }

  const enrollmentRefsToDelete = [];
  const markRefsToDelete = [];
  const logs = [];

  let enrollmentDuplicateGroups = 0;
  let markDuplicateGroups = 0;

  for (const [key, group] of enrollmentGroups.entries()) {
    if (group.length <= 1) continue;

    enrollmentDuplicateGroups += 1;

    let keeper = group[0];
    for (let i = 1; i < group.length; i += 1) {
      keeper = choosePreferredEnrollment(keeper, group[i]);
    }

    const duplicates = group.filter((row) => row.id !== keeper.id);
    duplicates.forEach((row) =>
      enrollmentRefsToDelete.push(doc(db, "studentSubjectEnrollments", row.id))
    );

    logs.push({
      type: "warning",
      message: "Duplicate enrollments cleaned",
      details: `${group.length - 1} removed for key ${key}`,
    });
  }

  for (const [key, group] of markGroups.entries()) {
    if (group.length <= 1) continue;

    markDuplicateGroups += 1;

    let keeper = group[0];
    for (let i = 1; i < group.length; i += 1) {
      keeper = choosePreferredMark(keeper, group[i]);
    }

    const duplicates = group.filter((row) => row.id !== keeper.id);
    duplicates.forEach((row) => markRefsToDelete.push(doc(db, "marks", row.id)));

    logs.push({
      type: "warning",
      message: "Duplicate marks cleaned",
      details: `${group.length - 1} removed for key ${key}`,
    });
  }

  await commitDeleteOperations(enrollmentRefsToDelete);
  await commitDeleteOperations(markRefsToDelete);

  const totalProcessed = targetEnrollments.length + targetMarks.length;

  return {
    mode: "cleanup_duplicates",
    totalProcessed,
    created: 0,
    reactivated: 0,
    updated: 0,
    deactivated: 0,
    skipped: 0,
    errors: 0,
    deletedEnrollments: enrollmentRefsToDelete.length,
    deletedMarks: markRefsToDelete.length,
    enrollmentDuplicateGroups,
    markDuplicateGroups,
    logs: [
      {
        type: "success",
        message: "Duplicate cleanup completed",
        details: `Enrollments removed: ${enrollmentRefsToDelete.length}, marks removed: ${markRefsToDelete.length}`,
      },
      ...logs,
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function GenerateSubjectEnrollments() {
  const { profile, isAdmin, loading: authLoading } = useAuth();

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [pageLoading, setPageLoading] = useState(true);
  const [running, setRunning] = useState("");

  const [summary, setSummary] = useState({
    mode: "",
    totalProcessed: 0,
    created: 0,
    reactivated: 0,
    updated: 0,
    deactivated: 0,
    skipped: 0,
    errors: 0,
    deletedEnrollments: 0,
    deletedMarks: 0,
    enrollmentDuplicateGroups: 0,
    markDuplicateGroups: 0,
    logs: [],
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setPageLoading(true);

      try {
        const studentData = await fetchStudents();
        if (!mounted) return;
        setStudents(studentData);
      } catch (error) {
        console.error("Failed to load students:", error);
        if (!mounted) return;

        setSummary({
          mode: "load",
          totalProcessed: 0,
          created: 0,
          reactivated: 0,
          updated: 0,
          deactivated: 0,
          skipped: 0,
          errors: 1,
          deletedEnrollments: 0,
          deletedMarks: 0,
          enrollmentDuplicateGroups: 0,
          markDuplicateGroups: 0,
          logs: [
            {
              type: "error",
              message: "Failed to load students",
              details: error?.message || "Unknown error",
            },
          ],
        });
      } finally {
        if (mounted) setPageLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const activeStudents = useMemo(
    () => students.filter((student) => isStudentActive(student)),
    [students]
  );

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const gradeDiff = getStudentGrade(a) - getStudentGrade(b);
      if (gradeDiff !== 0) return gradeDiff;

      const sectionDiff = getStudentSection(a).localeCompare(getStudentSection(b));
      if (sectionDiff !== 0) return sectionDiff;

      return getStudentName(a)
        .toLowerCase()
        .localeCompare(getStudentName(b).toLowerCase());
    });
  }, [students]);

  async function refreshStudents() {
    const refreshedStudents = await fetchStudents();
    setStudents(refreshedStudents);

    if (selectedStudent?.id) {
      const refreshedSelected =
        refreshedStudents.find((student) => student.id === selectedStudent.id) || null;
      setSelectedStudent(refreshedSelected);
    }
  }

  function applySummary(mode, result) {
    setSummary({
      mode: result?.mode || mode,
      totalProcessed: result?.totalProcessed || 0,
      created: result?.created || 0,
      reactivated: result?.reactivated || 0,
      updated: result?.updated || 0,
      deactivated: result?.deactivated || 0,
      skipped: result?.skipped || 0,
      errors: result?.errors || 0,
      deletedEnrollments: result?.deletedEnrollments || 0,
      deletedMarks: result?.deletedMarks || 0,
      enrollmentDuplicateGroups: result?.enrollmentDuplicateGroups || 0,
      markDuplicateGroups: result?.markDuplicateGroups || 0,
      logs: Array.isArray(result?.logs) ? result.logs : [],
    });
  }

  async function runMode(mode) {
    setRunning(mode);

    try {
      const normalizedYear = normalizeAcademicYear(academicYear);
      let result;

      if (mode === ENROLLMENT_MODES.GENERATE_MISSING) {
        result = await generateMissingEnrollments({
          academicYear: normalizedYear,
        });
      } else if (mode === ENROLLMENT_MODES.REGENERATE_STUDENT) {
        if (!selectedStudent?.id) {
          throw new Error("Please select a student first.");
        }

        result = await regenerateSingleStudent({
          academicYear: normalizedYear,
          studentId: selectedStudent.id,
        });
      } else if (mode === ENROLLMENT_MODES.FULL_REBUILD) {
        if (!isAdmin) {
          throw new Error("Only admin can run full rebuild.");
        }

        result = await fullRebuildEnrollments({
          academicYear: normalizedYear,
        });
      } else if (mode === "cleanup_duplicates") {
        if (!isAdmin) {
          throw new Error("Only admin can clean duplicates.");
        }

        result = await cleanupDuplicateEnrollmentAndMarkEntries({
          academicYear: normalizedYear,
        });
      } else {
        throw new Error("Unknown enrollment mode.");
      }

      setAcademicYear(normalizedYear);
      applySummary(mode, result);
      await refreshStudents();
    } catch (error) {
      console.error(error);
      setSummary(buildErrorSummary(mode, error));
    } finally {
      setRunning("");
    }
  }

  async function handlePostPromotionGenerate() {
    const mode = "post_promotion_generate_missing";
    setRunning(mode);

    try {
      const normalizedYear = normalizeAcademicYear(academicYear);

      const result = await generateMissingEnrollments({
        academicYear: normalizedYear,
      });

      setAcademicYear(normalizedYear);

      setSummary({
        mode,
        totalProcessed: result?.totalProcessed || 0,
        created: result?.created || 0,
        reactivated: result?.reactivated || 0,
        updated: result?.updated || 0,
        deactivated: result?.deactivated || 0,
        skipped: result?.skipped || 0,
        errors: result?.errors || 0,
        deletedEnrollments: 0,
        deletedMarks: 0,
        enrollmentDuplicateGroups: 0,
        markDuplicateGroups: 0,
        logs: [
          {
            type: "success",
            message: `Post-promotion enrollment generation completed for ${normalizedYear}`,
            details:
              "Use this after Year End Promotion so newly promoted students get their correct current-year subject enrollments.",
          },
          ...(Array.isArray(result?.logs) ? result.logs : []),
        ],
      });

      await refreshStudents();
    } catch (error) {
      console.error(error);
      setSummary({
        mode,
        totalProcessed: 0,
        created: 0,
        reactivated: 0,
        updated: 0,
        deactivated: 0,
        skipped: 0,
        errors: 1,
        deletedEnrollments: 0,
        deletedMarks: 0,
        enrollmentDuplicateGroups: 0,
        markDuplicateGroups: 0,
        logs: [
          {
            type: "error",
            message: "Post-promotion generation failed",
            details: error?.message || "Unknown error",
          },
        ],
      });
    } finally {
      setRunning("");
    }
  }

  const isRunning = Boolean(running);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Generate Subject Enrollments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Automatic enrollment generation with duplicate protection, status handling,
            and safe repeat runs.
          </Typography>
        </Box>

        <Alert severity="info">
          This page rebuilds <strong>studentSubjectEnrollments</strong> using the current
          student profile, subject definitions, and academic year.
        </Alert>

        <Alert severity="warning" icon={<WarningAmberIcon />}>
          If duplicate names are appearing in Marks Entry, run
          <strong> Admin Duplicate Cleanup</strong> first. Do not run Full Rebuild again
          until duplicate cleanup is completed.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Academic Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(normalizeAcademicYear(e.target.value))}
              disabled={isRunning}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Autocomplete
              options={sortedStudents}
              value={selectedStudent}
              onChange={(_, value) => setSelectedStudent(value)}
              getOptionLabel={(option) => getStudentOptionLabel(option)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Selected Student"
                  placeholder="Used for Regenerate Selected Student"
                />
              )}
              disabled={isRunning}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleIcon color="success" />
                    <Typography variant="h6">Post-Promotion Generate</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Best choice after Year End Promotion. Creates current-year missing
                    enrollments safely.
                  </Typography>

                  <Button
                    variant="contained"
                    color="success"
                    onClick={handlePostPromotionGenerate}
                    disabled={isRunning}
                  >
                    {running === "post_promotion_generate_missing" ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      "Post-Promotion Generate Missing"
                    )}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutorenewIcon color="primary" />
                    <Typography variant="h6">Generate Missing</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Create only missing enrollments for all active students in the selected year.
                  </Typography>

                  <Button
                    variant="contained"
                    onClick={() => runMode(ENROLLMENT_MODES.GENERATE_MISSING)}
                    disabled={isRunning}
                  >
                    {running === ENROLLMENT_MODES.GENERATE_MISSING ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      "Generate Missing"
                    )}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReplayIcon color="warning" />
                    <Typography variant="h6">Regenerate Selected Student</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Inactivate old enrollments for one student and rebuild that student only.
                  </Typography>

                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => runMode(ENROLLMENT_MODES.REGENERATE_STUDENT)}
                    disabled={isRunning || !selectedStudent}
                  >
                    {running === ENROLLMENT_MODES.REGENERATE_STUDENT ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      "Regenerate Selected Student"
                    )}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card variant="outlined" sx={{ borderColor: "error.main" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BuildIcon color="error" />
                    <Typography variant="h6">Full Rebuild</Typography>
                    <Chip
                      size="small"
                      label={isAdmin ? "Admin" : "Admin only"}
                      color={isAdmin ? "success" : "default"}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Inactivate all current-year enrollments and rebuild everything from scratch.
                  </Typography>

                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => runMode(ENROLLMENT_MODES.FULL_REBUILD)}
                    disabled={isRunning || !isAdmin}
                  >
                    {running === ENROLLMENT_MODES.FULL_REBUILD ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      "Full Rebuild"
                    )}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderColor: "warning.main" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CleaningServicesIcon color="warning" />
                    <Typography variant="h6">Admin Duplicate Cleanup</Typography>
                    <Chip
                      size="small"
                      label={isAdmin ? "Admin" : "Admin only"}
                      color={isAdmin ? "success" : "default"}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Removes duplicate entries from current-year
                    <strong> studentSubjectEnrollments</strong> and
                    <strong> marks</strong> while keeping the best matching record.
                  </Typography>

                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => runMode("cleanup_duplicates")}
                    disabled={isRunning || !isAdmin}
                  >
                    {running === "cleanup_duplicates" ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      "Run Duplicate Cleanup"
                    )}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {pageLoading || authLoading ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress />
          </Paper>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <StatCard title="Students Loaded" value={students.length} />
            </Grid>
            <Grid item xs={12} md={3}>
              <StatCard title="Active Students" value={activeStudents.length} />
            </Grid>
            <Grid item xs={12} md={3}>
              <StatCard title="Academic Year" value={academicYear} />
            </Grid>
            <Grid item xs={12} md={3}>
              <StatCard title="Current Role" value={profile?.role || "unknown"} />
            </Grid>
          </Grid>
        )}

        <Divider />

        <Typography variant="h6" fontWeight={700}>
          Run Summary
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <StatCard title="Processed" value={summary.totalProcessed} />
          </Grid>
          <Grid item xs={12} md={2}>
            <StatCard title="Created" value={summary.created} />
          </Grid>
          <Grid item xs={12} md={2}>
            <StatCard title="Reactivated" value={summary.reactivated} />
          </Grid>
          <Grid item xs={12} md={2}>
            <StatCard title="Updated" value={summary.updated} />
          </Grid>
          <Grid item xs={12} md={2}>
            <StatCard title="Deactivated" value={summary.deactivated} />
          </Grid>
          <Grid item xs={12} md={2}>
            <StatCard
              title="Skipped / Errors"
              value={`${summary.skipped} / ${summary.errors}`}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard title="Deleted Enrollments" value={summary.deletedEnrollments} />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard title="Deleted Marks" value={summary.deletedMarks} />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="Enrollment Duplicate Groups"
              value={summary.enrollmentDuplicateGroups}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="Mark Duplicate Groups"
              value={summary.markDuplicateGroups}
            />
          </Grid>
        </Grid>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Logs
            </Typography>

            {!summary.logs?.length ? (
              <Typography variant="body2" color="text.secondary">
                No logs yet.
              </Typography>
            ) : (
              summary.logs.map((log, index) => (
                <Alert
                  key={`${log.message || "log"}-${index}`}
                  severity={
                    log.type === "error"
                      ? "error"
                      : log.type === "warning"
                      ? "warning"
                      : "success"
                  }
                >
                  <Typography variant="body2" fontWeight={600}>
                    {log.message || "Log"}
                  </Typography>
                  {log.details ? (
                    <Typography variant="caption" display="block">
                      {String(log.details)}
                    </Typography>
                  ) : null}
                </Alert>
              ))
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}