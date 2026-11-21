import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableViewRoundedIcon from "@mui/icons-material/TableViewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { db } from "../../firebase";
import { getCollectionRows } from "../../services/firestoreReadCache";
import { PageContainer, ResponsiveTableWrapper } from "../../components/ui";
import {
  buildTextBookRequestIndex,
  createTextBookRequestReport,
} from "../../utils/textBookRequestReport";
import {
  exportTextBookRequestExcel,
  exportTextBookRequestPdf,
} from "../../utils/textBookRequestExportUtils";

const CURRENT_YEAR = new Date().getFullYear();

const normalize = (value) => String(value ?? "").trim();
const getYear = (row = {}) => Number(row.academicYear || row.year || row.academicYearKey || 0) || 0;
const getMedium = (row = {}) => normalize(row.medium || row.teachingMedium || row.rankingMedium);
const getStream = (row = {}) => normalize(row.stream || row.alStream || row.studyStream);

function SummaryCard({ label, value, color = "primary.main" }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={800} color={color}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function CountBreakdownTable({ report }) {
  const rows = report.scope === "school" ? report.gradeBreakdown : report.classBreakdown;
  if (!rows.length) return null;

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
          {report.scope === "school" ? "Grade Summary" : "Class / Division Summary"}
        </Typography>
        <ResponsiveTableWrapper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{report.scope === "school" ? "Grade" : "Division"}</TableCell>
                <TableCell align="right">Male</TableCell>
                <TableCell align="right">Female</TableCell>
                <TableCell align="right">Unknown</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={report.scope === "school" ? row.grade : row.id}>
                  <TableCell>{report.scope === "school" ? `Grade ${row.grade}` : row.className}</TableCell>
                  <TableCell align="right">{row.male}</TableCell>
                  <TableCell align="right">{row.female}</TableCell>
                  <TableCell align="right">{row.unknown}</TableCell>
                  <TableCell align="right"><strong>{row.total}</strong></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableWrapper>
      </CardContent>
    </Card>
  );
}

