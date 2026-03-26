import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  Box, Typography, Button, Grid, Card, CardContent, CardActions,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Alert, CircularProgress, IconButton, Tooltip,
  useMediaQuery, useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

const empty = { term: "Term 1", year: 2026, startDate: "", endDate: "" };
const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function AcademicTerms() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTerms = async () => {
    const snap = await getDocs(collection(db, "academicTerms"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.year - a.year || a.term.localeCompare(b.term));
    setTerms(data);
    setLoading(false);
  };

  useEffect(() => { fetchTerms(); }, []);

  const handleAdd = async () => {
    if (!form.term || !form.year || !form.startDate || !form.endDate)
      return setError("All fields are required.");
    setSaving(true); setError("");
    try {
      await addDoc(collection(db, "academicTerms"), {
        ...form,
        year: Number(form.year),
        isActive: false,
        createdAt: new Date().toISOString()
      });
      setSuccess("Term added!");
      setOpen(false); setForm(empty); fetchTerms();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleActivate = async (termToActivate) => {
    setSaving(true);
    try {
      // Deactivate all first
      for (const t of terms) {
        await updateDoc(doc(db, "academicTerms", t.id), { isActive: false });
      }
      // Activate selected
      await updateDoc(doc(db, "academicTerms", termToActivate.id), { isActive: true });
      setSuccess(`${termToActivate.term} ${termToActivate.year} is now active!`);
      fetchTerms();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this term?")) return;
    await deleteDoc(doc(db, "academicTerms", id));
    fetchTerms();
  };

  const activeTerm = terms.find(t => t.isActive);

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Academic Terms
          </Typography>
          {activeTerm && (
            <Chip
              icon={<CheckCircleIcon />}
              label={`Active: ${activeTerm.term} ${activeTerm.year}`}
              color="success" size="small" sx={{ mt: 0.5 }} />
          )}
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => { setOpen(true); setError(""); }}
          sx={{ bgcolor: "#1a237e", borderRadius: 2 }}
          size={isMobile ? "small" : "medium"}>
          {isMobile ? "Add" : "Add Term"}
        </Button>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Active Term Banner */}
      {activeTerm ? (
        <Card sx={{ mb: 3, bgcolor: "#e8f5e9", border: "2px solid #2e7d32", borderRadius: 3 }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <CheckCircleIcon sx={{ color: "#2e7d32", fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight={700} color="#2e7d32">
                  {activeTerm.term} — {activeTerm.year}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  📅 {activeTerm.startDate} → {activeTerm.endDate}
                </Typography>
              </Box>
              <Chip label="Currently Active" color="success" sx={{ ml: "auto" }} />
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="error" sx={{ mb: 3 }}>
          ⚠️ No active term! Teachers cannot enter marks until you activate a term.
        </Alert>
      )}

      {loading ? <CircularProgress /> : (
        <>
          {terms.length === 0 ? (
            <Box textAlign="center" py={6}>
              <CalendarMonthIcon sx={{ fontSize: 64, color: "#e8eaf6" }} />
              <Typography color="text.secondary" mt={1}>
                No terms added yet. Add your first term to get started.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {terms.map(t => (
                <Grid item xs={12} sm={6} md={4} key={t.id}>
                  <Card sx={{
                    borderRadius: 3,
                    border: t.isActive ? "2px solid #2e7d32" : "1px solid #e0e0e0",
                    boxShadow: t.isActive
                      ? "0 4px 20px rgba(46,125,50,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                    transition: "all 0.2s"
                  }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6" fontWeight={700} color="#1a237e">
                            {t.term}
                          </Typography>
                          <Chip label={t.year} size="small" color="primary"
                            sx={{ mt: 0.5 }} />
                        </Box>
                        {t.isActive && (
                          <Chip label="ACTIVE" color="success" size="small"
                            icon={<CheckCircleIcon />} />
                        )}
                      </Box>
                      <Box mt={1.5}>
                        <Typography variant="caption" color="text.secondary">
                          Start Date
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>{t.startDate}</Typography>
                      </Box>
                      <Box mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          End Date
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>{t.endDate}</Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
                      {!t.isActive ? (
                        <Button variant="contained" size="small" fullWidth
                          startIcon={<RadioButtonUncheckedIcon />}
                          onClick={() => handleActivate(t)}
                          disabled={saving}
                          sx={{ bgcolor: "#1a237e" }}>
                          Set Active
                        </Button>
                      ) : (
                        <Button variant="outlined" size="small" fullWidth
                          color="success" disabled
                          startIcon={<CheckCircleIcon />}>
                          Active Term
                        </Button>
                      )}
                      <Tooltip title="Delete Term">
                        <IconButton size="small" color="error"
                          onClick={() => handleDelete(t.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Add Term Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}
        maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          Add Academic Term
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Term" value={form.term}
                onChange={e => setForm({ ...form, term: e.target.value })}
                SelectProps={{ native: true }}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Year" type="number"
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
                inputProps={{ min: 2020, max: 2099 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Start Date" type="date"
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="End Date" type="date"
                value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" disabled={saving}
            fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} /> : "Add Term"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}