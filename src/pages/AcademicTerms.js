import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { getCollectionRows, invalidateCollectionRows } from "../services/firestoreReadCache";
import {
  AL_TERM_SYSTEM,
  SCHOOL_TERM_SYSTEM,
  buildSchoolTermPayload,
  deriveALBatchYear,
  deriveALIntakeYear,
  getALTermSchedule,
  getAcademicTermLabel,
  getCalendarSlotForTerm,
  getTermCalendarNumber,
  getTermCalendarYear,
  getTermSequence,
  getTermSystem,
  isALAcademicTerm,
  ordinalTermLabel,
} from "../utils/alAcademicCycle";
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
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WarningIcon from "@mui/icons-material/Warning";
import {
  EmptyState,
  PageContainer,
  StatCard,
  StatusChip,
} from "../components/ui";

const SCHOOL_TERMS = ["Term 1", "Term 2", "Term 3"];
const currentYear = new Date().getFullYear();

function getEmptyForm() {
  return {
    termSystem: SCHOOL_TERM_SYSTEM,
    term: "Term 1",
    year: currentYear,
    intakeYear: currentYear,
    batchYear: currentYear + 2,
    startDate: "",
    endDate: "",
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeYear(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : currentYear;
}

function normalizeTermDoc(data = {}, id = "") {
  const termSystem = getTermSystem(data);
  const termSequence = getTermSequence(data);
  const calendarYear = getTermCalendarYear(data);
  const calendarTerm = getTermCalendarNumber(data);

  return {
    id,
    ...data,
    termSystem,
    term: normalizeText(data.term || data.termName) || ordinalTermLabel(termSequence),
    termSequence,
    year: normalizeYear(data.year || data.academicYear),
    academicYear: normalizeYear(data.academicYear || data.year),
    batchYear: termSystem === AL_TERM_SYSTEM
      ? normalizeYear(data.batchYear || data.year || data.academicYear)
      : 0,
    intakeYear: termSystem === AL_TERM_SYSTEM
      ? normalizeYear(data.intakeYear || deriveALIntakeYear(data.batchYear || data.year))
      : 0,
    phaseGrade: Number(data.phaseGrade) || (termSequence <= 3 ? 12 : 13),
    calendarYear,
    calendarTerm,
    calendarSlotKey: data.calendarSlotKey || getCalendarSlotForTerm(data),
    isActive: data.isActive === true,
    startDate: normalizeText(data.startDate),
    endDate: normalizeText(data.endDate),
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || "",
  };
}

function sortTerms(list) {
  return [...list].sort((a, b) => {
    if (a.calendarYear !== b.calendarYear) return b.calendarYear - a.calendarYear;
    if (a.calendarTerm !== b.calendarTerm) return b.calendarTerm - a.calendarTerm;
    if (a.termSystem !== b.termSystem) return a.termSystem.localeCompare(b.termSystem);
    if ((a.batchYear || 0) !== (b.batchYear || 0)) return (b.batchYear || 0) - (a.batchYear || 0);
    return a.termSequence - b.termSequence;
  });
}

function formatDateRange(termDoc) {
  if (termDoc.startDate && termDoc.endDate) return "Date range: " + termDoc.startDate + " to " + termDoc.endDate;
  if (termDoc.startDate) return "Starts: " + termDoc.startDate;
  if (termDoc.endDate) return "Ends: " + termDoc.endDate;
  return "No date range set";
}

function getContextSubtitle(termDoc) {
  if (isALAcademicTerm(termDoc)) {
    return "Grade " + termDoc.phaseGrade + " · Calendar " + termDoc.calendarYear + " " + ordinalTermLabel(termDoc.calendarTerm);
  }
  return "Grades 6–11 · Calendar " + termDoc.calendarYear + " " + ordinalTermLabel(termDoc.calendarTerm);
}

export default function AcademicTerms() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(getEmptyForm());
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const activeTerms = useMemo(() => terms.filter((term) => term.isActive), [terms]);
  const activeSlot = activeTerms[0]?.calendarSlotKey || "";
  const stats = useMemo(() => ({
    total: terms.length,
    active: activeTerms.length,
    years: new Set(terms.map((term) => term.calendarYear).filter(Boolean)).size,
  }), [terms, activeTerms]);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await getCollectionRows(db, "academicTerms");
      setTerms(sortTerms(rows.map(({ id, ...term }) => normalizeTermDoc(term, id))));
    } catch (err) {
      console.error("AcademicTerms fetch error:", err);
      setError("Failed to load academic terms: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const resetDialog = useCallback(() => {
    setForm(getEmptyForm());
    setEditId(null);
    setError("");
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    resetDialog();
  }, [resetDialog]);

  const openEditDialog = (termDoc) => {
    setForm({
      termSystem: termDoc.termSystem,
      term: isALAcademicTerm(termDoc) ? ordinalTermLabel(termDoc.termSequence) : "Term " + termDoc.termSequence,
      year: termDoc.calendarYear || termDoc.year,
      intakeYear: termDoc.intakeYear || deriveALIntakeYear(termDoc.batchYear),
      batchYear: termDoc.batchYear || deriveALBatchYear(termDoc.intakeYear),
      startDate: termDoc.startDate || "",
      endDate: termDoc.endDate || "",
    });
    setEditId(termDoc.id);
    setError("");
    setOpen(true);
  };

  const validateForm = () => {
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setError("End date cannot be earlier than start date.");
      return false;
    }

    if (form.termSystem === AL_TERM_SYSTEM) {
      const intakeYear = normalizeYear(form.intakeYear);
      const batchYear = normalizeYear(form.batchYear);
      if (intakeYear < 2020 || intakeYear > 2099 || batchYear < 2020 || batchYear > 2101) {
        setError("Enter valid intake and batch years.");
        return false;
      }
      if (batchYear < intakeYear) {
        setError("Batch year cannot be earlier than intake year.");
        return false;
      }
      if (!editId && terms.some((term) => isALAcademicTerm(term) && term.batchYear === batchYear)) {
        setError(batchYear + " A/L Batch terms already exist.");
        return false;
      }
      return true;
    }

    const year = normalizeYear(form.year);
    const termNumber = getTermSequence({ term: form.term });
    if (year < 2020 || year > 2099 || !termNumber) {
      setError("Term and year are required.");
      return false;
    }
    const duplicate = terms.find((term) =>
      term.id !== editId &&
      term.termSystem === SCHOOL_TERM_SYSTEM &&
      term.calendarYear === year &&
      term.calendarTerm === termNumber
    );
    if (duplicate) {
      setError(year + " " + ordinalTermLabel(termNumber) + " already exists for Grades 6–11.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const now = new Date().toISOString();

    try {
      if (editId) {
        const existing = terms.find((term) => term.id === editId);
        const identity = existing && isALAcademicTerm(existing)
          ? { ...existing }
          : buildSchoolTermPayload({
              year: form.year,
              term: form.term,
              startDate: normalizeText(form.startDate),
              endDate: normalizeText(form.endDate),
            });
        delete identity.id;
        delete identity.createdAt;
        await updateDoc(doc(db, "academicTerms", editId), {
          ...identity,
          startDate: normalizeText(form.startDate),
          endDate: normalizeText(form.endDate),
          updatedAt: now,
        });
        setSuccess("Academic term updated successfully.");
      } else if (form.termSystem === AL_TERM_SYSTEM) {
        const schedule = getALTermSchedule({
          intakeYear: form.intakeYear,
          batchYear: form.batchYear,
        });
        const batch = writeBatch(db);
        schedule.forEach((term) => {
          batch.set(doc(collection(db, "academicTerms")), {
            ...term,
            startDate: "",
            endDate: "",
            isActive: term.calendarSlotKey === activeSlot && Boolean(activeSlot),
            createdAt: now,
            updatedAt: now,
          });
        });
        await batch.commit();
        setSuccess(form.batchYear + " A/L Batch created with all six terms.");
      } else {
        const payload = buildSchoolTermPayload({
          year: form.year,
          term: form.term,
          startDate: normalizeText(form.startDate),
          endDate: normalizeText(form.endDate),
        });
        const batch = writeBatch(db);
        batch.set(doc(collection(db, "academicTerms")), {
          ...payload,
          isActive: payload.calendarSlotKey === activeSlot && Boolean(activeSlot),
          createdAt: now,
          updatedAt: now,
        });
        await batch.commit();
        setSuccess("School academic term added successfully.");
      }

      invalidateCollectionRows("academicTerms");
      closeDialog();
      await fetchTerms();
    } catch (err) {
      console.error("AcademicTerms save error:", err);
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (termToActivate) => {
    setSaving(true);
    setError("");
    setSuccess("");
    const targetSlot = termToActivate.calendarSlotKey || getCalendarSlotForTerm(termToActivate);
    const now = new Date().toISOString();

    try {
      const batch = writeBatch(db);
      terms.forEach((termDoc) => {
        const nextActive = (termDoc.calendarSlotKey || getCalendarSlotForTerm(termDoc)) === targetSlot;
        if (termDoc.isActive !== nextActive) {
          batch.update(doc(db, "academicTerms", termDoc.id), {
            isActive: nextActive,
            updatedAt: now,
          });
        }
      });
      await batch.commit();
      invalidateCollectionRows("academicTerms");
      setSuccess(
        "Calendar " + termToActivate.calendarYear + " " +
        ordinalTermLabel(termToActivate.calendarTerm) +
        " is active across all matching school and A/L contexts."
      );
      await fetchTerms();
    } catch (err) {
      console.error("AcademicTerms activate error:", err);
      setError("Failed to activate term: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (termId) => {
    const termDoc = terms.find((term) => term.id === termId);
    if (!termDoc) return;
    if (termDoc.isActive) {
      setError("You cannot delete an active academic context. Activate another calendar slot first.");
      return;
    }
    if (!window.confirm("Delete " + getAcademicTermLabel(termDoc) + "?")) return;

    try {
      await deleteDoc(doc(db, "academicTerms", termId));
      invalidateCollectionRows("academicTerms");
      setSuccess("Academic term deleted.");
      await fetchTerms();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  };

  return (
    <PageContainer
      title="Academic Terms"
      subtitle="Manage the three school terms and six-term A/L batch calendars."
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetDialog();
            setOpen(true);
          }}
          sx={{ bgcolor: "#1a237e", borderRadius: 2, fontWeight: 700 }}
          size={isMobile ? "small" : "medium"}
          fullWidth={isMobile}
        >
          Add Term or A/L Batch
        </Button>
      }
    >
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard title="Academic Contexts" value={stats.total} icon={<CalendarMonthIcon />} color="primary" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard title="Active Contexts" value={stats.active} icon={<CheckCircleIcon />} color={activeTerms.length ? "success" : "warning"} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard title="Calendar Years" value={stats.years} icon={<WarningIcon />} color="secondary" />
        </Grid>
      </Grid>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {activeTerms.length ? (
        <Card sx={{ mb: 3, bgcolor: "#e8f5e9", border: "2px solid #2e7d32", borderRadius: 3 }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <CheckCircleIcon sx={{ color: "#2e7d32", fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight={700} color="#2e7d32">
                  Calendar {activeTerms[0].calendarYear} · {ordinalTermLabel(activeTerms[0].calendarTerm)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeTerms.map(getAcademicTermLabel).join(" · ")}
                </Typography>
              </Box>
              <Chip label={activeTerms.length + " active context" + (activeTerms.length === 1 ? "" : "s")} color="success" sx={{ ml: "auto" }} />
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          No active calendar slot. Activate a term before teachers enter marks.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : terms.length === 0 ? (
        <EmptyState title="No terms added yet" description="Add a school term or an A/L batch to get started." />
      ) : (
        <Grid container spacing={2}>
          {terms.map((termDoc) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={termDoc.id}>
              <Card
                sx={{
                  borderRadius: 3,
                  border: termDoc.isActive ? "2px solid #2e7d32" : "1px solid #e0e0e0",
                  boxShadow: termDoc.isActive ? "0 4px 20px rgba(46,125,50,0.15)" : "0 2px 8px rgba(0,0,0,0.06)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} color="primary.main">
                        {getAcademicTermLabel(termDoc)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {getContextSubtitle(termDoc)}
                      </Typography>
                    </Box>
                    <Chip
                      label={isALAcademicTerm(termDoc) ? "A/L" : "Grades 6–11"}
                      size="small"
                      color={isALAcademicTerm(termDoc) ? "secondary" : "primary"}
                    />
                  </Box>
                  <Box mt={1.5}>
                    <Typography variant="caption" color="text.secondary">{formatDateRange(termDoc)}</Typography>
                  </Box>
                  {termDoc.isActive && <StatusChip status="saved" label="Active" sx={{ mt: 1 }} />}
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
                      Activate Slot
                    </Button>
                  ) : (
                    <Button variant="outlined" size="small" fullWidth color="success" disabled startIcon={<CheckCircleIcon />}>
                      Active
                    </Button>
                  )}
                  <Tooltip title="Edit dates">
                    <IconButton size="small" color="primary" onClick={() => openEditDialog(termDoc)}><EditIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete term">
                    <span>
                      <IconButton size="small" color="error" onClick={() => handleDelete(termDoc.id)} disabled={termDoc.isActive || saving}>
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

      <Dialog open={open} onClose={saving ? undefined : closeDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "Edit Academic Term Dates" : "Add Academic Term or A/L Batch"}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} mt={0.5}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Term system"
                value={form.termSystem}
                disabled={Boolean(editId)}
                onChange={(event) => setForm((previous) => ({ ...previous, termSystem: event.target.value }))}
              >
                <MenuItem value={SCHOOL_TERM_SYSTEM}>Grades 6–11 (3 terms per calendar year)</MenuItem>
                <MenuItem value={AL_TERM_SYSTEM}>A/L Batch (6 terms)</MenuItem>
              </TextField>
            </Grid>

            {form.termSystem === AL_TERM_SYSTEM ? (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Intake year"
                    value={form.intakeYear}
                    disabled={Boolean(editId)}
                    onChange={(event) => {
                      const intakeYear = normalizeYear(event.target.value);
                      setForm((previous) => ({ ...previous, intakeYear, batchYear: deriveALBatchYear(intakeYear) }));
                    }}
                    helperText="Example: 2026 intake"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="A/L batch / exam year"
                    value={form.batchYear}
                    disabled={Boolean(editId)}
                    onChange={(event) => setForm((previous) => ({ ...previous, batchYear: normalizeYear(event.target.value) }))}
                    helperText="Defaults to intake year + 2"
                  />
                </Grid>
                {!editId && (
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info">
                      Creating this batch adds 1st through 6th Term. Terms 1–3 are Grade 12 and terms 4–6 are Grade 13.
                    </Alert>
                  </Grid>
                )}
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    select
                    label="School term"
                    value={form.term}
                    disabled={Boolean(editId && isALAcademicTerm(terms.find((term) => term.id === editId)))}
                    onChange={(event) => setForm((previous) => ({ ...previous, term: event.target.value }))}
                  >
                    {SCHOOL_TERMS.map((term) => <MenuItem key={term} value={term}>{term}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Calendar year"
                    value={form.year}
                    disabled={Boolean(editId && isALAcademicTerm(terms.find((term) => term.id === editId)))}
                    onChange={(event) => setForm((previous) => ({ ...previous, year: normalizeYear(event.target.value) }))}
                  />
                </Grid>
              </>
            )}

            {editId && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.endDate} onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))} />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ bgcolor: "#1a237e" }}>
            {saving ? <CircularProgress size={20} color="inherit" /> : editId ? "Save Dates" : form.termSystem === AL_TERM_SYSTEM ? "Create Six Terms" : "Add Term"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
