import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SchoolIcon from "@mui/icons-material/School";
import { useAuth } from "../context/AuthContext";
import {
  createDefaultSubjects,
  fixStudentData,
} from "../services/setupDefaultsService";

function StatCard({ title, value }) {
  return (
    <Card variant="outlined">
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
      setSuccess(`Default subjects created: ${result.created}, skipped existing: ${result.skipped}.`);
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
      setSuccess(`Students fixed: ${result.updated}, unchanged: ${result.unchanged}.`);
    } catch (err) {
      setError("Failed to fix student data: " + err.message);
    } finally {
      setLoadingStudents(false);
    }
  }

  if (!isAdmin) {
    return (
      <Box>
        <Alert severity="error">Only admin can run school setup tools.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="#1a237e">
            School Setup Tools
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Create missing default subjects and normalize student data required for automatic enrollments.
          </Typography>
        </Box>

        {success && <Alert severity="success">{success}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SchoolIcon color="primary" />
                    <Typography variant="h6">Create Default Subjects</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Creates missing default subjects for current automatic enrollment rules:
                    English, religion subjects, and aesthetic subjects.
                  </Typography>

                  <Button
                    variant="contained"
                    startIcon={<PlaylistAddCheckIcon />}
                    onClick={handleCreateSubjects}
                    disabled={loadingSubjects}
                  >
                    {loadingSubjects ? <CircularProgress size={20} color="inherit" /> : "Create Default Subjects"}
                  </Button>

                  {subjectResult && (
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <StatCard title="Created" value={subjectResult.created} />
                      </Grid>
                      <Grid item xs={4}>
                        <StatCard title="Skipped" value={subjectResult.skipped} />
                      </Grid>
                      <Grid item xs={4}>
                        <StatCard title="Templates" value={subjectResult.totalDefaults} />
                      </Grid>
                    </Grid>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoFixHighIcon color="secondary" />
                    <Typography variant="h6">Fix Student Data</Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Normalizes religion values, fills missing className from section, defaults missing Grade 6–9 aesthetic choice to Music, and fills some missing snapshot-friendly fields.
                  </Typography>

                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AutoFixHighIcon />}
                    onClick={handleFixStudents}
                    disabled={loadingStudents}
                  >
                    {loadingStudents ? <CircularProgress size={20} color="inherit" /> : "Fix Student Data"}
                  </Button>

                  {studentResult && (
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <StatCard title="Updated" value={studentResult.updated} />
                      </Grid>
                      <Grid item xs={4}>
                        <StatCard title="Unchanged" value={studentResult.unchanged} />
                      </Grid>
                      <Grid item xs={4}>
                        <StatCard title="Total" value={studentResult.total} />
                      </Grid>
                    </Grid>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Alert severity="info">
          Run order: 1) Create Default Subjects, 2) Fix Student Data, 3) open Subject Enrollments (AUTO), 4) Build Preview, 5) Generate Enrollments.
        </Alert>
      </Stack>
    </Box>
  );
}