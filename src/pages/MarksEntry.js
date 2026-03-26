import React, { useEffect, useState, useCallback } from "react";
import { collection, getDocs, setDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  GRADES, SECTIONS, getStudentSubjects,
  AESTHETIC_SUBJECTS, BASKET_1, BASKET_2, BASKET_3,
  COMPULSORY_SUBJECTS_10_11, SUBJECTS_BY_GRADE
} from "../constants";
import {
  Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, TextField,
  Button, CircularProgress, Alert, Chip, Card, CardContent,
  useMediaQuery, useTheme
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";

export default function MarksEntry() {
  const { profile, isAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [grade, setGrade] = useState(isAdmin ? 6 : profile?.grade || 6);
  const [section, setSection] = useState(isAdmin ? "A" : profile?.section || "A");
  const [subject, setSubject] = useState("");
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeTerm, setActiveTerm] = useState(null);
  const [termLoading, setTermLoading] = useState(true);

  // ── Subject dropdown list based on selected grade ──
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

  const subjects = getSubjectsForGrade(isAdmin ? grade : (profile?.grade || 6));

  useEffect(() => {
    async function fetchActiveTerm() {
      setTermLoading(true);
      const snap = await getDocs(collection(db, "academicTerms"));
      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(t => t.isActive === true);
      setActiveTerm(active || null);
      setTermLoading(false);
    }
    fetchActiveTerm();
  }, []);

  useEffect(() => {
    if (!isAdmin && profile) {
      setGrade(profile.grade);
      setSection(profile.section);
    }
  }, [profile, isAdmin]);

  useEffect(() => { setSubject(""); }, [grade]);

  const fetchStudents = useCallback(async () => {
    if (!subject || !activeTerm) return;
    setLoading(true); setSuccess(""); setError("");
    const snap = await getDocs(collection(db, "students"));
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => {
        if (s.grade !== grade) return false;
        if (s.section !== section) return false;
        if ((s.status || "active") !== "active") return false;
        // ── Only show student if selected subject is in their personal list ──
        const studentSubjects = getStudentSubjects(s);
        return studentSubjects.includes(subject);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setStudents(list);

    const existing = {};
    for (const s of list) {
      const markId = `${s.id}_${subject}_${activeTerm.term}_${activeTerm.year}`;
      const ref = doc(db, "marks", markId);
      const snap2 = await getDoc(ref);
      if (snap2.exists()) existing[s.id] = snap2.data().mark ?? "";
    }
    setMarks(existing);
    setLoading(false);
  }, [grade, section, subject, activeTerm]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleMarkChange = (studentId, value) => {
    if (value === "" || (Number(value) >= 0 && Number(value) <= 100)) {
      setMarks(prev => ({ ...prev, [studentId]: value }));
    }
  };

  const handleSave = async () => {
    if (!subject) return setError("Please select a subject.");
    if (!activeTerm) return setError("No active term! Admin must activate a term first.");
    setSaving(true); setSuccess(""); setError("");
    try {
      for (const s of students) {
        const mark = marks[s.id];
        if (mark !== undefined && mark !== "") {
          const markId = `${s.id}_${subject}_${activeTerm.term}_${activeTerm.year}`;
          await setDoc(doc(db, "marks", markId), {
            studentId: s.id,
            studentName: s.name,
            grade, section, subject,
            term: activeTerm.term,
            year: activeTerm.year,
            mark: Number(mark),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setSuccess(`Marks saved for ${activeTerm.term} ${activeTerm.year}!`);
    } catch (err) {
      setError("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const getGrade = (m) => {
    if (m === "" || m === undefined) return null;
    const n = Number(m);
    if (n >= 75) return { label: "A", color: "success" };
    if (n >= 65) return { label: "B", color: "primary" };
    if (n >= 55) return { label: "C", color: "warning" };
    if (n >= 35) return { label: "S", color: "default" };
    return { label: "F", color: "error" };
  };

  if (termLoading) return (
    <Box display="flex" justifyContent="center" mt={5}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700}
        color="#1a237e" gutterBottom>
        Marks Entry
      </Typography>

      {/* Active Term Banner */}
      {activeTerm ? (
        <Card sx={{ mb: 2, bgcolor: "#e8f5e9", border: "2px solid #2e7d32" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <CheckCircleIcon sx={{ color: "#2e7d32" }} />
              <Typography variant="subtitle2" fontWeight={700} color="#2e7d32">
                Active: {activeTerm.term} {activeTerm.year}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeTerm.startDate} → {activeTerm.endDate}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
          No active term set! Please ask admin to activate a term before entering marks.
        </Alert>
      )}

      {/* Filters */}
      <Grid container spacing={1.5} mb={2}>
        {isAdmin && (
          <>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Grade</InputLabel>
                <Select value={grade} label="Grade"
                  onChange={(e) => setGrade(e.target.value)}>
                  {GRADES.map(g => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Section</InputLabel>
                <Select value={section} label="Section"
                  onChange={(e) => setSection(e.target.value)}>
                  {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </>
        )}
        <Grid item xs={12} sm={isAdmin ? 6 : 12}>
          <FormControl fullWidth size="small">
            <InputLabel>Subject</InputLabel>
            <Select value={subject} label="Subject"
              onChange={(e) => setSubject(e.target.value)}
              disabled={!activeTerm}>
              {subjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!activeTerm ? null : !subject ? (
        <Alert severity="info">Select a subject to load students.</Alert>
      ) : loading ? (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center"
            mb={1} flexWrap="wrap" gap={1}>
            <Typography variant="body2" color="text.secondary">
              {students.length} students — Grade {grade}-{section} |{" "}
              {subject} | {activeTerm.term} {activeTerm.year}
            </Typography>
            {!isMobile && (
              <Button variant="contained" startIcon={<SaveIcon />}
                onClick={handleSave} disabled={saving}
                sx={{ bgcolor: "#1a237e" }}>
                {saving ? <CircularProgress size={20} color="inherit" /> : "Save All Marks"}
              </Button>
            )}
          </Box>

          {/* Info banner for basket subjects */}
          {(grade >= 10 && grade <= 11) &&
            ![...COMPULSORY_SUBJECTS_10_11].includes(subject) && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Showing only students who selected <strong>{subject}</strong> in their basket.
            </Alert>
          )}

          {/* Info banner for aesthetic subjects */}
          {(grade >= 6 && grade <= 9) &&
            AESTHETIC_SUBJECTS.includes(subject) && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Showing only students who selected <strong>{subject}</strong> as their aesthetic.
            </Alert>
          )}

          <Paper sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1a237e" }}>
                <TableRow>
                  {["#", "Name", "Marks (0-100)", "Grade"].map(h => (
                    <TableCell key={h} sx={{ color: "white", fontWeight: 600,
                      fontSize: { xs: 11, sm: 14 }, px: { xs: 1, sm: 2 } }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((s, idx) => {
                  const gradeInfo = getGrade(marks[s.id]);
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ px: { xs: 1, sm: 2 }, fontSize: { xs: 12, sm: 14 } }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ px: { xs: 1, sm: 2 }, fontSize: { xs: 12, sm: 14 } }}>
                        {isMobile ? s.name.split(" ")[0] : s.name}
                      </TableCell>
                      <TableCell sx={{ px: { xs: 0.5, sm: 2 } }}>
                        <TextField size="small" type="number"
                          inputProps={{ min: 0, max: 100 }}
                          value={marks[s.id] ?? ""}
                          onChange={(e) => handleMarkChange(s.id, e.target.value)}
                          sx={{ width: { xs: 65, sm: 100 } }}
                          placeholder="0–100" disabled={!activeTerm} />
                      </TableCell>
                      <TableCell sx={{ px: { xs: 0.5, sm: 2 } }}>
                        {gradeInfo ? (
                          <Chip label={gradeInfo.label}
                            color={gradeInfo.color} size="small" />
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No students found for <strong>{subject}</strong> in
                      Grade {grade}-{section}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          <Button variant="contained" startIcon={<SaveIcon />}
            onClick={handleSave} disabled={saving}
            fullWidth sx={{ bgcolor: "#1a237e", mt: 2 }}>
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save All Marks"}
          </Button>
        </>
      )}
    </Box>
  );
}