// src/pages/GenerateSubjectEnrollments.js

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
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  ENROLLMENT_MODES,
  fullRebuildEnrollments,
  generateMissingEnrollments,
  regenerateSingleStudent,
} from "../services/enrollmentGenerator";

function currentAcademicYear() {
  return String(new Date().getFullYear());
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isStudentActive(student) {
  if (typeof student?.isActive === "boolean") return student.isActive;
  if (student?.status) return normalize(student.status) === "active";
  return true;
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
        console.error(error);
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
    () => students.filter((s) => isStudentActive(s)),
    [students]
  );

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const aName = (a.fullName || a.name || "").toLowerCase();
      const bName = (b.fullName || b.name || "").toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [students]);

  async function runMode(mode) {
    setRunning(mode);

    try {
      let result;

      if (mode === ENROLLMENT_MODES.GENERATE_MISSING) {
        result = await generateMissingEnrollments({ academicYear });
      } else if (mode === ENROLLMENT_MODES.REGENERATE_STUDENT) {
        if (!selectedStudent?.id) {
          throw new Error("Please select a student first.");
        }

        result = await regenerateSingleStudent({
          academicYear,
          studentId: selectedStudent.id,
        });
      } else if (mode === ENROLLMENT_MODES.FULL_REBUILD) {
        if (!isAdmin) {
          throw new Error("Only admin can run full rebuild.");
        }

        result = await fullRebuildEnrollments({ academicYear });
      }

      setSummary(result);

      const refreshedStudents = await fetchStudents();
      setStudents(refreshedStudents);
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
        logs: [
          {
            type: "error",
            message: "Operation failed",
            details: error.message,
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
          Existing MarksEntry will remain safe as long as it reads only
          <strong> active </strong>
          enrollments.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Academic Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              disabled={isRunning}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Autocomplete
              options={sortedStudents}
              value={selectedStudent}
              onChange={(_, value) => setSelectedStudent(value)}
              getOptionLabel={(option) =>
                `${option.fullName || option.name || "Unnamed"}${
                  option.className ? ` - ${option.className}` : ""
                }`
              }
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
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutorenewIcon color="primary" />
                    <Typography variant="h6">Generate Missing</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Create only missing enrollments for all active students.
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

          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReplayIcon color="warning" />
                    <Typography variant="h6">Regenerate Selected Student</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Inactivate old enrollments for one student and rebuild correctly.
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

          <Grid item xs={12} md={4}>
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
                    Inactivate all current-year enrollments and rebuild everything.
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
            <StatCard title="Skipped / Errors" value={`${summary.skipped} / ${summary.errors}`} />
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
                  key={`${log.message}-${index}`}
                  severity={
                    log.type === "error"
                      ? "error"
                      : log.type === "warning"
                      ? "warning"
                      : "success"
                  }
                >
                  <Typography variant="body2" fontWeight={600}>
                    {log.message}
                  </Typography>
                  {log.details ? (
                    <Typography variant="caption" display="block">
                      {log.details}
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