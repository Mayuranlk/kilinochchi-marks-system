import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import { db } from "../firebase";
import { PageContainer, ResponsiveTableWrapper, StatCard } from "../components/ui";

const CURRENT_YEAR = new Date().getFullYear();
const TERMS = ["Term 1", "Term 2", "Term 3"];

function text(value) {
  return String(value || "").trim();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

const emptyForm = {
  name: "",
  term: "Term 1",
  year: CURRENT_YEAR,
  grade: "",
  subjectName: "",
  examDate: "",
  source: "",
};

export default function PracticeExams() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [examSnap, subjectSnap] = await Promise.all([
        getDocs(collection(db, "practiceExams")),
        getDocs(collection(db, "subjects")),
      ]);

      setExams(examSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setSubjects(subjectSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (err) {
      console.error("Practice exams load failed:", err);
      setError(err.message || "Failed to load practice exams.");
    } finally {
      setLoading(false);
    }
  }

  const subjectOptions = useMemo(() => {
    const grade = parseGrade(form.grade);
    return subjects
      .filter((subject) => {
        if (!grade) return true;
        if (Array.isArray(subject.grades) && subject.grades.length > 0) {
          return subject.grades.map(Number).includes(grade);
        }
        return true;
      })
      .map((subject) => text(subject.subjectName || subject.name || subject.shortName))
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [subjects, form.grade]);

  const sortedExams = useMemo(() => {
    return [...exams].sort((a, b) => {
      const yearDiff = Number(b.year || b.academicYear || 0) - Number(a.year || a.academicYear || 0);
      if (yearDiff !== 0) return yearDiff;
      const termDiff = TERMS.indexOf(a.term) - TERMS.indexOf(b.term);
      if (termDiff !== 0) return termDiff;
      const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
      if (gradeDiff !== 0) return gradeDiff;
      return text(a.name).localeCompare(text(b.name), undefined, { numeric: true });
    });
  }, [exams]);

  function openAdd() {
    setEditId("");
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(exam) {
    setEditId(exam.id);
    setForm({
      name: text(exam.name),
      term: text(exam.term || "Term 1"),
      year: Number(exam.year || exam.academicYear || CURRENT_YEAR),
      grade: exam.grade || "",
      subjectName: text(exam.subjectName),
      examDate: text(exam.examDate),
      source: text(exam.source),
    });
    setError("");
    setOpen(true);
  }

  async function handleSave() {
    if (!text(form.name)) {
      setError("Practice exam name is required.");
      return;
    }
    if (!form.term || !form.year || !form.grade || !text(form.subjectName)) {
      setError("Term, year, grade, and subject are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        name: text(form.name),
        term: form.term,
        termName: form.term,
        year: Number(form.year),
        academicYear: Number(form.year),
        grade: parseGrade(form.grade),
        subjectName: text(form.subjectName),
        examDate: text(form.examDate),
        source: text(form.source),
        updatedAt: new Date().toISOString(),
      };

      if (editId) {
        await updateDoc(doc(db, "practiceExams", editId), payload);
        setSuccess("Practice exam updated.");
      } else {
        await addDoc(collection(db, "practiceExams"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Practice exam added.");
      }

      setOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save practice exam.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exam) {
    if (!window.confirm(`Delete ${exam.name}? Existing marks will not be deleted.`)) return;

    try {
      await deleteDoc(doc(db, "practiceExams", exam.id));
      setSuccess("Practice exam deleted.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete practice exam.");
    }
  }

  return (
    <PageContainer
      title="Practice Exams"
      subtitle="Manage small exams under Term 1, Term 2, or Term 3 for subject-specific analysis."
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add Practice Exam
        </Button>
      }
    >
      <Stack spacing={2}>
        {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <StatCard title="Practice Exams" value={exams.length} />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard title="Academic Years" value={new Set(exams.map((exam) => exam.year || exam.academicYear)).size} color="success" />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard title="Subjects Used" value={new Set(exams.map((exam) => exam.subjectName)).size} color="warning" />
          </Grid>
        </Grid>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <ResponsiveTableWrapper minWidth={860}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Exam", "Term", "Year", "Grade", "Subject", "Date", "Source", "Actions"].map((heading) => (
                        <th key={heading} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExams.map((exam) => (
                      <tr key={exam.id}>
                        <td style={{ padding: 10, fontWeight: 700 }}>{exam.name}</td>
                        <td style={{ padding: 10 }}>{exam.term}</td>
                        <td style={{ padding: 10 }}>{exam.year || exam.academicYear}</td>
                        <td style={{ padding: 10 }}>Grade {exam.grade}</td>
                        <td style={{ padding: 10 }}>{exam.subjectName}</td>
                        <td style={{ padding: 10 }}>{exam.examDate || "-"}</td>
                        <td style={{ padding: 10 }}>{exam.source || "-"}</td>
                        <td style={{ padding: 10 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(exam)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(exam)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTableWrapper>
            </CardContent>
          </Card>
        )}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Edit Practice Exam" : "Add Practice Exam"}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Exam Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Term</InputLabel>
                <Select value={form.term} label="Term" onChange={(e) => setForm({ ...form, term: e.target.value })}>
                  {TERMS.map((term) => <MenuItem key={term} value={term}>{term}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="number" label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="number" label="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Subject" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })}>
                {subjectOptions.map((subject) => <MenuItem key={subject} value={subject}>{subject}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Exam Date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Source / Instruction" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Zonal / Ministry / School" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
