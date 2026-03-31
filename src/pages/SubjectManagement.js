import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SchoolIcon from "@mui/icons-material/School";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const SUBJECT_COLLECTION = "subjects";

const CATEGORY_OPTIONS = [
  { value: "core", label: "Core" },
  { value: "religion", label: "Religion" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "basket_a", label: "Basket A" },
  { value: "basket_b", label: "Basket B" },
  { value: "basket_c", label: "Basket C" },
  { value: "al_main", label: "A/L Main" },
];

const RELIGION_OPTIONS = [
  "Buddhism",
  "Hinduism",
  "Islam",
  "Catholicism",
  "Christianity",
];

const STREAM_OPTIONS = [
  "Science",
  "Commerce",
  "Arts",
  "Technology",
  "Maths",
  "Bio",
];

const GRADE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 1);

const defaultForm = {
  id: "",
  code: "",
  name: "",
  shortName: "",
  category: "core",
  status: "active",

  // grade application
  gradeMode: "single", // single | range | multi
  grade: "",
  minGrade: "",
  maxGrade: "",
  grades: [],

  // religion subjects
  religion: "",
  religionGroup: "",

  // AL subjects
  stream: "",
  streams: [],

  // general metadata
  description: "",
  displayOrder: "",
  isOptional: false,
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNumberOrEmpty(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  return Number.isNaN(n) ? "" : n;
}

function sortByName(items) {
  return [...items].sort((a, b) =>
    normalizeText(a.name || a.subjectName).localeCompare(
      normalizeText(b.name || b.subjectName)
    )
  );
}

function getCategoryLabel(category) {
  return CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category || "—";
}

function getStatusColor(status) {
  return normalizeLower(status) === "active" ? "success" : "default";
}

function buildGradeSummary(subject) {
  const grade = subject.grade;
  const minGrade = subject.minGrade;
  const maxGrade = subject.maxGrade;
  const grades = Array.isArray(subject.grades) ? subject.grades : [];

  if (grade !== undefined && grade !== null && grade !== "") {
    return `Grade ${grade}`;
  }

  if (grades.length > 0) {
    return grades
      .map((g) => `G${g}`)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .join(", ");
  }

  if (minGrade || maxGrade) {
    return `G${minGrade || "?"} - G${maxGrade || "?"}`;
  }

  return "All";
}

function getSubjectCode(subject) {
  return normalizeText(subject.code || subject.subjectCode || "");
}

function getSubjectName(subject) {
  return normalizeText(subject.name || subject.subjectName || "");
}

function getInitialsFromName(name) {
  return normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0]?.toUpperCase())
    .join("")
    .slice(0, 6);
}

function buildAutoCode(name, category) {
  const initials = getInitialsFromName(name);
  const prefixMap = {
    core: "CORE",
    religion: "REL",
    aesthetic: "AES",
    basket_a: "BA",
    basket_b: "BB",
    basket_c: "BC",
    al_main: "AL",
  };

  return `${prefixMap[category] || "SUB"}_${initials || "SUB"}`;
}

function buildSubjectDocId(form) {
  const namePart = slugify(form.name || "subject");
  const categoryPart = slugify(form.category || "general");
  const codePart = slugify(form.code || "");
  return [categoryPart, codePart, namePart].filter(Boolean).join("_");
}

function getCleanGrades(form) {
  if (form.gradeMode === "single") {
    return {
      grade: toNumberOrEmpty(form.grade),
      minGrade: "",
      maxGrade: "",
      grades: [],
    };
  }

  if (form.gradeMode === "range") {
    return {
      grade: "",
      minGrade: toNumberOrEmpty(form.minGrade),
      maxGrade: toNumberOrEmpty(form.maxGrade),
      grades: [],
    };
  }

  return {
    grade: "",
    minGrade: "",
    maxGrade: "",
    grades: (form.grades || []).map(Number).filter(Boolean),
  };
}

function detectGradeMode(subject) {
  if (subject.grade !== undefined && subject.grade !== null && subject.grade !== "") {
    return "single";
  }
  if (
    (subject.minGrade !== undefined && subject.minGrade !== null && subject.minGrade !== "") ||
    (subject.maxGrade !== undefined && subject.maxGrade !== null && subject.maxGrade !== "")
  ) {
    return "range";
  }
  if (Array.isArray(subject.grades) && subject.grades.length > 0) {
    return "multi";
  }
  return "single";
}

