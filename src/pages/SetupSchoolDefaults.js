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
  Chip,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { useAuth } from "../context/AuthContext";
import {
  createDefaultSubjects,
  fixStudentData,
} from "../services/setupDefaultsService";

function StatCard({ title, value, color = "text.primary" }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "#e8eaf6",
        boxShadow: "0 1px 4px rgba(26,35,126,0.05)",
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }} color={color}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  loading,
  color = "primary",
  children,
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: "#e8eaf6",
        boxShadow: "0 2px 8px rgba(26,35,126,0.05)",
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {icon}
            <Typography variant="h6" fontWeight={700}>
              {title}
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>

          <Button
            variant="contained"
            color={color}
            startIcon={loading ? null : icon}
            onClick={onClick}
            disabled={loading}
            sx={{ alignSelf: "flex-start", fontWeight: 700, borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : buttonText}
          </Button>

          {children}
        </Stack>
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
        `Student schema cleanup complete: ${result.updated} updated, ${result.unchanged} unchanged.`
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
        <Box
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            p: { xs: 2, md: 3 },
            border: "1px solid #e8eaf6",
            boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
              <SchoolIcon sx={{ color: "#1a237e" }} />
              <Typography variant="h5" fontWeight={800} color="#1a237e">
                School Setup
              </Typography>
              <Chip label="Setup Only" color="primary" size="small" />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              One-time and occasional maintenance tools for preparing subject definitions
              and cleaning compatibility fields in student records.
            </Typography>

            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              This page does <strong>not</strong> decide actual subject membership.
              Canonical subject assignment must come from
              <strong> studentSubjectEnrollments</strong>.
            </Alert>
          </Stack>
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
              color={subjectResult ? "success.main" : "text.primary"}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <StatCard
              title="Student Schema Fix Run"
              value={studentResult ? "Done" : "Pending"}
              color={studentResult ? "secondary.main" : "text.primary"}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <StatCard title="Enrollment Authority" value="studentSubjectEnrollments" />
          </Grid>
        </Grid>

        <ActionCard
          icon={<PlaylistAddCheckIcon />}
          title="Create Default Subjects"
          description="Creates missing subject definitions required by the system, such as core subjects, religion subjects, aesthetic subjects, and other baseline catalog subjects used across grades."
          buttonText="Create Default Subjects"
          onClick={handleCreateSubjects}
          loading={loadingSubjects}
          color="primary"
        >
          {subjectResult && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <StatCard title="Created" value={subjectResult.created} color="success.main" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatCard title="Skipped" value={subjectResult.skipped} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatCard title="Templates" value={subjectResult.totalDefaults} />
              </Grid>
            </Grid>
          )}
        </ActionCard>

        <ActionCard
          icon={<AutoFixHighIcon />}
          title="Fix Student Data"
          description="Normalizes compatibility fields in student records for safer schema alignment. This is only a cleanup tool for student document consistency and should not be treated as the final source of subject membership."
          buttonText="Fix Student Data"
          onClick={handleFixStudents}
          loading={loadingStudents}
          color="secondary"
        >
          <Alert severity="warning" icon={<FactCheckIcon />}>
            This tool may normalize fields like section, className compatibility, and old profile-based options,
            but real subject assignment must still be reviewed through
            <strong> Generate Subject Enrollments</strong> and
            <strong> Student Subject Enrollments</strong>.
          </Alert>

          {studentResult && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <StatCard title="Updated" value={studentResult.updated} color="secondary.main" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatCard title="Unchanged" value={studentResult.unchanged} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatCard title="Total" value={studentResult.total} />
              </Grid>
            </Grid>
          )}
        </ActionCard>

        <Card
          variant="outlined"
          sx={{
            borderColor: "#c5cae9",
            bgcolor: "#fafbff",
            borderRadius: 3,
            boxShadow: "0 1px 6px rgba(26,35,126,0.04)",
          }}
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
                3. Open <strong>Generate Subject Enrollments</strong>
              </Typography>
              <Typography variant="body2">
                4. Review results in <strong>Student Subject Enrollments</strong>
              </Typography>
              <Typography variant="body2">
                5. Open <strong>Marks Entry</strong> and verify enrolled subjects load correctly
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Alert severity="info">
          This page is setup-only. Enrollment generation and enrollment correction must be handled through the dedicated enrollment pages, not through student profile defaults.
        </Alert>
      </Stack>
    </Box>
  );
}