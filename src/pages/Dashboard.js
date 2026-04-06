import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
  useMediaQuery,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Card,
  CardContent,
} from "@mui/material";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import GradingRoundedIcon from "@mui/icons-material/GradingRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { db } from "../firebase";
import {
  EmptyState,
  MobileListRow,
  PageContainer,
  ResponsiveTableWrapper,
  SectionCard,
  StatCard,
  StatusChip,
} from "../components/ui";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function getStudentName(student) {
  return normalizeText(student?.name || student?.fullName || "Unnamed Student");
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className || "");
}

function getStudentStatus(student) {
  return normalizeText(student?.status || "Active");
}

function isActiveStudent(student) {
  return normalizeLower(getStudentStatus(student)) === "active";
}

function getInitials(name = "") {
  return normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function sortStudents(list) {
  return [...list].sort((a, b) => {
    const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
    if (gradeDiff !== 0) return gradeDiff;

    const sectionDiff = getStudentSection(a).localeCompare(getStudentSection(b));
    if (sectionDiff !== 0) return sectionDiff;

    return getStudentName(a).localeCompare(getStudentName(b));
  });
}

function QuickActionCard({ title, description, buttonText, onClick, icon }) {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 4,
        boxShadow: "0px 8px 24px rgba(15, 23, 42, 0.06)",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(37,99,235,0.10)",
                color: "primary.main",
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>

          <Button
            variant="outlined"
            endIcon={<ArrowForwardRoundedIcon />}
            onClick={onClick}
            fullWidth
          >
            {buttonText}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [marksCount, setMarksCount] = useState(0);
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [enrollmentsCount, setEnrollmentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setLoadError("");

      try {
        const [studSnap, usersSnap, marksSnap, subjectsSnap, enrollmentsSnap] =
          await Promise.all([
            getDocs(collection(db, "students")),
            getDocs(collection(db, "users")),
            getDocs(collection(db, "marks")),
            getDocs(collection(db, "subjects")),
            getDocs(collection(db, "studentSubjectEnrollments")),
          ]);

        const loadedStudents = studSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const loadedUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setStudents(sortStudents(loadedStudents));
        setTeachers(loadedUsers.filter((u) => normalizeLower(u.role) === "teacher"));
        setMarksCount(marksSnap.size);
        setSubjectsCount(subjectsSnap.size);
        setEnrollmentsCount(enrollmentsSnap.size);
      } catch (error) {
        console.error("Dashboard load error:", error);
        setLoadError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  const activeStudents = useMemo(
    () => students.filter((s) => isActiveStudent(s)),
    [students]
  );

  const leftStudents = useMemo(
    () => students.filter((s) => normalizeLower(getStudentStatus(s)) === "left"),
    [students]
  );

  const activeClassesCount = useMemo(() => {
    return new Set(
      activeStudents.map((s) => `${parseGrade(s.grade)}-${getStudentSection(s)}`)
    ).size;
  }, [activeStudents]);

  const recentStudents = useMemo(() => students.slice(0, 6), [students]);

  const statCards = [
    {
      title: "Students",
      value: students.length,
      helperText: `${activeStudents.length} active`,
      icon: <PeopleRoundedIcon />,
      color: "primary",
      onClick: () => navigate("/students"),
    },
    {
      title: "Teachers",
      value: teachers.length,
      helperText: "From users",
      icon: <PersonRoundedIcon />,
      color: "success",
      onClick: () => navigate("/teachers"),
    },
    {
      title: "Marks Records",
      value: marksCount,
      helperText: "Saved documents",
      icon: <GradingRoundedIcon />,
      color: "warning",
      onClick: () => navigate("/marks"),
    },
    {
      title: "Active Classes",
      value: activeClassesCount,
      helperText: "Based on active students",
      icon: <AssessmentRoundedIcon />,
      color: "secondary",
      onClick: () => navigate("/students"),
    },
  ];

  const quickActions = [
    {
      title: "Manage Students",
      description: "Add, edit, bulk upload, and maintain student records.",
      buttonText: "Open Students",
      onClick: () => navigate("/students"),
      icon: <PeopleRoundedIcon />,
    },
    {
      title: "Subject Definitions",
      description: "Manage core, religion, aesthetic, basket, and A/L subject setup.",
      buttonText: "Open Subjects",
      onClick: () => navigate("/subjects"),
      icon: <MenuBookRoundedIcon />,
    },
    {
      title: "Generate Enrollments",
      description: "Rebuild or generate student subject enrollments safely.",
      buttonText: "Open Enrollments",
      onClick: () => navigate("/student-subject-enrollments"),
      icon: <AutoFixHighRoundedIcon />,
    },
  ];

  if (loading) {
    return (
      <PageContainer
        title="Admin Dashboard"
        subtitle="Loading overview of the Kilinochchi Marks Management System..."
      >
        <SectionCard>
          <Stack alignItems="center" spacing={2} py={6}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading dashboard...
            </Typography>
          </Stack>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Admin Dashboard"
      subtitle="Overview of the Kilinochchi Marks Management System"
    >
      <Stack spacing={2}>
        {loadError ? <Alert severity="error">{loadError}</Alert> : null}

        <SectionCard
          sx={{
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(124,58,237,0.04) 100%)",
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <SchoolRoundedIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    School Overview
                  </Typography>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Core system summary, quick access, and recent student activity.
                </Typography>
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ width: { xs: "100%", md: "auto" } }}
              >
                <Button
                  variant="contained"
                  onClick={() => navigate("/marks")}
                  fullWidth={isMobile}
                >
                  Open Marks Entry
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/terms")}
                  fullWidth={isMobile}
                >
                  Academic Terms
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<CheckCircleRoundedIcon />}
                label={`${activeStudents.length} Active Students`}
                color="success"
              />
              <Chip
                icon={<WarningAmberRoundedIcon />}
                label={`${leftStudents.length} Left Students`}
                color="warning"
              />
              <Chip label={`${subjectsCount} Subjects`} color="primary" variant="outlined" />
              <Chip label={`${enrollmentsCount} Enrollments`} color="secondary" variant="outlined" />
            </Stack>
          </Stack>
        </SectionCard>

        <Grid container spacing={1.5}>
          {statCards.map((card) => (
            <Grid item xs={6} md={3} key={card.title}>
              <StatCard
                title={card.title}
                value={card.value}
                helperText={card.helperText}
                icon={card.icon}
                color={card.color}
                sx={{ cursor: "pointer", height: "100%" }}
                onClick={card.onClick}
              />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={1.5}>
          {quickActions.map((item) => (
            <Grid item xs={12} md={4} key={item.title}>
              <QuickActionCard {...item} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={1.5} alignItems="stretch">
          <Grid item xs={12} lg={7}>
            <SectionCard
              title="Recent Students"
              subtitle="Latest student records currently in the system."
              action={
                students.length > 0 ? (
                  <Button variant="outlined" onClick={() => navigate("/students")}>
                    View All
                  </Button>
                ) : null
              }
              sx={{ height: "100%" }}
            >
              {recentStudents.length === 0 ? (
                <EmptyState
                  title="No students added yet"
                  description="Add students to start using the marks system."
                />
              ) : isMobile ? (
                <Stack spacing={1.25}>
                  {recentStudents.map((student) => (
                    <MobileListRow
                      key={student.id}
                      title={getStudentName(student)}
                      subtitle={[
                        student.admissionNo || "No admission no",
                        `G${parseGrade(student.grade)}-${getStudentSection(student) || "—"}`,
                      ].join(" • ")}
                      right={
                        <Avatar
                          sx={{
                            width: 52,
                            height: 52,
                            bgcolor: "primary.main",
                            fontSize: 20,
                            fontWeight: 800,
                          }}
                        >
                          {getInitials(getStudentName(student))}
                        </Avatar>
                      }
                      footer={
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <StatusChip
                            status={isActiveStudent(student) ? "active" : "inactive"}
                            label={getStudentStatus(student)}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/report/${student.id}`)}
                          >
                            View Report
                          </Button>
                        </Stack>
                      }
                    />
                  ))}
                </Stack>
              ) : (
                <ResponsiveTableWrapper minWidth={820}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Admission No</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Grade</TableCell>
                        <TableCell>Section</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentStudents.map((student) => (
                        <TableRow key={student.id} hover>
                          <TableCell>{student.admissionNo || "—"}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: "primary.main",
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {getInitials(getStudentName(student))}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {getStudentName(student)}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{`G${parseGrade(student.grade)}`}</TableCell>
                          <TableCell>{getStudentSection(student) || "—"}</TableCell>
                          <TableCell>
                            <StatusChip
                              status={isActiveStudent(student) ? "active" : "inactive"}
                              label={getStudentStatus(student)}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate(`/report/${student.id}`)}
                            >
                              Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableWrapper>
              )}
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={5}>
            <SectionCard
              title="System Snapshot"
              subtitle="Current totals across the core collections."
              sx={{ height: "100%" }}
            >
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Active students
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {activeStudents.length}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Left students
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {leftStudents.length}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Teachers
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {teachers.length}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Subject definitions
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {subjectsCount}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Subject enrollments
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {enrollmentsCount}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Marks documents
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {marksCount}
                  </Typography>
                </Stack>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
                Quick Links
              </Typography>

              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate("/subjects")}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ justifyContent: "space-between" }}
                >
                  Subject Management
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate("/assignments")}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ justifyContent: "space-between" }}
                >
                  Teacher Assignments
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate("/classrooms")}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ justifyContent: "space-between" }}
                >
                  Classrooms
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate("/student-subject-enrollments")}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ justifyContent: "space-between" }}
                >
                  Subject Enrollments
                </Button>
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      </Stack>
    </PageContainer>
  );
}