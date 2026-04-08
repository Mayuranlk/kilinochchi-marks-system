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
  AL_STREAM_OPTIONS,
  AL_STREAM_CODES,
  AL_STREAM_SHORT_NAMES,
  buildALClassName,
  buildALDisplayClassName,
  isALGrade,
  normalizeText,
} from "../constants";
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
import {
  EmptyState,
  PageContainer,
  ResponsiveTableWrapper,
  StatCard,
  StatusChip,
} from "../components/ui";

const YEARS = [2026, 2025, 2024];
const ALL_SECTIONS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

const emptyForm = {
  grade: 6,
  section: "A",
  stream: "",
  streamCode: "",
  alClassName: "",
  fullClassName: "",
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

const buildRegularClassName = (grade, section) =>
  `${normalizeGrade(grade)}${upper(section)}`;

const buildStoredClassValues = (grade, section, stream = "") => {
  const g = normalizeGrade(grade);
  const s = upper(section);
  const st = normalizeText(stream);

  if (isALGrade(g) && st) {
    const alClassName = buildALClassName(g, st, s);
    return {
      className: buildRegularClassName(g, s),
      fullClassName: alClassName,
      alClassName,
      streamCode: AL_STREAM_CODES[st] || "",
      displayClassName: buildALDisplayClassName(g, st, s) || alClassName,
    };
  }

  const regular = buildRegularClassName(g, s);
  return {
    className: regular,
    fullClassName: regular,
    alClassName: "",
    streamCode: "",
    displayClassName: regular,
  };
};

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
  const stream = safeString(data.stream);
  const built = buildStoredClassValues(grade, section, stream);

  return {
    id,
    ...data,
    grade,
    section,
    year,
    className: safeString(data.className) || built.className,
    fullClassName: safeString(data.fullClassName) || built.fullClassName,
    alClassName: safeString(data.alClassName) || built.alClassName,
    stream,
    streamCode: safeString(data.streamCode) || built.streamCode,
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
          if (a.stream !== b.stream) return a.stream.localeCompare(b.stream);
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

    return (
      teachers.find((teacher) => {
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
      }) || null
    );
  };

  const getTeacherName = (classroom) => {
    const teacher = resolveTeacher(classroom);
    return teacher?.name || classroom.classTeacherName || "-";
  };

  const getClassLabel = (classroom) => {
    if (classroom.alClassName) return classroom.alClassName;
    return `Grade ${classroom.grade} - ${classroom.section}`;
  };

  const getAvailableSections = () => {
    const currentGrade = normalizeGrade(form.grade);
    const currentYear = normalizeYear(form.year);
    const currentStream = normalizeText(form.stream);

    const existingForScope = classrooms.filter((c) => {
      if (c.grade !== currentGrade || c.year !== currentYear) return false;
      if (isALGrade(currentGrade)) {
        return safeString(c.stream) === currentStream;
      }
      return true;
    });

    const existingSections = existingForScope.map((c) => c.section);
    const sectionSet = new Set(existingSections);

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
    const stream = safeString(form.stream);

    if (isALGrade(grade) && !stream) {
      setError("Select a stream first for Grade 12-13 classrooms.");
      return;
    }

    const existingForScope = classrooms.filter((c) => {
      if (c.grade !== grade || c.year !== year) return false;
      if (isALGrade(grade)) return safeString(c.stream) === stream;
      return true;
    });

    const nextSection = ALL_SECTIONS.find(
      (section) => !existingForScope.map((c) => c.section).includes(section)
    );

    if (!nextSection) {
      setError(
        isALGrade(grade)
          ? `No more section letters available for Grade ${grade} ${stream} in ${year}.`
          : `No more section letters available for Grade ${grade} in ${year}.`
      );
      return;
    }

    const duplicate = classrooms.find(
      (c) =>
        c.grade === grade &&
        c.section === nextSection &&
        c.year === year &&
        (isALGrade(grade) ? safeString(c.stream) === stream : true)
    );

    if (duplicate) {
      setError(
        isALGrade(grade)
          ? `${buildALClassName(grade, stream, nextSection)} already exists for ${year}.`
          : `Grade ${grade}-${nextSection} already exists for ${year}.`
      );
      return;
    }

    setCreatingSection(true);

    try {
      const built = buildStoredClassValues(grade, nextSection, stream);

      await addDoc(collection(db, "classrooms"), {
        grade,
        section: nextSection,
        className: built.className,
        fullClassName: built.fullClassName,
        alClassName: built.alClassName,
        stream: isALGrade(grade) ? stream : "",
        streamCode: built.streamCode,
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

      setForm((prev) => ({
        ...prev,
        section: nextSection,
        streamCode: built.streamCode,
        alClassName: built.alClassName,
        fullClassName: built.fullClassName,
      }));

      setSuccess(
        isALGrade(grade)
          ? `New classroom created: ${built.fullClassName}`
          : `New classroom created: Grade ${grade} - ${nextSection}`
      );
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
    const stream = safeString(form.stream);

    if (!grade || !section) {
      setError("Grade and Section are required.");
      return;
    }

    if (isALGrade(grade) && !stream) {
      setError("Stream is required for Grade 12-13 classrooms.");
      return;
    }

    const duplicate = classrooms.find((c) => {
      if (c.id === editId) return false;
      if (c.grade !== grade || c.section !== section || c.year !== year) return false;
      if (isALGrade(grade)) {
        return safeString(c.stream) === stream;
      }
      return true;
    });

    if (duplicate) {
      setError(
        isALGrade(grade)
          ? `${buildALClassName(grade, stream, section)} already exists for ${year}.`
          : `Grade ${grade}-${section} already exists for ${year}.`
      );
      return;
    }

    const selectedTeacher =
      teachers.find((teacher) => teacher.id === form.classTeacherId) || null;

    const built = buildStoredClassValues(grade, section, stream);

    const payload = {
      grade,
      section,
      className: built.className,
      fullClassName: built.fullClassName,
      alClassName: built.alClassName,
      stream: isALGrade(grade) ? stream : "",
      streamCode: built.streamCode,
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
        setSuccess("Classroom updated successfully.");
      } else {
        await addDoc(collection(db, "classrooms"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Classroom added successfully.");
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
      streamCode: classroom.streamCode || "",
      alClassName: classroom.alClassName || "",
      fullClassName: classroom.fullClassName || "",
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
  const quickStats = [
    { label: `Total: ${classrooms.length}`, status: "active" },
    { label: `Grades: ${Object.keys(groupedByGrade).length}`, status: "saved" },
    { label: `With Teacher: ${classroomCountWithTeacher}`, status: "draft" },
  ];

  return (
    <PageContainer
      title="Classrooms"
      subtitle="Manage classrooms, sections, years, and class teacher assignments."
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size={isMobile ? "small" : "medium"}
          onClick={() => {
            resetFormState();
            setOpen(true);
          }}
          fullWidth={isMobile}
          sx={{ bgcolor: "#1a237e", fontWeight: 700, borderRadius: 2 }}
        >
          Add Classroom
        </Button>
      }
    >
      <Paper
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
          border: "1px solid #e8eaf6",
          position: { xs: "sticky", md: "static" },
          top: { xs: 76, md: "auto" },
          zIndex: { xs: 2, md: "auto" },
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
            <Typography variant="subtitle1" fontWeight={800} color="#1a237e">
              Classroom Tools
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.4}>
              Create sections, assign class teachers, and review classroom coverage.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {isMobile ? (
        <Paper sx={{ p: 1.5, mb: 2, borderRadius: 3, border: "1px solid #e8eaf6" }}>
          <Box display="flex" gap={1} flexWrap="wrap">
            {quickStats.map((item) => (
              <StatusChip key={item.label} status={item.status} label={item.label} />
            ))}
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} md={4}>
            <StatCard title="Total Classrooms" value={classrooms.length} icon={<SchoolIcon />} color="primary" />
          </Grid>
          <Grid item xs={6} md={4}>
            <StatCard title="Grades Covered" value={Object.keys(groupedByGrade).length} icon={<AutoAwesomeIcon />} color="success" />
          </Grid>
          <Grid item xs={6} md={4}>
            <StatCard title="With Teacher" value={classroomCountWithTeacher} icon={<PersonIcon />} color="warning" />
          </Grid>
        </Grid>
      )}

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
        <EmptyState
          title="No classrooms created yet"
          description='Click "Add Classroom" to get started'
        />
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
                        label={AL_STREAM_SHORT_NAMES[classroom.stream] || classroom.stream}
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
                        Notes: {classroom.notes}
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
                    <ResponsiveTableWrapper minWidth={860}>
                      <Table size="small">
                      <TableHead sx={{ bgcolor: "#1a237e" }}>
                        <TableRow>
                          {[
                            "Class",
                            "Year",
                            "Class Teacher",
                            "Stream",
                            "Notes",
                            "Actions",
                          ].map((heading) => (
                            <TableCell
                              key={heading}
                              sx={{ color: "white", fontWeight: 700, fontSize: 13 }}
                            >
                              {heading}
                            </TableCell>
                          ))}
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
                                label={classroom.fullClassName || getClassLabel(classroom)}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 800, fontSize: 12 }}
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
                                  label={AL_STREAM_SHORT_NAMES[classroom.stream] || classroom.stream}
                                  size="small"
                                  color="warning"
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  -
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {classroom.notes || "-"}
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
                    </ResponsiveTableWrapper>
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
          {editId ? "Edit Classroom" : "Add / Create Classroom"}
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
                  onChange={(e) => {
                    const nextGrade = Number(e.target.value);
                    const built = buildStoredClassValues(
                      nextGrade,
                      "A",
                      isALGrade(nextGrade) ? form.stream : ""
                    );

                    setForm((prev) => ({
                      ...prev,
                      grade: nextGrade,
                      section: "A",
                      stream: isALGrade(nextGrade) ? prev.stream : "",
                      streamCode: built.streamCode,
                      alClassName: built.alClassName,
                      fullClassName: built.fullClassName,
                    }));
                  }}
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
                  onChange={(e) => {
                    const nextSection = upper(e.target.value);
                    const built = buildStoredClassValues(form.grade, nextSection, form.stream);

                    setForm((prev) => ({
                      ...prev,
                      section: nextSection,
                      streamCode: built.streamCode,
                      alClassName: built.alClassName,
                      fullClassName: built.fullClassName,
                    }));
                  }}
                >
                  {availableSections.map((section) => (
                    <MenuItem key={section} value={section}>
                      Section {section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                Existing + next available section for selected scope
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

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!isALGrade(form.grade)}>
                <InputLabel>Stream</InputLabel>
                <Select
                  value={form.stream || ""}
                  label="Stream"
                  onChange={(e) => {
                    const nextStream = e.target.value || "";
                    const built = buildStoredClassValues(form.grade, form.section, nextStream);

                    setForm((prev) => ({
                      ...prev,
                      stream: nextStream,
                      streamCode: built.streamCode,
                      alClassName: built.alClassName,
                      fullClassName: built.fullClassName,
                    }));
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {AL_STREAM_OPTIONS.map((stream) => (
                    <MenuItem key={stream} value={stream}>
                      {stream}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="caption" color="text.secondary">
                {isALGrade(form.grade) ? "Required for Grade 12–13" : "Only for Grade 12–13"}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Stream Code"
                value={form.streamCode || ""}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Class Name"
                value={
                  form.fullClassName ||
                  buildStoredClassValues(form.grade, form.section, form.stream).fullClassName
                }
                InputProps={{ readOnly: true }}
              />
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
                  : isALGrade(form.grade) && form.stream
                  ? `Create New ${AL_STREAM_SHORT_NAMES[form.stream] || form.stream} Division`
                  : `Create New Classroom / Division for Grade ${form.grade}`}
              </Button>

              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                This creates the next section automatically for the selected year
                {isALGrade(form.grade) && form.stream ? ` and stream (${form.stream})` : ""}.
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
              <TextField
                fullWidth
                label="Notes (optional)"
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
    </PageContainer>
  );
}