function SubjectRequirementTable({ report }) {
  const showClassColumns = report.scope === "grade" && report.classes.length > 1;
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
          Subject Textbook Requirements
        </Typography>
        {!report.subjectRows.length ? (
          <Alert severity="info">No active subject enrollments match the selected filters.</Alert>
        ) : (
          <ResponsiveTableWrapper>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>No</TableCell>
                  <TableCell>Subject</TableCell>
                  {showClassColumns && report.classes.map((row) => (
                    <TableCell key={row.id} align="right">{row.className}</TableCell>
                  ))}
                  {!showClassColumns && <TableCell align="right">Students Taking Subject</TableCell>}
                  <TableCell align="right">Books Required</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.subjectRows.map((subject, index) => (
                  <TableRow key={subject.id} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{subject.name}</TableCell>
                    {showClassColumns && report.classes.map((row) => (
                      <TableCell key={row.id} align="right">{subject.byClass[row.id] || 0}</TableCell>
                    ))}
                    {!showClassColumns && <TableCell align="right">{subject.total}</TableCell>}
                    <TableCell align="right"><strong>{subject.booksRequired}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableWrapper>
        )}
      </CardContent>
    </Card>
  );
}

export default function TextBookRequestReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [academicYear, setAcademicYear] = useState(CURRENT_YEAR);
  const [scope, setScope] = useState("school");
  const [grade, setGrade] = useState("");
  const [classId, setClassId] = useState("");
  const [medium, setMedium] = useState("");
  const [stream, setStream] = useState("");

  async function loadData(forceRefresh = false) {
    try {
      setLoading(true);
      setError("");
      const [studentRows, enrollmentRows, subjectRows, classroomRows] = await Promise.all([
        getCollectionRows(db, "students", { forceRefresh }),
        getCollectionRows(db, "studentSubjectEnrollments", { forceRefresh }),
        getCollectionRows(db, "subjects", { forceRefresh }),
        getCollectionRows(db, "classrooms", { forceRefresh }),
      ]);
      setStudents(studentRows);
      setEnrollments(enrollmentRows);
      setSubjects(subjectRows);
      setClassrooms(classroomRows);
      const years = classroomRows.map(getYear).filter(Boolean).sort((a, b) => b - a);
      if (years.length && !years.includes(academicYear)) setAcademicYear(years[0]);
    } catch (err) {
      console.error("Text Book Request load failed:", err);
      setError(err.message || "Failed to load Text Book Request data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Cached collections are loaded once; filters operate on the local index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableYears = useMemo(
    () => [...new Set(classrooms.map(getYear).filter(Boolean))].sort((a, b) => b - a),
    [classrooms]
  );
  const index = useMemo(
    () => buildTextBookRequestIndex({ students, enrollments, subjects, classrooms, academicYear }),
    [students, enrollments, subjects, classrooms, academicYear]
  );
  const grades = useMemo(
    () => [...new Set(index.classrooms.map((row) => row.grade))].sort((a, b) => a - b),
    [index]
  );
  const classesForGrade = useMemo(
    () => index.classrooms.filter((row) => !grade || row.grade === Number(grade)),
    [index, grade]
  );
  const mediums = useMemo(
    () => [...new Set([...index.classrooms.map(getMedium), ...index.students.map(getMedium)].filter(Boolean))].sort(),
    [index]
  );
  const streams = useMemo(
    () => [...new Set([...index.classrooms.map(getStream), ...index.students.map(getStream)].filter(Boolean))].sort(),
    [index]
  );
  const report = useMemo(
    () => createTextBookRequestReport(index, { scope, grade, classId, medium, stream }),
    [index, scope, grade, classId, medium, stream]
  );

  function changeScope(nextScope) {
    setScope(nextScope);
    if (nextScope === "school") {
      setGrade("");
      setClassId("");
    } else if (nextScope === "grade") {
      setClassId("");
    }
  }

  return (
    <PageContainer
      title="Text Book Request"
      subtitle="Textbook quantities derived from active students and unique active subject enrollments."
    >
      <Stack spacing={3}>
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Academic Year</InputLabel>
                  <Select value={academicYear} label="Academic Year" onChange={(e) => setAcademicYear(Number(e.target.value))}>
                    {availableYears.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Scope</InputLabel>
                  <Select value={scope} label="Scope" onChange={(e) => changeScope(e.target.value)}>
                    <MenuItem value="school">Whole School</MenuItem>
                    <MenuItem value="grade">Grade</MenuItem>
                    <MenuItem value="class">Class / Division</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {scope !== "school" && (
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Grade</InputLabel>
                    <Select value={grade} label="Grade" onChange={(e) => { setGrade(e.target.value); setClassId(""); }}>
                      {grades.map((item) => <MenuItem key={item} value={item}>Grade {item}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {scope === "class" && (
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Class / Division</InputLabel>
                    <Select value={classId} label="Class / Division" onChange={(e) => setClassId(e.target.value)} disabled={!grade}>
                      {classesForGrade.map((row) => <MenuItem key={row.id} value={row.id}>{row.className}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Medium</InputLabel>
                  <Select value={medium} label="Medium" onChange={(e) => setMedium(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {mediums.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stream</InputLabel>
                  <Select value={stream} label="Stream" onChange={(e) => setStream(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {streams.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
              <Button startIcon={<RefreshRoundedIcon />} variant="outlined" onClick={() => loadData(true)} disabled={loading}>
                Refresh
              </Button>
              <Button startIcon={<PictureAsPdfRoundedIcon />} variant="contained" onClick={() => exportTextBookRequestPdf(report)} disabled={loading || !report.summary.total}>
                PDF
              </Button>
              <Button startIcon={<TableViewRoundedIcon />} variant="contained" color="success" onClick={() => exportTextBookRequestExcel(report)} disabled={loading || !report.summary.total}>
                Excel
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>}
        {!!error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && (
          <>
            {(scope === "grade" && !grade) || (scope === "class" && (!grade || !classId)) ? (
              <Alert severity="info">Select the required {scope === "class" ? "grade and class" : "grade"}.</Alert>
            ) : (
              <>
                <Typography variant="h5" fontWeight={800}>
                  Text Book Request — {academicYear}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, md: 2.4 }}><SummaryCard label="Total Students" value={report.summary.total} /></Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}><SummaryCard label="Male" value={report.summary.male} color="info.main" /></Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}><SummaryCard label="Female" value={report.summary.female} color="secondary.main" /></Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}><SummaryCard label="Unknown" value={report.summary.unknown} color="warning.main" /></Grid>
                  <Grid size={{ xs: 12, md: 2.4 }}><SummaryCard label="Subjects" value={report.subjectRows.length} color="success.main" /></Grid>
                </Grid>
                <CountBreakdownTable report={report} />
                <SubjectRequirementTable report={report} />
              </>
            )}
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
