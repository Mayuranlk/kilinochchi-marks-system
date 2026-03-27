import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  GRADES, SECTIONS, getStudentSubjects,
  AESTHETIC_SUBJECTS, BASKET_1, BASKET_2, BASKET_3,
  COMPULSORY_SUBJECTS_10_11, SUBJECTS_BY_GRADE
} from "../constants";
import {
  Box, Typography, Button, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, IconButton,
  CircularProgress, Alert, Grid, Chip, Card, CardContent,
  Checkbox, FormGroup, FormControlLabel, Avatar, Tooltip,
  useMediaQuery, useTheme
} from "@mui/material";
import DeleteIcon      from "@mui/icons-material/Delete";
import SaveIcon        from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const getSubjectsForGrade = (g) => {
  if (g >= 6 && g <= 9) {
    const dummy = { grade: g, religion: "Hinduism", aesthetic: "Art" };
    const compulsory = getStudentSubjects(dummy).slice(0, -1);
    return [...new Set([...compulsory, ...AESTHETIC_SUBJECTS])];
  }
  if (g >= 10 && g <= 11) {
    return [...COMPULSORY_SUBJECTS_10_11, ...BASKET_1, ...BASKET_2, ...BASKET_3];
  }
  return SUBJECTS_BY_GRADE[g] || [];
};

