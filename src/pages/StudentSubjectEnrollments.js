import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  CircularProgress,
  Grid,
  Alert,
  Card,
  CardContent,
  CardActions,
  useMediaQuery,
  useTheme,
  Tooltip,
  Divider,
  Stack,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

const SUBJECT_CATEGORIES = [
  { value: "religion", label: "Religion" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "basket", label: "Basket" },
  { value: "al_main", label: "A/L Main" },
  { value: "general", label: "General" },
];

const MEDIUM_OPTIONS = ["Tamil", "English", "Sinhala"];
const STREAM_OPTIONS = ["Maths", "Bio", "Commerce", "Technology", "Arts"];

const emptyForm = {
  studentId: "",
  studentName: "",
  admissionNo: "",
  grade: "",
  section: "",
  academicYear: "",
  subjectCategory: "",
  subjectName: "",
  medium: "",
  stream: "",
};

const BATCH_LIMIT = 400;

const normalizeText = (value) => String(value || "").trim();

const sortStudentsClientSide = (list) => {
  return [...list].sort((a, b) => {
    const gradeA = Number(a.grade) || 0;
    const gradeB = Number(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = String(a.section || a.className || "").toUpperCase();
    const sectionB = String(b.section || b.className || "").toUpperCase();
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const nameA = String(a.name || a.fullName || "").toLowerCase();
    const nameB = String(b.name || b.fullName || "").toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const admA = String(a.admissionNo || "").toLowerCase();
    const admB = String(b.admissionNo || "").toLowerCase();
    return admA.localeCompare(admB);
  });
};

const sortEnrollments = (list) => {
  return [...list].sort((a, b) => {
    const gradeA = Number(a.grade) || 0;
    const gradeB = Number(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = String(a.section || a.className || "").toUpperCase();
    const sectionB = String(b.section || b.className || "").toUpperCase();
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const nameA = String(a.studentName || "").toLowerCase();
    const nameB = String(b.studentName || "").toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const categoryA = String(a.subjectCategory || "").toLowerCase();
    const categoryB = String(b.subjectCategory || "").toLowerCase();
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);

    return String(a.subjectName || "")
      .toLowerCase()
      .localeCompare(String(b.subjectName || "").toLowerCase());
  });
};

async function commitDeleteInChunks(ids) {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((id) => {
      batch.delete(doc(db, "studentSubjectEnrollments", id));
    });

    await batch.commit();
  }
}

