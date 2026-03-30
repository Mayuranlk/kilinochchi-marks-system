import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  Checkbox,
  ListItemText,
  OutlinedInput,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tabs,
  Tab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";

const SUBJECT_CATEGORIES = [
  { value: "compulsory", label: "Compulsory" },
  { value: "religion", label: "Religion" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "basket", label: "Basket" },
  { value: "al_main", label: "A/L Main" },
  { value: "general_english", label: "General English" },
  { value: "common_compulsory", label: "Common Compulsory" },
  { value: "other", label: "Other" },
];

const SUBJECT_STATUSES = ["active", "inactive"];
const RELIGION_KEYS = ["Hindu", "Catholic", "Christian", "Islam", "Buddhist", "Other"];
const BASKET_GROUPS = ["A", "B", "C"];
const STREAM_OPTIONS = ["Maths", "Bio", "Commerce", "Technology", "Arts"];
const MEDIUM_OPTIONS = ["Tamil", "English", "Sinhala"];
const GRADE_OPTIONS = [6, 7, 8, 9, 10, 11, 12, 13];

const emptyForm = {
  code: "",
  name: "",
  category: "",
  grades: [],
  religionKey: "",
  basketGroup: "",
  stream: "",
  mediums: [],
  status: "active",
  isSystem: false,
  displayOrder: "",
};

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();
const normalizeStatus = (value) => normalizeLower(value);
const normalizeCategory = (value) => normalizeText(value);

const normalizeGradeList = (grades) => {
  return [...new Set((Array.isArray(grades) ? grades : []).map(Number).filter(Boolean))].sort(
    (a, b) => a - b
  );
};

const getCategoryLabel = (value) =>
  SUBJECT_CATEGORIES.find((item) => item.value === value)?.label || value || "—";

const getStageFromGrades = (grades = []) => {
  const numbers = normalizeGradeList(grades);
  if (numbers.some((g) => g >= 12 && g <= 13)) return "al";
  if (numbers.some((g) => g >= 10 && g <= 11)) return "ol";
  if (numbers.some((g) => g >= 6 && g <= 9)) return "junior";
  return "all";
};

const shouldShowReligionKey = (category) => category === "religion";
const shouldShowBasketGroup = (category) => category === "basket";
const shouldShowStream = (category) => category === "al_main";
const shouldShowMediums = (category) =>
  ["al_main", "general_english", "common_compulsory", "other"].includes(category);

const sortSubjects = (list) => {
  return [...list].sort((a, b) => {
    const orderA =
      a.displayOrder !== "" && a.displayOrder !== undefined && a.displayOrder !== null
        ? Number(a.displayOrder)
        : 9999;
    const orderB =
      b.displayOrder !== "" && b.displayOrder !== undefined && b.displayOrder !== null
        ? Number(b.displayOrder)
        : 9999;

    if (orderA !== orderB) return orderA - orderB;

    const categoryA = normalizeLower(a.category);
    const categoryB = normalizeLower(b.category);
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);

    return normalizeLower(a.name).localeCompare(normalizeLower(b.name));
  });
};

const sharesAnyGrade = (gradesA, gradesB) => {
  const a = new Set(normalizeGradeList(gradesA));
  return normalizeGradeList(gradesB).some((g) => a.has(g));
};

const hasGradeOutside = (grades, min, max) =>
  normalizeGradeList(grades).some((g) => g < min || g > max);

