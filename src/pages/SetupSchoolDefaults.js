import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import { useAuth } from "../context/AuthContext";
import {
  createDefaultSubjects,
  fixStudentData,
} from "../services/setupDefaultsService";

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

export default function SetupSchoolDefaults() {
  const { profile, isAdmin } = useAuth();

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [subjectResult, setSubjectResult] = useState(null);
  const [studentResult, setStudentResult] = useState(null);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleCreateSubjects() {
    setSuccess("");
    setError("");
    setLoadingSubjects(true);

    try {
      const result = await createDefaultSubjects(profile);
      setSubjectResult(result);
      setSuccess(
        `Default subjects created: ${result.created}, skipped existing: ${result.skipped}.`
      );
    } catch (err) {
      setError("Failed to create default subjects: " + err.message);
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function handleFixStudents() {
    setSuccess("");
    setError("");
    setLoadingStudents(true);

    try {
      const result = await fixStudentData(profile);
      setStudentResult(result);
      setSuccess(
        `Students fixed: ${result.updated}, unchanged: ${result.unchanged}.`
      );
    } catch (err) {
      setError("Failed to fix student data: " + err.message);
    } finally {
      setLoadingStudents(false);
    }
  }

  if (!isAdmin) {
    return (
      <Box>
        <Alert severity="error">Only admin can access school setup tools.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="#1a237e">
            School Setup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            One-time and occasional maintenance tools for preparing subject definitions
            and student data before automatic enrollment generation.
          </Typography>
        </Box>

        {success && (
          <Alert severity="success" onClose={() => setSuccess("")}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Default Subjects Run"
              value={subjectResult ? "Done" : "Pending"}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Student Data Fix Run"
              value={studentResult ? "Done" : "Pending"}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard title="Mode" value="Setup Only" />
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SchoolIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Create Default Subjects
                </Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Creates missing default subjects needed by the system, such as
                core subjects, religion subjects, and aesthetic subjects.
              </Typography>

              <Button
                variant="contained"
                startIcon={<PlaylistAddCheckIcon />}
                onClick={handleCreateSubjects}
                disabled={loadingSubjects}
                sx={{ alignSelf: "flex-start" }}
              >
                {loadingSubjects ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Create Default Subjects"
                )}
              </Button>

              {subjectResult && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <StatCard title="Created" value={subjectResult.created} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <StatCard title="Skipped" value={subjectResult.skipped} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <StatCard
                      title="Templates"
                      value={subjectResult.totalDefaults}
                    />
                  </Grid>
                </Grid>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AutoFixHighIcon color="secondary" />
                <Typography variant="h6" fontWeight={700}>
                  Fix Student Data
                </Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Normalizes student data used by the automatic enrollment engine.
                This can fill missing className from section, normalize religion text,
                and default missing aesthetic choices where appropriate.
              </Typography>

              <Button
                variant="contained"
                color="secondary"
                startIcon={<AutoFixHighIcon />}
                onClick={handleFixStudents}
                disabled={loadingStudents}
                sx={{ alignSelf: "flex-start" }}
              >
                {loadingStudents ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Fix Student Data"
                )}
              </Button>

              {studentResult && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <StatCard title="Updated" value={studentResult.updated} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <StatCard title="Unchanged" value={studentResult.unchanged} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <StatCard title="Total" value={studentResult.total} />
                  </Grid>
                </Grid>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card
          variant="outlined"
          sx={{ borderColor: "primary.light", bgcolor: "#fafbff" }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SettingsSuggestIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Recommended Workflow
                </Typography>
              </Stack>

              <Divider />

              <Typography variant="body2">
                1. Run <strong>Create Default Subjects</strong>
              </Typography>
              <Typography variant="body2">
                2. Run <strong>Fix Student Data</strong>
              </Typography>
              <Typography variant="body2">
                3. Open <strong>Subject Enrollments</strong>
              </Typography>
              <Typography variant="body2">
                4. Run <strong>Full Rebuild</strong>
              </Typography>
              <Typography variant="body2">
                5. Open <strong>Marks Entry</strong> and verify subjects load correctly
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Alert severity="info">
          This page is now setup-only. Enrollment generation is handled only through
          the dedicated <strong>Subject Enrollments</strong> page.
        </Alert>
      </Stack>
    </Box>
  );
}