export default function StudentSubjectEnrollments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  const gradeOptions = useMemo(() => {
    return [...new Set(students.map((s) => Number(s.grade)).filter(Boolean))].sort(
      (a, b) => a - b
    );
  }, [students]);

  const sectionOptions = useMemo(() => {
    if (filterGrade) {
      return [
        ...new Set(
          students
            .filter((s) => String(s.grade) === String(filterGrade))
            .map((s) => normalizeText(s.section || s.className))
            .filter(Boolean)
        ),
      ].sort();
    }

    return [
      ...new Set(
        students.map((s) => normalizeText(s.section || s.className)).filter(Boolean)
      ),
    ].sort();
  }, [students, filterGrade]);

  const filteredStudentsForForm = useMemo(() => students, [students]);

  const filteredEnrollments = useMemo(() => {
    const q = search.toLowerCase();

    return enrollments.filter((item) => {
      const matchSearch =
        !q ||
        normalizeText(item.studentName).toLowerCase().includes(q) ||
        normalizeText(item.admissionNo).toLowerCase().includes(q) ||
        normalizeText(item.subjectName).toLowerCase().includes(q) ||
        normalizeText(item.academicYear).toLowerCase().includes(q);

      const matchGrade = !filterGrade || String(item.grade) === String(filterGrade);
      const matchSection =
        !filterSection ||
        String(item.section || item.className) === String(filterSection);
      const matchCategory = !filterCategory || item.subjectCategory === filterCategory;

      return matchSearch && matchGrade && matchSection && matchCategory;
    });
  }, [enrollments, search, filterGrade, filterSection, filterCategory]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilterSection("");
  }, [filterGrade]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentSnap, enrollmentSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentSubjectEnrollments")),
      ]);

      const loadedStudents = studentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedEnrollments = enrollmentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setStudents(sortStudentsClientSide(loadedStudents));
      setEnrollments(sortEnrollments(loadedEnrollments));
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStudentDisplay = (student) => {
    if (!student) return "";
    return `${student.name || student.fullName || "Unnamed"}${
      student.admissionNo ? ` (${student.admissionNo})` : ""
    } - Grade ${student.grade || ""}${
      student.section || student.className ? ` ${student.section || student.className}` : ""
    }`;
  };

  const handleStudentChange = (studentId) => {
    const selectedStudent = studentMap.get(studentId);

    if (!selectedStudent) {
      setForm((prev) => ({
        ...prev,
        studentId: "",
        studentName: "",
        admissionNo: "",
        grade: "",
        section: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name || selectedStudent.fullName || "",
      admissionNo: selectedStudent.admissionNo || "",
      grade: selectedStudent.grade || "",
      section: selectedStudent.section || selectedStudent.className || "",
    }));
  };

  const validateForm = () => {
    if (!form.studentId) return "Student is required.";
    if (!normalizeText(form.studentName)) return "Student name is required.";
    if (!form.grade) return "Student grade is required.";
    if (!normalizeText(form.section)) return "Student section is required.";
    if (!normalizeText(form.academicYear)) return "Academic year is required.";
    if (!normalizeText(form.subjectCategory)) return "Subject category is required.";
    if (!normalizeText(form.subjectName)) return "Subject name is required.";

    const grade = Number(form.grade) || 0;
    const category = form.subjectCategory;

    if (grade >= 6 && grade <= 9) {
      if (!["religion", "aesthetic", "general"].includes(category)) {
        return "Grades 6 to 9 should use Religion, Aesthetic, or General category.";
      }
    }

    if (grade >= 10 && grade <= 11) {
      if (!["religion", "basket", "general"].includes(category)) {
        return "Grades 10 to 11 should use Religion, Basket, or General category.";
      }
    }

    if (grade >= 12 && grade <= 13) {
      if (!["al_main", "general"].includes(category)) {
        return "Grades 12 to 13 should use A/L Main or General category.";
      }
    }

    return "";
  };

  const buildPayload = () => ({
    studentId: form.studentId,
    studentName: normalizeText(form.studentName),
    admissionNo: normalizeText(form.admissionNo),
    grade: Number(form.grade),
    section: normalizeText(form.section),
    className: normalizeText(form.section),
    academicYear: normalizeText(form.academicYear),
    subjectCategory: normalizeText(form.subjectCategory),
    subjectName: normalizeText(form.subjectName),
    medium: normalizeText(form.medium),
    stream: normalizeText(form.stream),
    updatedAt: new Date().toISOString(),
  });

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayload();

      if (editId) {
        await updateDoc(doc(db, "studentSubjectEnrollments", editId), payload);
        setSuccess("Student subject enrollment updated successfully.");
      } else {
        await addDoc(collection(db, "studentSubjectEnrollments"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Student subject enrollment added successfully.");
      }

      setForm(emptyForm);
      setEditId(null);
      setOpen(false);
      await fetchData();
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setForm({
      studentId: item.studentId || "",
      studentName: item.studentName || "",
      admissionNo: item.admissionNo || "",
      grade: item.grade || "",
      section: item.section || item.className || "",
      academicYear: item.academicYear || "",
      subjectCategory: item.subjectCategory || "",
      subjectName: item.subjectName || "",
      medium: item.medium || "",
      stream: item.stream || "",
    });
    setEditId(item.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subject enrollment? This cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, "studentSubjectEnrollments", id));
      setSuccess("Subject enrollment deleted.");
      await fetchData();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  };

  const handleDeleteAll = async () => {
    if (enrollments.length === 0) {
      setError("No enrollments available to delete.");
      return;
    }

    const confirm1 = window.confirm(
      `Delete ALL ${enrollments.length} student subject enrollments? This cannot be undone.`
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      "Please confirm again: this will remove every document in studentSubjectEnrollments."
    );
    if (!confirm2) return;

    setBulkDeleting(true);
    setError("");
    setSuccess("");

    try {
      const ids = enrollments.map((item) => item.id);
      await commitDeleteInChunks(ids);

      setSuccess(`Deleted all ${ids.length} subject enrollments successfully.`);
      await fetchData();
    } catch (err) {
      setError("Delete all failed: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const getCategoryLabel = (value) => {
    return SUBJECT_CATEGORIES.find((item) => item.value === value)?.label || value || "—";
  };

  const isALGrade = Number(form.grade) >= 12 && Number(form.grade) <= 13;

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
              Student Subject Enrollments
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Manage religion, aesthetic, basket, A/L main, and general subject selections separately from student master data.
            </Typography>
            <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
              <Chip
                label={`Total Enrollments: ${enrollments.length}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Students Loaded: ${students.length}`}
                size="small"
                color="success"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              size={isMobile ? "small" : "medium"}
              onClick={handleDeleteAll}
              disabled={bulkDeleting || loading || enrollments.length === 0}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              {bulkDeleting ? (
                <CircularProgress size={18} color="inherit" />
              ) : isMobile ? (
                "Delete All"
              ) : (
                "Delete All Enrollments"
              )}
            </Button>

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
              {isMobile ? "Add" : "Add Enrollment"}
            </Button>
          </Stack>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={1.5} mt={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search student, admission no, subject, year"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Grade</InputLabel>
            <Select
              value={filterGrade}
              label="Grade"
              onChange={(e) => setFilterGrade(e.target.value)}
            >
              <MenuItem value="">All Grades</MenuItem>
              {gradeOptions.map((g) => (
                <MenuItem key={g} value={g}>
                  Grade {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filterSection}
              label="Section"
              onChange={(e) => setFilterSection(e.target.value)}
            >
              <MenuItem value="">All Sections</MenuItem>
              {sectionOptions.map((section) => (
                <MenuItem key={section} value={section}>
                  {section}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              label="Category"
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              {SUBJECT_CATEGORIES.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSearch("");
              setFilterGrade("");
              setFilterSection("");
              setFilterCategory("");
            }}
            sx={{ borderColor: "#e8eaf6", color: "text.secondary" }}
          >
            Clear
          </Button>

          <Typography variant="caption" color="text.secondary">
            {filteredEnrollments.length} result{filteredEnrollments.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Box>

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setSuccess("")}
        >
          {success}
        </Alert>
      )}

      {error && !open && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : filteredEnrollments.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            border: "1px solid #e8eaf6",
          }}
        >
          <Typography
            variant="h6"
            color="text.secondary"
            mt={1}
            fontWeight={600}
          >
            No subject enrollments found
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click Add Enrollment to create student subject selections
          </Typography>
        </Box>
      ) : isMobile ? (
        <Box>
          {filteredEnrollments.map((item) => (
            <Card
              key={item.id}
              sx={{
                mb: 1.5,
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.07)",
              }}
            >
              <CardContent sx={{ pb: 0 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                  {item.studentName || "Unnamed Student"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {item.admissionNo || "No Adm#"} • Grade {item.grade || "—"}-
                  {item.section || item.className || "—"}
                </Typography>
                <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
                  <Chip
                    label={getCategoryLabel(item.subjectCategory)}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label={item.subjectName || "No Subject"}
                    size="small"
                    color="success"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Year: {item.academicYear || "—"}
                </Typography>
                {(item.medium || item.stream) && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.medium ? `Medium: ${item.medium}` : ""}
                    {item.medium && item.stream ? " • " : ""}
                    {item.stream ? `Stream: ${item.stream}` : ""}
                  </Typography>
                )}
              </CardContent>

              <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(item)}
                  sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <Paper
          sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
            border: "1px solid #e8eaf6",
            overflow: "hidden",
          }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1a237e" }}>
              <TableRow>
                {[
                  "#",
                  "Student",
                  "Adm No",
                  "Grade/Sec",
                  "Category",
                  "Subject",
                  "Academic Year",
                  "Medium",
                  "Stream",
                  "Actions",
                ].map((header) => (
                  <TableCell
                    key={header}
                    sx={{ color: "white", fontWeight: 700, fontSize: 13 }}
                  >
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEnrollments.map((item, idx) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                >
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {item.studentName || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="#1a237e" fontWeight={700}>
                      {item.admissionNo || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`G${item.grade || "—"}-${item.section || item.className || "—"}`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700, fontSize: 12 }}
                    />
                  </TableCell>
                  <TableCell>{getCategoryLabel(item.subjectCategory)}</TableCell>
                  <TableCell>{item.subjectName || "—"}</TableCell>
                  <TableCell>{item.academicYear || "—"}</TableCell>
                  <TableCell>{item.medium || "—"}</TableCell>
                  <TableCell>{item.stream || "—"}</TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEdit(item)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(item.id)}
                      >
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

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "✏️ Edit Subject Enrollment" : "➕ Add Subject Enrollment"}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Student
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Student</InputLabel>
                <Select
                  value={form.studentId}
                  label="Student"
                  onChange={(e) => handleStudentChange(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select Student</em>
                  </MenuItem>
                  {filteredStudentsForForm.map((student) => (
                    <MenuItem key={student.id} value={student.id}>
                      {getStudentDisplay(student)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Student Name"
                value={form.studentName}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Admission No."
                value={form.admissionNo}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                label="Grade"
                value={form.grade}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                label="Section"
                value={form.section}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Enrollment
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="Academic Year"
                placeholder="2026"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Subject Category</InputLabel>
                <Select
                  value={form.subjectCategory}
                  label="Subject Category"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subjectCategory: e.target.value,
                      stream: e.target.value === "al_main" ? form.stream : "",
                    })
                  }
                >
                  {SUBJECT_CATEGORIES.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="Subject Name"
                placeholder="Hinduism / Art / Commerce / Physics"
                value={form.subjectName}
                onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Medium</InputLabel>
                <Select
                  value={form.medium}
                  label="Medium"
                  onChange={(e) => setForm({ ...form, medium: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {MEDIUM_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {(isALGrade || form.subjectCategory === "al_main") && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Stream</InputLabel>
                  <Select
                    value={form.stream}
                    label="Stream"
                    onChange={(e) => setForm({ ...form, stream: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {STREAM_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
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
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editId ? (
              "Update Enrollment"
            ) : (
              "Save Enrollment"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}