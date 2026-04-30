import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
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
    .map((word) => word[0]?.toUpperCase())
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

function MetricTile({ title, value, helperText, icon, color = "primary", onClick }) {
  const theme = useTheme();
  const palette = theme.palette[color] || theme.palette.primary;

  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 2,
        boxShadow: "none",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
          <Stack spacing={1.2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(palette.main, 0.1),
                  color: palette.main,
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1 }}>
              {value}
            </Typography>
            {helperText ? (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>
                {helperText}
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function QuickActionCard({ title, description, buttonText, onClick, icon }) {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 2,
        boxShadow: "none",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, "&:last-child": { pb: { xs: 1.75, sm: 2.25 } } }}>
          <Stack spacing={1.35}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "action.selected",
                  color: "primary.main",
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.2 }}>
                  {title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {buttonText}
                </Typography>
              </Box>
              <ArrowForwardRoundedIcon color="primary" sx={{ ml: "auto" }} />
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
              {description}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function SnapshotRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
        const [studentsSnap, usersSnap, marksSnap, subjectsSnap, enrollmentsSnap] =
          await Promise.all([
            getDocs(collection(db, "students")),
            getDocs(collection(db, "users")),
            getDocs(collection(db, "marks")),
            getDocs(collection(db, "subjects")),
            getDocs(collection(db, "studentSubjectEnrollments")),
          ]);

        const loadedStudents = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const loadedUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setStudents(sortStudents(loadedStudents));
        setTeachers(loadedUsers.filter((user) => normalizeLower(user.role) === "teacher"));
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
    () => students.filter((student) => isActiveStudent(student)),
    [students]
  );

  const leftStudents = useMemo(
    () => students.filter((student) => normalizeLower(getStudentStatus(student)) === "left"),
    [students]
  );

  const activeClassesCount = useMemo(() => {
    return new Set(
      activeStudents.map((student) => `${parseGrade(student.grade)}-${getStudentSection(student)}`)
    ).size;
  }, [activeStudents]);

  const recentStudents = useMemo(() => students.slice(0, isMobile ? 4 : 6), [isMobile, students]);
  const activePercent = students.length ? Math.round((activeStudents.length / students.length) * 100) : 0;

  const metricCards = [
    {
      title: "Students",
      value: students.length,
      helperText: `${activeStudents.length} active`,
      icon: <PeopleRoundedIcon fontSize="small" />,
      color: "primary",
      onClick: () => navigate("/students"),
    },
    {
      title: "Teachers",
      value: teachers.length,
      helperText: "User accounts",
      icon: <PersonRoundedIcon fontSize="small" />,
      color: "secondary",
      onClick: () => navigate("/teachers"),
    },
    {
      title: "Marks",
      value: marksCount,
      helperText: "Saved records",
      icon: <GradingRoundedIcon fontSize="small" />,
      color: "warning",
      onClick: () => navigate("/marks"),
    },
    {
      title: "Classes",
      value: activeClassesCount,
      helperText: "Active sections",
      icon: <AssessmentRoundedIcon fontSize="small" />,
      color: "success",
      onClick: () => navigate("/students"),
    },
  ];

  const quickActions = [
    {
      title: "Students",
      description: "Add records, bulk upload, edit details, and maintain class data.",
      buttonText: "Open Students",
      onClick: () => navigate("/students"),
      icon: <PeopleRoundedIcon />,
    },
    {
      title: "Subjects",
      description: "Manage core, religion, aesthetic, basket, and A/L subject setup.",
      buttonText: "Open Subjects",
      onClick: () => navigate("/subjects"),
      icon: <MenuBookRoundedIcon />,
    },
    {
      title: "Enrollments",
      description: "Generate or rebuild student subject enrollments safely.",
      buttonText: "Open Enrollments",
      onClick: () => navigate("/student-subject-enrollments"),
      icon: <AutoFixHighRoundedIcon />,
    },
  ];

  if (loading) {
    return (
      <PageContainer maxWidth="lg" sx={{ pb: { xs: 10, md: 3 } }}>
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
    <PageContainer maxWidth="xl" sx={{ pb: { xs: 10, md: 3 } }}>
      <Stack spacing={{ xs: 1.5, md: 2 }}>
        {loadError ? <Alert severity="error">{loadError}</Alert> : null}

        <Card
          sx={{
            borderRadius: 2,
            boxShadow: "none",
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            background: {
              xs: "background.paper",
              md: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(
                theme.palette.secondary.main,
                0.08
              )} 100%)`,
            },
          }}
        >
          <CardContent sx={{ p: { xs: 1.75, sm: 2.5, md: 3 }, "&:last-child": { pb: { xs: 1.75, sm: 2.5, md: 3 } } }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
                spacing={2}
              >
                <Stack direction="row" spacing={1.4} alignItems="center">
                  <Box
                    sx={{
                      width: { xs: 44, md: 52 },
                      height: { xs: 44, md: 52 },
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      flexShrink: 0,
                    }}
                  >
                    <SchoolRoundedIcon />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                      Admin Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Kilinochchi Marks Management System
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                  <Button
                    variant="contained"
                    onClick={() => navigate("/marks")}
                    fullWidth={isMobile}
                    endIcon={<ArrowForwardRoundedIcon />}
                  >
                    Marks
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/subject-analysis")}
                    fullWidth={isMobile}
                  >
                    Analysis
                  </Button>
                </Stack>
              </Stack>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Active student coverage
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 850 }}>
                    {activePercent}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={activePercent}
                  sx={{ height: 7, borderRadius: 999, bgcolor: alpha(theme.palette.primary.main, 0.12) }}
                />
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip icon={<CheckCircleRoundedIcon />} label={`${activeStudents.length} active`} color="success" />
                <Chip icon={<WarningAmberRoundedIcon />} label={`${leftStudents.length} left`} color="warning" />
                <Chip label={`${subjectsCount} subjects`} variant="outlined" color="primary" />
                <Chip label={`${enrollmentsCount} enrollments`} variant="outlined" color="secondary" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={1.25}>
          {metricCards.map((card) => (
            <Grid item xs={6} md={3} key={card.title}>
              <MetricTile {...card} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={1.25}>
          {quickActions.map((item) => (
            <Grid item xs={12} md={4} key={item.title}>
              <QuickActionCard {...item} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={1.25} alignItems="stretch">
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
                <Stack spacing={1}>
                  {recentStudents.map((student) => (
                    <MobileListRow
                      key={student.id}
                      compact
                      title={getStudentName(student)}
                      subtitle={[
                        student.admissionNo || "No admission no",
                        `G${parseGrade(student.grade)}-${getStudentSection(student) || "-"}`,
                      ].join(" - ")}
                      right={
                        <Avatar
                          sx={{
                            width: 42,
                            height: 42,
                            bgcolor: "primary.main",
                            fontSize: 16,
                            fontWeight: 850,
                          }}
                        >
                          {getInitials(getStudentName(student))}
                        </Avatar>
                      }
                      footer={
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <StatusChip
                            status={isActiveStudent(student) ? "active" : "inactive"}
                            label={getStudentStatus(student)}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/report/${student.id}`)}
                          >
                            Report
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
                          <TableCell>{student.admissionNo || "-"}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: "primary.main",
                                  fontSize: 12,
                                  fontWeight: 850,
                                }}
                              >
                                {getInitials(getStudentName(student))}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 750 }}>
                                {getStudentName(student)}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{`G${parseGrade(student.grade)}`}</TableCell>
                          <TableCell>{getStudentSection(student) || "-"}</TableCell>
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
                <SnapshotRow label="Active students" value={activeStudents.length} />
                <SnapshotRow label="Left students" value={leftStudents.length} />
                <SnapshotRow label="Teachers" value={teachers.length} />
                <SnapshotRow label="Subject definitions" value={subjectsCount} />
                <SnapshotRow label="Subject enrollments" value={enrollmentsCount} />
                <SnapshotRow label="Marks documents" value={marksCount} />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1.25 }}>
                Quick Links
              </Typography>

              <Stack spacing={1}>
                {[
                  ["Subject Management", "/subjects"],
                  ["Teacher Assignments", "/assignments"],
                  ["Classrooms", "/classrooms"],
                  ["Subject Enrollments", "/student-subject-enrollments"],
                ].map(([label, path]) => (
                  <Button
                    key={path}
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate(path)}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ justifyContent: "space-between" }}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      </Stack>
    </PageContainer>
  );
}
