import React, { useEffect, useState, useCallback } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableHead, TableRow, TableCell,
  TableBody, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Chip, CircularProgress, Grid, Alert, Card, CardContent,
  CardActions, useMediaQuery, useTheme, Tooltip, Avatar, Divider,
  InputAdornment, ToggleButton, ToggleButtonGroup
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import SubjectIcon from "@mui/icons-material/Subject";

const STATUS_OPTIONS = ["Active", "Left", "Graduated", "Suspended"];

const emptyForm = {
  name: "",
  admissionNo: "",
  phone: "",
  parentPhone: "",
  grade: "",
  section: "",
  status: "Active",
  address: "",
  birthday: "",
  gender: "",
  notes: ""
};

export default function Students() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // ── data state ──────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── filter state ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("Active");
  const [viewMode, setViewMode] = useState("table"); // "table" | "subject"

  // ── form / dialog state ──────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── derived: unique grades from classrooms ───────────────────────
  const gradeOptions = [...new Set(classrooms.map(c => c.grade))]
    .sort((a, b) => a - b);

  // ── derived: sections for selected grade (filter) ────────────────
  const sectionOptionsForFilter = filterGrade
    ? [...new Set(
        classrooms
          .filter(c => c.grade === Number(filterGrade))
          .map(c => c.section)
      )].sort()
    : [...new Set(classrooms.map(c => c.section))].sort();

  // ── derived: sections for selected grade (form) ──────────────────
  const sectionOptionsForForm = form.grade
    ? [...new Set(
        classrooms
          .filter(c => c.grade === Number(form.grade))
          .map(c => c.section)
      )].sort()
    : [];

  // ── fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [studSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, "students"), orderBy("name"))),
        getDocs(collection(db, "classrooms"))
      ]);

      setStudents(studSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClassrooms(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── reset section filter when grade changes ───────────────────────
  useEffect(() => { setFilterSection(""); }, [filterGrade]);

  // ── reset form section when form grade changes ────────────────────
  useEffect(() => {
    setForm(prev => ({ ...prev, section: "" }));
  }, [form.grade]);

  // ── filtered students ─────────────────────────────────────────────
  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.admissionNo || "").toLowerCase().includes(q) ||
      (s.phone || "").includes(q);

    const matchGrade = !filterGrade || String(s.grade) === String(filterGrade);
    const matchSection = !filterSection || s.section === filterSection;
    const matchStatus = !filterStatus || s.status === filterStatus;

    return matchSearch && matchGrade && matchSection && matchStatus;
  });

  // ── stats ─────────────────────────────────────────────────────────
  const activeCount = students.filter(s => s.status === "Active").length;
  const leftCount = students.filter(s => s.status === "Left").length;
  const totalCount = students.length;

  // ── save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.grade) { setError("Grade is required."); return; }
    if (!form.section) { setError("Section is required."); return; }
    if (!form.admissionNo.trim()) { setError("Admission No. is required."); return; }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name: form.name.trim(),
        admissionNo: form.admissionNo.trim(),
        phone: form.phone.trim(),
        parentPhone: form.parentPhone.trim(),
        grade: Number(form.grade),
        section: form.section,
        status: form.status,
        address: form.address.trim(),
        birthday: form.birthday,
        gender: form.gender,
        notes: form.notes.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editId) {
        await updateDoc(doc(db, "students", editId), payload);
        setSuccess("Student updated successfully!");
      } else {
        await addDoc(collection(db, "students"), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSuccess("Student added successfully!");
      }

      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await fetchAll();
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── edit ──────────────────────────────────────────────────────────
  const handleEdit = (s) => {
    setForm({
      name: s.name || "",
      admissionNo: s.admissionNo || "",
      phone: s.phone || "",
      parentPhone: s.parentPhone || "",
      grade: s.grade || "",
      section: s.section || "",
      status: s.status || "Active",
      address: s.address || "",
      birthday: s.birthday || "",
      gender: s.gender || "",
      notes: s.notes || ""
    });
    setEditId(s.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  // ── delete ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this student permanently?")) return;
    try {
      await deleteDoc(doc(db, "students", id));
      setSuccess("Student deleted.");
      await fetchAll();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  };

  // ── status chip color ─────────────────────────────────────────────
  const statusColor = (s) => {
    if (s === "Active") return "success";
    if (s === "Left") return "error";
    if (s === "Graduated") return "primary";
    return "warning";
  };

  // ── avatar initials ───────────────────────────────────────────────
  const initials = (name = "") =>
    name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  // ── grouped by subject (view mode) ───────────────────────────────
  const groupedByGradeSection = filtered.reduce((acc, s) => {
    const key = `Grade ${s.grade} - ${s.section}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Header ── */}
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
              Students
            </Typography>
            <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
              <Chip label={`Active: ${activeCount}`} size="small" color="success" sx={{ fontWeight: 700 }} />
              <Chip label={`Left: ${leftCount}`} size="small" color="error" sx={{ fontWeight: 700 }} />
              <Chip label={`Total: ${totalCount}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
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
            {isMobile ? "Add" : "Add Student"}
          </Button>
        </Box>

        {/* ── Filters ── */}
        <Box
          display="flex"
          flexWrap="wrap"
          gap={1.5}
          mt={2}
          alignItems="center"
        >
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search name, adm no, phone"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />

          {/* Grade — from classrooms */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Grade</InputLabel>
            <Select
              value={filterGrade}
              label="Grade"
              onChange={e => setFilterGrade(e.target.value)}
            >
              <MenuItem value="">All Grades</MenuItem>
              {gradeOptions.map(g => (
                <MenuItem key={g} value={g}>Grade {g}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Section — from classrooms (filtered by grade if selected) */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filterSection}
              label="Section"
              onChange={e => setFilterSection(e.target.value)}
              disabled={sectionOptionsForFilter.length === 0}
            >
              <MenuItem value="">All Sections</MenuItem>
              {sectionOptionsForFilter.map(s => (
                <MenuItem key={s} value={s}>Section {s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={e => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="table" sx={{ fontWeight: 700, fontSize: 11 }}>
              <SchoolIcon sx={{ fontSize: 16, mr: 0.5 }} /> TABLE
            </ToggleButton>
            <ToggleButton value="subject" sx={{ fontWeight: 700, fontSize: 11 }}>
              <SubjectIcon sx={{ fontSize: 16, mr: 0.5 }} /> BY SUBJECT
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* ── Alerts ── */}
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

      {/* ── Loading ── */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{ bgcolor: "white", borderRadius: 3, border: "1px solid #e8eaf6" }}
        >
          <PersonIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography variant="h6" color="text.secondary" mt={1} fontWeight={600}>
            No students found
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {students.length === 0
              ? 'Click "Add Student" to get started'
              : "Try adjusting your filters"}
          </Typography>
        </Box>
      ) : viewMode === "subject" ? (
        /* ── BY SUBJECT / GROUP VIEW ── */
        <Box>
          {Object.entries(groupedByGradeSection)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupKey, groupStudents]) => (
              <Box key={groupKey} mb={3}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <SchoolIcon sx={{ color: "#1a237e", fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={800} color="#1a237e">
                    {groupKey}
                  </Typography>
                  <Chip
                    label={`${groupStudents.length} student${groupStudents.length > 1 ? "s" : ""}`}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                <Paper sx={{ borderRadius: 3, border: "1px solid #e8eaf6", overflow: "hidden" }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#1a237e" }}>
                      <TableRow>
                        {["#", "Name", "Adm No", "Status", "Phone", "Actions"].map(h => (
                          <TableCell key={h} sx={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupStudents.map((s, idx) => (
                        <TableRow key={s.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                          <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{idx + 1}</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: "#1a237e", fontSize: 11 }}>
                                {initials(s.name)}
                              </Avatar>
                              <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" fontWeight={600} color="#1a237e">
                              {s.admissionNo || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={s.status} size="small" color={statusColor(s.status)} sx={{ fontWeight: 600 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{s.phone || "—"}</Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit">
                              <IconButton size="small" color="primary" onClick={() => handleEdit(s)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}>
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
      ) : isMobile ? (
        /* ── MOBILE CARD VIEW ── */
        <Box>
          {filtered.map(s => (
            <Card
              key={s.id}
              sx={{
                mb: 1.5,
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.07)"
              }}
            >
              <CardContent sx={{ pb: 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Avatar sx={{ bgcolor: "#1a237e", width: 38, height: 38, fontSize: 14, fontWeight: 800 }}>
                      {initials(s.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.admissionNo || "No Adm#"}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip label={s.status} size="small" color={statusColor(s.status)} sx={{ fontWeight: 600 }} />
                </Box>

                <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                  <Chip
                    label={`Grade ${s.grade} - ${s.section}`}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                  {s.phone && (
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                      📞 {s.phone}
                    </Typography>
                  )}
                </Box>
              </CardContent>

              <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(s)}
                  sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(s.id)}
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        /* ── DESKTOP TABLE VIEW ── */
        <Paper
          sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
            border: "1px solid #e8eaf6",
            overflow: "hidden"
          }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1a237e" }}>
              <TableRow>
                {["#", "Name", "Adm No", "Grade / Section", "Status", "Phone", "Parent Phone", "Actions"].map(h => (
                  <TableCell key={h} sx={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s, idx) => (
                <TableRow key={s.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{idx + 1}</TableCell>

                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 30, height: 30, bgcolor: "#1a237e", fontSize: 11, fontWeight: 800 }}>
                        {initials(s.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                        {s.gender && (
                          <Typography variant="caption" color="text.secondary">{s.gender}</Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" fontWeight={700} color="#1a237e">
                      {s.admissionNo || "—"}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={`G${s.grade} - ${s.section}`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700, fontSize: 12 }}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip label={s.status} size="small" color={statusColor(s.status)} sx={{ fontWeight: 600 }} />
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{s.phone || "—"}</Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{s.parentPhone || "—"}</Typography>
                  </TableCell>

                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => handleEdit(s)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "✏️ Edit Student" : "➕ Add Student"}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>
          )}

          <Grid container spacing={2} mt={0.5}>
            {/* Name */}
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                required
                label="Full Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </Grid>

            {/* Gender */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={form.gender}
                  label="Gender"
                  onChange={e => setForm({ ...form, gender: e.target.value })}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Admission No */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Admission No."
                value={form.admissionNo}
                onChange={e => setForm({ ...form, admissionNo: e.target.value })}
              />
            </Grid>

            {/* Birthday */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Birthday"
                type="date"
                value={form.birthday}
                onChange={e => setForm({ ...form, birthday: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Class Assignment
                </Typography>
              </Divider>
            </Grid>

            {/* Grade — from classrooms */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={form.grade}
                  label="Grade"
                  onChange={e => setForm({ ...form, grade: e.target.value })}
                >
                  <MenuItem value=""><em>Select Grade</em></MenuItem>
                  {gradeOptions.map(g => (
                    <MenuItem key={g} value={g}>Grade {g}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {gradeOptions.length === 0 && (
                <Typography variant="caption" color="error">
                  No classrooms found — create them in Classroom Management first.
                </Typography>
              )}
            </Grid>

            {/* Section — filtered by grade, from classrooms */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required disabled={!form.grade}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={form.section}
                  label="Section"
                  onChange={e => setForm({ ...form, section: e.target.value })}
                >
                  <MenuItem value=""><em>Select Section</em></MenuItem>
                  {sectionOptionsForForm.map(s => (
                    <MenuItem key={s} value={s}>Section {s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {form.grade && sectionOptionsForForm.length === 0 && (
                <Typography variant="caption" color="error">
                  No sections for Grade {form.grade} — create them in Classroom Management.
                </Typography>
              )}
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Contact
                </Typography>
              </Divider>
            </Grid>

            {/* Phone */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Student Phone"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </Grid>

            {/* Parent Phone */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Parent Phone"
                value={form.parentPhone}
                onChange={e => setForm({ ...form, parentPhone: e.target.value })}
              />
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={2}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
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
              : editId ? "Update Student" : "Save Student"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}