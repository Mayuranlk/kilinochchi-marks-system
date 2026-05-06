import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { PageContainer, ResponsiveTableWrapper, StatCard } from "../components/ui";

const CURRENT_YEAR = new Date().getFullYear();

function text(value) {
  return String(value || "").trim();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeStatus(value) {
  return text(value || "active").toLowerCase();
}

function isAbsentMark(mark = {}) {
  const absent = mark.absent ?? mark.isAbsent ?? mark.attendanceStatus ?? mark.status;
  if (typeof absent === "boolean") return absent;
  return ["absent", "ab", "true", "yes", "1"].includes(String(absent || "").trim().toLowerCase());
}

function getClassName(row = {}) {
  return text(row.fullClassName || row.alClassName || row.className) || `${row.grade}${row.section || ""}`;
}

function getYear(row = {}) {
  return Number(row.academicYear || row.year || 0);
}

export default function SectionalHeadDashboard() {
  const navigate = useNavigate();
  const { profile, assignedGrades } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [marks, setMarks] = useState([]);
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [studentSnap, classroomSnap, enrollmentSnap, markSnap, termSnap] = await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "classrooms")),
          getDocs(collection(db, "studentSubjectEnrollments")),
          getDocs(collection(db, "marks")),
          getDocs(collection(db, "academicTerms")),
        ]);

        setStudents(studentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setClassrooms(classroomSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setEnrollments(enrollmentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setMarks(markSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setTerms(termSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Sectional head dashboard load failed:", err);
        setError(err.message || "Failed to load sectional head dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const gradeSet = useMemo(() => new Set((assignedGrades || []).map(Number)), [assignedGrades]);
  const activeTerm = useMemo(() => terms.find((term) => term.isActive) || terms[0] || null, [terms]);
  const activeTermName = text(activeTerm?.term || activeTerm?.termName || "");
  const activeYear = Number(activeTerm?.year || activeTerm?.academicYear || CURRENT_YEAR);

  const scopedStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          gradeSet.has(parseGrade(student.grade)) &&
          normalizeStatus(student.status) === "active"
      ),
    [students, gradeSet]
  );

  const scopedClassrooms = useMemo(
    () =>
      classrooms.filter(
        (classroom) =>
          gradeSet.has(parseGrade(classroom.grade)) &&
          (!getYear(classroom) || getYear(classroom) === activeYear)
      ),
    [classrooms, gradeSet, activeYear]
  );

  const scopedEnrollments = useMemo(
    () =>
      enrollments.filter(
        (enrollment) =>
          gradeSet.has(parseGrade(enrollment.grade || enrollment.className)) &&
          normalizeStatus(enrollment.status) !== "inactive" &&
          (!getYear(enrollment) || getYear(enrollment) === activeYear)
      ),
    [enrollments, gradeSet, activeYear]
  );

  const scopedMarks = useMemo(
    () =>
      marks.filter(
        (mark) =>
          gradeSet.has(parseGrade(mark.grade || mark.className)) &&
          (!activeTermName || text(mark.termName || mark.term) === activeTermName) &&
          (!getYear(mark) || getYear(mark) === activeYear)
      ),
    [marks, gradeSet, activeTermName, activeYear]
  );

  const classRows = useMemo(() => {
    return scopedClassrooms
      .map((classroom) => {
        const grade = parseGrade(classroom.grade);
        const className = getClassName(classroom);
        const studentCount = scopedStudents.filter(
          (student) => parseGrade(student.grade) === grade && text(student.section || student.className) === text(classroom.section || classroom.className)
        ).length;
        const markCount = scopedMarks.filter((mark) => getClassName(mark) === className).length;
        const absentCount = scopedMarks.filter((mark) => getClassName(mark) === className && isAbsentMark(mark)).length;

        return {
          className,
          grade,
          studentCount,
          markCount,
          absentCount,
          classTeacher: text(classroom.classTeacherName || classroom.teacherName || "-"),
        };
      })
      .sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className, undefined, { numeric: true }));
  }, [scopedClassrooms, scopedStudents, scopedMarks]);

  if (!assignedGrades.length) {
    return (
      <PageContainer title="Sectional Head Dashboard">
        <Alert severity="warning">
          No assigned grades found for {profile?.name || "this sectional head"}. Ask an admin to set assigned grades in the user profile.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Sectional Head Dashboard"
      subtitle={`Assigned Grade(s): ${assignedGrades.join(", ")} | ${activeTermName || "No active exam"} ${activeYear || ""}`}
    >
      <Stack spacing={2.5}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <StatCard title="Active Students" value={scopedStudents.length} icon={<GroupsRoundedIcon />} />
              </Grid>
              <Grid item xs={12} md={3}>
                <StatCard title="Classes" value={scopedClassrooms.length} icon={<SchoolRoundedIcon />} color="success" />
              </Grid>
              <Grid item xs={12} md={3}>
                <StatCard title="Subject Enrollments" value={scopedEnrollments.length} icon={<AssessmentRoundedIcon />} color="warning" />
              </Grid>
              <Grid item xs={12} md={3}>
                <StatCard title="Absent Entries" value={scopedMarks.filter(isAbsentMark).length} icon={<WarningAmberRoundedIcon />} color="error" />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Button fullWidth variant="contained" startIcon={<AssessmentRoundedIcon />} onClick={() => navigate("/sectional-head/class-marks-reports")}>
                  Class Marks Reports
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button fullWidth variant="contained" color="success" startIcon={<BarChartRoundedIcon />} onClick={() => navigate("/sectional-head/subject-analysis")}>
                  Subject Analysis
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button fullWidth variant="outlined" startIcon={<FactCheckRoundedIcon />} onClick={() => navigate("/sectional-head/classwise-list")}>
                  Classwise Lists
                </Button>
              </Grid>
            </Grid>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
                  Assigned Classes
                </Typography>
                <ResponsiveTableWrapper minWidth={760}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Class</TableCell>
                        <TableCell>Class Teacher</TableCell>
                        <TableCell align="right">Students</TableCell>
                        <TableCell align="right">Saved Mark Entries</TableCell>
                        <TableCell align="right">Absent Entries</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {classRows.map((row) => (
                        <TableRow key={row.className}>
                          <TableCell sx={{ fontWeight: 800 }}>{row.className}</TableCell>
                          <TableCell>{row.classTeacher}</TableCell>
                          <TableCell align="right">{row.studentCount}</TableCell>
                          <TableCell align="right">{row.markCount}</TableCell>
                          <TableCell align="right">{row.absentCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableWrapper>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
