import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase";
import { GRADES, SECTIONS, SUBJECTS_BY_GRADE } from "../constants";
/* eslint-disable no-unused-vars */
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Chip, CircularProgress, Grid, Alert,
  Card, CardContent, CardActions, useMediaQuery, useTheme, Tooltip, Avatar,
  Divider, Accordion, AccordionSummary, AccordionDetails
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const empty = {
  name: "", email: "", password: "",
  grade: 6, section: "A", subjects: [],
  phone: "", signatureNo: "",
  status: "active", transferredDate: "",
  transferredReason: "", transferredTo: ""
};

export default function AdminTeachers() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [form, setForm] = useState(empty);
  const [editForm, setEditForm] = useState({});
  const [transferForm, setTransferForm] = useState({ date: "", reason: "", school: "" });
  const [reassignForm, setReassignForm] = useState({ grade: 6, section: "A" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTeachers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setTeachers(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "teacher")
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  };

  useEffect(() => { fetchTeachers(); }, []);

  const activeTeachers = teachers.filter(t => (t.status || "active") === "active");
  const transferredTeachers = teachers.filter(t => t.status === "transferred");

  const allClasses = [];
  GRADES.forEach(g => SECTIONS.forEach(s => allClasses.push({ grade: g, section: s })));
  const assignedClasses = activeTeachers.map(t => `${t.grade}-${t.section}`);
  const unassignedClasses = allClasses.filter(c =>
    !assignedClasses.includes(`${c.grade}-${c.section}`)
  );

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password)
      return setError("Name, email and password are required.");
    if (form.subjects.length === 0)
      return setError("Please select at least one subject.");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    setSaving(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: form.name, email: form.email, role: "teacher",
        grade: form.grade, section: form.section,
        subjects: form.subjects, phone: form.phone,
        signatureNo: form.signatureNo, status: "active",
        createdAt: new Date().toISOString(),
      });
      setSuccess(`Teacher ${form.name} added!`);
      setOpen(false); setForm(empty); fetchTeachers();
    } catch (err) {
      setError(err.message.includes("email-already-in-use")
        ? "This email is already registered." : err.message);
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editForm.name) return setError("Name is required.");
    setSaving(true); setError("");
    try {
      await updateDoc(doc(db, "users", selectedTeacher.id), {
        name: editForm.name, grade: editForm.grade,
        section: editForm.section, subjects: editForm.subjects,
        phone: editForm.phone || "", signatureNo: editForm.signatureNo || "",
      });
      setSuccess("Teacher updated!");
      setEditOpen(false); fetchTeachers();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleTransfer = async () => {
    if (!transferForm.date) return setError("Transfer date is required.");
    setSaving(true); setError("");
    try {
      await updateDoc(doc(db, "users", selectedTeacher.id), {
        status: "transferred",
        transferredDate: transferForm.date,
        transferredReason: transferForm.reason,
        transferredTo: transferForm.school,
      });
      setSuccess(`${selectedTeacher.name} marked as transferred.`);
      setTransferOpen(false);
      setTransferForm({ date: "", reason: "", school: "" });
      fetchTeachers();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleReassign = async () => {
    setSaving(true); setError("");
    try {
      await updateDoc(doc(db, "users", selectedTeacher.id), {
        grade: reassignForm.grade,
        section: reassignForm.section,
      });
      setSuccess(`${selectedTeacher.name} moved to G${reassignForm.grade}-${reassignForm.section}!`);
      setReassignOpen(false); fetchTeachers();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleRestoreTeacher = async (t) => {
    await updateDoc(doc(db, "users", t.id), {
      status: "active", transferredDate: "",
      transferredReason: "", transferredTo: ""
    });
    fetchTeachers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this teacher?")) return;
    await deleteDoc(doc(db, "users", id));
    fetchTeachers();
  };

  const openEdit = (t) => {
    setSelectedTeacher(t);
    setEditForm({
      name: t.name, grade: t.grade, section: t.section,
      subjects: t.subjects || [], phone: t.phone || "",
      signatureNo: t.signatureNo || ""
    });
    setError(""); setEditOpen(true);
  };

  const openTransfer = (t) => {
    setSelectedTeacher(t); setError(""); setTransferOpen(true);
  };

  const openReassign = (t) => {
    setSelectedTeacher(t);
    setReassignForm({ grade: t.grade, section: t.section });
    setError(""); setReassignOpen(true);
  };

  const getAvatarColor = (name) => {
    const colors = ["#1a237e","#1565c0","#0277bd","#00695c","#2e7d32","#6a1b9a","#880e4f","#e65100"];
    let hash = 0;
    for (let i = 0; i < (name?.length || 0); i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const addSubjects = SUBJECTS_BY_GRADE[form.grade] || [];
  const editSubjects = SUBJECTS_BY_GRADE[editForm.grade] || [];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Manage Teachers
          </Typography>
          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            <Chip label={`Active: ${activeTeachers.length}`} size="small" color="success" />
            <Chip label={`Transferred: ${transferredTeachers.length}`} size="small" color="warning" />
            {unassignedClasses.length > 0 && (
              <Chip label={`Unassigned: ${unassignedClasses.length}`} size="small" color="error" />
            )}
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => { setOpen(true); setError(""); setSuccess(""); setForm(empty); }}
          sx={{ bgcolor: "#1a237e", borderRadius: 2 }}
          size={isMobile ? "small" : "medium"}>
          {isMobile ? "Add" : "Add Teacher"}
        </Button>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Unassigned Classes Warning */}
      {unassignedClasses.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            ⚠️ Classes without a teacher:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {unassignedClasses.map(c => (
              <Chip key={`${c.grade}-${c.section}`}
                label={`G${c.grade}-${c.section}`} size="small" color="warning" />
            ))}
          </Box>
        </Alert>
      )}

      {loading ? <CircularProgress /> : (
        <>
          {/* Mobile Cards */}
          {isMobile ? (
            <Box>
              {activeTeachers.map(t => (
                <Card key={t.id} sx={{
                  mb: 1.5, borderRadius: 3,
                  boxShadow: "0 2px 12px rgba(26,35,126,0.10)",
                  border: "1px solid #e8eaf6"
                }}>
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" gap={1.5} alignItems="flex-start">
                      <Avatar sx={{
                        bgcolor: getAvatarColor(t.name),
                        width: 44, height: 44, fontSize: 18, fontWeight: 700
                      }}>
                        {t.name?.charAt(0)}
                      </Avatar>
                      <Box flex={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="subtitle2" fontWeight={700}>{t.name}</Typography>
                          <Chip label={`G${t.grade}-${t.section}`} size="small" color="primary" />
                        </Box>
                        <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                        {t.phone && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            📞 {t.phone}
                          </Typography>
                        )}
                        {t.signatureNo && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            ✍️ {t.signatureNo}
                          </Typography>
                        )}
                        <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                          {(t.subjects || []).map(s => (
                            <Chip key={s} label={s} size="small" variant="outlined"
                              sx={{ fontSize: 10 }} />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 1.5, pt: 0.5, gap: 0.5, flexWrap: "wrap" }}>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />}
                      onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="small" variant="outlined" color="info"
                      startIcon={<SwapHorizIcon />}
                      onClick={() => openReassign(t)}>Move</Button>
                    <Button size="small" variant="outlined" color="warning"
                      startIcon={<FlightTakeoffIcon />}
                      onClick={() => openTransfer(t)}>Transfer</Button>
                    <IconButton size="small" color="error"
                      onClick={() => handleDelete(t.id)}><DeleteIcon /></IconButton>
                  </CardActions>
                </Card>
              ))}
              {activeTeachers.length === 0 && (
                <Typography align="center" color="text.secondary" mt={3}>
                  No active teachers.
                </Typography>
              )}
            </Box>
          ) : (
            /* Desktop Table */
            <Paper sx={{
              borderRadius: 3, overflow: "hidden",
              boxShadow: "0 2px 16px rgba(26,35,126,0.10)"
            }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1a237e" }}>
                    {["Teacher", "Phone", "Class", "Subjects", "Sig No", "Actions"].map(h => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeTeachers.map(t => (
                    <TableRow key={t.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar sx={{
                            bgcolor: getAvatarColor(t.name),
                            width: 36, height: 36, fontSize: 15, fontWeight: 700
                          }}>
                            {t.name?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{t.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t.phone || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={`G${t.grade}-${t.section}`} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {(t.subjects || []).map(s => (
                            <Chip key={s} label={s} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {t.signatureNo || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Edit">
                          <IconButton size="small" color="primary"
                            onClick={() => openEdit(t)}><EditIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="Move to Another Class">
                          <IconButton size="small" color="info"
                            onClick={() => openReassign(t)}><SwapHorizIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="Mark as Transferred">
                          <IconButton size="small" color="warning"
                            onClick={() => openTransfer(t)}><FlightTakeoffIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error"
                            onClick={() => handleDelete(t.id)}><DeleteIcon /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeTeachers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No active teachers.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Transferred Teachers Accordion */}
          {transferredTeachers.length > 0 && (
            <Accordion sx={{
              mt: 2, borderRadius: "12px !important",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              "&:before": { display: "none" }
            }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}
                sx={{ bgcolor: "#fff8e1", borderRadius: 3 }}>
                <Typography fontWeight={700} color="#f57f17">
                  🚌 Transferred Teachers ({transferredTeachers.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#fff3e0" }}>
                    <TableRow>
                      {["Name", "Email", "Was", "Date", "To School", "Actions"].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, fontSize: 13 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transferredTeachers.map(t => (
                      <TableRow key={t.id} sx={{ bgcolor: "#fffde7" }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                        </TableCell>
                        <TableCell>{t.email}</TableCell>
                        <TableCell>
                          <Chip label={`G${t.grade}-${t.section}`} size="small" />
                        </TableCell>
                        <TableCell>{t.transferredDate || "—"}</TableCell>
                        <TableCell>{t.transferredTo || "—"}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" color="success"
                            onClick={() => handleRestoreTeacher(t)}
                            sx={{ mr: 0.5 }}>Restore</Button>
                          <IconButton size="small" color="error"
                            onClick={() => handleDelete(t.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}

      {/* ── Add Teacher Dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)}
        maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          Add New Teacher
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} mt={0.5}>

            {/* Row 1 — Name + Email */}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name *" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email Address *" type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} />
            </Grid>

            {/* Row 2 — Password + Phone */}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Password (min 6 chars) *" type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone Number" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })} />
            </Grid>

            {/* Row 3 — Signature + Grade + Section */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Signature No." value={form.signatureNo}
                placeholder="e.g. T-001"
                onChange={e => setForm({ ...form, signatureNo: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select value={form.grade} label="Grade"
                  onChange={e => setForm({ ...form, grade: e.target.value, subjects: [] })}>
                  {GRADES.map(g => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select value={form.section} label="Section"
                  onChange={e => setForm({ ...form, section: e.target.value })}>
                  {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {/* Row 4 — Subjects */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Assigned Subjects</InputLabel>
                <Select multiple value={form.subjects} label="Assigned Subjects"
                  onChange={e => setForm({ ...form, subjects: e.target.value })}
                  renderValue={selected => (
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {selected.map(s => <Chip key={s} label={s} size="small" />)}
                    </Box>
                  )}>
                  {addSubjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" disabled={saving}
            fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} /> : "Add Teacher"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Teacher Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}
        maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          Edit — {selectedTeacher?.name}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} mt={0.5}>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name *" value={editForm.name || ""}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone Number" value={editForm.phone || ""}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Signature No." value={editForm.signatureNo || ""}
                onChange={e => setEditForm({ ...editForm, signatureNo: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select value={editForm.grade || 6} label="Grade"
                  onChange={e => setEditForm({ ...editForm, grade: e.target.value, subjects: [] })}>
                  {GRADES.map(g => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select value={editForm.section || "A"} label="Section"
                  onChange={e => setEditForm({ ...editForm, section: e.target.value })}>
                  {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Assigned Subjects</InputLabel>
                <Select multiple value={editForm.subjects || []} label="Assigned Subjects"
                  onChange={e => setEditForm({ ...editForm, subjects: e.target.value })}
                  renderValue={selected => (
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {selected.map(s => <Chip key={s} label={s} size="small" />)}
                    </Box>
                  )}>
                  {editSubjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" disabled={saving}
            fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Move to Another Class Dialog ── */}
      <Dialog open={reassignOpen} onClose={() => setReassignOpen(false)}
        maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: "#0277bd", color: "white" }}>
          <SwapHorizIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Move to Another Class
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Moving <strong>{selectedTeacher?.name}</strong> from{" "}
            <strong>G{selectedTeacher?.grade}-{selectedTeacher?.section}</strong> to:
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>New Grade</InputLabel>
                <Select value={reassignForm.grade} label="New Grade"
                  onChange={e => setReassignForm({ ...reassignForm, grade: e.target.value })}>
                  {GRADES.map(g => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>New Section</InputLabel>
                <Select value={reassignForm.section} label="New Section"
                  onChange={e => setReassignForm({ ...reassignForm, section: e.target.value })}>
                  {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReassignOpen(false)}>Cancel</Button>
          <Button onClick={handleReassign} variant="contained"
            disabled={saving} sx={{ bgcolor: "#0277bd" }}>
            {saving ? <CircularProgress size={20} /> : "Confirm Move"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Transfer Dialog ── */}
      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)}
        maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: "#e65100", color: "white" }}>
          <FlightTakeoffIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Mark as Transferred
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            <strong>{selectedTeacher?.name}</strong> will be removed from{" "}
            <strong>G{selectedTeacher?.grade}-{selectedTeacher?.section}</strong>.
            The class will become unassigned.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Transfer Date *" type="date"
                value={transferForm.date}
                onChange={e => setTransferForm({ ...transferForm, date: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Transferred To (School Name)"
                value={transferForm.school}
                onChange={e => setTransferForm({ ...transferForm, school: e.target.value })}
                placeholder="e.g. Jaffna Central College" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reason (optional)" multiline rows={2}
                value={transferForm.reason}
                onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button onClick={handleTransfer} variant="contained" color="warning"
            disabled={saving || !transferForm.date}>
            {saving ? <CircularProgress size={20} /> : "Confirm Transfer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}