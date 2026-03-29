import React, { useEffect, useState } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADES } from "../constants";
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableHead, TableRow, TableCell,
  TableBody, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Chip, CircularProgress, Grid, Alert, Card, CardContent,
  CardActions, useMediaQuery, useTheme, Tooltip, Divider
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SchoolIcon from "@mui/icons-material/School";
import PersonIcon from "@mui/icons-material/Person";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const STREAMS = ["Maths", "Bio", "Technology", "Arts", "Commerce"];
const YEARS = [2026, 2025, 2024];
const ALL_SECTIONS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"
];

const emptyForm = {
  grade: 6,
  section: "A",
  stream: "",
  classTeacherId: "",
  year: 2026,
  notes: ""
};

export default function ClassroomManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classSnap, teacherSnap] = await Promise.all([
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "users"))
      ]);

      setClassrooms(
        classSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) =>
            a.grade - b.grade ||
            a.section.localeCompare(b.section) ||
            (b.year || 0) - (a.year || 0)
          )
      );

      setTeachers(
        teacherSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.role === "teacher")
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      );
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTeacherName = (tid) => {
    const t = teachers.find(t => t.id === tid);
    return t ? t.name : "—";
  };

  const getClassLabel = (c) => {
    let label = `Grade ${c.grade} - ${c.section}`;
    if (c.stream) label += ` (${c.stream})`;
    return label;
  };

  const groupedByGrade = GRADES.reduce((acc, g) => {
    const gc = classrooms.filter(c => c.grade === g);
    if (gc.length > 0) acc[g] = gc;
    return acc;
  }, {});

  const getAvailableSections = () => {
    const existingForGrade = classrooms
      .filter(c => c.grade === form.grade)
      .map(c => c.section);

    const sectionSet = new Set(["A", "B", "C", "D", ...existingForGrade]);

    for (const s of ALL_SECTIONS) {
      if (!sectionSet.has(s)) {
        sectionSet.add(s);
        break;
      }
    }

    return ALL_SECTIONS.filter(s => sectionSet.has(s));
  };

  const availableSections = getAvailableSections();

  const createNewSection = async () => {
    setError("");
    setSuccess("");

    const existingForGrade = classrooms
      .filter(c => c.grade === form.grade)
      .map(c => c.section);

    const nextSection = ALL_SECTIONS.find(s => !existingForGrade.includes(s));

    if (!nextSection) {
      setError(`No more section letters available for Grade ${form.grade}.`);
      return;
    }

    const duplicate = classrooms.find(
      c => c.grade === form.grade &&
           c.section === nextSection &&
           c.year === form.year
    );

    if (duplicate) {
      setError(`Grade ${form.grade}-${nextSection} already exists for ${form.year}.`);
      return;
    }

    setCreatingSection(true);
    try {
      await addDoc(collection(db, "classrooms"), {
        grade: form.grade,
        section: nextSection,
        stream: form.grade >= 12 ? form.stream || "" : "",
        classTeacherId: "",
        year: form.year,
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setForm(prev => ({ ...prev, section: nextSection }));
      setSuccess(`New classroom created: Grade ${form.grade} - ${nextSection}`);
      await fetchData();
    } catch (err) {
      setError("Failed to create classroom: " + err.message);
    } finally {
      setCreatingSection(false);
    }
  };

  const handleSave = async () => {
    if (!form.grade || !form.section) {
      setError("Grade and Section are required.");
      return;
    }

    const duplicate = classrooms.find(c =>
      c.grade === form.grade &&
      c.section === form.section &&
      c.year === form.year &&
      c.id !== editId
    );

    if (duplicate) {
      setError(`Grade ${form.grade}-${form.section} already exists for ${form.year}.`);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        grade: form.grade,
        section: form.section,
        stream: form.grade >= 12 ? (form.stream || "") : "",
        classTeacherId: form.classTeacherId || "",
        year: form.year,
        notes: form.notes || "",
        updatedAt: new Date().toISOString()
      };

      if (editId) {
        await updateDoc(doc(db, "classrooms", editId), payload);
        setSuccess("Classroom updated successfully!");
      } else {
        await addDoc(collection(db, "classrooms"), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSuccess("Classroom added successfully!");
      }

      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await fetchData();
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c) => {
    setForm({
      grade: c.grade,
      section: c.section,
      stream: c.stream || "",
      classTeacherId: c.classTeacherId || "",
      year: c.year || 2026,
      notes: c.notes || ""
    });
    setEditId(c.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this classroom?")) return;
    try {
      await deleteDoc(doc(db, "classrooms", id));
      setSuccess("Classroom deleted.");
      await fetchData();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
          border: "1px solid #e8eaf6"
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800} color="#1a237e">
              Classrooms
            </Typography>
            <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
              <Chip label={`Total: ${classrooms.length}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Chip label={`Grades: ${Object.keys(groupedByGrade).length}`} size="small" color="success" sx={{ fontWeight: 700 }} />
              <Chip
                label={`With Teacher: ${classrooms.filter(c => c.classTeacherId).length}`}
                size="small"
                color="warning"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size={isMobile ? "small" : "medium"}
            onClick={() => {
              setForm(emptyForm);
              setEditId(null);
              setError("");
              setSuccess("");
              setOpen(true);
            }}
            sx={{ bgcolor: "#1a237e", fontWeight: 700, borderRadius: 2 }}
          >
            {isMobile ? "Add" : "Add Classroom"}
          </Button>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : classrooms.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            border: "1px solid #e8eaf6"
          }}
        >
          <SchoolIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography variant="h6" color="text.secondary" mt={1} fontWeight={600}>
            No classrooms created yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click "Add Classroom" to get started
          </Typography>
        </Box>
      ) : (
        <>
          {isMobile ? (
            <Box>
              {classrooms.map(c => (
                <Card
                  key={c.id}
                  sx={{
                    mb: 1.5,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.07)"
                  }}
                >
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800} color="#1a237e">
                          {getClassLabel(c)}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5} mt={0.3}>
                          <PersonIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {getTeacherName(c.classTeacherId)}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip label={c.year} size="small" color="primary" sx={{ fontWeight: 700 }} />
                    </Box>

                    {c.stream && (
                      <Chip label={c.stream} size="small" color="warning" sx={{ mt: 1, fontWeight: 600 }} />
                    )}

                    {c.notes && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        📝 {c.notes}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(c)}
                      sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          ) : (
            <Box>
              {Object.entries(groupedByGrade).map(([grade, gClassrooms]) => (
                <Box key={grade} mb={3}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <SchoolIcon sx={{ color: "#1a237e", fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={800} color="#1a237e">
                      Grade {grade}
                    </Typography>
                    <Chip
                      label={`${gClassrooms.length} section${gClassrooms.length > 1 ? "s" : ""}`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>

                  <Paper
                    sx={{
                      overflowX: "auto",
                      borderRadius: 3,
                      boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
                      border: "1px solid #e8eaf6"
                    }}
                  >
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#1a237e" }}>
                        <TableRow>
                          {["Section", "Year", "Class Teacher", "Stream", "Notes", "Actions"].map(h => (
                            <TableCell key={h} sx={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {gClassrooms.map(c => (
                          <TableRow key={c.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                            <TableCell>
                              <Chip
                                label={c.section}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 800, fontSize: 13 }}
                              />
                            </TableCell>

                            <TableCell>
                              <Chip label={c.year} size="small" color="default" sx={{ fontWeight: 600 }} />
                            </TableCell>

                            <TableCell>
                              {c.classTeacherId ? (
                                <Chip
                                  icon={<PersonIcon />}
                                  label={getTeacherName(c.classTeacherId)}
                                  color="success"
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                <Chip label="Not assigned" size="small" color="warning" variant="outlined" />
                              )}
                            </TableCell>

                            <TableCell>
                              {c.stream ? (
                                <Chip label={c.stream} size="small" color="warning" sx={{ fontWeight: 600 }} />
                              ) : (
                                <Typography variant="caption" color="text.secondary">—</Typography>
                              )}
                            </TableCell>

                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {c.notes || "—"}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Tooltip title="Edit">
                                <IconButton size="small" color="primary" onClick={() => handleEdit(c)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "✏️ Edit Classroom" : "➕ Add / Create Classroom"}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2, mt: 1 }}>
              {success}
            </Alert>
          )}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={form.grade}
                  label="Grade"
                  onChange={e => setForm({ ...form, grade: Number(e.target.value), section: "A" })}
                >
                  {GRADES.map(g => (
                    <MenuItem key={g} value={g}>
                      Grade {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Section</InputLabel>
                <Select
                  value={form.section}
                  label="Section"
                  onChange={e => setForm({ ...form, section: e.target.value })}
                >
                  {availableSections.map(s => (
                    <MenuItem key={s} value={s}>
                      Section {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                Existing + next available section
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={form.year}
                  label="Year"
                  onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                >
                  {YEARS.map(y => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={creatingSection ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                onClick={createNewSection}
                disabled={creatingSection}
                sx={{
                  borderColor: "#1a237e",
                  color: "#1a237e",
                  fontWeight: 700,
                  height: 42,
                  borderRadius: 2
                }}
              >
                {creatingSection
                  ? "Creating..."
                  : `Create New Classroom / Division for Grade ${form.grade}`}
              </Button>
              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                This creates the next section automatically, like E, F, G...
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Assignment
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Class Teacher</InputLabel>
                <Select
                  value={form.classTeacherId || ""}
                  label="Class Teacher"
                  onChange={e => setForm({ ...form, classTeacherId: e.target.value })}
                >
                  <MenuItem value="">
                    <em>No teacher assigned</em>
                  </MenuItem>
                  {teachers.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={form.grade < 12}>
                <InputLabel>Stream</InputLabel>
                <Select
                  value={form.stream || ""}
                  label="Stream"
                  onChange={e => setForm({ ...form, stream: e.target.value || "" })}
                >
                  <MenuItem value="">None</MenuItem>
                  {STREAMS.map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                {form.grade < 12 ? "Only for Grade 12–13" : "Select A/L stream"}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={2}
                value={form.notes || ""}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Science lab class, special notes..."
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
          >
            {saving
              ? <CircularProgress size={20} color="inherit" />
              : editId ? "Update Classroom" : "Save Classroom"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}