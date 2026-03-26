import React, { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Chip, CircularProgress, Grid, Alert,
  Card, CardContent, CardActions, Tabs, Tab, useMediaQuery, useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import BookIcon from "@mui/icons-material/Book";

const SUBJECT_TYPES = [
  { value: "compulsory", label: "Compulsory", color: "primary" },
  { value: "religion", label: "Religion", color: "secondary" },
  { value: "aesthetic", label: "Aesthetic", color: "warning" },
  { value: "stream", label: "A/L Stream", color: "error" },
];

const GRADE_GROUPS = ["6-9", "10-11", "AL"];
const STREAMS = ["Maths", "Bio", "Technology", "Arts", "Commerce"];

const emptyForm = {
  name: "", code: "", type: "compulsory",
  gradesGroup: "6-9", stream: "", isActive: true
};

export default function SubjectManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    const snap = await getDocs(collection(db, "subjects"));
    setSubjects(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) return setError("Name and Code are required.");
    setSaving(true); setError(""); setSuccess("");
    try {
      if (editId) {
        await updateDoc(doc(db, "subjects", editId), form);
        setSuccess("Subject updated!");
      } else {
        await addDoc(collection(db, "subjects"), form);
        setSuccess("Subject added!");
      }
      setOpen(false); setForm(emptyForm); setEditId(null);
      fetchSubjects();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleEdit = (s) => {
    setForm({
      name: s.name, code: s.code, type: s.type,
      gradesGroup: s.gradesGroup, stream: s.stream || "", isActive: s.isActive
    });
    setEditId(s.id); setError(""); setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subject?")) return;
    await deleteDoc(doc(db, "subjects", id));
    setSuccess("Subject deleted.");
    fetchSubjects();
  };

  const filtered = subjects.filter((s) => {
    if (tab === 0) return true;
    if (tab === 1) return s.gradesGroup === "6-9";
    if (tab === 2) return s.gradesGroup === "10-11";
    if (tab === 3) return s.gradesGroup === "AL";
    return true;
  });

  const getTypeChip = (type) => {
    const t = SUBJECT_TYPES.find(st => st.value === type);
    return t ? <Chip label={t.label} size="small" color={t.color} /> : null;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
          Subjects
          <Typography component="span" variant="body2" color="text.secondary" ml={1}>
            ({subjects.length})
          </Typography>
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} size={isMobile ? "small" : "medium"}
          onClick={() => { setForm(emptyForm); setEditId(null); setError(""); setOpen(true); }}
          sx={{ bgcolor: "#1a237e" }}>
          {isMobile ? "Add" : "Add Subject"}
        </Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}>
          <Tab label="All" />
          <Tab label="Grade 6-9" />
          <Tab label="Grade 10-11" />
          <Tab label="A/L" />
        </Tabs>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
      ) : (
        <>
          {/* Mobile Card View */}
          {isMobile ? (
            <Box>
              {filtered.map((s) => (
                <Card key={s.id} sx={{ mb: 1.5, boxShadow: 2 }}>
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Code: {s.code} • {s.gradesGroup}
                        </Typography>
                      </Box>
                      <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                        {getTypeChip(s.type)}
                        <Chip
                          label={s.isActive ? "Active" : "Inactive"}
                          color={s.isActive ? "success" : "default"}
                          size="small" />
                      </Box>
                    </Box>
                    {s.stream && (
                      <Chip label={`Stream: ${s.stream}`} size="small"
                        variant="outlined" sx={{ mt: 0.5 }} />
                    )}
                  </CardContent>
                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />}
                      onClick={() => handleEdit(s)}>Edit</Button>
                    <Button size="small" variant="outlined" color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(s.id)}>Delete</Button>
                  </CardActions>
                </Card>
              ))}
              {filtered.length === 0 && (
                <Box textAlign="center" py={4}>
                  <BookIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                  <Typography color="text.secondary" mt={1}>
                    No subjects found. Add your first subject!
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            /* Desktop Table View */
            <Paper sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["Code", "Subject Name", "Type", "Grade Group", "Stream", "Status", "Actions"].map((h) => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell><strong>{s.code}</strong></TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{getTypeChip(s.type)}</TableCell>
                      <TableCell>{s.gradesGroup}</TableCell>
                      <TableCell>{s.stream || "—"}</TableCell>
                      <TableCell>
                        <Chip label={s.isActive ? "Active" : "Inactive"}
                          color={s.isActive ? "success" : "default"} size="small" />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="primary" onClick={() => handleEdit(s)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <BookIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                        <Typography color="text.secondary">
                          No subjects found. Add your first subject!
                        </Typography>
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
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm"
        fullWidth fullScreen={isMobile}>
        <DialogTitle>{editId ? "Edit Subject" : "Add New Subject"}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <TextField fullWidth label="Subject Name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Subject Code (e.g. MATH)" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={form.type} label="Type"
                  onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {SUBJECT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Grade Group</InputLabel>
                <Select value={form.gradesGroup} label="Grade Group"
                  onChange={(e) => setForm({ ...form, gradesGroup: e.target.value })}>
                  {GRADE_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Stream (A/L only)</InputLabel>
                <Select value={form.stream || ""} label="Stream"
                  onChange={(e) => setForm({ ...form, stream: e.target.value || "" })}
                  disabled={form.gradesGroup !== "AL"}>
                  <MenuItem value="">None</MenuItem>
                  {STREAMS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={form.isActive} label="Status"
                  onChange={(e) => setForm({ ...form, isActive: e.target.value })}>
                  <MenuItem value={true}>Active</MenuItem>
                  <MenuItem value={false}>Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} color="inherit" /> :
              editId ? "Update Subject" : "Add Subject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}