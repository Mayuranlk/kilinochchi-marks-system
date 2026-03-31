import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADES } from "../constants";
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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SchoolIcon from "@mui/icons-material/School";
import PersonIcon from "@mui/icons-material/Person";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const STREAMS = ["Maths", "Bio", "Technology", "Arts", "Commerce"];
const YEARS = [2026, 2025, 2024];
const ALL_SECTIONS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

const emptyForm = {
  grade: 6,
  section: "A",
  stream: "",
  classTeacherId: "",
  year: 2026,
  notes: "",
};

const safeString = (value) => (value == null ? "" : String(value).trim());
const upper = (value) => safeString(value).toUpperCase();

const normalizeGrade = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeYear = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : new Date().getFullYear();
};

const buildClassName = (grade, section) => `${normalizeGrade(grade)}${upper(section)}`;

const normalizeTeacher = (id, data = {}, source = "users") => {
  const name =
    safeString(data.name) ||
    safeString(data.fullName) ||
    safeString(data.displayName) ||
    safeString(data.teacherName) ||
    "Unnamed Teacher";

  const email =
    safeString(data.email) ||
    safeString(data.gmail) ||
    safeString(data.mail);

  const phone =
    safeString(data.phone) ||
    safeString(data.mobile) ||
    safeString(data.phoneNumber);

  const signatureNo =
    safeString(data.signatureNo) ||
    safeString(data.signatureNumber) ||
    safeString(data.teacherSignatureNo) ||
    safeString(data.teacherNo);

  const uid =
    safeString(data.uid) ||
    safeString(data.authUid) ||
    safeString(data.userId);

  const role = safeString(data.role).toLowerCase();

  return {
    id,
    source,
    uid,
    role,
    name,
    email,
    phone,
    signatureNo,
    raw: data,
  };
};

const normalizeClassroom = (id, data = {}) => {
  const grade = normalizeGrade(data.grade);
  const section = upper(data.section || data.classSection || "");
  const year = normalizeYear(data.year || data.academicYear || new Date().getFullYear());
  const className =
    safeString(data.className) ||
    safeString(data.fullClassName) ||
    buildClassName(grade, section);

  return {
    id,
    ...data,
    grade,
    section,
    year,
    className,
    fullClassName: safeString(data.fullClassName) || className,
    stream: safeString(data.stream),
    notes: safeString(data.notes),
    classTeacherId:
      safeString(data.classTeacherId) ||
      safeString(data.teacherId) ||
      safeString(data.classTeacherDocId),
    classTeacherUid: safeString(data.classTeacherUid),
    classTeacherName:
      safeString(data.classTeacherName) ||
      safeString(data.teacherName),
    classTeacherEmail:
      safeString(data.classTeacherEmail) ||
      safeString(data.teacherEmail),
    classTeacherPhone:
      safeString(data.classTeacherPhone) ||
      safeString(data.teacherPhone),
    classTeacherSignatureNo:
      safeString(data.classTeacherSignatureNo) ||
      safeString(data.teacherSignatureNo),
  };
};

