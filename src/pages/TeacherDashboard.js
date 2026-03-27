import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getStudentSubjects } from "../constants";
import {
  Box, Typography, Grid, Card, CardContent, CardActions, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Button, Chip,
  Alert, LinearProgress, Divider, useMediaQuery, useTheme
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditNoteIcon from "@mui/icons-material/EditNote";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BarChartIcon from "@mui/icons-material/BarChart";

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [assignments, setAssignments]     = useState([]);
  const [students, setStudents]           = useState([]);
  const [marksCount, setMarksCount]       = useState(0);
  const [activeTerm, setActiveTerm]       = useState(null);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;

      // ── Fetch active term ──
      const termSnap = await getDocs(collection(db, "academicTerms"));
      const active = termSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(t => t.isActive === true) || null;
      setActiveTerm(active);

      // ── Fetch this teacher's subject assignments ──
      const aSnap = await getDocs(collection(db, "assignments"));
      const myAssignments = aSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.teacherId === profile.uid)
        .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
      setAssignments(myAssignments);

      // ── Unique classes from assignments ──
      const myClasses = [
        ...new Map(
          myAssignments.map(a =>
            [`${a.grade}-${a.section}`, { grade: a.grade, section: a.section }]
          )
        ).values()
      ];

      // ── Fetch students in those classes ──
      const sSnap = await getDocs(collection(db, "students"));
      const allStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const myStudents = allStudents.filter(s =>
        myClasses.some(c => c.grade === s.grade && c.section === s.section) &&
        (s.status || "active") === "active"
      );
      setStudents(myStudents);

      // ── Fetch marks ──
      const mSnap = await getDocs(collection(db, "marks"));
      const allMarks = mSnap.docs.map(d => d.data());
      const myMarks = allMarks.filter(m =>
        myAssignments.some(a =>
          a.grade === m.grade &&
          a.section === m.section &&
          a.subject === m.subject
        )
      );
      setMarksCount(myMarks.length);

      // ── Class Teacher: build subject progress ──
      if (profile.isClassTeacher && active) {
        const classStudents = allStudents.filter(s =>
          s.grade   === profile.classGrade &&
          s.section === profile.classSection &&
          (s.status || "active") === "active"
        );

        // Get all unique subjects for this class
        const subjectSet = new Set();
        classStudents.forEach(s => {
          getStudentSubjects(s).forEach(sub => subjectSet.add(sub));
        });

        // For each subject check how many students have marks
        const progress = Array.from(subjectSet).map(subject => {
          // students who should have this subject
          const eligibleStudents = classStudents.filter(s =>
            getStudentSubjects(s).includes(subject)
          );
          // marks entered for this subject this term
          const enteredMarks = allMarks.filter(m =>
            m.grade   === profile.classGrade &&
            m.section === profile.classSection &&
            m.subject === subject &&
            m.term    === active.term &&
            m.year    === active.year
          );
          const entered  = enteredMarks.length;
          const total    = eligibleStudents.length;
          const percent  = total > 0 ? Math.round((entered / total) * 100) : 0;
          const status   = entered === 0 ? "pending"
                         : entered < total ? "partial"
                         : "done";
          // find who entered marks
          const enteredBy = enteredMarks.length > 0
            ? enteredMarks[0].updatedBy || "—"
            : "—";

          return { subject, entered, total, percent, status, enteredBy };
        });

        // Sort: pending first, then partial, then done
        progress.sort((a, b) => {
          const order = { pending: 0, partial: 1, done: 2 };
          return order[a.status] - order[b.status];
        });
        setSubjectProgress(progress);
      }

      setLoading(false);
    }
    fetchData();
  }, [profile]);

  // ── Group subject assignments by class ──
  const groupedClasses = assignments.reduce((acc, a) => {
    const key = `Grade ${a.grade}-${a.section}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a.subject);
    return acc;
  }, {});

  const myClasses = [
    ...new Map(
      assignments.map(a =>
        [`${a.grade}-${a.section}`, { grade: a.grade, section: a.section }]
      )
    ).values()
  ];

  const statCards = [
    {
      label: "My Students",   value: students.length,
      icon: <PeopleIcon   sx={{ fontSize: 34, color: "#1a237e" }} />, color: "#e8eaf6"
    },
    {
      label: "Marks Entered", value: marksCount,
      icon: <GradeIcon    sx={{ fontSize: 34, color: "#1b5e20" }} />, color: "#e8f5e9"
    },
    {
      label: "Assignments",   value: assignments.length,
      icon: <MenuBookIcon sx={{ fontSize: 34, color: "#e65100" }} />, color: "#fff3e0"
    },
  ];

  // ── Status helpers ──
  const statusColor  = s => s === "done" ? "success" : s === "partial" ? "warning" : "error";
  const statusLabel  = s => s === "done" ? "✅ Done" : s === "partial" ? "⚠️ Partial" : "⏳ Pending";
  const progressColor = s => s === "done" ? "#2e7d32" : s === "partial" ? "#f57f17" : "#c62828";

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
          Welcome, {profile?.name}
        </Typography>
        {profile?.isClassTeacher && (
          <Chip
            icon={<CheckCircleIcon />}
            label={`Class Teacher · G${profile.classGrade}-${profile.classSection}`}
            color="primary" size="small" />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Subject Teacher • {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
        {activeTerm && ` • Active: ${activeTerm.term} ${activeTerm.year}`}
      </Typography>

      {/* No assignments warning */}
      {assignments.length === 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          You have no subject assignments yet. Contact admin to assign you
          to a subject and class.
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2} mb={3}>
        {statCards.map(c => (
          <Grid item xs={4} key={c.label}>
            <Card sx={{ bgcolor: c.color, boxShadow: 2 }}>
              <CardContent sx={{
                p: { xs: 1.5, sm: 2 },
                "&:last-child": { pb: { xs: 1.5, sm: 2 } }
              }}>
                <Box display="flex" alignItems="center" gap={1}
                  flexDirection={{ xs: "column", sm: "row" }}>
                  {c.icon}
                  <Box textAlign={{ xs: "center", sm: "left" }}>
                    <Typography variant={isMobile ? "h5" : "h4"}
                      fontWeight={700} lineHeight={1}>
                      {c.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ fontSize: { xs: 9, sm: 12 } }}>
                      {c.label}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ══════════════════════════════════════════
          CLASS TEACHER SECTION
      ══════════════════════════════════════════ */}
      {profile?.isClassTeacher && (
        <Box mb={3}>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="subtitle1" fontWeight={700} color="#1a237e">
              🏫 Class Progress Monitor —
              Grade {profile.classGrade}-{profile.classSection}
              {activeTerm && ` · ${activeTerm.term} ${activeTerm.year}`}
            </Typography>
            <Button variant="contained" size="small"
              startIcon={<BarChartIcon />}
              onClick={() => navigate("/teacher/class-report")}
              sx={{ bgcolor: "#1a237e" }}>
              {isMobile ? "Report" : "Full Class Report"}
            </Button>
          </Box>

          {!activeTerm ? (
            <Alert severity="warning">No active term. Ask admin to activate a term.</Alert>
          ) : subjectProgress.length === 0 ? (
            <Alert severity="info">No students found in your class yet.</Alert>
          ) : (
            <>
              {/* Progress Summary Chips */}
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                <Chip size="small" color="success"
                  label={`✅ Done: ${subjectProgress.filter(s => s.status === "done").length}`} />
                <Chip size="small" color="warning"
                  label={`⚠️ Partial: ${subjectProgress.filter(s => s.status === "partial").length}`} />
                <Chip size="small" color="error"
                  label={`⏳ Pending: ${subjectProgress.filter(s => s.status === "pending").length}`} />
              </Box>

              {isMobile ? (
                /* Mobile progress cards */
                <Box>
                  {subjectProgress.map(sp => (
                    <Box key={sp.subject} sx={{
                      mb: 1.5, p: 1.5, borderRadius: 2,
                      border: "1px solid #e8eaf6",
                      bgcolor: sp.status === "done" ? "#f1f8f1"
                             : sp.status === "partial" ? "#fffde7" : "#fff5f5"
                    }}>
                      <Box display="flex" justifyContent="space-between"
                        alignItems="center" mb={0.8}>
                        <Typography variant="body2" fontWeight={600}>
                          {sp.subject}
                        </Typography>
                        <Chip label={statusLabel(sp.status)}
                          size="small" color={statusColor(sp.status)} />
                      </Box>
                      <LinearProgress variant="determinate"
                        value={sp.percent}
                        sx={{
                          height: 6, borderRadius: 3, mb: 0.5,
                          bgcolor: "#e0e0e0",
                          "& .MuiLinearProgress-bar": {
                            bgcolor: progressColor(sp.status)
                          }
                        }} />
                      <Typography variant="caption" color="text.secondary">
                        {sp.entered}/{sp.total} students
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                /* Desktop progress table */
                <Paper sx={{ borderRadius: 2, overflow: "hidden",
                  boxShadow: "0 1px 8px rgba(26,35,126,0.08)" }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#1a237e" }}>
                      <TableRow>
                        {["#", "Subject", "Progress", "Students",
                          "% Complete", "Status"].map(h => (
                          <TableCell key={h}
                            sx={{ color: "white", fontWeight: 600 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subjectProgress.map((sp, idx) => (
                        <TableRow key={sp.subject} hover sx={{
                          bgcolor: sp.status === "done"    ? "#f1f8f1"
                                 : sp.status === "partial" ? "#fffde7"
                                 : "#fff5f5"
                        }}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {sp.subject}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: 150 }}>
                            <LinearProgress variant="determinate"
                              value={sp.percent}
                              sx={{
                                height: 8, borderRadius: 4,
                                bgcolor: "#e0e0e0",
                                "& .MuiLinearProgress-bar": {
                                  bgcolor: progressColor(sp.status)
                                }
                              }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {sp.entered} / {sp.total}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}
                              color={progressColor(sp.status)}>
                              {sp.percent}%
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={statusLabel(sp.status)}
                              size="small" color={statusColor(sp.status)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </>
          )}
          <Divider sx={{ mt: 3 }} />
        </Box>
      )}

      {/* ── My Teaching Assignments ── */}
      {Object.keys(groupedClasses).length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            📚 My Teaching Assignments
          </Typography>
          <Grid container spacing={1.5}>
            {Object.entries(groupedClasses).map(([classLabel, subjects]) => (
              <Grid item xs={12} sm={6} md={4} key={classLabel}>
                <Paper sx={{ p: 1.5, borderRadius: 2,
                  border: "1px solid #e8eaf6",
                  boxShadow: "0 1px 6px rgba(26,35,126,0.07)" }}>
                  <Typography variant="subtitle2" fontWeight={700}
                    color="#1a237e" mb={0.8}>
                    {classLabel}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {subjects.map(s => (
                      <Chip key={s} label={s} size="small"
                        color="primary" variant="outlined"
                        sx={{ fontSize: 11 }} />
                    ))}
                  </Box>
                  <Button size="small" variant="text"
                    startIcon={<EditNoteIcon />}
                    sx={{ mt: 1, color: "#1a237e", p: 0 }}
                    onClick={() => navigate("/teacher/marks")}>
                    Enter Marks
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ── My Students ── */}
      {myClasses.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            👥 My Students ({students.length})
          </Typography>
          {isMobile ? (
            <Box>
              {students.map((s, idx) => (
                <Card key={s.id} sx={{ mb: 1.5, boxShadow: 2 }}>
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adm: {s.admissionNo} • {s.gender}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Grade {s.grade}-{s.section}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        #{idx + 1}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2 }}>
                    <Button size="small" variant="outlined"
                      startIcon={<AssessmentIcon />}
                      onClick={() => navigate(`/teacher/report/${s.id}`)}>
                      Report
                    </Button>
                  </CardActions>
                </Card>
              ))}
              {students.length === 0 && (
                <Typography align="center" color="text.secondary" mt={2}>
                  No students found in your assigned classes.
                </Typography>
              )}
            </Box>
          ) : (
            <Paper sx={{ overflowX: "auto", mb: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["#", "Adm No", "Name", "Grade", "Gender", "Action"].map(h => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((s, idx) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{s.admissionNo}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>
                        <Chip label={`G${s.grade}-${s.section}`}
                          size="small" color="primary" />
                      </TableCell>
                      <TableCell>{s.gender}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined"
                          startIcon={<AssessmentIcon />}
                          onClick={() => navigate(`/teacher/report/${s.id}`)}>
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
            </Paper>
          )}

          <Button variant="contained" fullWidth={isMobile}
            startIcon={<EditNoteIcon />}
            sx={{ bgcolor: "#1a237e", mt: isMobile ? 1 : 0 }}
            onClick={() => navigate("/teacher/marks")}>
            Go to Marks Entry
          </Button>
        </>
      )}
    </Box>
  );
}