const getAvatarColor = (name) => {
  const colors = ["#1a237e","#1565c0","#0277bd","#00695c",
                  "#2e7d32","#6a1b9a","#880e4f","#e65100"];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// All subjects across all grades (unique)
const ALL_SUBJECTS = [...new Set(
  GRADES.flatMap(g => getSubjectsForGrade(g))
)].sort();

export default function TeacherAssignments() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers]       = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");

  // ── Form state ──
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGrades, setSelectedGrades]   = useState([]);   // number[]
  const [selectedSections, setSelectedSections] = useState([]); // string[]
  const [selectedSubjects, setSelectedSubjects] = useState([]); // string[]

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
    setAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Toggle helpers ──
  const toggleGrade = (g) => {
    setSelectedGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
    // Reset subjects when grade changes
    setSelectedSubjects([]);
  };

  const toggleSection = (s) => {
    setSelectedSections(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleSubject = (s) => {
    setSelectedSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleAllGrades = () => {
    setSelectedGrades(prev => prev.length === GRADES.length ? [] : [...GRADES]);
    setSelectedSubjects([]);
  };

  const toggleAllSections = () => {
    setSelectedSections(prev =>
      prev.length === SECTIONS.length ? [] : [...SECTIONS]
    );
  };

  const toggleAllSubjects = () => {
    setSelectedSubjects(prev =>
      prev.length === availableSubjects.length ? [] : [...availableSubjects]
    );
  };

  // Subjects available for selected grades
  const availableSubjects = selectedGrades.length > 0
    ? [...new Set(selectedGrades.flatMap(g => getSubjectsForGrade(g)))].sort()
    : ALL_SUBJECTS;

  // Preview: how many combos will be created
  const previewCount = selectedGrades.length *
    selectedSections.length * selectedSubjects.length;

  // ── Save ──
  const handleSave = async () => {
    if (!selectedTeacher)          return setError("Please select a teacher.");
    if (selectedGrades.length === 0)   return setError("Select at least one grade.");
    if (selectedSections.length === 0) return setError("Select at least one section.");
    if (selectedSubjects.length === 0) return setError("Select at least one subject.");

    setSaving(true); setError("");
    const teacher = teachers.find(t => t.id === selectedTeacher);
    const conflicts = [];
    const toAdd = [];

    for (const g of selectedGrades) {
      for (const s of selectedSections) {
        for (const sub of selectedSubjects) {
          // Skip if subject not valid for this grade
          if (!getSubjectsForGrade(g).includes(sub)) continue;

          // Check duplicate
          const existing = assignments.find(a =>
            a.grade === g && a.section === s && a.subject === sub
          );
          if (existing) {
            if (existing.teacherId === selectedTeacher) continue; // already assigned
            const ct = teachers.find(t => t.id === existing.teacherId);
            conflicts.push(`${sub} G${g}-${s} → already assigned to ${ct?.name || "another teacher"}`);
            continue;
          }
          toAdd.push({ grade: g, section: s, subject: sub });
        }
      }
    }

    if (conflicts.length > 0) {
      setError("⚠️ Conflicts found:\n" + conflicts.join("\n"));
      setSaving(false);
      return;
    }

    if (toAdd.length === 0) {
      setError("All selected combinations are already assigned.");
      setSaving(false);
      return;
    }

    try {
      await Promise.all(toAdd.map(item =>
        addDoc(collection(db, "assignments"), {
          teacherId:   selectedTeacher,
          teacherName: teacher?.name || "",
          grade:       item.grade,
          section:     item.section,
          subject:     item.subject,
          createdAt:   new Date().toISOString(),
        })
      ));
      setSuccess(`✅ ${toAdd.length} assignments added for ${teacher?.name}!`);
      // Reset form
      setSelectedTeacher("");
      setSelectedGrades([]);
      setSelectedSections([]);
      setSelectedSubjects([]);
      fetchAll();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this assignment?")) return;
    await deleteDoc(doc(db, "assignments", id));
    fetchAll();
  };

  // Grouped for display
  const groupedByTeacher = teachers
    .map(t => ({
      ...t,
      assignments: assignments
        .filter(a => a.teacherId === t.id)
        .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
    }))
    .filter(t => t.assignments.length > 0);

  return (
    <Box>
      {/* Header */}
      <Box mb={2}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
          Teacher Assignments
        </Typography>
        <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
          <Chip label={`${assignments.length} Total`} size="small" color="primary" />
          <Chip label={`${teachers.length} Teachers`} size="small" color="success" />
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* ══════════════════════════════
          ASSIGNMENT FORM
      ══════════════════════════════ */}
      <Paper sx={{
        p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3,
        border: "2px solid #e8eaf6",
        boxShadow: "0 2px 12px rgba(26,35,126,0.07)"
      }}>
        <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={2.5}>
          ➕ New Assignment
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error.split("\n").map((line, i) => (
              <Typography key={i} variant="caption" display="block">{line}</Typography>
            ))}
          </Alert>
        )}

        {/* ── Step 1: Select Teacher ── */}
        <Box mb={2.5}>
          <Typography variant="body2" fontWeight={700} color="#1a237e" mb={1}>
            Step 1 — Select Teacher
          </Typography>
          <FormControl fullWidth size="small" sx={{ maxWidth: 400 }}>
            <InputLabel>Teacher *</InputLabel>
            <Select value={selectedTeacher} label="Teacher *"
              onChange={e => setSelectedTeacher(e.target.value)}>
              {teachers.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Avatar sx={{
                      bgcolor: getAvatarColor(t.name),
                      width: 28, height: 28, fontSize: 13, fontWeight: 700
                    }}>
                      {t.name?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {t.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {assignments.filter(a => a.teacherId === t.id).length} assigned
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={3}>

          {/* ── Step 2: Select Grades ── */}
          <Grid item xs={12} sm={4}>
            <Box sx={{
              border: "1px solid #e8eaf6", borderRadius: 2, p: 2,
              bgcolor: selectedGrades.length > 0 ? "#e8eaf6" : "#fafafa"
            }}>
              <Box display="flex" justifyContent="space-between"
                alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#1a237e">
                  Step 2 — Grade
                </Typography>
                <Button size="small" variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0 }}
                  onClick={toggleAllGrades}>
                  {selectedGrades.length === GRADES.length ? "None" : "All"}
                </Button>
              </Box>
              <FormGroup>
                {GRADES.map(g => (
                  <FormControlLabel key={g}
                    control={
                      <Checkbox
                        checked={selectedGrades.includes(g)}
                        onChange={() => toggleGrade(g)}
                        size="small"
                        sx={{ py: 0.3,
                          color: "#1a237e",
                          "&.Mui-checked": { color: "#1a237e" }
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2">Grade {g}</Typography>
                    }
                  />
                ))}
              </FormGroup>
              {selectedGrades.length > 0 && (
                <Chip label={`${selectedGrades.length} selected`}
                  size="small" color="primary" sx={{ mt: 1 }} />
              )}
            </Box>
          </Grid>

          {/* ── Step 3: Select Sections ── */}
          <Grid item xs={12} sm={4}>
            <Box sx={{
              border: "1px solid #e8eaf6", borderRadius: 2, p: 2,
              bgcolor: selectedSections.length > 0 ? "#e8f5e9" : "#fafafa"
            }}>
              <Box display="flex" justifyContent="space-between"
                alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#2e7d32">
                  Step 3 — Section
                </Typography>
                <Button size="small" variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#2e7d32" }}
                  onClick={toggleAllSections}>
                  {selectedSections.length === SECTIONS.length ? "None" : "All"}
                </Button>
              </Box>
              <FormGroup>
                {SECTIONS.map(s => (
                  <FormControlLabel key={s}
                    control={
                      <Checkbox
                        checked={selectedSections.includes(s)}
                        onChange={() => toggleSection(s)}
                        size="small"
                        sx={{ py: 0.3,
                          color: "#2e7d32",
                          "&.Mui-checked": { color: "#2e7d32" }
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2">Section {s}</Typography>
                    }
                  />
                ))}
              </FormGroup>
              {selectedSections.length > 0 && (
                <Chip label={`${selectedSections.length} selected`}
                  size="small" color="success" sx={{ mt: 1 }} />
              )}
            </Box>
          </Grid>

          {/* ── Step 4: Select Subjects ── */}
          <Grid item xs={12} sm={4}>
            <Box sx={{
              border: "1px solid #e8eaf6", borderRadius: 2, p: 2,
              bgcolor: selectedSubjects.length > 0 ? "#fff3e0" : "#fafafa",
              maxHeight: 320, overflowY: "auto"
            }}>
              <Box display="flex" justifyContent="space-between"
                alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#e65100">
                  Step 4 — Subject
                </Typography>
                <Button size="small" variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#e65100" }}
                  onClick={toggleAllSubjects}>
                  {selectedSubjects.length === availableSubjects.length ? "None" : "All"}
                </Button>
              </Box>
              <FormGroup>
                {availableSubjects.map(s => (
                  <FormControlLabel key={s}
                    control={
                      <Checkbox
                        checked={selectedSubjects.includes(s)}
                        onChange={() => toggleSubject(s)}
                        size="small"
                        sx={{ py: 0.3,
                          color: "#e65100",
                          "&.Mui-checked": { color: "#e65100" }
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: 13 }}>
                        {s}
                      </Typography>
                    }
                  />
                ))}
              </FormGroup>
              {selectedSubjects.length > 0 && (
                <Chip label={`${selectedSubjects.length} selected`}
                  size="small" color="warning" sx={{ mt: 1 }} />
              )}
            </Box>
          </Grid>
        </Grid>

        {/* ── Preview + Save ── */}
        <Box mt={2.5} display="flex" alignItems="center"
          gap={2} flexWrap="wrap">
          {previewCount > 0 && (
            <Box sx={{
              bgcolor: "#e8eaf6", px: 2, py: 1,
              borderRadius: 2, border: "1px solid #1a237e"
            }}>
              <Typography variant="body2" fontWeight={700} color="#1a237e">
                <CheckCircleIcon sx={{ fontSize: 16, mr: 0.5,
                  verticalAlign: "middle" }} />
                Will create <strong>{previewCount}</strong> assignment
                {previewCount !== 1 ? "s" : ""}
                {" "}({selectedGrades.length}G × {selectedSections.length}S
                × {selectedSubjects.length} subjects)
              </Typography>
            </Box>
          )}
          <Button
            variant="contained"
            startIcon={saving
              ? <CircularProgress size={16} color="inherit" />
              : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || previewCount === 0 || !selectedTeacher}
            sx={{ bgcolor: "#1a237e", px: 3 }}>
            {saving ? "Saving..." : `Save ${previewCount > 0 ? previewCount : ""} Assignments`}
          </Button>
        </Box>
      </Paper>

      {/* ══════════════════════════════
          CURRENT ASSIGNMENTS TABLE
      ══════════════════════════════ */}
      {loading ? <CircularProgress /> : (
        groupedByTeacher.length > 0 ? (
          <Box>
            <Typography variant="subtitle1" fontWeight={700}
              color="#1a237e" mb={1.5}>
              📋 Current Assignments
            </Typography>
            {isMobile ? (
              groupedByTeacher.map(t => (
                <Card key={t.id} sx={{
                  mb: 1.5, borderRadius: 3,
                  border: "1px solid #e8eaf6",
                  boxShadow: "0 2px 8px rgba(26,35,126,0.08)"
                }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Avatar sx={{
                        bgcolor: getAvatarColor(t.name),
                        width: 32, height: 32, fontSize: 14, fontWeight: 700
                      }}>
                        {t.name?.charAt(0)}
                      </Avatar>
                      <Typography variant="subtitle2" fontWeight={700}
                        color="#1a237e">
                        {t.name}
                      </Typography>
                      <Chip label={`${t.assignments.length}`}
                        size="small" color="primary" sx={{ ml: "auto" }} />
                    </Box>
                    {t.assignments.map(a => (
                      <Box key={a.id}
                        display="flex" justifyContent="space-between"
                        alignItems="center" py={0.5}
                        sx={{ borderBottom: "1px solid #f0f0f0" }}>
                        <Box display="flex" gap={0.8} flexWrap="wrap"
                          alignItems="center">
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
              <Paper sx={{ borderRadius: 3, overflow: "hidden",
                boxShadow: "0 2px 12px rgba(26,35,126,0.08)" }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#1a237e" }}>
                    <TableRow>
                      {["#","Teacher","Grade","Section","Subject","Action"].map(h => (
                        <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignments
                      .sort((a, b) => a.grade - b.grade ||
                        a.section.localeCompare(b.section))
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
                          <Chip label={`Grade ${a.grade}`}
                            size="small" color="primary" />
                        </TableCell>
                        <TableCell>{a.section}</TableCell>
                        <TableCell>{a.subject}</TableCell>
                        <TableCell>
                          <Tooltip title="Remove">
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
          <Alert severity="info">
            No assignments yet. Use the form above to assign teachers.
          </Alert>
        )
      )}
    </Box>
  );
}