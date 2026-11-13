import { academicDisplay } from "../utils/academicDisplay";
import React, { useCallback, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem,
  Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { EmptyState, PageContainer, StatCard } from "../components/ui";
import { buildAcademicHealthReport } from "../utils/academicDataHealth";
import { restoreOfficialSubjects } from "../services/setupDefaultsService";
import { generateMissingEnrollments } from "../services/enrollmentGenerator";

const currentYear = String(new Date().getFullYear());
const SAFE_FIX_TYPES = new Set([
  "Missing compulsory enrollment",
]);

export default function AcademicDataHealth() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({ students: [], subjects: [], enrollments: [], marks: [] });
  const [year, setYear] = useState(currentYear);
  const [type, setType] = useState("all");
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const yearValues = [year, Number(year)].filter(
        (value, index, values) =>
          Number.isFinite(Number(value)) &&
          values.findIndex((item) => typeof item === typeof value && item === value) === index
      );
      const loadYearRows = async (collectionName) => {
        const variants = ["academicYear", "year"].flatMap((field) =>
          yearValues.map((value) => ({ field, value }))
        );
        const read = ({ field, value }) =>
          getDocs(query(collection(db, collectionName), where(field, "==", value)));
        const primary = await read(variants[0]);
        const snapshots = primary.docs.length
          ? [primary]
          : await Promise.all(variants.slice(1).map(read));
        return [
          ...new Map(
            snapshots
              .flatMap((snapshot) =>
                snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
              )
              .map((item) => [item.id, item])
          ).values(),
        ];
      };
      const map = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const [students, subjects, enrollments, marks] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "subjects")),
        loadYearRows("studentSubjectEnrollments"),
        loadYearRows("marks"),
      ]);
      setData({
        students: map(students),
        subjects: map(subjects),
        enrollments,
        marks,
      });
      setHasRun(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not run academic data checks.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  const years = useMemo(() => {
    const values = new Set([currentYear]);
    [...data.enrollments, ...data.marks].forEach((item) => {
      const match = String(item.academicYear || item.year || "").match(/\d{4}/);
      if (match) values.add(match[0]);
    });
    return [...values].sort((a, b) => Number(b) - Number(a));
  }, [data]);

  const report = useMemo(() =>
    buildAcademicHealthReport({ ...data, academicYear: year }), [data, year]);
  const issueTypes = useMemo(() => Object.keys(report.byType).sort(), [report.byType]);
  const visibleIssues = type === "all"
    ? report.issues
    : report.issues.filter((issue) => issue.type === type);

  const exportCsv = () => {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Severity", "Issue", "Student", "Index No", "Class", "Details"],
      ...visibleIssues.map((issue) => [
        issue.severity, issue.type, issue.student, issue.indexNo, issue.className, issue.detail,
      ]),
    ];
    const blob = new Blob(["\ufeff", rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `academic-data-health-${year}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const runSafeFixes = async () => {
    setFixing(true);
    setError("");
    setFixResult(null);
    try {
      const subjectResult = await restoreOfficialSubjects(profile);
      const enrollmentResult = await generateMissingEnrollments({ academicYear: year });
      setFixResult({
        subjectsCreated: subjectResult.created || 0,
        subjectsRepaired: subjectResult.restored || 0,
        enrollmentsCreated: enrollmentResult.created || 0,
        enrollmentsReactivated: enrollmentResult.reactivated || 0,
        enrollmentsUpdated: enrollmentResult.updated || 0,
        skipped: enrollmentResult.skipped || 0,
        errors: enrollmentResult.errors || 0,
      });
      setFixDialogOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      setError(err.message || "Safe repair could not be completed.");
    } finally {
      setFixing(false);
    }
  };

  return (
    <PageContainer title="Academic Data Health"
      subtitle="Find enrollment, subject, student and marks problems before they affect reports.">
      <Stack spacing={2.5}>
        <Alert severity={!hasRun ? "info" : report.totals.errors ? "error" : report.totals.warnings ? "warning" : "success"}>
          {!hasRun
            ? "Choose an academic year and run the audit. Data is loaded only when requested."
            : academicDisplay(report.issues.length
              ? report.totals.errors + " critical and " + report.totals.warnings + " warning issues need review."
              : "No academic data problems detected for " + year + ".")}
        </Alert>
        {fixResult && <Alert severity={fixResult.errors ? "warning" : "success"} onClose={() => setFixResult(null)}>
          Safe fixes completed: {academicDisplay(fixResult.subjectsCreated)} subjects created, {academicDisplay(fixResult.subjectsRepaired)} repaired,
          {" "}{fixResult.enrollmentsCreated} enrollments created, {fixResult.enrollmentsReactivated} reactivated,
          {" "}{fixResult.enrollmentsUpdated} updated. {fixResult.skipped} students need manual data review.
        </Alert>}

        <Card variant="outlined"><CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
            sx={{ flexWrap: { sm: "wrap" }, rowGap: 2 }}>
            <TextField select label="Academic year" value={year} onChange={(e) => setYear(e.target.value)} sx={{ minWidth: 180 }}>
              {years.map((value) => <MenuItem key={value} value={value}>{academicDisplay(value)}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label="Issue type" value={type} onChange={(e) => setType(e.target.value)}>
              <MenuItem value="all">All issues ({academicDisplay(report.issues.length)})</MenuItem>
              {issueTypes.map((value) => <MenuItem key={value} value={value}>{academicDisplay(value)} ({academicDisplay(report.byType[value])})</MenuItem>)}
            </TextField>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>{hasRun ? "Refresh audit" : "Run audit"}</Button>
            <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={exportCsv} disabled={!hasRun || !visibleIssues.length}>Export</Button>
            <Button color="success" variant="contained" startIcon={<AutoFixHighRoundedIcon />}
              onClick={() => setFixDialogOpen(true)} disabled={!hasRun || loading || fixing}>
              Safe fixes
            </Button>
          </Stack>
        </CardContent></Card>

        {loading ? <Box textAlign="center" py={8}><CircularProgress /></Box> : error ? <Alert severity="error">{academicDisplay(error)}</Alert> : !hasRun ? (
          <EmptyState icon={<HealthAndSafetyRoundedIcon />}
            title="Audit ready" description="Run the selected-year audit when you need a full data health check." />
        ) : <>
          <Stack direction="row" spacing={1.5} sx={{ overflowX: "auto", pb: 1 }}>
            <Box minWidth={160}><StatCard title="Active students" value={report.totals.students} /></Box>
            <Box minWidth={160}><StatCard title="Active subjects" value={report.totals.subjects} /></Box>
            <Box minWidth={160}><StatCard title={academicDisplay(`${year} enrollments`)} value={report.totals.enrollments} /></Box>
            <Box minWidth={160}><StatCard title="Critical issues" value={report.totals.errors} color="error" /></Box>
          </Stack>

          {!visibleIssues.length ? <EmptyState icon={<HealthAndSafetyRoundedIcon />}
            title="Data looks healthy" description="No issues match the selected year and filter." /> :
            <Stack spacing={1.25}>
              {visibleIssues.map((issue, index) => <Card key={`${issue.type}-${issue.indexNo}-${index}`} variant="outlined"
                sx={{ borderLeft: "5px solid", borderLeftColor: issue.severity === "error" ? "error.main" : "warning.main" }}>
                <CardContent>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography fontWeight={850}>{issue.type}</Typography>
                      {(issue.student || issue.className) && <Typography variant="body2" color="text.secondary">
                        {academicDisplay([issue.student, issue.indexNo && `Index ${issue.indexNo}`, issue.className].filter(Boolean).join(" · "))}
                      </Typography>}
                      <Typography mt={.75}>{academicDisplay(issue.detail)}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {SAFE_FIX_TYPES.has(issue.type) && <Chip size="small" color="success" variant="outlined" label="Safe fix available" />}
                      <Chip size="small" color={issue.severity === "error" ? "error" : "warning"} label={academicDisplay(issue.severity)} />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>)}
            </Stack>}
        </>}
      </Stack>
      <Dialog open={fixDialogOpen} onClose={() => !fixing && setFixDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Run safe academic data fixes?</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will repair official subject definitions and generate missing active enrollments for {year}.
            Existing marks and student records will not be deleted.
          </Alert>
          <Typography fontWeight={800} mb={1}>Automatically handled</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Missing compulsory enrollments, inactive official subjects, incorrect official grade ranges,
            and missing standard subject definitions.
          </Typography>
          <Typography fontWeight={800} mb={1}>Still requires review</Typography>
          <Typography variant="body2" color="text.secondary">
            Duplicate student index numbers, orphan records, conflicting duplicates, missing student profile
            choices, and marks that cannot be matched safely.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFixDialogOpen(false)} disabled={fixing}>Cancel</Button>
          <Button color="success" variant="contained" onClick={runSafeFixes} disabled={fixing}>
            {fixing ? "Repairing…" : "Confirm safe fixes"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