export default function ClassroomManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const teachersById = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      map.set(teacher.id, teacher);
    });
    return map;
  }, [teachers]);

  const groupedByGrade = useMemo(() => {
    return GRADES.reduce((acc, grade) => {
      const rows = classrooms.filter((c) => c.grade === grade);
      if (rows.length) acc[grade] = rows;
      return acc;
    }, {});
  }, [classrooms]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [classSnap, usersSnap, teachersSnap] = await Promise.all([
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "teachers")),
      ]);

      const normalizedClassrooms = classSnap.docs
        .map((d) => normalizeClassroom(d.id, d.data()))
        .sort((a, b) => {
          if (a.grade !== b.grade) return a.grade - b.grade;
          if (a.section !== b.section) return a.section.localeCompare(b.section);
          return b.year - a.year;
        });

      const userTeachers = usersSnap.docs
        .map((d) => normalizeTeacher(d.id, d.data(), "users"))
        .filter((t) => t.role === "teacher" || t.raw?.designation === "teacher");

      const directTeachers = teachersSnap.docs.map((d) =>
        normalizeTeacher(d.id, d.data(), "teachers")
      );

      const dedupedTeachers = [];
      const seen = new Set();

      [...userTeachers, ...directTeachers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((teacher) => {
          const key =
            safeString(teacher.email).toLowerCase() ||
            safeString(teacher.uid) ||
            safeString(teacher.signatureNo) ||
            teacher.id;

          if (!seen.has(key)) {
            seen.add(key);
            dedupedTeachers.push(teacher);
          }
        });

      setClassrooms(normalizedClassrooms);
      setTeachers(dedupedTeachers);
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resolveTeacher = (classroom) => {
    const direct = teachersById.get(classroom.classTeacherId);
    if (direct) return direct;

    return teachers.find((teacher) => {
      const teacherName = safeString(teacher.name).toLowerCase();
      const teacherEmail = safeString(teacher.email).toLowerCase();
      const teacherUid = safeString(teacher.uid);
      const teacherSignatureNo = safeString(teacher.signatureNo);

      return (
        (classroom.classTeacherUid && teacherUid && classroom.classTeacherUid === teacherUid) ||
        (classroom.classTeacherEmail &&
          teacherEmail &&
          classroom.classTeacherEmail.toLowerCase() === teacherEmail) ||
        (classroom.classTeacherSignatureNo &&
          teacherSignatureNo &&
          classroom.classTeacherSignatureNo === teacherSignatureNo) ||
        (classroom.classTeacherName &&
          teacherName &&
          classroom.classTeacherName.toLowerCase() === teacherName)
      );
    }) || null;
  };

  const getTeacherName = (classroom) => {
    const teacher = resolveTeacher(classroom);
    return teacher?.name || classroom.classTeacherName || "—";
  };

  const getClassLabel = (classroom) => {
    let label = `Grade ${classroom.grade} - ${classroom.section}`;
    if (classroom.stream) label += ` (${classroom.stream})`;
    return label;
  };

  const getAvailableSections = () => {
    const currentGrade = normalizeGrade(form.grade);
    const currentYear = normalizeYear(form.year);

    const existingForGradeYear = classrooms
      .filter((c) => c.grade === currentGrade && c.year === currentYear)
      .map((c) => c.section);

    const sectionSet = new Set(existingForGradeYear);

    ["A", "B", "C", "D"].forEach((section) => sectionSet.add(section));

    for (const section of ALL_SECTIONS) {
      if (!sectionSet.has(section)) {
        sectionSet.add(section);
        break;
      }
    }

    return ALL_SECTIONS.filter((section) => sectionSet.has(section));
  };

  const availableSections = getAvailableSections();

  const resetFormState = () => {
    setForm(emptyForm);
    setEditId(null);
    setError("");
    setSuccess("");
  };

  const createNewSection = async () => {
    setError("");
    setSuccess("");

    const grade = normalizeGrade(form.grade);
    const year = normalizeYear(form.year);

    const existingForGradeYear = classrooms
      .filter((c) => c.grade === grade && c.year === year)
      .map((c) => c.section);

    const nextSection = ALL_SECTIONS.find(
      (section) => !existingForGradeYear.includes(section)
    );

    if (!nextSection) {
      setError(`No more section letters available for Grade ${grade} in ${year}.`);
      return;
    }

    const duplicate = classrooms.find(
      (c) => c.grade === grade && c.section === nextSection && c.year === year
    );

    if (duplicate) {
      setError(`Grade ${grade}-${nextSection} already exists for ${year}.`);
      return;
    }

    setCreatingSection(true);

    try {
      const className = buildClassName(grade, nextSection);

      await addDoc(collection(db, "classrooms"), {
        grade,
        section: nextSection,
        className,
        fullClassName: className,
        stream: grade >= 12 ? safeString(form.stream) : "",
        classTeacherId: "",
        classTeacherUid: "",
        classTeacherName: "",
        classTeacherEmail: "",
        classTeacherPhone: "",
        classTeacherSignatureNo: "",
        year,
        academicYear: year,
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setForm((prev) => ({ ...prev, section: nextSection }));
      setSuccess(`New classroom created: Grade ${grade} - ${nextSection}`);
      await fetchData();
    } catch (err) {
      setError(`Failed to create classroom: ${err.message}`);
    } finally {
      setCreatingSection(false);
    }
  };

  const handleSave = async () => {
    const grade = normalizeGrade(form.grade);
    const section = upper(form.section);
    const year = normalizeYear(form.year);

    if (!grade || !section) {
      setError("Grade and Section are required.");
      return;
    }

    const duplicate = classrooms.find(
      (c) =>
        c.grade === grade &&
        c.section === section &&
        c.year === year &&
        c.id !== editId
    );

    if (duplicate) {
      setError(`Grade ${grade}-${section} already exists for ${year}.`);
      return;
    }

    const selectedTeacher =
      teachers.find((teacher) => teacher.id === form.classTeacherId) || null;

    const className = buildClassName(grade, section);

    const payload = {
      grade,
      section,
      className,
      fullClassName: className,
      stream: grade >= 12 ? safeString(form.stream) : "",
      classTeacherId: selectedTeacher?.id || "",
      classTeacherUid: selectedTeacher?.uid || "",
      classTeacherName: selectedTeacher?.name || "",
      classTeacherEmail: selectedTeacher?.email || "",
      classTeacherPhone: selectedTeacher?.phone || "",
      classTeacherSignatureNo: selectedTeacher?.signatureNo || "",
      year,
      academicYear: year,
      notes: safeString(form.notes),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editId) {
        await updateDoc(doc(db, "classrooms", editId), payload);
        setSuccess("Classroom updated successfully!");
      } else {
        await addDoc(collection(db, "classrooms"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Classroom added successfully!");
      }

      setOpen(false);
      resetFormState();
      await fetchData();
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (classroom) => {
    const teacher =
      resolveTeacher(classroom) ||
      teachers.find((t) => t.id === classroom.classTeacherId) ||
      null;

    setForm({
      grade: classroom.grade || 6,
      section: classroom.section || "A",
      stream: classroom.stream || "",
      classTeacherId: teacher?.id || classroom.classTeacherId || "",
      year: classroom.year || 2026,
      notes: classroom.notes || "",
    });

    setEditId(classroom.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete this classroom?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "classrooms", id));
      setSuccess("Classroom deleted.");
      await fetchData();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  const classroomCountWithTeacher = classrooms.filter(
    (c) => c.classTeacherId || c.classTeacherName || c.classTeacherEmail
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
              Classrooms
            </Typography>

            <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
              <Chip
                label={`Total: ${classrooms.length}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Grades: ${Object.keys(groupedByGrade).length}`}
                size="small"
                color="success"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`With Teacher: ${classroomCountWithTeacher}`}
                size="small"
                color="warning"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size={isMobile ? "small" : "medium"}
            onClick={() => {
              resetFormState();
              setOpen(true);
            }}
            sx={{ bgcolor: "#1a237e", fontWeight: 700, borderRadius: 2 }}
          >
            {isMobile ? "Add" : "Add Classroom"}
          </Button>
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
      ) : classrooms.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            border: "1px solid #e8eaf6",
          }}
        >
          <SchoolIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography variant="h6" color="text.secondary" mt={1} fontWeight={600}>
            No classrooms created yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click "Add Classroom" to get started
          </Typography>
        </Box>
      ) : (
        <>
          {isMobile ? (
            <Box>
              {classrooms.map((classroom) => (
                <Card
                  key={classroom.id}
                  sx={{
                    mb: 1.5,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.07)",
                  }}
                >
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800} color="#1a237e">
                          {getClassLabel(classroom)}
                        </Typography>

                        <Box display="flex" alignItems="center" gap={0.5} mt={0.3}>
                          <PersonIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {getTeacherName(classroom)}
                          </Typography>
                        </Box>
                      </Box>

                      <Chip
                        label={classroom.year}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>

                    {classroom.stream && (
                      <Chip
                        label={classroom.stream}
                        size="small"
                        color="warning"
                        sx={{ mt: 1, fontWeight: 600 }}
                      />
                    )}

                    {classroom.notes && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        mt={0.5}
                      >
                        📝 {classroom.notes}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(classroom)}
                      sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                    >
                      Edit
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(classroom.id)}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          ) : (
            <Box>
              {Object.entries(groupedByGrade).map(([grade, rows]) => (
                <Box key={grade} mb={3}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <SchoolIcon sx={{ color: "#1a237e", fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={800} color="#1a237e">
                      Grade {grade}
                    </Typography>
                    <Chip
                      label={`${rows.length} section${rows.length > 1 ? "s" : ""}`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>

                  <Paper
                    sx={{
                      overflowX: "auto",
                      borderRadius: 3,
                      boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
                      border: "1px solid #e8eaf6",
                    }}
                  >
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#1a237e" }}>
                        <TableRow>
                          {["Section", "Year", "Class Teacher", "Stream", "Notes", "Actions"].map(
                            (heading) => (
                              <TableCell
                                key={heading}
                                sx={{ color: "white", fontWeight: 700, fontSize: 13 }}
                              >
                                {heading}
                              </TableCell>
                            )
                          )}
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {rows.map((classroom) => (
                          <TableRow
                            key={classroom.id}
                            hover
                            sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                          >
                            <TableCell>
                              <Chip
                                label={classroom.section}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 800, fontSize: 13 }}
                              />
                            </TableCell>

                            <TableCell>
                              <Chip
                                label={classroom.year}
                                size="small"
                                color="default"
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>

                            <TableCell>
                              {classroom.classTeacherId ||
                              classroom.classTeacherName ||
                              classroom.classTeacherEmail ? (
                                <Chip
                                  icon={<PersonIcon />}
                                  label={getTeacherName(classroom)}
                                  color="success"
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                <Chip
                                  label="Not assigned"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </TableCell>

                            <TableCell>
                              {classroom.stream ? (
                                <Chip
                                  label={classroom.stream}
                                  size="small"
                                  color="warning"
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  —
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {classroom.notes || "—"}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEdit(classroom)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(classroom.id)}
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
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "✏️ Edit Classroom" : "➕ Add / Create Classroom"}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2, mt: 1 }}>
              {success}
            </Alert>
          )}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={form.grade}
                  label="Grade"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      grade: Number(e.target.value),
                      section: "A",
                    }))
                  }
                >
                  {GRADES.map((grade) => (
                    <MenuItem key={grade} value={grade}>
                      Grade {grade}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Section</InputLabel>
                <Select
                  value={form.section}
                  label="Section"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, section: upper(e.target.value) }))
                  }
                >
                  {availableSections.map((section) => (
                    <MenuItem key={section} value={section}>
                      Section {section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                Existing + next available section for selected year
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={form.year}
                  label="Year"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, year: Number(e.target.value) }))
                  }
                >
                  {YEARS.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={
                  creatingSection ? <CircularProgress size={16} /> : <AutoAwesomeIcon />
                }
                onClick={createNewSection}
                disabled={creatingSection}
                sx={{
                  borderColor: "#1a237e",
                  color: "#1a237e",
                  fontWeight: 700,
                  height: 42,
                  borderRadius: 2,
                }}
              >
                {creatingSection
                  ? "Creating..."
                  : `Create New Classroom / Division for Grade ${form.grade}`}
              </Button>

              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                This creates the next section automatically for the selected year.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Assignment
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Class Teacher</InputLabel>
                <Select
                  value={form.classTeacherId || ""}
                  label="Class Teacher"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, classTeacherId: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>No teacher assigned</em>
                  </MenuItem>

                  {teachers.map((teacher) => (
                    <MenuItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                      {teacher.signatureNo ? ` (${teacher.signatureNo})` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={form.grade < 12}>
                <InputLabel>Stream</InputLabel>
                <Select
                  value={form.stream || ""}
                  label="Stream"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, stream: e.target.value || "" }))
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {STREAMS.map((stream) => (
                    <MenuItem key={stream} value={stream}>
                      {stream}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="caption" color="text.secondary">
                {form.grade < 12 ? "Only for Grade 12–13" : "Select A/L stream"}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={2}
                value={form.notes || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="e.g. Science lab class, special notes..."
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
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editId ? (
              "Update Classroom"
            ) : (
              "Save Classroom"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}