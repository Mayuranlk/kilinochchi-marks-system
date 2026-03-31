import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  MenuItem,
  Stack,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WarningIcon from "@mui/icons-material/Warning";

const TERMS = ["Term 1", "Term 2", "Term 3"];

const emptyForm = {
  term: "Term 1",
  year: new Date().getFullYear(),
  startDate: "",
  endDate: "",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeYear(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : new Date().getFullYear();
}

function normalizeTermDoc(docData = {}, id = "") {
  return {
    id,
    term: normalizeText(docData.term),
    year: normalizeYear(docData.year),
    isActive: docData.isActive === true,
    startDate: normalizeText(docData.startDate),
    endDate: normalizeText(docData.endDate),
    createdAt: docData.createdAt || "",
    updatedAt: docData.updatedAt || "",
  };
}

function sortTerms(list) {
  const termOrder = { "Term 1": 1, "Term 2": 2, "Term 3": 3 };
  return [...list].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return (termOrder[a.term] || 99) - (termOrder[b.term] || 99);
  });
}

export default function AcademicTerms() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const activeTerm = useMemo(
    () => terms.find((term) => term.isActive) || null,
    [terms]
  );

  const stats = useMemo(() => {
    return {
      total: terms.length,
      active: terms.filter((term) => term.isActive).length,
      years: new Set(terms.map((term) => term.year)).size,
    };
  }, [terms]);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setLoading(true);
    setError("");

    try {
      const snap = await getDocs(collection(db, "academicTerms"));
      const data = sortTerms(
        snap.docs.map((d) => normalizeTermDoc(d.data(), d.id))
      );
      setTerms(data);
    } catch (err) {
      setError(`Failed to load academic terms: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setForm(emptyForm);
    setEditId(null);
    setError("");
  };

  const openAddDialog = () => {
    resetDialog();
    setOpen(true);
  };

  const openEditDialog = (termDoc) => {
    setForm({
      term: termDoc.term || "Term 1",
      year: termDoc.year || new Date().getFullYear(),
      startDate: termDoc.startDate || "",
      endDate: termDoc.endDate || "",
    });
    setEditId(termDoc.id);
    setError("");
    setOpen(true);
  };

  const validateForm = () => {
    const term = normalizeText(form.term);
    const year = normalizeYear(form.year);

    if (!term || !year) {
      setError("Term and year are required.");
      return false;
    }

    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setError("End date cannot be earlier than start date.");
      return false;
    }

    const duplicate = terms.find(
      (t) =>
        t.id !== editId &&
        normalizeText(t.term) === term &&
        Number(t.year) === Number(year)
    );

    if (duplicate) {
      setError(`${term} ${year} already exists.`);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      term: normalizeText(form.term),
      year: normalizeYear(form.year),
      startDate: normalizeText(form.startDate),
      endDate: normalizeText(form.endDate),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "academicTerms", editId), payload);
        setSuccess("Academic term updated successfully.");
      } else {
        await addDoc(collection(db, "academicTerms"), {
          ...payload,
          isActive: false,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Academic term added successfully.");
      }

      setOpen(false);
      resetDialog();
      await fetchTerms();
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (termToActivate) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updates = terms.map(async (termDoc) => {
        const nextActiveState = termDoc.id === termToActivate.id;
        if (termDoc.isActive === nextActiveState) return;

        await updateDoc(doc(db, "academicTerms", termDoc.id), {
          isActive: nextActiveState,
          updatedAt: new Date().toISOString(),
        });
      });

      await Promise.all(updates);

      setSuccess(`${termToActivate.term} ${termToActivate.year} is now active.`);
      await fetchTerms();
    } catch (err) {
      setError(`Failed to activate term: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (termId) => {
    const termDoc = terms.find((t) => t.id === termId);
    if (!termDoc) return;

    if (termDoc.isActive) {
      setError("You cannot delete the active term. Activate another term first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${termDoc.term} ${termDoc.year}?`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "academicTerms", termId));
      setSuccess("Academic term deleted.");
      await fetchTerms();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
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
          border: "1px solid #e8eaf6",
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1.5}
        >
          <Box>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              fontWeight={800}
              color="#1a237e"
            >
              Academic Terms
            </Typography>

            <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
              <Chip
                label={`Total: ${stats.total}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Active: ${stats.active}`}
                size="small"
                color="success"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Years: ${stats.years}`}
                size="small"
                color="warning"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAddDialog}
            sx={{ bgcolor: "#1a237e", borderRadius: 2, fontWeight: 700 }}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Add" : "Add Term"}
          </Button>
        </Box>
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

      {activeTerm ? (
        <Card
          sx={{
            mb: 3,
            bgcolor: "#e8f5e9",
            border: "2px solid #2e7d32",
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <CheckCircleIcon sx={{ color: "#2e7d32", fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight={700} color="#2e7d32">
                  {activeTerm.term} — {activeTerm.year}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeTerm.startDate && activeTerm.endDate
                    ? `📅 ${activeTerm.startDate} → ${activeTerm.endDate}`
                    : activeTerm.startDate
                    ? `📅 Starts: ${activeTerm.startDate}`
                    : activeTerm.endDate
                    ? `📅 Ends: ${activeTerm.endDate}`
                    : "No date range set"}
                </Typography>
              </Box>
              <Chip label="Currently Active" color="success" sx={{ ml: "auto" }} />
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          No active term. Teachers cannot safely enter marks until one term is activated.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : terms.length === 0 ? (
        <Box textAlign="center" py={6}>
          <CalendarMonthIcon sx={{ fontSize: 64, color: "#e8eaf6" }} />
          <Typography color="text.secondary" mt={1}>
            No terms added yet. Add your first term to get started.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {terms.map((termDoc) => (
            <Grid item xs={12} sm={6} md={4} key={termDoc.id}>
              <Card
                sx={{
                  borderRadius: 3,
                  border: termDoc.isActive ? "2px solid #2e7d32" : "1px solid #e0e0e0",
                  boxShadow: termDoc.isActive
                    ? "0 4px 20px rgba(46,125,50,0.15)"
                    : "0 2px 8px rgba(0,0,0,0.06)",
                  transition: "all 0.2s",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" fontWeight={700} color="#1a237e">
                        {termDoc.term}
                      </Typography>
                      <Chip
                        label={termDoc.year}
                        size="small"
                        color="primary"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>

                    {termDoc.isActive && (
                      <Chip
                        label="ACTIVE"
                        color="success"
                        size="small"
                        icon={<CheckCircleIcon />}
                      />
                    )}
                  </Box>

                  <Box mt={1.5}>
                    <Typography variant="caption" color="text.secondary">
                      Start Date
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {termDoc.startDate || "—"}
                    </Typography>
                  </Box>

                  <Box mt={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      End Date
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {termDoc.endDate || "—"}
                    </Typography>
                  </Box>
                </CardContent>

                <Divider />

                <CardActions sx={{ px: 2, pb: 2, pt: 1.5, gap: 1 }}>
                  {!termDoc.isActive ? (
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<RadioButtonUncheckedIcon />}
                      onClick={() => handleActivate(termDoc)}
                      disabled={saving}
                      sx={{ bgcolor: "#1a237e" }}
                    >
                      Set Active
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      color="success"
                      disabled
                      startIcon={<CheckCircleIcon />}
                    >
                      Active Term
                    </Button>
                  )}

                  <Tooltip title="Edit Term">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => openEditDialog(termDoc)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete Term">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(termDoc.id)}
                        disabled={termDoc.isActive}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "Edit Academic Term" : "Add Academic Term"}
        </DialogTitle>

        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Term"
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
              >
                {TERMS.map((term) => (
                  <MenuItem key={term} value={term}>
                    {term}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                inputProps={{ min: 2020, max: 2099 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Start Date (optional)"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="End Date (optional)"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : editId ? "Update Term" : "Add Term"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}