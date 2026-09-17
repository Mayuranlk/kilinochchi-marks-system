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
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import { useAuth } from "../context/AuthContext";
import {
  restoreOfficialSubjects,
  fixStudentData,
  repairStudentNames,
  scanStudentNameIssues,
} from "../services/setupDefaultsService";
import { PageContainer } from "../components/ui";

function StatCard({ title, value, color = "text.primary" }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "divider",
        boxShadow: 1,
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
        borderColor: "divider",
        boxShadow: 1,
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
  const [scanningNames, setScanningNames] = useState(false);
  const [repairingNames, setRepairingNames] = useState(false);

  const [subjectResult, setSubjectResult] = useState(null);
  const [studentResult, setStudentResult] = useState(null);
  const [nameRepairPreview, setNameRepairPreview] = useState(null);
  const [nameRepairResult, setNameRepairResult] = useState(null);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleCreateSubjects() {
    setSuccess("");
    setError("");
    setLoadingSubjects(true);

    try {
      const result = await restoreOfficialSubjects(profile);
      setSubjectResult(result);
      setSuccess(
        `Official subjects repaired. Created: ${result.created}, refreshed/reactivated: ${result.restored}. Compulsory subjects now cover their correct grade ranges.`
      );
    } catch (err) {
      setError("Failed to create default subjects: " + (err.message || "Unknown error"));
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
      setError("Failed to fix student data: " + (err.message || "Unknown error"));
    } finally {
      setLoadingStudents(false);
    }
  }

  async function handleScanStudentNames() {
    setSuccess("");
    setError("");
    setNameRepairResult(null);
    setScanningNames(true);

    try {
      const result = await scanStudentNameIssues();
      setNameRepairPreview(result);
      setSuccess(
        result.affectedStudents
          ? `Name scan complete. ${result.affectedStudents} student record(s) need normalization. Review the preview before applying.`
          : "Name scan complete. No corrupted student names were found."
      );
    } catch (err) {
      setError("Failed to scan student names: " + (err.message || "Unknown error"));
    } finally {
      setScanningNames(false);
    }
  }

  async function handleRepairStudentNames() {
    if (!nameRepairPreview?.affectedStudents && !nameRepairPreview?.dependentDocuments) {
      return;
    }

    const confirmed = window.confirm(
      `Normalize ${nameRepairPreview.affectedStudents} student name(s) and synchronize ${nameRepairPreview.dependentDocuments} related document(s)? Original master names will be retained in a backup field.`
    );
    if (!confirmed) return;

    setSuccess("");
    setError("");
    setRepairingNames(true);

    try {
      const result = await repairStudentNames(profile);
      setNameRepairResult(result);
      setNameRepairPreview(null);
      setSuccess(
        `Student name normalization complete. ${result.affectedStudents} student record(s) and ${result.dependentDocuments} related document(s) updated.`
      );
    } catch (err) {
      setError("Failed to normalize student names: " + (err.message || "Unknown error"));
    } finally {
      setRepairingNames(false);
    }
  }

  if (!isAdmin) {
    return (
      <PageContainer title="School Setup">
        <Alert severity="error">Only admin can access school setup tools.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Box
          sx={{
            bgcolor: "background.paper",
            borderRadius: 3,
            p: { xs: 2, md: 3 },
            border: "1px solid",
            borderColor: "divider",
            boxShadow: 1,
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
              <SchoolIcon sx={{ color: "primary.main" }} />
              <Typography variant="h5" fontWeight={800} color="primary.main">
                School Setup
              </Typography>
              <Chip label="Setup Only" color="primary" size="small" />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              One-time and occasional maintenance tools for preparing subject definitions
              and cleaning compatibility fields in student records.
            </Typography>

            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              This page seeds the baseline subject catalog, including A/L common subjects:
              <strong> Common General Test</strong>,
              <strong> General English</strong>, and
              <strong> General Information Technology</strong> for Grade 12.
            </Alert>

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
          <Grid size={{ xs: 12, md: 4 }}>
            <StatCard
              title="Default Subjects Run"
              value={subjectResult ? "Done" : "Pending"}
              color={subjectResult ? "success.main" : "text.primary"}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <StatCard
              title="Student Schema Fix Run"
              value={studentResult ? "Done" : "Pending"}
              color={studentResult ? "secondary.main" : "text.primary"}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <StatCard title="Enrollment Authority" value="studentSubjectEnrollments" />
          </Grid>
        </Grid>

        <ActionCard
          icon={<PlaylistAddCheckIcon />}
          title="Repair Official Subjects"
          description="Creates missing definitions and repairs existing official subjects, including compulsory grade ranges, religion, aesthetic, basket and A/L subjects."
          buttonText="Repair Official Subjects"
          onClick={handleCreateSubjects}
          loading={loadingSubjects}
          color="primary"
        >
          <Alert severity="info" icon={<FactCheckIcon />}>
            A/L common subject seeding is now grade-aware:
            <strong> Common General Test</strong> and
            <strong> General English</strong> apply to Grades 12 and 13, while
            <strong> GIT</strong> applies to Grade 12 only.
          </Alert>

          {subjectResult && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatCard title="Created" value={subjectResult.created} color="success.main" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatCard title="Refreshed" value={subjectResult.restored} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
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
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatCard title="Updated" value={studentResult.updated} color="secondary.main" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatCard title="Unchanged" value={studentResult.unchanged} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatCard title="Total" value={studentResult.total} />
              </Grid>
            </Grid>
          )}
        </ActionCard>

        <ActionCard
          icon={<SpellcheckIcon />}
          title="Normalize Student Names"
          description="Scans the entire school for damaged Excel-imported names, hidden characters and inconsistent stored name copies. It preserves Tamil and English Unicode, letter case and legitimate ampersands."
          buttonText="Scan Student Names"
          onClick={handleScanStudentNames}
          loading={scanningNames}
          color="primary"
        >
          <Alert severity="info">
            This repairs stored text, not just the display font. Names matching patterns such as
            <strong> &amp;&amp;R&amp;A&amp;M&amp;A...</strong> are safely converted to normal text,
            then synchronized to marks, subject enrollments, student accounts and late-arrival records.
          </Alert>

          {(nameRepairPreview || nameRepairResult) && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <StatCard
                  title="Students Scanned"
                  value={(nameRepairPreview || nameRepairResult).studentsScanned}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <StatCard
                  title="Names Found"
                  value={(nameRepairPreview || nameRepairResult).affectedStudents}
                  color={(nameRepairPreview || nameRepairResult).affectedStudents ? "warning.main" : "success.main"}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <StatCard
                  title="10C Names Found"
                  value={(nameRepairPreview || nameRepairResult).byClass?.["10C"] || 0}
                  color={(nameRepairPreview || nameRepairResult).byClass?.["10C"] ? "warning.main" : "success.main"}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <StatCard
                  title="Related Records"
                  value={(nameRepairPreview || nameRepairResult).dependentDocuments}
                />
              </Grid>
            </Grid>
          )}

          {nameRepairPreview?.samples?.length > 0 && (
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Preview - no data has been changed yet
              </Typography>
              <Stack spacing={0.75}>
                {nameRepairPreview.samples.slice(0, 10).map((item) => (
                  <Typography key={item.id} variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    <strong>{item.className} | {item.admissionNo || item.id}:</strong>{" "}
                    {item.before || "(empty)"} -&gt; <strong>{item.after}</strong>
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}

          {nameRepairPreview &&
            (nameRepairPreview.affectedStudents > 0 ||
              nameRepairPreview.dependentDocuments > 0) && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={repairingNames ? null : <SpellcheckIcon />}
                  disabled={repairingNames}
                  onClick={handleRepairStudentNames}
                  sx={{ alignSelf: "flex-start", fontWeight: 800 }}
                >
                  {repairingNames ? <CircularProgress size={20} color="inherit" /> : "Apply School-wide Name Repair"}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  A copy of each original master name is retained in the student document.
                </Typography>
              </Stack>
            )}
        </ActionCard>

        <Card
          variant="outlined"
          sx={{
            borderColor: "divider",
            bgcolor: "background.paper",
            borderRadius: 3,
            boxShadow: 1,
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
                2. Confirm A/L common subjects are present:
                <strong> Common General Test</strong>,
                <strong> General English</strong>,
                <strong> GIT</strong>
              </Typography>
              <Typography variant="body2">
                3. Run <strong>Fix Student Data</strong>
              </Typography>
              <Typography variant="body2">
                4. Open <strong>Generate Subject Enrollments</strong>
              </Typography>
              <Typography variant="body2">
                5. Review results in <strong>Student Subject Enrollments</strong>
              </Typography>
              <Typography variant="body2">
                6. Open <strong>Marks Entry</strong> and verify enrolled subjects load correctly
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Alert severity="info">
          This page is setup-only. Enrollment generation and enrollment correction must be handled through the dedicated enrollment pages, not through student profile defaults.
        </Alert>
      </Stack>
    </PageContainer>
  );
}
