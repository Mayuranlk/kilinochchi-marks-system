import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  COMPULSORY_SUBJECTS_6_9, COMPULSORY_SUBJECTS_10_11,
  AESTHETIC_SUBJECTS, BASKET_1, BASKET_2, BASKET_3
} from "../constants";
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableHead, TableRow, TableCell, TableBody, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, CircularProgress,
  Alert, Tabs, Tab, Tooltip, IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

// ── Build default subjects list from constants ──
const buildDefaults = () => {
  const list = [];

  COMPULSORY_SUBJECTS_6_9.forEach(s => list.push({
    id: `default-69-${s}`, code: "—", name: s,
    type: "Compulsory", gradeGroup: "Grade 6-9", stream: "—",
    status: "active", isDefault: true
  }));

  COMPULSORY_SUBJECTS_10_11.forEach(s => list.push({
    id: `default-1011-${s}`, code: "—", name: s,
    type: "Compulsory", gradeGroup: "Grade 10-11", stream: "—",
    status: "active", isDefault: true
  }));

  AESTHETIC_SUBJECTS.forEach(s => list.push({
    id: `default-aes-${s}`, code: "—", name: s,
    type: "Aesthetic", gradeGroup: "Grade 6-9", stream: "—",
    status: "active", isDefault: true
  }));

  BASKET_1.forEach(s => list.push({
    id: `default-b1-${s}`, code: "—", name: s,
    type: "Basket 1", gradeGroup: "Grade 10-11", stream: "—",
    status: "active", isDefault: true
  }));

  BASKET_2.forEach(s => list.push({
    id: `default-b2-${s}`, code: "—", name: s,
    type: "Basket 2", gradeGroup: "Grade 10-11", stream: "—",
    status: "active", isDefault: true
  }));

  BASKET_3.forEach(s => list.push({
    id: `default-b3-${s}`, code: "—", name: s,
    type: "Basket 3", gradeGroup: "Grade 10-11", stream: "—",
    status: "active", isDefault: true
  }));

  return list;
};

const DEFAULT_SUBJECTS = buildDefaults();

const emptyForm = {
  code: "", name: "", type: "Compulsory",
  gradeGroup: "Grade 6-9", stream: "", status: "active"
};

export default function SubjectManagement() {
  const [customSubjects, setCustomSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tabValue, setTabValue] = useState(0);

  const tabs = ["ALL", "GRADE 6-9", "GRADE 10-11", "A/L"];

  const fetchCustom = async () => {
    const snap = await getDocs(collection(db, "subjects"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data(), isDefault: false }));
    setCustomSubjects(data);
    setLoading(false);
  };

  useEffect(() => { fetchCustom(); }, []);

  // Combine defaults + custom
  const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects];

  const filtered = allSubjects.filter(s => {
    if (tabValue === 0) return true;
    if (tabValue === 1) return s.gradeGroup === "Grade 6-9";
    if (tabValue === 2) return s.gradeGroup === "Grade 10-11";
    if (tabValue === 3) return s.gradeGroup === "A/L";
    return true;
  });

  const handleSave = async () => {
    if (!form.name) return setError("Subject name is required.");
    setSaving(true); setError("");
    try {
      await addDoc(collection(db, "subjects"), {
        ...form, createdAt: new Date().toISOString()
      });
      setOpen(false); setForm(emptyForm);
      fetchCustom();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this custom subject?")) return;
    await deleteDoc(doc(db, "subjects", id));
    fetchCustom();
  };

  const getTypeColor = (type) => {
    if (type === "Compulsory") return "primary";
    if (type === "Aesthetic")  return "secondary";
    if (type === "Basket 1")   return "success";
    if (type === "Basket 2")   return "warning";
    if (type === "Basket 3")   return "info";
    return "default";
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700} color="#1a237e">
          Subjects ({filtered.length})
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => { setForm(emptyForm); setError(""); setOpen(true); }}
          sx={{ bgcolor: "#1a237e" }}>
          Add Subject
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        ✅ Default subjects are loaded from the system. Use <strong>Add Subject</strong> to add extra/custom subjects only.
      </Alert>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
        {tabs.map((t, i) => <Tab key={i} label={t} />)}
      </Tabs>

      {loading ? <CircularProgress /> : (
        <Paper sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1a237e" }}>
              <TableRow>
                {["#", "Code", "Subject Name", "Type", "Grade Group", "Stream", "Status", "Actions"].map(h => (
                  <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s, idx) => (
                <TableRow key={s.id} hover
                  sx={{ bgcolor: s.isDefault ? "#f8f9ff" : "white" }}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{s.code}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                    {s.isDefault && (
                      <Chip label="Default" size="small"
                        sx={{ fontSize: 10, height: 16, ml: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={s.type} size="small" color={getTypeColor(s.type)} />
                  </TableCell>
                  <TableCell>{s.gradeGroup}</TableCell>
                  <TableCell>{s.stream || "—"}</TableCell>
                  <TableCell>
                    <Chip label={s.status} size="small"
                      color={s.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell>
                    {!s.isDefault ? (
                      <Tooltip title="Delete custom subject">
                        <IconButton size="small" color="error"
                          onClick={() => handleDelete(s.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        System
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">No subjects found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add Subject Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          Add Custom Subject
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{error}</Alert>}
          <Box display="flex" flexDirection="column" gap={2} mt={1.5}>
            <TextField label="Subject Code" value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. SCI01" />
            <TextField label="Subject Name *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type"
                onChange={e => setForm({ ...form, type: e.target.value })}>
                {["Compulsory", "Aesthetic", "Basket 1", "Basket 2", "Basket 3", "Elective", "Other"]
                  .map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Grade Group</InputLabel>
              <Select value={form.gradeGroup} label="Grade Group"
                onChange={e => setForm({ ...form, gradeGroup: e.target.value })}>
                {["Grade 6-9", "Grade 10-11", "A/L"].map(g =>
                  <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Stream (optional)" value={form.stream}
              onChange={e => setForm({ ...form, stream: e.target.value })}
              placeholder="e.g. Science, Arts, Commerce" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={saving} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} /> : "Save Subject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}