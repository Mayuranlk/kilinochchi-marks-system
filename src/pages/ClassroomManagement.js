import React, { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Chip, CircularProgress, Grid, Alert,
  Card, CardContent, CardActions, useMediaQuery, useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SchoolIcon from "@mui/icons-material/School";
import PersonIcon from "@mui/icons-material/Person";

const GRADES = Array.from({ length: 8 }, (_, i) => 6 + i);
const SECTIONS = ["A", "B", "C"];
const STREAMS = ["Maths", "Bio", "Technology", "Arts", "Commerce"];
const YEARS = [2026, 2025, 2024];

const emptyForm = {
  grade: 6, section: "A", stream: "",
  classTeacherId: "", year: 2026, notes: ""
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

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [classSnap, teacherSnap] = await Promise.all([
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "users"))
      ]);
      setClassrooms(
        classSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
      );
      setTeachers(
        teacherSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.role === "teacher")
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.grade || !form.section) return setError("Grade and Section are required.");
    setSaving(true); setError(""); setSuccess("");
    try {
      if (editId) {
        await updateDoc(doc(db, "classrooms", editId), form);
        setSuccess("Classroom updated successfully!");
      } else {
        await addDoc(collection(db, "classrooms"), form);
        setSuccess("Classroom added successfully!");
      }
      setOpen(false); setForm(emptyForm); setEditId(null);
      fetchData();
    } catch (err) {
      setError("Save failed: " + err.message);
    }
    setSaving(false);
  };

  const handleEdit = (c) => {
    setForm({
      grade: c.grade, section: c.section, stream: c.stream || "",
      classTeacherId: c.classTeacherId || "", year: c.year || 2026, notes: c.notes || ""
    });
    setEditId(c.id); setError(""); setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this classroom?")) return;
    await deleteDoc(doc(db, "classrooms", id));
    setSuccess("Classroom deleted.");
    fetchData();
  };

  const getTeacherName = (tid) => {
    const t = teachers.find(t => t.id === tid);
    return t ? t.name : "No teacher";
  };

  const getClassLabel = (c) => {
    let label = `Grade ${c.grade}${c.section}`;
    if (c.stream) label += ` - ${c.stream}`;
    return label;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
          Classrooms
          <Typography component="span" variant="body2" color="text.secondary" ml={1}>
            ({classrooms.length})
          </Typography>
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} size={isMobile ? "small" : "medium"}
          onClick={() => { setForm(emptyForm); setEditId(null); setError(""); setOpen(true); }}
          sx={{ bgcolor: "#1a237e" }}>
          {isMobile ? "Add" : "Add Classroom"}
        </Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
      ) : (
        <>
          {/* Mobile Card View */}
          {isMobile ? (
            <Box>
              {classrooms.map((c) => (
                <Card key={c.id} sx={{ mb: 1.5, boxShadow: 2 }}>
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {getClassLabel(c)}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5} mt={0.3}>
                          <PersonIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {getTeacherName(c.classTeacherId)}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip label={c.year} size="small" color="primary" />
                    </Box>
                    {c.stream && (
                      <Chip label={c.stream} size="small" color="warning" sx={{ mt: 1 }} />
                    )}
                    {c.notes && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {c.notes}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />}
                      onClick={() => handleEdit(c)}>Edit</Button>
                    <Button size="small" variant="outlined" color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(c.id)}>Delete</Button>
                  </CardActions>
                </Card>
              ))}
              {classrooms.length === 0 && (
                <Box textAlign="center" py={4}>
                  <SchoolIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                  <Typography color="text.secondary" mt={1}>No classrooms yet.</Typography>
                </Box>
              )}
            </Box>
          ) : (
            /* Desktop Table View */
            <Paper sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["Class", "Year", "Class Teacher", "Stream", "Notes", "Actions"].map((h) => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {classrooms.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{getClassLabel(c)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Grade {c.grade} - {c.section}
                        </Typography>
                      </TableCell>
                      <TableCell><Chip label={c.year} color="primary" size="small" /></TableCell>
                      <TableCell>
                        <Chip icon={<PersonIcon />}
                          label={getTeacherName(c.classTeacherId)}
                          color={c.classTeacherId ? "success" : "default"} size="small" />
                      </TableCell>
                      <TableCell>
                        {c.stream ? <Chip label={c.stream} color="warning" size="small" /> : "—"}
                      </TableCell>
                      <TableCell>{c.notes || "—"}</TableCell>
                      <TableCell>
                        <IconButton size="small" color="primary" onClick={() => handleEdit(c)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {classrooms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <SchoolIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                        <Typography color="text.secondary">No classrooms created yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md"
        fullWidth fullScreen={isMobile}>
        <DialogTitle>{editId ? "Edit Classroom" : "Add New Classroom"}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={4}>
              <FormControl fullWidth required>
                <InputLabel>Grade</InputLabel>
                <Select value={form.grade} label="Grade"
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  {GRADES.map((g) => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth required>
                <InputLabel>Section</InputLabel>
                <Select value={form.section} label="Section"
                  onChange={(e) => setForm({ ...form, section: e.target.value })}>
                  {SECTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select value={form.year} label="Year"
                  onChange={(e) => setForm({ ...form, year: e.target.value })}>
                  {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Stream (Grade 12-13 only)</InputLabel>
                <Select value={form.stream || ""} label="Stream"
                  onChange={(e) => setForm({ ...form, stream: e.target.value || "" })}
                  disabled={form.grade < 12}>
                  <MenuItem value="">None</MenuItem>
                  {STREAMS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
                <Typography variant="caption" color="text.secondary" mt={0.5}>
                  {form.grade < 12 ? `Not applicable for Grade ${form.grade}` : "Select A/L stream"}
                </Typography>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Class Teacher</InputLabel>
                <Select value={form.classTeacherId || ""} label="Class Teacher"
                  onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}>
                  <MenuItem value="">No teacher assigned</MenuItem>
                  {teachers.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name} {t.grade && t.section ? `(G${t.grade}-${t.section})` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes (optional)" multiline rows={2}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Special notes about this class..." />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} color="inherit" /> :
              editId ? "Update Classroom" : "Add Classroom"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}