export default function SubjectManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "subjects"));
      const loaded = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        grades: normalizeGradeList(d.data().grades),
        mediums: Array.isArray(d.data().mediums) ? d.data().mediums : [],
      }));
      setSubjects(sortSubjects(loaded));
    } catch (err) {
      setError("Failed to load subjects: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = normalizeLower(search);

    return subjects.filter((subject) => {
      const stage = getStageFromGrades(subject.grades);

      const matchTab =
        tab === "all" ||
        stage === tab ||
        (tab === "junior" && subject.grades.some((g) => g >= 6 && g <= 9)) ||
        (tab === "ol" && subject.grades.some((g) => g >= 10 && g <= 11)) ||
        (tab === "al" && subject.grades.some((g) => g >= 12 && g <= 13));

      const matchSearch =
        !q ||
        normalizeLower(subject.name).includes(q) ||
        normalizeLower(subject.code).includes(q) ||
        normalizeLower(subject.category).includes(q) ||
        normalizeLower(subject.religionKey).includes(q) ||
        normalizeLower(subject.stream).includes(q) ||
        normalizeLower(subject.basketGroup).includes(q);

      const matchCategory = !filterCategory || subject.category === filterCategory;
      const matchStatus = !filterStatus || normalizeStatus(subject.status) === filterStatus;

      return matchTab && matchSearch && matchCategory && matchStatus;
    });
  }, [subjects, tab, search, filterCategory, filterStatus]);

  const counts = useMemo(() => {
    return {
      total: subjects.length,
      active: subjects.filter((s) => normalizeStatus(s.status) === "active").length,
      inactive: subjects.filter((s) => normalizeStatus(s.status) === "inactive").length,
      compulsory: subjects.filter((s) => s.category === "compulsory").length,
      religion: subjects.filter((s) => s.category === "religion").length,
      basket: subjects.filter((s) => s.category === "basket").length,
      alMain: subjects.filter((s) => s.category === "al_main").length,
    };
  }, [subjects]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
  };

  const cleanFormByCategory = (data) => {
    const category = normalizeCategory(data.category);

    return {
      ...data,
      religionKey: shouldShowReligionKey(category) ? normalizeText(data.religionKey) : "",
      basketGroup: shouldShowBasketGroup(category) ? normalizeUpper(data.basketGroup) : "",
      stream: shouldShowStream(category) ? normalizeText(data.stream) : "",
      mediums: shouldShowMediums(category)
        ? [...new Set((Array.isArray(data.mediums) ? data.mediums : []).map(normalizeText).filter(Boolean))]
        : [],
    };
  };

  const buildPayload = () => {
    const cleaned = cleanFormByCategory(form);

    return {
      code: normalizeText(cleaned.code),
      name: normalizeText(cleaned.name),
      category: normalizeCategory(cleaned.category),
      grades: normalizeGradeList(cleaned.grades),
      religionKey: normalizeText(cleaned.religionKey),
      basketGroup: normalizeUpper(cleaned.basketGroup),
      stream: normalizeText(cleaned.stream),
      mediums: Array.isArray(cleaned.mediums) ? cleaned.mediums : [],
      status: normalizeStatus(cleaned.status) || "active",
      isSystem: Boolean(cleaned.isSystem),
      displayOrder:
        cleaned.displayOrder === "" || cleaned.displayOrder === null || cleaned.displayOrder === undefined
          ? null
          : Number(cleaned.displayOrder),
      updatedAt: new Date().toISOString(),
    };
  };

  const validateForm = () => {
    const payload = buildPayload();

    if (!payload.code) return "Subject code is required.";
    if (!payload.name) return "Subject name is required.";
    if (!payload.category) return "Category is required.";
    if (!Array.isArray(payload.grades) || payload.grades.length === 0) {
      return "Select at least one grade.";
    }

    if (payload.category === "religion" && !payload.religionKey) {
      return "Religion key is required for religion subjects.";
    }

    if (payload.category === "basket" && !payload.basketGroup) {
      return "Basket group is required for basket subjects.";
    }

    if (payload.category === "al_main" && !payload.stream) {
      return "Stream is required for A/L main subjects.";
    }

    if (payload.category === "religion" && hasGradeOutside(payload.grades, 6, 11)) {
      return "Religion subjects can only be assigned to Grades 6 to 11.";
    }

    if (payload.category === "aesthetic" && hasGradeOutside(payload.grades, 6, 9)) {
      return "Aesthetic subjects can only be assigned to Grades 6 to 9.";
    }

    if (payload.category === "basket" && hasGradeOutside(payload.grades, 10, 11)) {
      return "Basket subjects can only be assigned to Grades 10 to 11.";
    }

    if (payload.category === "al_main" && hasGradeOutside(payload.grades, 12, 13)) {
      return "A/L main subjects can only be assigned to Grades 12 to 13.";
    }

    if (payload.category === "general_english" && hasGradeOutside(payload.grades, 12, 13)) {
      return "General English can only be assigned to Grades 12 to 13.";
    }

    if (payload.category === "common_compulsory" && hasGradeOutside(payload.grades, 12, 13)) {
      return "Common Compulsory subjects can only be assigned to Grades 12 to 13.";
    }

    if (payload.category === "compulsory" && payload.grades.some((g) => g >= 12)) {
      return "Use A/L Main, General English, or Common Compulsory for Grades 12 to 13.";
    }

    const duplicateCode = subjects.find((item) => {
      if (editId && item.id === editId) return false;
      return normalizeLower(item.code) === normalizeLower(payload.code);
    });

    if (duplicateCode) {
      return "A subject with this code already exists.";
    }

    const conflictingCategoryRule = subjects.find((item) => {
      if (editId && item.id === editId) return false;
      if (!sharesAnyGrade(item.grades, payload.grades)) return false;

      const sameCategory = normalizeLower(item.category) === normalizeLower(payload.category);
      if (!sameCategory) return false;

      if (payload.category === "religion") {
        return normalizeLower(item.religionKey) === normalizeLower(payload.religionKey);
      }

      if (payload.category === "basket") {
        return normalizeUpper(item.basketGroup) === normalizeUpper(payload.basketGroup);
      }

      if (payload.category === "general_english") {
        return true;
      }

      if (payload.category === "common_compulsory") {
        return normalizeLower(item.name) === normalizeLower(payload.name);
      }

      if (payload.category === "al_main") {
        return (
          normalizeLower(item.name) === normalizeLower(payload.name) &&
          normalizeLower(item.stream) === normalizeLower(payload.stream)
        );
      }

      if (payload.category === "aesthetic") {
        return normalizeLower(item.name) === normalizeLower(payload.name);
      }

      if (payload.category === "compulsory") {
        return normalizeLower(item.name) === normalizeLower(payload.name);
      }

      return normalizeLower(item.name) === normalizeLower(payload.name);
    });

    if (conflictingCategoryRule) {
      if (payload.category === "religion") {
        return "A religion subject with the same religion key already exists for one or more selected grades.";
      }
      if (payload.category === "basket") {
        return "A basket subject with the same basket group already exists for one or more selected grades.";
      }
      if (payload.category === "general_english") {
        return "General English already exists for one or more selected grades.";
      }
      if (payload.category === "al_main") {
        return "An A/L main subject with the same subject name and stream already exists for one or more selected grades.";
      }
      return "A conflicting subject definition already exists for one or more selected grades.";
    }

    return "";
  };

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
        await updateDoc(doc(db, "subjects", editId), payload);
        setSuccess("Subject updated successfully.");
      } else {
        await addDoc(collection(db, "subjects"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Subject created successfully.");
      }

      setOpen(false);
      resetForm();
      await fetchSubjects();
    } catch (err) {
      setError("Failed to save subject: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (subject) => {
    setForm({
      code: subject.code || "",
      name: subject.name || "",
      category: subject.category || "",
      grades: normalizeGradeList(subject.grades),
      religionKey: subject.religionKey || "",
      basketGroup: subject.basketGroup || "",
      stream: subject.stream || "",
      mediums: Array.isArray(subject.mediums) ? subject.mediums : [],
      status: subject.status || "active",
      isSystem: Boolean(subject.isSystem),
      displayOrder:
        subject.displayOrder === null || subject.displayOrder === undefined
          ? ""
          : String(subject.displayOrder),
    });
    setEditId(subject.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const handleDeactivate = async (subject) => {
    if (!window.confirm(`Set subject "${subject.name}" inactive?`)) return;

    try {
      await updateDoc(doc(db, "subjects", subject.id), {
        status: "inactive",
        updatedAt: new Date().toISOString(),
      });
      setSuccess("Subject set to inactive.");
      await fetchSubjects();
    } catch (err) {
      setError("Failed to update subject status: " + err.message);
    }
  };

  const juniorSubjects = subjects.filter((s) =>
    s.grades.some((g) => g >= 6 && g <= 9)
  ).length;

  const olSubjects = subjects.filter((s) =>
    s.grades.some((g) => g >= 10 && g <= 11)
  ).length;

  const alSubjects = subjects.filter((s) =>
    s.grades.some((g) => g >= 12 && g <= 13)
  ).length;

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
              Subject Definitions
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Strict subject master for enrollment generation, marks entry, and reporting.
            </Typography>

            <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
              <Chip label={`Total: ${counts.total}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Chip label={`Active: ${counts.active}`} size="small" color="success" sx={{ fontWeight: 700 }} />
              <Chip label={`Inactive: ${counts.inactive}`} size="small" color="default" sx={{ fontWeight: 700 }} />
              <Chip label={`Compulsory: ${counts.compulsory}`} size="small" color="secondary" sx={{ fontWeight: 700 }} />
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setError("");
              setSuccess("");
              setOpen(true);
            }}
            sx={{ bgcolor: "#1a237e", fontWeight: 700, borderRadius: 2 }}
          >
            {isMobile ? "Add" : "Add Subject"}
          </Button>
        </Box>

        <Grid container spacing={1.5} mt={1}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Grades 6–9
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Compulsory, religion, and aesthetic subject definitions.
                </Typography>
                <Chip label={`${juniorSubjects} subjects`} size="small" color="primary" sx={{ mt: 1, fontWeight: 700 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Grades 10–11
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Compulsory, religion, and basket subject definitions.
                </Typography>
                <Chip label={`${olSubjects} subjects`} size="small" color="warning" sx={{ mt: 1, fontWeight: 700 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Grades 12–13
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  A/L main, General English, and Common Compulsory subjects.
                </Typography>
                <Chip label={`${alSubjects} subjects`} size="small" color="success" sx={{ mt: 1, fontWeight: 700 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mt: 2, borderBottom: "1px solid #e8eaf6" }}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons="auto"
        >
          <Tab label="All" value="all" />
          <Tab label="Grades 6–9" value="junior" />
          <Tab label="Grades 10–11" value="ol" />
          <Tab label="Grades 12–13" value="al" />
        </Tabs>

        <Box display="flex" flexWrap="wrap" gap={1.5} mt={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search code, subject, category, stream"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 170 }}>
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

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {SUBJECT_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSearch("");
              setFilterCategory("");
              setFilterStatus("active");
              setTab("all");
            }}
            sx={{ borderColor: "#e8eaf6", color: "text.secondary" }}
          >
            Clear
          </Button>

          <Typography variant="caption" color="text.secondary">
            {filteredSubjects.length} result{filteredSubjects.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Box>

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

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : filteredSubjects.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            border: "1px solid #e8eaf6",
          }}
        >
          <Typography variant="h6" color="text.secondary" fontWeight={600}>
            No subjects found
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Create subject definitions to support enrollments and marks entry.
          </Typography>
        </Box>
      ) : isMobile ? (
        <Box>
          {filteredSubjects.map((subject) => (
            <Card
              key={subject.id}
              sx={{
                mb: 1.5,
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.07)",
              }}
            >
              <CardContent sx={{ pb: 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {subject.name || "Unnamed Subject"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {subject.code || "—"}
                    </Typography>
                  </Box>

                  <Chip
                    label={normalizeStatus(subject.status) || "inactive"}
                    size="small"
                    color={normalizeStatus(subject.status) === "active" ? "success" : "default"}
                    sx={{ fontWeight: 700 }}
                  />
                </Box>

                <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
                  <Chip label={getCategoryLabel(subject.category)} size="small" color="primary" />
                  {subject.religionKey && <Chip label={`Religion: ${subject.religionKey}`} size="small" />}
                  {subject.basketGroup && <Chip label={`Basket ${subject.basketGroup}`} size="small" color="warning" />}
                  {subject.stream && <Chip label={`Stream: ${subject.stream}`} size="small" color="success" />}
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Grades: {subject.grades.length > 0 ? subject.grades.join(", ") : "—"}
                </Typography>

                {Array.isArray(subject.mediums) && subject.mediums.length > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Mediums: {subject.mediums.join(", ")}
                  </Typography>
                )}
              </CardContent>

              <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(subject)}
                  sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<BlockIcon />}
                  onClick={() => handleDeactivate(subject)}
                  disabled={normalizeStatus(subject.status) === "inactive"}
                >
                  Inactivate
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
                  "Code",
                  "Subject",
                  "Category",
                  "Grades",
                  "Extra",
                  "Mediums",
                  "Status",
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
              {filteredSubjects.map((subject, idx) => (
                <TableRow key={subject.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={700} color="#1a237e">
                      {subject.code || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {subject.name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>{getCategoryLabel(subject.category)}</TableCell>
                  <TableCell>
                    {subject.grades.length > 0 ? subject.grades.join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {subject.religionKey && <Chip size="small" label={subject.religionKey} />}
                      {subject.basketGroup && <Chip size="small" label={`Basket ${subject.basketGroup}`} color="warning" />}
                      {subject.stream && <Chip size="small" label={subject.stream} color="success" />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {Array.isArray(subject.mediums) && subject.mediums.length > 0
                      ? subject.mediums.join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={normalizeStatus(subject.status) || "inactive"}
                      size="small"
                      color={normalizeStatus(subject.status) === "active" ? "success" : "default"}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => handleEdit(subject)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Set inactive">
                      <span>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleDeactivate(subject)}
                          disabled={normalizeStatus(subject.status) === "inactive"}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </span>
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
          {editId ? "Edit Subject Definition" : "Add Subject Definition"}
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
                  Basic Details
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="Subject Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="CIV, REL-HIN, AL-CM"
              />
            </Grid>

            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                required
                label="Subject Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Civics, Hinduism, Combined Maths"
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={form.category}
                  label="Category"
                  onChange={(e) =>
                    setForm(
                      cleanFormByCategory({
                        ...form,
                        category: e.target.value,
                      })
                    )
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
              <FormControl fullWidth required>
                <InputLabel>Grades</InputLabel>
                <Select
                  multiple
                  value={form.grades}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      grades:
                        typeof e.target.value === "string"
                          ? e.target.value.split(",")
                          : e.target.value,
                    })
                  }
                  input={<OutlinedInput label="Grades" />}
                  renderValue={(selected) => selected.join(", ")}
                >
                  {GRADE_OPTIONS.map((grade) => (
                    <MenuItem key={grade} value={grade}>
                      <Checkbox checked={form.grades.indexOf(grade) > -1} />
                      <ListItemText primary={`Grade ${grade}`} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Display Order"
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                placeholder="Optional"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Rule Mapping
                </Typography>
              </Divider>
            </Grid>

            {shouldShowReligionKey(form.category) && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel>Religion Key</InputLabel>
                  <Select
                    value={form.religionKey}
                    label="Religion Key"
                    onChange={(e) => setForm({ ...form, religionKey: e.target.value })}
                  >
                    {RELIGION_KEYS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {shouldShowBasketGroup(form.category) && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel>Basket Group</InputLabel>
                  <Select
                    value={form.basketGroup}
                    label="Basket Group"
                    onChange={(e) => setForm({ ...form, basketGroup: e.target.value })}
                  >
                    {BASKET_GROUPS.map((item) => (
                      <MenuItem key={item} value={item}>
                        Basket {item}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {shouldShowStream(form.category) && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel>Stream</InputLabel>
                  <Select
                    value={form.stream}
                    label="Stream"
                    onChange={(e) => setForm({ ...form, stream: e.target.value })}
                  >
                    {STREAM_OPTIONS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {shouldShowMediums(form.category) && (
              <Grid item xs={12} sm={8}>
                <FormControl fullWidth>
                  <InputLabel>Supported Mediums</InputLabel>
                  <Select
                    multiple
                    value={form.mediums}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mediums:
                          typeof e.target.value === "string"
                            ? e.target.value.split(",")
                            : e.target.value,
                      })
                    }
                    input={<OutlinedInput label="Supported Mediums" />}
                    renderValue={(selected) => selected.join(", ")}
                  >
                    {MEDIUM_OPTIONS.map((item) => (
                      <MenuItem key={item} value={item}>
                        <Checkbox checked={form.mediums.indexOf(item) > -1} />
                        <ListItemText primary={item} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {SUBJECT_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>System Subject</InputLabel>
                <Select
                  value={String(form.isSystem)}
                  label="System Subject"
                  onChange={(e) => setForm({ ...form, isSystem: e.target.value === "true" })}
                >
                  <MenuItem value="false">False</MenuItem>
                  <MenuItem value="true">True</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setOpen(false);
              setError("");
            }}
            fullWidth={isMobile}
          >
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
              "Update Subject"
            ) : (
              "Save Subject"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}