function buildFormFromSubject(subject) {
  return {
    id: subject.id || "",
    code: normalizeText(subject.code || subject.subjectCode || ""),
    name: normalizeText(subject.name || subject.subjectName || ""),
    shortName: normalizeText(subject.shortName || ""),
    category: normalizeText(subject.category || "core"),
    status: normalizeText(subject.status || "active"),

    gradeMode: detectGradeMode(subject),
    grade: subject.grade ?? "",
    minGrade: subject.minGrade ?? "",
    maxGrade: subject.maxGrade ?? "",
    grades: Array.isArray(subject.grades) ? subject.grades : [],

    religion: normalizeText(subject.religion || ""),
    religionGroup: normalizeText(subject.religionGroup || ""),
    stream: normalizeText(subject.stream || ""),
    streams: Array.isArray(subject.streams) ? subject.streams : [],

    description: normalizeText(subject.description || ""),
    displayOrder:
      subject.displayOrder !== undefined && subject.displayOrder !== null
        ? String(subject.displayOrder)
        : "",
    isOptional: subject.isOptional === true,
  };
}

function validateForm(form) {
  const errors = {};

  if (!normalizeText(form.name)) {
    errors.name = "Subject name is required";
  }

  if (!normalizeText(form.category)) {
    errors.category = "Category is required";
  }

  if (!normalizeText(form.code)) {
    errors.code = "Code is required";
  }

  if (form.gradeMode === "single" && !toNumberOrEmpty(form.grade)) {
    errors.grade = "Grade is required";
  }

  if (form.gradeMode === "range") {
    if (!toNumberOrEmpty(form.minGrade)) {
      errors.minGrade = "Min grade is required";
    }
    if (!toNumberOrEmpty(form.maxGrade)) {
      errors.maxGrade = "Max grade is required";
    }
    if (
      toNumberOrEmpty(form.minGrade) &&
      toNumberOrEmpty(form.maxGrade) &&
      Number(form.minGrade) > Number(form.maxGrade)
    ) {
      errors.maxGrade = "Max grade must be greater than or equal to min grade";
    }
  }

  if (form.gradeMode === "multi" && (!form.grades || form.grades.length === 0)) {
    errors.grades = "Select at least one grade";
  }

  if (form.category === "religion" && !normalizeText(form.religion)) {
    errors.religion = "Religion is required for religion subjects";
  }

  if (form.category === "al_main") {
    const hasSingleStream = !!normalizeText(form.stream);
    const hasMultiStreams = Array.isArray(form.streams) && form.streams.length > 0;

    if (!hasSingleStream && !hasMultiStreams) {
      errors.stream = "Select at least one stream for A/L subject";
    }
  }

  return errors;
}

function buildPayload(form, profile) {
  const grades = getCleanGrades(form);

  const payload = {
    code: normalizeText(form.code),
    subjectCode: normalizeText(form.code),
    name: normalizeText(form.name),
    subjectName: normalizeText(form.name),
    shortName: normalizeText(form.shortName),
    category: normalizeText(form.category),
    status: normalizeText(form.status || "active"),

    grade: grades.grade,
    minGrade: grades.minGrade,
    maxGrade: grades.maxGrade,
    grades: grades.grades,

    religion: form.category === "religion" ? normalizeText(form.religion) : "",
    religionGroup:
      form.category === "religion" ? normalizeText(form.religionGroup) : "",

    stream: form.category === "al_main" ? normalizeText(form.stream) : "",
    streams:
      form.category === "al_main"
        ? (form.streams || []).map((x) => normalizeText(x)).filter(Boolean)
        : [],

    description: normalizeText(form.description),
    displayOrder:
      form.displayOrder === "" ? 0 : Number(form.displayOrder) || 0,
    isOptional: form.isOptional === true,

    updatedAt: new Date().toISOString(),
    updatedById: profile?.uid || "",
    updatedByName: profile?.name || profile?.displayName || profile?.email || "",
  };

  if (!form.id) {
    payload.createdAt = new Date().toISOString();
    payload.createdById = profile?.uid || "";
    payload.createdByName =
      profile?.name || profile?.displayName || profile?.email || "";
  }

  return payload;
}

