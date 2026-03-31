import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
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
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import PersonIcon from "@mui/icons-material/Person";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SchoolIcon from "@mui/icons-material/School";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

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

function StatCard({ title, value, subtitle, icon, bg, onClick }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        bgcolor: bg,
        boxShadow: "0 2px 10px rgba(26,35,126,0.08)",
        borderRadius: 3,
        cursor: onClick ? "pointer" : "default",
        border: "1px solid #e8eaf6",
        height: "100%",
        "&:hover": onClick
          ? {
              boxShadow: "0 6px 18px rgba(26,35,126,0.16)",
              transform: "translateY(-2px)",
              transition: "all 0.2s ease",
            }
          : {},
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Stack>

        <Typography variant="h4" fontWeight={800} lineHeight={1}>
          {value}
        </Typography>

        {subtitle ? (
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            {subtitle}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActionCard({ title, description, buttonText, onClick, icon }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        border: "1px solid #e8eaf6",
        boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
        height: "100%",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.2} alignItems="center" mb={1.5}>
          {icon}
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>

        <Button
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={onClick}
          sx={{ borderColor: "#1a237e", color: "#1a237e" }}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
        setTeachers(
          loadedUsers.filter((u) => normalizeLower(u.role) === "teacher")
        );
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

  const recentStudents = useMemo(() => {
    return students.slice(0, 6);
  }, [students]);

  const statCards = [
    {
      label: "Total Students",
      value: students.length,
      subtitle: `${activeStudents.length} active`,
      icon: <PeopleIcon sx={{ fontSize: 32, color: "#1a237e" }} />,
      color: "#e8eaf6",
      path: "/students",
    },
    {
      label: "Teachers",
      value: teachers.length,
      subtitle: "From users collection",
      icon: <PersonIcon sx={{ fontSize: 32, color: "#1b5e20" }} />,
      color: "#e8f5e9",
      path: "/teachers",
    },
    {
      label: "Marks Records",
      value: marksCount,
      subtitle: "Saved marks documents",
      icon: <GradeIcon sx={{ fontSize: 32, color: "#e65100" }} />,
      color: "#fff3e0",
      path: "/marks",
    },
    {
      label: "Active Classes",
      value: activeClassesCount,
      subtitle: "Based on active students",
      icon: <AssessmentIcon sx={{ fontSize: 32, color: "#4a148c" }} />,
      color: "#f3e5f5",
      path: "/students",
    },
  ];

  const actionCards = [
    {
      title: "Manage Students",
      description: "Add, edit, bulk upload, and maintain student records.",
      buttonText: "Open Students",
      onClick: () => navigate("/students"),
      icon: <PeopleIcon color="primary" />,
    },
    {
      title: "Subject Definitions",
      description: "Manage core, religion, aesthetic, basket, and A/L subject setup.",
      buttonText: "Open Subjects",
      onClick: () => navigate("/subjects"),
      icon: <MenuBookIcon color="secondary" />,
    },
    {
      title: "Generate Enrollments",
      description: "Rebuild or generate student subject enrollments safely.",
      buttonText: "Open Enrollments",
      onClick: () => navigate("/student-subject-enrollments"),
      icon: <AutoFixHighIcon sx={{ color: "#2e7d32" }} />,
    },
  ];

  return (
    <Box>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          mb: 3,
          borderRadius: 4,
          border: "1px solid #e8eaf6",
          background:
            "linear-gradient(135deg, rgba(26,35,126,0.08) 0%, rgba(255,255,255,1) 60%)",
          boxShadow: "0 4px 18px rgba(26,35,126,0.08)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <SchoolIcon sx={{ color: "#1a237e" }} />
              <Typography variant={isMobile ? "h6" : "h4"} fontWeight={800} color="#1a237e">
                Admin Dashboard
              </Typography>
            </Stack>

            <Typography variant="body1" color="text.secondary">
              Overview of the Kilinochchi Marks Management System
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`${activeStudents.length} Active Students`}
                color="success"
                size="small"
              />
              <Chip
                icon={<WarningAmberIcon />}
                label={`${leftStudents.length} Left Students`}
                color="warning"
                size="small"
              />
              <Chip
                label={`${subjectsCount} Subjects`}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`${enrollmentsCount} Enrollments`}
                color="secondary"
                variant="outlined"
                size="small"
              />
            </Stack>
          </Box>

          <Stack direction={{ xs: "row", md: "column" }} spacing={1}>
            <Button
              variant="contained"
              onClick={() => navigate("/marks")}
              sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
            >
              Open Marks Entry
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate("/terms")}
              sx={{ borderColor: "#1a237e", color: "#1a237e" }}
            >
              Academic Terms
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={5}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={2} mb={3}>
            {statCards.map((c) => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <StatCard
                  title={c.label}
                  value={c.value}
                  subtitle={c.subtitle}
                  icon={c.icon}
                  bg={c.color}
                  onClick={() => navigate(c.path)}
                />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} mb={3}>
            {actionCards.map((item) => (
              <Grid item xs={12} md={4} key={item.title}>
                <ActionCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={8}>
              <Paper
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
                  border: "1px solid #e8eaf6",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: "#1a237e",
                    color: "white",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700}>
                    Recent Students
                  </Typography>
                </Box>

                {isMobile ? (
                  <Box p={1.5}>
                    {recentStudents.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                        No students added yet.
                      </Typography>
                    ) : (
                      recentStudents.map((s) => (
                        <Card
                          key={s.id}
                          variant="outlined"
                          sx={{ mb: 1.2, borderRadius: 2 }}
                        >
                          <CardContent sx={{ pb: 1.2 }}>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                              <Avatar sx={{ bgcolor: "#1a237e", width: 36, height: 36 }}>
                                {getInitials(getStudentName(s))}
                              </Avatar>
                              <Box flex={1}>
                                <Typography variant="body2" fontWeight={700}>
                                  {getStudentName(s)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {s.admissionNo || "—"} • G{parseGrade(s.grade)}-{getStudentSection(s)}
                                </Typography>
                              </Box>
                              <Chip
                                label={getStudentStatus(s)}
                                size="small"
                                color={isActiveStudent(s) ? "success" : "default"}
                              />
                            </Stack>

                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ mt: 1.2, borderColor: "#1a237e", color: "#1a237e" }}
                              onClick={() => navigate(`/report/${s.id}`)}
                            >
                              View Report
                            </Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </Box>
                ) : (
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#f5f7ff" }}>
                      <TableRow>
                        {["Admission No", "Name", "Grade", "Section", "Status", "Action"].map(
                          (h) => (
                            <TableCell key={h} sx={{ fontWeight: 700 }}>
                              {h}
                            </TableCell>
                          )
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentStudents.map((s) => (
                        <TableRow key={s.id} hover>
                          <TableCell>{s.admissionNo || "—"}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                              <Avatar
                                sx={{
                                  width: 30,
                                  height: 30,
                                  bgcolor: "#1a237e",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                {getInitials(getStudentName(s))}
                              </Avatar>
                              <Typography variant="body2" fontWeight={700}>
                                {getStudentName(s)}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`G${parseGrade(s.grade)}`}
                              size="small"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell>{getStudentSection(s) || "—"}</TableCell>
                          <TableCell>
                            <Chip
                              label={getStudentStatus(s)}
                              size="small"
                              color={isActiveStudent(s) ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate(`/report/${s.id}`)}
                              sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                            >
                              Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                      {recentStudents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            No students added yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {students.length > 6 && (
                  <Box p={2}>
                    <Button
                      variant="contained"
                      onClick={() => navigate("/students")}
                      sx={{ bgcolor: "#1a237e" }}
                      fullWidth={isMobile}
                    >
                      View All Students
                    </Button>
                  </Box>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 3,
                  boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
                  border: "1px solid #e8eaf6",
                  height: "100%",
                }}
              >
                <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
                  System Snapshot
                </Typography>

                <Stack spacing={1.2}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Active students
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {activeStudents.length}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Left students
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {leftStudents.length}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Teachers
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {teachers.length}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Subject definitions
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {subjectsCount}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Subject enrollments
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {enrollmentsCount}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Marks documents
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {marksCount}
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  Quick Links
                </Typography>

                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate("/subjects")}
                    sx={{ justifyContent: "space-between", borderColor: "#e8eaf6", color: "#1a237e" }}
                    endIcon={<ArrowForwardIcon />}
                  >
                    Subject Management
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate("/assignments")}
                    sx={{ justifyContent: "space-between", borderColor: "#e8eaf6", color: "#1a237e" }}
                    endIcon={<ArrowForwardIcon />}
                  >
                    Teacher Assignments
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate("/classrooms")}
                    sx={{ justifyContent: "space-between", borderColor: "#e8eaf6", color: "#1a237e" }}
                    endIcon={<ArrowForwardIcon />}
                  >
                    Classrooms
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}