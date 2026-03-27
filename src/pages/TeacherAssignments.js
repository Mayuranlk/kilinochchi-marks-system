import React, { useEffect, useState } from "react";
import {
  collection, getDocs, addDoc, deleteDoc, doc
} from "firebase/firestore";
import { db } from "../firebase";
import {
  GRADES, SECTIONS, getStudentSubjects,
  AESTHETIC_SUBJECTS, BASKET_1, BASKET_2, BASKET_3,
  COMPULSORY_SUBJECTS_10_11, SUBJECTS_BY_GRADE
} from "../constants";
import {
  Box, Typography, Button, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, IconButton,
  CircularProgress, Alert, Grid, Chip, Tooltip, Card, CardContent,
  useMediaQuery, useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";

const getSubjectsForGrade = (g) => {
  if (g >= 6 && g <= 9) {
    const dummy = { grade: g, religion: "Hindu", aesthetic: "Art" };
    const compulsory = getStudentSubjects(dummy).slice(0, -1);
    return [...new Set([...compulsory, ...AESTHETIC_SUBJECTS])];
  }
  if (g >= 10 && g <= 11) {
    return [...COMPULSORY_SUBJECTS_10_11, ...BASKET_1, ...BASKET_2, ...BASKET_3];
  }
  return SUBJECTS_BY_GRADE[g] || [];
};

const emptyForm = {
  teacherId: "", grade: 6, section: "A", subject: ""
};

export default function TeacherAssignments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const [tSnap, aSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "assignments"))
    ]);
    setTeachers(
      tSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "teacher" && (u.status || "active") === "active")
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setAssignments(
      aSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const subjects = getSubjectsForGrade(form.grade);

  // ── reset subject when grade changes ──
  const handleGradeChange = (g) => {
    setForm({ ...form, grade: g, subject: "" });
  };

  const handleAssign = async () => {
    if (!form.teacherId) return setError("Please select a teacher.");
    if (!form.subject)   return setError("Please select a subject.");

    // Check duplicate
    const exists = assignments.find(a =>
      a.grade === form.grade &&
      a.section === form.section &&
      a.subject === form.subject
    );
    if (exists) {
      const existingTeacher = teachers.find(t => t.id === exists.teacherId);
      return setError(
        `${form.subject} for Grade ${form.grade}-${form.section} is already assigned` +
        ` to ${existingTeacher?.name || "another teacher"}.`
      );
    }

    setSaving(true); setError("");
    try {
      const teacher = teachers.find(t => t.id === form.teacherId);
      await addDoc(collection(db, "assignments"), {
        teacherId:   form.teacherId,
        teacherName: teacher?.name || "",
        grade:       form.grade,
        section:     form.section,
        subject:     form.subject,
        createdAt:   new Date().toISOString(),
      });
      setSuccess(`✅ ${teacher?.name} assigned to ${form.subject} — Grade ${form.grade}-${form.section}`);
      setForm(emptyForm);
      fetchAll();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this assignment?")) return;
    await deleteDoc(doc(db, "assignments", id));
    fetchAll();
  };

  // ── Group assignments by teacher for display ──
  const groupedByTeacher = teachers.map(t => ({
    ...t,
    assignments: assignments
      .filter(a => a.teacherId === t.id)
      .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
  })).filter(t => t.assignments.length > 0);

  // ── Unassigned subject-class combinations ──
  const allCombos = [];
  GRADES.forEach(g => {
    SECTIONS.forEach(s => {
      getSubjectsForGrade(g).forEach(sub => {
        allCombos.push({ grade: g, section: s, subject: sub });
      });
    });
  });
  const assignedKeys = assignments.map(a => `${a.grade}-${a.section}-${a.subject}`);
  const unassigned = allCombos.filter(
    c => !assignedKeys.includes(`${c.grade}-${c.section}-${c.subject}`)
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Teacher Assignments
          </Typography>
          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            <Chip label={`${assignments.length} Assignments`} size="small" color="primary" />
            <Chip label={`${teachers.length} Teachers`} size="small" color="success" />
            <Chip label={`${unassigned.length} Unassigned`} size="small"
              color={unassigned.length > 0 ? "warning" : "default"} />
          </Box>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* ── Assign Form ── */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3,
        border: "2px solid #e8eaf6",
        boxShadow: "0 2px 12px rgba(26,35,126,0.07)" }}>
        <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={2}>
          ➕ New Assignment
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} alignItems="flex-end">

          {/* Teacher */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Teacher *</InputLabel>
              <Select value={form.teacherId} label="Teacher *"
                onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                {teachers.map(t => (
                  <MenuItem key={t.id} value={t.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon fontSize="small" sx={{ color: "#1a237e" }} />
                      {t.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Grade */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Grade *</InputLabel>
              <Select value={form.grade} label="Grade *"
                onChange={e => handleGradeChange(Number(e.target.value))}>
                {GRADES.map(g => (
                  <MenuItem key={g} value={g}>Grade {g}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Section */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Section *</InputLabel>
              <Select value={form.section} label="Section *"
                onChange={e => setForm({ ...form, section: e.target.value })}>
                {SECTIONS.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Subject */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Subject *</InputLabel>
              <Select value={form.subject} label="Subject *"
                onChange={e => setForm({ ...form, subject: e.target.value })}>
                {subjects.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Assign Button */}
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              onClick={handleAssign} disabled={saving}
              sx={{ bgcolor: "#1a237e", height: 40 }}>
              Assign
            </Button>
          </Grid>

        </Grid>
      </Paper>

      {loading ? <CircularProgress /> : (
        <>
          {/* ── Assignments by Teacher ── */}
          {groupedByTeacher.length > 0 ? (
            <Box mb={3}>
              <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
                📋 Current Assignments
              </Typography>
              {isMobile ? (
                /* Mobile Cards */
                groupedByTeacher.map(t => (
                  <Card key={t.id} sx={{
                    mb: 1.5, borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.08)"
                  }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700} color="#1a237e" mb={1}>
                        👤 {t.name}
                      </Typography>
                      {t.assignments.map(a => (
                        <Box key={a.id}
                          display="flex" justifyContent="space-between"
                          alignItems="center" py={0.5}
                          sx={{ borderBottom: "1px solid #f0f0f0" }}>
                          <Box display="flex" gap={0.8} flexWrap="wrap" alignItems="center">
                            <Chip label={`G${a.grade}-${a.section}`}
                              size="small" color="primary" />
                            <Typography variant="body2">{a.subject}</Typography>
                          </Box>
                          <IconButton size="small" color="error"
                            onClick={() => handleDelete(a.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                ))
              ) : (
                /* Desktop Table */
                <Paper sx={{ borderRadius: 3, overflow: "hidden",
                  boxShadow: "0 2px 12px rgba(26,35,126,0.08)" }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#1a237e" }}>
                      <TableRow>
                        {["#", "Teacher", "Grade", "Section", "Subject", "Action"].map(h => (
                          <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assignments
                        .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
                        .map((a, idx) => (
                        <TableRow key={a.id} hover
                          sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {a.teacherName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={`Grade ${a.grade}`} size="small" color="primary" />
                          </TableCell>
                          <TableCell>{a.section}</TableCell>
                          <TableCell>{a.subject}</TableCell>
                          <TableCell>
                            <Tooltip title="Remove Assignment">
                              <IconButton size="small" color="error"
                                onClick={() => handleDelete(a.id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              No assignments yet. Use the form above to assign teachers to subjects.
            </Alert>
          )}

          {/* ── Per-Teacher Summary Cards ── */}
          {groupedByTeacher.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
                👤 Per Teacher Summary
              </Typography>
              <Grid container spacing={2}>
                {groupedByTeacher.map(t => (
                  <Grid item xs={12} sm={6} md={4} key={t.id}>
                    <Paper sx={{ p: 2, borderRadius: 3,
                      border: "1px solid #e8eaf6",
                      boxShadow: "0 1px 8px rgba(26,35,126,0.07)" }}>
                      <Typography variant="subtitle2" fontWeight={700}
                        color="#1a237e" mb={1}>
                        {t.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        {t.email}
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {t.assignments.map(a => (
                          <Chip key={a.id}
                            label={`G${a.grade}${a.section} · ${a.subject}`}
                            size="small" variant="outlined" color="primary"
                            sx={{ fontSize: 11 }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary" mt={1}
                        display="block">
                        {t.assignments.length} subject{t.assignments.length !== 1 ? "s" : ""}
                        assigned
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}