function SubjectStatsCard({ title, value, icon }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function SubjectManagement() {
  const { profile, isAdmin } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function loadSubjects() {
    setLoading(true);
    setError("");

    try {
      const snap = await getDocs(collection(db, SUBJECT_COLLECTION));
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setSubjects(sortByName(rows));
    } catch (err) {
      setError("Failed to load subjects: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubjects();
  }, []);

  const stats = useMemo(() => {
    return {
      total: subjects.length,
      active: subjects.filter((s) => normalizeLower(s.status) === "active").length,
      inactive: subjects.filter((s) => normalizeLower(s.status) !== "active").length,
      categories: new Set(subjects.map((s) => normalizeText(s.category)).filter(Boolean))
        .size,
    };
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      const name = getSubjectName(subject);
      const code = getSubjectCode(subject);
      const category = normalizeText(subject.category);
      const status = normalizeLower(subject.status || "active");

      const passesSearch =
        !normalizeText(search) ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        code.toLowerCase().includes(search.toLowerCase()) ||
        category.toLowerCase().includes(search.toLowerCase()) ||
        normalizeText(subject.religion).toLowerCase().includes(search.toLowerCase()) ||
        normalizeText(subject.stream).toLowerCase().includes(search.toLowerCase());

      const passesCategory =
        categoryFilter === "all" || category === categoryFilter;

      const passesStatus =
        statusFilter === "all" || status === statusFilter;

      const passesGrade =
        gradeFilter === "all" ||
        String(subject.grade) === String(gradeFilter) ||
        (Array.isArray(subject.grades) &&
          subject.grades.map(String).includes(String(gradeFilter))) ||
        (subject.minGrade &&
          subject.maxGrade &&
          Number(gradeFilter) >= Number(subject.minGrade) &&
          Number(gradeFilter) <= Number(subject.maxGrade));

      return passesSearch && passesCategory && passesStatus && passesGrade;
    });
  }, [subjects, search, categoryFilter, statusFilter, gradeFilter]);

  function openCreateDialog() {
    setEditingId("");
    setForm(defaultForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEditDialog(subject) {
    setEditingId(subject.id);
    setForm(buildFormFromSubject(subject));
    setFormErrors({});
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setForm(defaultForm);
    setEditingId("");
    setFormErrors({});
  }

  function updateForm(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleAutoCode() {
    setForm((prev) => ({
      ...prev,
      code: buildAutoCode(prev.name, prev.category),
    }));
  }

  function handleGradeModeChange(mode) {
    setForm((prev) => ({
      ...prev,
      gradeMode: mode,
      grade: "",
      minGrade: "",
      maxGrade: "",
      grades: [],
    }));
  }

  async function handleSave() {
    setSuccess("");
    setError("");

    if (!isAdmin) {
      setError("Only admin can create or edit subjects.");
      return;
    }

    const validationErrors = validateForm(form);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload(form, profile);

      const duplicate = subjects.find((subject) => {
        if (editingId && subject.id === editingId) return false;

        return (
          normalizeLower(getSubjectCode(subject)) === normalizeLower(payload.code) ||
          (normalizeLower(getSubjectName(subject)) === normalizeLower(payload.name) &&
            normalizeLower(subject.category) === normalizeLower(payload.category) &&
            buildGradeSummary(subject) === buildGradeSummary(payload))
        );
      });

      if (duplicate) {
        throw new Error(
          `Duplicate subject detected: ${getSubjectName(duplicate)} (${getSubjectCode(
            duplicate
          )})`
        );
      }

      if (editingId) {
        await updateDoc(doc(db, SUBJECT_COLLECTION, editingId), payload);
        setSuccess("Subject updated successfully.");
      } else {
        const newId = buildSubjectDocId(form);
        await setDoc(doc(db, SUBJECT_COLLECTION, newId), payload, { merge: false });
        setSuccess("Subject created successfully.");
      }

      closeDialog();
      await loadSubjects();
    } catch (err) {
      setError("Failed to save subject: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(subject) {
    if (!isAdmin) {
      setError("Only admin can change subject status.");
      return;
    }

    setSuccess("");
    setError("");

    try {
      const nextStatus =
        normalizeLower(subject.status) === "active" ? "inactive" : "active";

      await updateDoc(doc(db, SUBJECT_COLLECTION, subject.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedById: profile?.uid || "",
        updatedByName: profile?.name || profile?.displayName || profile?.email || "",
      });

      setSuccess(
        `${getSubjectName(subject)} marked as ${nextStatus}.`
      );
      await loadSubjects();
    } catch (err) {
      setError("Failed to update subject status: " + err.message);
    }
  }

  const dialogTitle = editingId ? "Edit Subject" : "Create Subject";
  const isReligion = form.category === "religion";
  const isAL = form.category === "al_main";

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1a237e">
            Subject Management
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Manage strict subject definitions for enrollment generation and marks entry.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSubjects}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            disabled={!isAdmin}
          >
            Add Subject
          </Button>
        </Stack>
      </Stack>

      {!isAdmin && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You can view subject definitions, but only admin can create or edit them.
        </Alert>
      )}

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <SubjectStatsCard
            title="Total Subjects"
            value={stats.total}
            icon={<SchoolIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SubjectStatsCard
            title="Active"
            value={stats.active}
            icon={<Chip size="small" color="success" label="ACTIVE" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SubjectStatsCard
            title="Inactive"
            value={stats.inactive}
            icon={<Chip size="small" label="INACTIVE" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SubjectStatsCard
            title="Categories"
            value={stats.categories}
            icon={<AutoAwesomeIcon color="secondary" />}
          />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search subjects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, category, religion, stream"
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth>
              <InputLabel>Grade</InputLabel>
              <Select
                value={gradeFilter}
                label="Grade"
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {GRADE_OPTIONS.map((grade) => (
                  <MenuItem key={grade} value={grade}>
                    Grade {grade}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#1a237e" }}>
            <TableRow>
              {[
                "Code",
                "Subject Name",
                "Category",
                "Grade Scope",
                "Religion / Stream",
                "Status",
                "Actions",
              ].map((head) => (
                <TableCell key={head} sx={{ color: "white", fontWeight: 700 }}>
                  {head}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredSubjects.map((subject) => (
              <TableRow key={subject.id} hover>
                <TableCell>{getSubjectCode(subject) || "—"}</TableCell>
                <TableCell>
                  <Stack spacing={0.4}>
                    <Typography variant="body2" fontWeight={600}>
                      {getSubjectName(subject)}
                    </Typography>
                    {normalizeText(subject.shortName) && (
                      <Typography variant="caption" color="text.secondary">
                        {subject.shortName}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getCategoryLabel(subject.category)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{buildGradeSummary(subject)}</TableCell>
                <TableCell>
                  {subject.category === "religion"
                    ? normalizeText(subject.religion || subject.religionGroup) || "—"
                    : subject.category === "al_main"
                    ? normalizeText(subject.stream) ||
                      (Array.isArray(subject.streams) && subject.streams.length > 0
                        ? subject.streams.join(", ")
                        : "—")
                    : "—"}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={normalizeText(subject.status || "active").toUpperCase()}
                    color={getStatusColor(subject.status || "active")}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(subject)}
                          disabled={!isAdmin}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip
                      title={
                        normalizeLower(subject.status) === "active"
                          ? "Set Inactive"
                          : "Set Active"
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color={
                            normalizeLower(subject.status) === "active"
                              ? "warning"
                              : "success"
                          }
                          onClick={() => toggleStatus(subject)}
                          disabled={!isAdmin}
                        >
                          {normalizeLower(subject.status) === "active"
                            ? "Deactivate"
                            : "Activate"}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}

            {filteredSubjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No subjects found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{dialogTitle}</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Subject Code"
                  value={form.code}
                  onChange={(e) => updateForm("code", e.target.value)}
                  error={!!formErrors.code}
                  helperText={formErrors.code}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Subject Name"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleAutoCode}
                  sx={{ height: "56px" }}
                >
                  Auto Code
                </Button>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Short Name"
                  value={form.shortName}
                  onChange={(e) => updateForm("shortName", e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth error={!!formErrors.category}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={form.category}
                    label="Category"
                    onChange={(e) => updateForm("category", e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {formErrors.category && (
                  <Typography variant="caption" color="error">
                    {formErrors.category}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={form.status}
                    label="Status"
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Grade Application
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Grade Mode</InputLabel>
                    <Select
                      value={form.gradeMode}
                      label="Grade Mode"
                      onChange={(e) => handleGradeModeChange(e.target.value)}
                    >
                      <MenuItem value="single">Single Grade</MenuItem>
                      <MenuItem value="range">Grade Range</MenuItem>
                      <MenuItem value="multi">Multiple Grades</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {form.gradeMode === "single" && (
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth error={!!formErrors.grade}>
                      <InputLabel>Grade</InputLabel>
                      <Select
                        value={form.grade}
                        label="Grade"
                        onChange={(e) => updateForm("grade", e.target.value)}
                      >
                        {GRADE_OPTIONS.map((grade) => (
                          <MenuItem key={grade} value={grade}>
                            Grade {grade}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {formErrors.grade && (
                      <Typography variant="caption" color="error">
                        {formErrors.grade}
                      </Typography>
                    )}
                  </Grid>
                )}

                {form.gradeMode === "range" && (
                  <>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth error={!!formErrors.minGrade}>
                        <InputLabel>Min Grade</InputLabel>
                        <Select
                          value={form.minGrade}
                          label="Min Grade"
                          onChange={(e) => updateForm("minGrade", e.target.value)}
                        >
                          {GRADE_OPTIONS.map((grade) => (
                            <MenuItem key={grade} value={grade}>
                              Grade {grade}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {formErrors.minGrade && (
                        <Typography variant="caption" color="error">
                          {formErrors.minGrade}
                        </Typography>
                      )}
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth error={!!formErrors.maxGrade}>
                        <InputLabel>Max Grade</InputLabel>
                        <Select
                          value={form.maxGrade}
                          label="Max Grade"
                          onChange={(e) => updateForm("maxGrade", e.target.value)}
                        >
                          {GRADE_OPTIONS.map((grade) => (
                            <MenuItem key={grade} value={grade}>
                              Grade {grade}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {formErrors.maxGrade && (
                        <Typography variant="caption" color="error">
                          {formErrors.maxGrade}
                        </Typography>
                      )}
                    </Grid>
                  </>
                )}

                {form.gradeMode === "multi" && (
                  <Grid item xs={12} md={8}>
                    <FormControl fullWidth error={!!formErrors.grades}>
                      <InputLabel>Grades</InputLabel>
                      <Select
                        multiple
                        value={form.grades}
                        label="Grades"
                        onChange={(e) => updateForm("grades", e.target.value)}
                        renderValue={(selected) =>
                          selected.map((g) => `Grade ${g}`).join(", ")
                        }
                      >
                        {GRADE_OPTIONS.map((grade) => (
                          <MenuItem key={grade} value={grade}>
                            Grade {grade}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {formErrors.grades && (
                      <Typography variant="caption" color="error">
                        {formErrors.grades}
                      </Typography>
                    )}
                  </Grid>
                )}
              </Grid>
            </Box>

            {isReligion && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Religion Mapping
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth error={!!formErrors.religion}>
                        <InputLabel>Religion</InputLabel>
                        <Select
                          value={form.religion}
                          label="Religion"
                          onChange={(e) => updateForm("religion", e.target.value)}
                        >
                          {RELIGION_OPTIONS.map((item) => (
                            <MenuItem key={item} value={item}>
                              {item}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {formErrors.religion && (
                        <Typography variant="caption" color="error">
                          {formErrors.religion}
                        </Typography>
                      )}
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Religion Group"
                        value={form.religionGroup}
                        onChange={(e) => updateForm("religionGroup", e.target.value)}
                        placeholder="Optional alternate matching value"
                      />
                    </Grid>
                  </Grid>
                </Box>
              </>
            )}

            {isAL && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    A/L Stream Mapping
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth error={!!formErrors.stream}>
                        <InputLabel>Primary Stream</InputLabel>
                        <Select
                          value={form.stream}
                          label="Primary Stream"
                          onChange={(e) => updateForm("stream", e.target.value)}
                        >
                          <MenuItem value="">None</MenuItem>
                          {STREAM_OPTIONS.map((item) => (
                            <MenuItem key={item} value={item}>
                              {item}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {formErrors.stream && (
                        <Typography variant="caption" color="error">
                          {formErrors.stream}
                        </Typography>
                      )}
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Additional Streams</InputLabel>
                        <Select
                          multiple
                          value={form.streams}
                          label="Additional Streams"
                          onChange={(e) => updateForm("streams", e.target.value)}
                          renderValue={(selected) => selected.join(", ")}
                        >
                          {STREAM_OPTIONS.map((item) => (
                            <MenuItem key={item} value={item}>
                              {item}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              </>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Extra Metadata
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Description"
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Display Order"
                      value={form.displayOrder}
                      onChange={(e) => updateForm("displayOrder", e.target.value)}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.isOptional}
                          onChange={(e) => updateForm("isOptional", e.target.checked)}
                        />
                      }
                      label="Optional Subject"
                    />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !isAdmin}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : editingId ? "Update Subject" : "Create Subject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}