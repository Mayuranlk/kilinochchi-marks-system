import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getStudentSubjects } from "../constants";
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
  LinearProgress,
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
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditNoteIcon from "@mui/icons-material/EditNote";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BarChartIcon from "@mui/icons-material/BarChart";
import SchoolIcon from "@mui/icons-material/School";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

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

function isStudentActive(student) {
  return normalizeLower(student?.status || "active") === "active";
}

function getMarkSubject(mark) {
  return normalizeText(mark?.subjectName || mark?.subject);
}

function getMarkYear(mark) {
  return String(mark?.academicYear || mark?.year || "");
}

function getMarkTerm(mark) {
  return normalizeText(mark?.term || mark?.termName || mark?.termLabel);
}

function getMarkValue(mark) {
  const value = mark?.mark ?? mark?.marks ?? mark?.score ?? null;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hasMarkEntry(mark) {
  return (
    getMarkValue(mark) !== null ||
    mark?.isAbsent === true ||
    mark?.isMedicalAbsent === true ||
    normalizeLower(mark?.attendanceStatus) === "absent" ||
    normalizeLower(mark?.attendanceStatus) === "medical_absent"
  );
}

function getTeacherAssignmentSubject(assignment) {
  return normalizeText(assignment?.subjectName || assignment?.subject || "");
}

function getTeacherAssignmentSection(assignment) {
  return normalizeSection(assignment?.section || assignment?.className || "");
}

function getInitials(name = "") {
  return normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function statusColor(status) {
  return status === "done"
    ? "success"
    : status === "partial"
    ? "warning"
    : "error";
}

function statusLabel(status) {
  return status === "done"
    ? "Done"
    : status === "partial"
    ? "Partial"
    : "Pending";
}

function progressBarColor(status) {
  return status === "done"
    ? "#2e7d32"
    : status === "partial"
    ? "#f57f17"
    : "#c62828";
}

function StatCard({ title, value, subtitle, icon, bg }) {
  return (
    <Card
      sx={{
        bgcolor: bg,
        borderRadius: 3,
        border: "1px solid #e8eaf6",
        boxShadow: "0 2px 10px rgba(26,35,126,0.08)",
        height: "100%",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.2} alignItems="center" mb={1.2}>
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

function QuickActionCard({ title, description, buttonText, onClick, icon }) {
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
        <Stack direction="row" spacing={1.2} alignItems="center" mb={1.2}>
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

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!profile?.uid) return;

      setLoading(true);
      setLoadError("");

      try {
        const [termSnap, assignmentSnap, studentSnap, marksSnap] = await Promise.all([
          getDocs(collection(db, "academicTerms")),
          getDocs(collection(db, "teacherAssignments")),
          getDocs(collection(db, "students")),
          getDocs(collection(db, "marks")),
        ]);

        const active = termSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .find((t) => t.isActive === true) || null;
        setActiveTerm(active);

        const allAssignments = assignmentSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const myAssignments = allAssignments
          .filter((a) => normalizeText(a.teacherId) === normalizeText(profile.uid))
          .filter((a) => normalizeLower(a.status || "active") === "active")
          .sort((a, b) => {
            const gradeDiff = Number(a.grade || 0) - Number(b.grade || 0);
            if (gradeDiff !== 0) return gradeDiff;
            return getTeacherAssignmentSection(a).localeCompare(getTeacherAssignmentSection(b));
          });

        setAssignments(myAssignments);

        const myClasses = [
          ...new Map(
            myAssignments.map((a) => [
              `${a.grade}-${getTeacherAssignmentSection(a)}`,
              { grade: Number(a.grade), section: getTeacherAssignmentSection(a) },
            ])
          ).values(),
        ];

        const allStudents = studentSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const myStudents = allStudents.filter(
          (s) =>
            isStudentActive(s) &&
            myClasses.some(
              (c) =>
                Number(c.grade) === Number(s.grade) &&
                c.section === getStudentSection(s)
            )
        );

        myStudents.sort((a, b) => {
          const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
          if (gradeDiff !== 0) return gradeDiff;

          const sectionDiff = getStudentSection(a).localeCompare(getStudentSection(b));
          if (sectionDiff !== 0) return sectionDiff;

          return getStudentName(a).localeCompare(getStudentName(b));
        });

        setStudents(myStudents);

        const allMarks = marksSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const myMarks = allMarks.filter((m) =>
          myAssignments.some(
            (a) =>
              Number(a.grade) === Number(m.grade) &&
              getTeacherAssignmentSection(a) === normalizeSection(m.section || m.className) &&
              getTeacherAssignmentSubject(a) === getMarkSubject(m)
          )
        );

        setMarks(myMarks);

        if (profile.isClassTeacher && active) {
          const classStudents = allStudents.filter(
            (s) =>
              isStudentActive(s) &&
              Number(s.grade) === Number(profile.classGrade) &&
              getStudentSection(s) === normalizeSection(profile.classSection)
          );

          const subjectSet = new Set();
          classStudents.forEach((s) => {
            const subs = getStudentSubjects(s) || [];
            subs.forEach((sub) => subjectSet.add(normalizeText(sub)));
          });

          const progress = Array.from(subjectSet).map((subject) => {
            const eligibleStudents = classStudents.filter((s) =>
              (getStudentSubjects(s) || []).map((x) => normalizeText(x)).includes(subject)
            );

            const enteredMarks = allMarks.filter(
              (m) =>
                Number(m.grade) === Number(profile.classGrade) &&
                normalizeSection(m.section || m.className) ===
                  normalizeSection(profile.classSection) &&
                getMarkSubject(m) === subject &&
                (!active?.term || getMarkTerm(m) === normalizeText(active.term)) &&
                (!active?.year || getMarkYear(m) === String(active.year))
            );

            const uniqueMarkedStudents = new Set(
              enteredMarks
                .filter((m) => hasMarkEntry(m))
                .map((m) => normalizeText(m.studentId))
                .filter(Boolean)
            );

            const entered = uniqueMarkedStudents.size;
            const total = eligibleStudents.length;
            const percent = total > 0 ? Math.round((entered / total) * 100) : 0;
            const status =
              entered === 0 ? "pending" : entered < total ? "partial" : "done";

            return {
              subject,
              entered,
              total,
              percent,
              status,
            };
          });

          progress.sort((a, b) => {
            const order = { pending: 0, partial: 1, done: 2 };
            return order[a.status] - order[b.status] || a.subject.localeCompare(b.subject);
          });

          setSubjectProgress(progress);
        } else {
          setSubjectProgress([]);
        }
      } catch (error) {
        console.error("TeacherDashboard fetch error:", error);
        setLoadError("Failed to load teacher dashboard.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  const myClasses = useMemo(() => {
    return [
      ...new Map(
        assignments.map((a) => [
          `${a.grade}-${getTeacherAssignmentSection(a)}`,
          { grade: Number(a.grade), section: getTeacherAssignmentSection(a) },
        ])
      ).values(),
    ];
  }, [assignments]);

  const groupedClasses = useMemo(() => {
    return assignments.reduce((acc, a) => {
      const key = `Grade ${a.grade}-${getTeacherAssignmentSection(a)}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(getTeacherAssignmentSubject(a));
      return acc;
    }, {});
  }, [assignments]);

  const completedAssignmentsCount = useMemo(() => {
    if (!activeTerm) return 0;

    return assignments.filter((assignment) => {
      const classStudents = students.filter(
        (s) =>
          Number(s.grade) === Number(assignment.grade) &&
          getStudentSection(s) === getTeacherAssignmentSection(assignment)
      );

      if (!classStudents.length) return false;

      const subjectEligibleStudents = classStudents.filter((s) =>
        (getStudentSubjects(s) || [])
          .map((x) => normalizeText(x))
          .includes(getTeacherAssignmentSubject(assignment))
      );

      if (!subjectEligibleStudents.length) return false;

      const markedStudentIds = new Set(
        marks
          .filter(
            (m) =>
              Number(m.grade) === Number(assignment.grade) &&
              normalizeSection(m.section || m.className) ===
                getTeacherAssignmentSection(assignment) &&
              getMarkSubject(m) === getTeacherAssignmentSubject(assignment) &&
              getMarkTerm(m) === normalizeText(activeTerm.term) &&
              getMarkYear(m) === String(activeTerm.year) &&
              hasMarkEntry(m)
          )
          .map((m) => normalizeText(m.studentId))
          .filter(Boolean)
      );

      return markedStudentIds.size >= subjectEligibleStudents.length;
    }).length;
  }, [assignments, students, marks, activeTerm]);

  const marksCount = marks.length;

  const statCards = [
    {
      label: "My Students",
      value: students.length,
      subtitle: `${myClasses.length} class${myClasses.length !== 1 ? "es" : ""}`,
      icon: <PeopleIcon sx={{ fontSize: 32, color: "#1a237e" }} />,
      color: "#e8eaf6",
    },
    {
      label: "Marks Entered",
      value: marksCount,
      subtitle: "My assigned subjects",
      icon: <GradeIcon sx={{ fontSize: 32, color: "#1b5e20" }} />,
      color: "#e8f5e9",
    },
    {
      label: "Assignments",
      value: assignments.length,
      subtitle: `${completedAssignmentsCount} completed this term`,
      icon: <MenuBookIcon sx={{ fontSize: 32, color: "#e65100" }} />,
      color: "#fff3e0",
    },
  ];

  const quickActions = [
    {
      title: "Marks Entry",
      description: "Open teacher marks entry for your assigned classes and subjects.",
      buttonText: "Open Marks",
      onClick: () => navigate("/teacher/marks"),
      icon: <EditNoteIcon sx={{ color: "#1a237e" }} />,
    },
    {
      title: "Student Reports",
      description: "Open report cards for students in your assigned classes.",
      buttonText: "Open Students",
      onClick: () => navigate("/teacher/marks"),
      icon: <AssessmentIcon sx={{ color: "#2e7d32" }} />,
    },
    profile?.isClassTeacher
      ? {
          title: "Class Teacher Report",
          description: "Monitor completion and overall class progress.",
          buttonText: "Open Report",
          onClick: () => navigate("/teacher/class-report"),
          icon: <BarChartIcon sx={{ color: "#6a1b9a" }} />,
        }
      : null,
  ].filter(Boolean);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

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
                Welcome, {profile?.name || "Teacher"}
              </Typography>
            </Stack>

            <Typography variant="body1" color="text.secondary">
              Teacher dashboard for assignments, marks entry, and class progress
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5}>
              <Chip
                icon={<MenuBookIcon />}
                label={`${assignments.length} Assignment${assignments.length !== 1 ? "s" : ""}`}
                color="primary"
                size="small"
              />
              {activeTerm ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Active Term: ${activeTerm.term} ${activeTerm.year}`}
                  color="success"
                  size="small"
                />
              ) : (
                <Chip
                  icon={<WarningIcon />}
                  label="No Active Term"
                  color="warning"
                  size="small"
                />
              )}

              {profile?.isClassTeacher && (
                <Chip
                  label={`Class Teacher · G${profile.classGrade}-${profile.classSection}`}
                  color="secondary"
                  size="small"
                />
              )}
            </Stack>
          </Box>

          <Stack direction={{ xs: "row", md: "column" }} spacing={1}>
            <Button
              variant="contained"
              onClick={() => navigate("/teacher/marks")}
              sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
            >
              Open Marks Entry
            </Button>

            {profile?.isClassTeacher && (
              <Button
                variant="outlined"
                onClick={() => navigate("/teacher/class-report")}
                sx={{ borderColor: "#1a237e", color: "#1a237e" }}
              >
                Class Report
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {assignments.length === 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          You have no subject assignments yet. Ask admin to assign your classes and subjects.
        </Alert>
      )}

      <Grid container spacing={2} mb={3}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={4} key={c.label}>
            <StatCard
              title={c.label}
              value={c.value}
              subtitle={c.subtitle}
              icon={c.icon}
              bg={c.color}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} mb={3}>
        {quickActions.map((item) => (
          <Grid item xs={12} md={4} key={item.title}>
            <QuickActionCard {...item} />
          </Grid>
        ))}
      </Grid>

      {profile?.isClassTeacher && (
        <Box mb={3}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid #e8eaf6",
              boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={1.5}
              mb={2}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700} color="#1a237e">
                  Class Progress Monitor
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Grade {profile.classGrade}-{profile.classSection}
                  {activeTerm ? ` · ${activeTerm.term} ${activeTerm.year}` : ""}
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={<BarChartIcon />}
                onClick={() => navigate("/teacher/class-report")}
                sx={{ borderColor: "#1a237e", color: "#1a237e" }}
              >
                Full Class Report
              </Button>
            </Stack>

            {!activeTerm ? (
              <Alert severity="warning">No active term. Ask admin to activate a term.</Alert>
            ) : subjectProgress.length === 0 ? (
              <Alert severity="info">No class progress data available yet.</Alert>
            ) : isMobile ? (
              <Box>
                {subjectProgress.map((sp) => (
                  <Card
                    key={sp.subject}
                    variant="outlined"
                    sx={{
                      mb: 1.2,
                      borderRadius: 2,
                      bgcolor:
                        sp.status === "done"
                          ? "#f1f8f1"
                          : sp.status === "partial"
                          ? "#fffde7"
                          : "#fff5f5",
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={1}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {sp.subject}
                        </Typography>
                        <Chip
                          label={statusLabel(sp.status)}
                          size="small"
                          color={statusColor(sp.status)}
                        />
                      </Box>

                      <LinearProgress
                        variant="determinate"
                        value={sp.percent}
                        sx={{
                          height: 7,
                          borderRadius: 4,
                          bgcolor: "#e0e0e0",
                          "& .MuiLinearProgress-bar": {
                            bgcolor: progressBarColor(sp.status),
                          },
                        }}
                      />

                      <Typography variant="caption" color="text.secondary" display="block" mt={0.8}>
                        {sp.entered}/{sp.total} students · {sp.percent}%
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#1a237e" }}>
                    <TableRow>
                      {["#", "Subject", "Progress", "Students", "%", "Status"].map((h) => (
                        <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subjectProgress.map((sp, idx) => (
                      <TableRow
                        key={sp.subject}
                        hover
                        sx={{
                          bgcolor:
                            sp.status === "done"
                              ? "#f1f8f1"
                              : sp.status === "partial"
                              ? "#fffde7"
                              : "#fff5f5",
                        }}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {sp.subject}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <LinearProgress
                            variant="determinate"
                            value={sp.percent}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: "#e0e0e0",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: progressBarColor(sp.status),
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {sp.entered} / {sp.total}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={progressBarColor(sp.status)}
                          >
                            {sp.percent}%
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabel(sp.status)}
                            size="small"
                            color={statusColor(sp.status)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Paper>
        </Box>
      )}

      {Object.keys(groupedClasses).length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
            My Teaching Assignments
          </Typography>

          <Grid container spacing={1.5}>
            {Object.entries(groupedClasses).map(([classLabel, subjects]) => (
              <Grid item xs={12} sm={6} md={4} key={classLabel}>
                <Paper
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 1px 6px rgba(26,35,126,0.07)",
                    height: "100%",
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} color="#1a237e" mb={1}>
                    {classLabel}
                  </Typography>

                  <Box display="flex" flexWrap="wrap" gap={0.6}>
                    {subjects.map((s) => (
                      <Chip
                        key={`${classLabel}-${s}`}
                        label={s}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    ))}
                  </Box>

                  <Button
                    size="small"
                    variant="text"
                    startIcon={<EditNoteIcon />}
                    sx={{ mt: 1.2, color: "#1a237e", p: 0 }}
                    onClick={() => navigate("/teacher/marks")}
                  >
                    Enter Marks
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

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
                My Students ({students.length})
              </Typography>
            </Box>

            {isMobile ? (
              <Box p={1.5}>
                {students.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                    No students found in your assigned classes.
                  </Typography>
                ) : (
                  students.map((s, idx) => (
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
                              Adm: {s.admissionNo || "—"} · G{parseGrade(s.grade)}-{getStudentSection(s)}
                            </Typography>
                          </Box>

                          <Typography variant="caption" color="text.secondary">
                            #{idx + 1}
                          </Typography>
                        </Stack>

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AssessmentIcon />}
                          sx={{ mt: 1.2, borderColor: "#1a237e", color: "#1a237e" }}
                          onClick={() => navigate(`/teacher/report/${s.id}`)}
                        >
                          Report
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
                    {["#", "Adm No", "Name", "Grade", "Gender", "Action"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((s, idx) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{idx + 1}</TableCell>
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
                          label={`G${parseGrade(s.grade)}-${getStudentSection(s)}`}
                          size="small"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>{s.gender || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AssessmentIcon />}
                          onClick={() => navigate(`/teacher/report/${s.id}`)}
                          sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                        >
                          Report
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No students found in your assigned classes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {students.length > 0 && (
              <Box p={2}>
                <Button
                  variant="contained"
                  fullWidth={isMobile}
                  startIcon={<EditNoteIcon />}
                  sx={{ bgcolor: "#1a237e" }}
                  onClick={() => navigate("/teacher/marks")}
                >
                  Go to Marks Entry
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
              Teaching Snapshot
            </Typography>

            <Stack spacing={1.2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Assigned classes
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {myClasses.length}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Assigned subjects
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {assignments.length}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Completed assignments
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {completedAssignmentsCount}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Students in scope
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {students.length}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Marks in scope
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {marksCount}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Class teacher role
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {profile?.isClassTeacher ? "Yes" : "No"}
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
                onClick={() => navigate("/teacher/marks")}
                sx={{ justifyContent: "space-between", borderColor: "#e8eaf6", color: "#1a237e" }}
                endIcon={<ArrowForwardIcon />}
              >
                Marks Entry
              </Button>

              {profile?.isClassTeacher && (
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate("/teacher/class-report")}
                  sx={{ justifyContent: "space-between", borderColor: "#e8eaf6", color: "#1a237e" }}
                  endIcon={<ArrowForwardIcon />}
                >
                  Class Report
                </Button>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}