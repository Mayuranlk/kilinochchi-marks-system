import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import {
  AL_STREAM_OPTIONS,
  AL_STREAM_CODES,
  isALGrade,
  buildALClassName,
  buildALDisplayClassName,
} from "../constants";
import {
  ActionBar,
  PageContainer,
  StatCard,
  StatusChip,
} from "../components/ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const safeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const lower = (value) => safeString(value).toLowerCase();

const normalizeGrade = (value) => {
  const raw = safeString(value);
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const normalizeSection = (value) => {
  const raw = safeString(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : "";
};

const normalizeSubjectName = (value) =>
  safeString(value).replace(/\s+/g, "").toLowerCase();

const getAvatarColor = (name) => {
  const colors = [
    "#1a237e",
    "#1565c0",
    "#0277bd",
    "#00695c",
    "#2e7d32",
    "#6a1b9a",
    "#880e4f",
    "#e65100",
  ];

  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const getSubjectName = (subject) =>
  safeString(subject.subjectName || subject.name || subject.shortName);

const getSubjectCode = (subject) =>
  safeString(subject.subjectCode || subject.code);

const getSubjectNumber = (subject) =>
  safeString(subject.subjectNumber);

const getSubjectCategory = (subject) => lower(subject.category);

const isActiveSubject = (subject) => lower(subject.status || "active") === "active";

const isTeacherActive = (teacher) => lower(teacher.status || "active") === "active";

const subjectMatchesGrade = (subject, grade) => {
  const grades = Array.isArray(subject.grades)
    ? subject.grades.map((g) => normalizeGrade(g)).filter(Boolean)
    : [];

  if (grades.length) {
    return grades.includes(Number(grade));
  }

  const minGrade = normalizeGrade(subject.minGrade);
  const maxGrade = normalizeGrade(subject.maxGrade);

  if (minGrade && maxGrade) {
    return Number(grade) >= minGrade && Number(grade) <= maxGrade;
  }

  if (minGrade && !maxGrade) {
    return Number(grade) >= minGrade;
  }

  if (!minGrade && maxGrade) {
    return Number(grade) <= maxGrade;
  }

  return true;
};

const subjectMatchesStream = (subject, stream) => {
  const cleanStream = safeString(stream);
  if (!cleanStream) return true;

  const primaryStream = safeString(subject.stream);
  const additionalStreams = Array.isArray(subject.streams)
    ? subject.streams.map(safeString).filter(Boolean)
    : [];
  const streamOptions = Array.isArray(subject.streamOptions)
    ? subject.streamOptions.map(safeString).filter(Boolean)
    : [];

  const allStreams = [
    ...new Set([primaryStream, ...additionalStreams, ...streamOptions].filter(Boolean)),
  ];

  if (!allStreams.length) {
    if (subject.appliesToAllStreams === true) return true;
    return !["al", "al_main", "al_general"].includes(getSubjectCategory(subject));
  }

  return allStreams.includes(cleanStream);
};

const subjectKey = (row) => {
  const sid = safeString(row.subjectId);
  if (sid) return `id:${sid}`;
  return `name:${normalizeSubjectName(row.subjectName || row.subject)}`;
};

const getAssignmentSubjectName = (row) =>
  safeString(row.subjectName || row.subject);

const getClassroomSection = (row) => normalizeSection(row.section || row.className);

const getAssignmentFullClassName = (row) => {
  if (safeString(row.fullClassName)) return safeString(row.fullClassName);

  const grade = normalizeGrade(row.grade);
  const section = normalizeSection(row.section);
  const stream = safeString(row.stream);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return `${grade}${section}`;
};

const getAssignmentGroupKey = (assignment) => {
  const grade = normalizeGrade(assignment.grade) || "";
  const section = normalizeSection(assignment.section);
  const stream = safeString(assignment.stream);
  return `${grade}-${section}-${stream}`;
};

const groupAssignmentsByClass = (teacherAssignments = []) => {
  const map = new Map();

  teacherAssignments.forEach((assignment) => {
    const key = getAssignmentGroupKey(assignment);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getAssignmentFullClassName(assignment),
        stream: safeString(assignment.stream),
        assignments: [],
      });
    }

    map.get(key).assignments.push(assignment);
  });

  return Array.from(map.values());
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function TeacherAssignments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState([]);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [expandedTeacherId, setExpandedTeacherId] = useState("");
  const [clearingTeacherId, setClearingTeacherId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [teacherSnap, subjectSnap, assignmentSnap, classroomSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "teacher"))),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "teacherAssignments")),
        getDocs(collection(db, "classrooms")),
      ]);

      const teacherRows = teacherSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => isTeacherActive(row))
        .sort((a, b) => safeString(a.name).localeCompare(safeString(b.name)));

      const subjectRows = subjectSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => isActiveSubject(row))
        .sort((a, b) => getSubjectName(a).localeCompare(getSubjectName(b)));

      const assignmentRows = assignmentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const classroomRows = classroomSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setTeachers(teacherRows);
      setSubjects(subjectRows);
      setAssignments(assignmentRows);
      setClassrooms(classroomRows);
    } catch (err) {
      console.error("TeacherAssignments fetch error:", err);
      setError("Failed to load teachers, subjects, assignments, or classrooms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const selectedTeacherRow = useMemo(
    () => teachers.find((t) => t.id === selectedTeacher) || null,
    [teachers, selectedTeacher]
  );

  const hasALGradeSelected = useMemo(
    () => selectedGrades.some((grade) => isALGrade(grade)),
    [selectedGrades]
  );

  const availableGrades = useMemo(() => {
    const createdGrades = classrooms
      .map((row) => normalizeGrade(row.grade))
      .filter(Boolean);

    return [...new Set(createdGrades)].sort((a, b) => a - b);
  }, [classrooms]);

  const availableStreams = useMemo(() => {
    const classroomStreams = classrooms
      .filter((row) => isALGrade(normalizeGrade(row.grade)))
      .map((row) => safeString(row.stream))
      .filter(Boolean);

    return [...new Set([...AL_STREAM_OPTIONS, ...classroomStreams])];
  }, [classrooms]);

  const availableSections = useMemo(() => {
    if (!selectedGrades.length) return [];

    const derived = classrooms
      .filter((row) => selectedGrades.includes(normalizeGrade(row.grade)))
      .filter((row) => {
        const grade = normalizeGrade(row.grade);
        if (isALGrade(grade) && selectedStreams.length > 0) {
          return selectedStreams.includes(safeString(row.stream));
        }
        return true;
      })
      .map((row) => getClassroomSection(row))
      .filter(Boolean);

    return [...new Set(derived)].sort((a, b) => a.localeCompare(b));
  }, [classrooms, selectedGrades, selectedStreams]);

  const availableSubjects = useMemo(() => {
    if (!selectedGrades.length) {
      return [];
    }

    return subjects.filter((subject) =>
      selectedGrades.some((grade) => {
        if (!subjectMatchesGrade(subject, grade)) return false;

        if (isALGrade(grade)) {
          if (selectedStreams.length === 0) return true;
          return selectedStreams.some((stream) => subjectMatchesStream(subject, stream));
        }

        return true;
      })
    );
  }, [subjects, selectedGrades, selectedStreams]);

  const selectedSubjectRows = useMemo(() => {
    return availableSubjects.filter((subject) =>
      selectedSubjectKeys.includes(subjectKey({
        subjectId: subject.id,
        subjectName: getSubjectName(subject),
      }))
    );
  }, [availableSubjects, selectedSubjectKeys]);

  const previewCombos = useMemo(() => {
    const combos = [];

    selectedGrades.forEach((grade) => {
      const alGrade = isALGrade(grade);

      const streamsForGrade = alGrade
        ? selectedStreams.length > 0
          ? selectedStreams
          : availableStreams
        : [""];

      selectedSections.forEach((section) => {
        streamsForGrade.forEach((stream) => {
          selectedSubjectRows.forEach((subject) => {
            if (!subjectMatchesGrade(subject, grade)) return;
            if (alGrade && !subjectMatchesStream(subject, stream)) return;

            const fullClassName =
              alGrade && stream
                ? buildALClassName(grade, stream, section)
                : `${grade}${section}`;

            const displayClassName =
              alGrade && stream
                ? buildALDisplayClassName(grade, stream, section) || fullClassName
                : `${grade}${section}`;

            combos.push({
              grade: Number(grade),
              section: safeString(section),
              stream: alGrade ? safeString(stream) : "",
              streamCode: alGrade ? safeString(AL_STREAM_CODES[stream] || "") : "",
              className: `${grade}${section}`,
              alClassName: alGrade ? fullClassName : "",
              fullClassName,
              displayClassName,
              subjectId: subject.id,
              subjectName: getSubjectName(subject),
              subjectCode: getSubjectCode(subject),
              subjectNumber: getSubjectNumber(subject),
            });
          });
        });
      });
    });

    return combos;
  }, [selectedGrades, selectedSections, selectedStreams, selectedSubjectRows, availableStreams]);

  const previewCount = previewCombos.length;

  useEffect(() => {
    setSelectedGrades((prev) =>
      prev.filter((grade) => availableGrades.includes(grade))
    );
  }, [availableGrades]);

  useEffect(() => {
    setSelectedSections((prev) =>
      prev.filter((section) => availableSections.includes(section))
    );
  }, [availableSections]);

  const toggleGrade = (grade) => {
    setSelectedGrades((prev) => {
      const next = prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort((a, b) => a - b);

      const stillHasAL = next.some((g) => isALGrade(g));
      if (!stillHasAL) {
        setSelectedStreams([]);
      }

      return next;
    });

    setSelectedSubjectKeys([]);
  };

  const toggleSection = (section) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section].sort()
    );
  };

  const toggleStream = (stream) => {
    setSelectedStreams((prev) =>
      prev.includes(stream)
        ? prev.filter((s) => s !== stream)
        : [...prev, stream].sort()
    );
    setSelectedSubjectKeys([]);
  };

  const toggleSubject = (key) => {
    setSelectedSubjectKeys((prev) =>
      prev.includes(key)
        ? prev.filter((s) => s !== key)
        : [...prev, key]
    );
  };

  const toggleAllGrades = () => {
    setSelectedGrades((prev) =>
      prev.length === availableGrades.length ? [] : [...availableGrades]
    );
    setSelectedSubjectKeys([]);
  };

  const toggleAllSections = () => {
    setSelectedSections((prev) =>
      prev.length === availableSections.length ? [] : [...availableSections]
    );
  };

  const toggleAllStreams = () => {
    setSelectedStreams((prev) =>
      prev.length === availableStreams.length ? [] : [...availableStreams]
    );
    setSelectedSubjectKeys([]);
  };

  const toggleAllSubjects = () => {
    const allKeys = availableSubjects.map((subject) =>
      subjectKey({
        subjectId: subject.id,
        subjectName: getSubjectName(subject),
      })
    );

    setSelectedSubjectKeys((prev) =>
      prev.length === allKeys.length ? [] : allKeys
    );
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!selectedTeacher) {
      setError("Please select a teacher.");
      return;
    }

    if (!selectedGrades.length) {
      setError("Select at least one grade.");
      return;
    }

    if (!selectedSections.length) {
      setError("Select at least one section.");
      return;
    }

    if (hasALGradeSelected && !selectedStreams.length) {
      setError("Select at least one stream for A/L grades.");
      return;
    }

    if (!selectedSubjectRows.length) {
      setError("Select at least one subject.");
      return;
    }

    setSaving(true);

    try {
      const conflicts = [];
      const alreadyAssignedToSameTeacher = [];
      const rowsToCreate = [];

      previewCombos.forEach((combo) => {
        const existing = assignments.find((assignment) => {
          const sameGrade = Number(assignment.grade) === Number(combo.grade);
          const sameSection =
            normalizeSection(assignment.section) === normalizeSection(combo.section);

          if (!sameGrade || !sameSection) return false;

          if (isALGrade(combo.grade)) {
            const existingStream = safeString(assignment.stream);
            if (existingStream !== safeString(combo.stream)) return false;
          }

          const existingSubjectId = safeString(assignment.subjectId);
          const existingSubjectName = safeString(
            assignment.subjectName || assignment.subject
          );

          if (existingSubjectId && combo.subjectId) {
            return existingSubjectId === combo.subjectId;
          }

          return (
            normalizeSubjectName(existingSubjectName) ===
            normalizeSubjectName(combo.subjectName)
          );
        });

        if (!existing) {
          rowsToCreate.push(combo);
          return;
        }

        if (safeString(existing.teacherId) === selectedTeacher) {
          alreadyAssignedToSameTeacher.push(
            `${combo.subjectName} - ${combo.displayClassName}`
          );
          return;
        }

        conflicts.push(
          `${combo.subjectName} - ${combo.displayClassName} already assigned to ${safeString(existing.teacherName) || "another teacher"}`
        );
      });

      if (conflicts.length) {
        setError(conflicts.join("\n"));
        setSaving(false);
        return;
      }

      if (!rowsToCreate.length) {
        setError(
          alreadyAssignedToSameTeacher.length
            ? "All selected combinations are already assigned to this teacher."
            : "No new assignments to save."
        );
        setSaving(false);
        return;
      }

      await Promise.all(
        rowsToCreate.map((row) =>
          addDoc(collection(db, "teacherAssignments"), {
            teacherId: selectedTeacher,
            teacherName: safeString(selectedTeacherRow?.name),
            teacherEmail: safeString(selectedTeacherRow?.email),

            grade: Number(row.grade),
            section: safeString(row.section),

            className: safeString(row.className),
            fullClassName: safeString(row.fullClassName),
            alClassName: safeString(row.alClassName),

            stream: safeString(row.stream),
            streamCode: safeString(row.streamCode),

            subjectId: safeString(row.subjectId),
            subjectName: safeString(row.subjectName),
            subject: safeString(row.subjectName),
            subjectCode: safeString(row.subjectCode),
            subjectNumber: safeString(row.subjectNumber),

            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );

      setSuccess(
        `${rowsToCreate.length} assignment${rowsToCreate.length === 1 ? "" : "s"} added for ${safeString(selectedTeacherRow?.name)}.`
      );

      setSelectedTeacher("");
      setSelectedGrades([]);
      setSelectedSections([]);
      setSelectedStreams([]);
      setSelectedSubjectKeys([]);

      await fetchAll();
    } catch (err) {
      console.error("TeacherAssignments save error:", err);
      setError("Failed to save teacher assignments.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Remove this assignment?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "teacherAssignments", id));
      await fetchAll();
    } catch (err) {
      console.error("TeacherAssignments delete error:", err);
      setError("Failed to remove assignment.");
    }
  };

  const handleClearTeacherAssignments = async (teacher) => {
    const teacherAssignments = teacher.assignments || [];
    if (!teacherAssignments.length || clearingTeacherId) return;

    const teacherName = safeString(teacher.name) || "this teacher";
    const confirmed = window.confirm(
      `Clear all ${teacherAssignments.length} assignment${teacherAssignments.length === 1 ? "" : "s"} for ${teacherName}?`
    );
    if (!confirmed) return;

    setClearingTeacherId(teacher.id);
    setError("");
    setSuccess("");

    try {
      const batch = writeBatch(db);
      teacherAssignments.forEach((assignment) => {
        batch.delete(doc(db, "teacherAssignments", assignment.id));
      });
      await batch.commit();

      setSuccess(
        `Cleared ${teacherAssignments.length} assignment${teacherAssignments.length === 1 ? "" : "s"} for ${teacherName}.`
      );
      if (expandedTeacherId === teacher.id) {
        setExpandedTeacherId("");
      }
      await fetchAll();
    } catch (err) {
      console.error("TeacherAssignments bulk clear error:", err);
      setError("Failed to clear teacher assignments.");
    } finally {
      setClearingTeacherId("");
    }
  };

  const groupedAssignments = teachers
    .map((teacher) => ({
      ...teacher,
      assignments: assignments
        .filter((assignment) => safeString(assignment.teacherId) === teacher.id)
        .sort((a, b) => {
          const gradeDiff = Number(a.grade) - Number(b.grade);
          if (gradeDiff !== 0) return gradeDiff;

          const streamDiff = safeString(a.stream).localeCompare(safeString(b.stream));
          if (streamDiff !== 0) return streamDiff;

          const sectionDiff = safeString(a.section).localeCompare(safeString(b.section));
          if (sectionDiff !== 0) return sectionDiff;

          return getAssignmentSubjectName(a).localeCompare(getAssignmentSubjectName(b));
        }),
    }))
    .filter((teacher) => teacher.assignments.length > 0);

  const filteredGroupedAssignments = useMemo(() => {
    const term = lower(assignmentSearch);
    if (!term) return groupedAssignments;

    return groupedAssignments.filter((teacher) => {
      const teacherText = [
        teacher.name,
        teacher.email,
        teacher.phone,
        teacher.nic,
      ]
        .map(lower)
        .join(" ");

      if (teacherText.includes(term)) return true;

      return teacher.assignments.some((assignment) =>
        [
          getAssignmentFullClassName(assignment),
          assignment.stream,
          assignment.subjectName,
          assignment.subject,
          assignment.subjectNumber,
          assignment.subjectCode,
        ]
          .map(lower)
          .join(" ")
          .includes(term)
      );
    });
  }, [assignmentSearch, groupedAssignments]);

  const stats = {
    total: assignments.length,
    teachers: teachers.length,
    subjects: subjects.length,
    preview: previewCount,
  };

  const selectionPanelSx = {
    border: "1px solid #e2e8f0",
    borderRadius: 1,
    p: { xs: 1.25, sm: 1.5 },
    minHeight: { sm: 260 },
  };

  const optionLabelSx = {
    m: 0,
    px: 1,
    py: { xs: 0.7, sm: 0.4 },
    minHeight: 42,
    borderRadius: 1,
    alignItems: "center",
    "&:hover": { bgcolor: "rgba(26,35,126,0.04)" },
    "& .MuiFormControlLabel-label": {
      minWidth: 0,
      flex: 1,
    },
  };

  return (
    <PageContainer
      title="Teacher Assignments"
      subtitle="Assign subjects to teachers by grade, section, and stream."
    >
      <Stack spacing={2.25}>
        {isMobile ? (
          <Paper
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: "1px solid #e8eaf6",
              boxShadow: "0 2px 12px rgba(26,35,126,0.07)",
            }}
          >
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1a237e" }}>
                Quick Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusChip status="active" label={`${stats.total} total`} />
                <StatusChip status="saved" label={`${stats.teachers} teachers`} />
                <StatusChip status="completed" label={`${stats.subjects} subjects`} />
                <StatusChip status="draft" label={`${stats.preview} preview`} />
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}>
              <StatCard title="Assignments" value={stats.total} icon={<AssignmentIndIcon />} color="primary" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Teachers" value={stats.teachers} icon={<CheckCircleIcon />} color="success" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Active Subjects" value={stats.subjects} icon={<AssignmentIndIcon />} color="secondary" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Preview Rows" value={stats.preview} icon={<SaveIcon />} color="warning" />
            </Grid>
          </Grid>
        )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Paper
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 3,
          borderRadius: 1,
          border: "2px solid #e8eaf6",
          boxShadow: "0 2px 12px rgba(26,35,126,0.07)",
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={2.5}>
          New Assignment
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error.split("\n").map((line, i) => (
              <Typography key={i} variant="caption" display="block">
                {line}
              </Typography>
            ))}
          </Alert>
        )}

        <Box mb={2.5}>
          <Typography variant="body2" fontWeight={700} color="#1a237e" mb={1}>
            Step 1 - Select Teacher
          </Typography>

          <FormControl fullWidth size={isMobile ? "medium" : "small"} sx={{ maxWidth: 520 }}>
            <InputLabel>Teacher *</InputLabel>
            <Select
              label="Teacher *"
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              {teachers.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Avatar
                      sx={{
                        bgcolor: getAvatarColor(teacher.name),
                        width: 28,
                        height: 28,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {safeString(teacher.name).charAt(0) || "T"}
                    </Avatar>

                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {teacher.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {
                          assignments.filter(
                            (assignment) => safeString(assignment.teacherId) === teacher.id
                          ).length
                        }{" "}
                        assigned
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={{ xs: 1.25, sm: 2 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <Box
              sx={{
                ...selectionPanelSx,
                bgcolor: selectedGrades.length > 0 ? "#e8eaf6" : "#fafafa",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#1a237e">
                  Step 2 - Grade
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0 }}
                  onClick={toggleAllGrades}
                  disabled={availableGrades.length === 0}
                >
                  {selectedGrades.length === availableGrades.length ? "None" : "All"}
                </Button>
              </Box>

              {availableGrades.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Create classrooms first to enable assignment.
                </Typography>
              ) : (
                <FormGroup>
                  {availableGrades.map((grade) => (
                    <FormControlLabel
                      key={grade}
                      sx={optionLabelSx}
                      control={
                        <Checkbox
                          checked={selectedGrades.includes(grade)}
                          onChange={() => toggleGrade(grade)}
                          size="small"
                          sx={{
                            py: 0.3,
                            color: "#1a237e",
                            "&.Mui-checked": { color: "#1a237e" },
                          }}
                        />
                      }
                      label={<Typography variant="body2">Grade {grade}</Typography>}
                    />
                  ))}
                </FormGroup>
              )}

              {selectedGrades.length > 0 && (
                <Chip
                  label={`${selectedGrades.length} selected`}
                  size="small"
                  color="primary"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
            <Box
              sx={{
                ...selectionPanelSx,
                bgcolor: selectedSections.length > 0 ? "#e8f5e9" : "#fafafa",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#2e7d32">
                  Step 3 - Section
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#2e7d32" }}
                  onClick={toggleAllSections}
                  disabled={availableSections.length === 0}
                >
                  {selectedSections.length === availableSections.length ? "None" : "All"}
                </Button>
              </Box>

              {selectedGrades.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Select a grade to show its classroom sections.
                </Typography>
              ) : availableSections.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No sections found for the selected classroom filters.
                </Typography>
              ) : (
                <FormGroup>
                  {availableSections.map((section) => (
                    <FormControlLabel
                      key={section}
                      sx={optionLabelSx}
                      control={
                        <Checkbox
                          checked={selectedSections.includes(section)}
                          onChange={() => toggleSection(section)}
                          size="small"
                          sx={{
                            py: 0.3,
                            color: "#2e7d32",
                            "&.Mui-checked": { color: "#2e7d32" },
                          }}
                        />
                      }
                      label={<Typography variant="body2">Section {section}</Typography>}
                    />
                  ))}
                </FormGroup>
              )}

              {selectedSections.length > 0 && (
                <Chip
                  label={`${selectedSections.length} selected`}
                  size="small"
                  color="success"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
            <Box
              sx={{
                ...selectionPanelSx,
                bgcolor: selectedStreams.length > 0 ? "#f3e5f5" : "#fafafa",
                opacity: hasALGradeSelected ? 1 : 0.7,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#6a1b9a">
                  Step 4 - Stream
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#6a1b9a" }}
                  onClick={toggleAllStreams}
                  disabled={!hasALGradeSelected}
                >
                  {selectedStreams.length === availableStreams.length ? "None" : "All"}
                </Button>
              </Box>

              {!hasALGradeSelected ? (
                <Typography variant="caption" color="text.secondary">
                  Select Grade 12 or 13 to enable stream selection.
                </Typography>
              ) : (
                <FormGroup>
                  {availableStreams.map((stream) => (
                    <FormControlLabel
                      key={stream}
                      sx={optionLabelSx}
                      control={
                        <Checkbox
                          checked={selectedStreams.includes(stream)}
                          onChange={() => toggleStream(stream)}
                          size="small"
                          sx={{
                            py: 0.3,
                            color: "#6a1b9a",
                            "&.Mui-checked": { color: "#6a1b9a" },
                          }}
                        />
                      }
                      label={<Typography variant="body2">{stream}</Typography>}
                    />
                  ))}
                </FormGroup>
              )}

              {selectedStreams.length > 0 && (
                <Chip
                  label={`${selectedStreams.length} selected`}
                  size="small"
                  sx={{ mt: 1, bgcolor: "#6a1b9a", color: "white" }}
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} lg={3}>
            <Box
              sx={{
                ...selectionPanelSx,
                bgcolor: selectedSubjectKeys.length > 0 ? "#fff3e0" : "#fafafa",
                maxHeight: { xs: 340, sm: 360 },
                overflowY: "auto",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#e65100">
                  Step 5 - Subject
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#e65100" }}
                  onClick={toggleAllSubjects}
                  disabled={availableSubjects.length === 0}
                >
                  {selectedSubjectKeys.length === availableSubjects.length ? "None" : "All"}
                </Button>
              </Box>

              {selectedGrades.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Select a grade to load matching subjects.
                </Typography>
              ) : availableSubjects.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No active subjects found for the selected filters.
                </Typography>
              ) : (
                <FormGroup>
                  {availableSubjects.map((subject) => {
                  const key = subjectKey({
                    subjectId: subject.id,
                    subjectName: getSubjectName(subject),
                  });

                  return (
                    <FormControlLabel
                      key={key}
                      sx={optionLabelSx}
                      control={
                        <Checkbox
                          checked={selectedSubjectKeys.includes(key)}
                          onChange={() => toggleSubject(key)}
                          size="small"
                          sx={{
                            py: 0.3,
                            color: "#e65100",
                            "&.Mui-checked": { color: "#e65100" },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            {getSubjectName(subject)}
                          </Typography>
                          {getSubjectNumber(subject) && (
                            <Typography variant="caption" color="text.secondary">
                              No. {getSubjectNumber(subject)}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  );
                  })}
                </FormGroup>
              )}

              {selectedSubjectKeys.length > 0 && (
                <Chip
                  label={`${selectedSubjectKeys.length} selected`}
                  size="small"
                  color="warning"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Grid>
        </Grid>

        <ActionBar sticky sx={{ mt: 1, pb: { xs: 0.5, sm: 0 } }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <StatusChip status="active" label={`${previewCount} preview`} />
            <StatusChip
              status={selectedTeacher ? "saved" : "pending"}
              label={selectedTeacher ? "Teacher selected" : "Select teacher"}
            />
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {previewCount > 0 ? (
              <Box
                sx={{
                  bgcolor: "#e8eaf6",
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  border: "1px solid #1a237e",
                  display: { xs: "none", sm: "block" },
                }}
              >
                <Typography variant="body2" fontWeight={700} color="#1a237e">
                  Will create {previewCount} assignment{previewCount !== 1 ? "s" : ""}
                </Typography>
              </Box>
            ) : null}

            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || previewCount === 0 || !selectedTeacher}
              sx={{ bgcolor: "#1a237e", px: 3 }}
              fullWidth={isMobile}
            >
              {saving ? "Saving..." : isMobile ? "Save Assignments" : `Save ${previewCount > 0 ? previewCount : ""} Assignments`}
            </Button>
          </Stack>
        </ActionBar>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      ) : groupedAssignments.length > 0 ? (
        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            mb={1.5}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="#1a237e">
                Current Assignments
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {filteredGroupedAssignments.length} of {groupedAssignments.length} teachers shown
              </Typography>
            </Box>

            <TextField
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              placeholder="Search teacher, class, subject..."
              size="small"
              sx={{ width: { xs: "100%", sm: 360 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {filteredGroupedAssignments.length === 0 ? (
            <Alert severity="info">No assignments match your search.</Alert>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 620, overflowY: "auto", pr: 0.5 }}>
              {filteredGroupedAssignments.map((teacher) => {
                const classGroups = groupAssignmentsByClass(teacher.assignments);
                const isClearingTeacher = clearingTeacherId === teacher.id;

                return (
                  <Accordion
                    key={teacher.id}
                    expanded={expandedTeacherId === teacher.id}
                    onChange={(_, expanded) =>
                      setExpandedTeacherId(expanded ? teacher.id : "")
                    }
                    disableGutters
                    sx={{
                      border: "1px solid #e8eaf6",
                      borderRadius: "8px !important",
                      boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        px: { xs: 1.25, sm: 2 },
                        py: { xs: 0.75, sm: 0.5 },
                        "& .MuiAccordionSummary-content": {
                          minWidth: 0,
                        },
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.25}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        sx={{ width: "100%", minWidth: 0, pr: 1 }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                          <Avatar
                            sx={{
                              bgcolor: getAvatarColor(teacher.name),
                              width: 38,
                              height: 38,
                              fontSize: 15,
                              fontWeight: 700,
                              flex: "0 0 auto",
                            }}
                          >
                            {safeString(teacher.name).charAt(0) || "T"}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={800} noWrap>
                              {teacher.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {teacher.email || "Teacher assignments"}
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          justifyContent={{ xs: "space-between", sm: "flex-end" }}
                          sx={{ width: { xs: "100%", sm: "auto" } }}
                        >
                          <Chip
                            label={`${teacher.assignments.length} assigned`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ flexShrink: 0 }}
                          />
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={
                              isClearingTeacher ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <DeleteSweepIcon fontSize="small" />
                              )
                            }
                            disabled={isClearingTeacher || Boolean(clearingTeacherId)}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleClearTeacherAssignments(teacher);
                            }}
                            onFocus={(event) => event.stopPropagation()}
                            sx={{
                              minHeight: 36,
                              display: { xs: "none", sm: "inline-flex" },
                            }}
                          >
                            Clear All
                          </Button>
                        </Stack>
                      </Stack>
                    </AccordionSummary>

                    <AccordionDetails sx={{ pt: 0, px: { xs: 1.25, sm: 2 } }}>
                      <Stack spacing={0.85}>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          fullWidth
                          startIcon={
                            isClearingTeacher ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <DeleteSweepIcon fontSize="small" />
                            )
                          }
                          disabled={isClearingTeacher || Boolean(clearingTeacherId)}
                          onClick={() => handleClearTeacherAssignments(teacher)}
                          sx={{
                            minHeight: 42,
                            display: { xs: "inline-flex", sm: "none" },
                          }}
                        >
                          Clear all assigned classes
                        </Button>

                        {classGroups.map((group) => (
                          <Box
                            key={group.key}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: { xs: "1fr", md: "150px 1fr" },
                              gap: 1,
                              alignItems: "start",
                              p: 1,
                              border: "1px solid #edf0f7",
                              borderRadius: 1,
                              bgcolor: "#fafbff",
                            }}
                          >
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              <Chip label={group.label} size="small" color="primary" />
                              {group.stream && (
                                <Chip label={group.stream} size="small" color="secondary" />
                              )}
                            </Stack>

                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              {group.assignments.map((assignment) => (
                                <Box
                                  key={assignment.id}
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    width: { xs: "100%", sm: "auto" },
                                    maxWidth: { xs: "100%", sm: 360 },
                                    minHeight: 40,
                                    pl: 1,
                                    border: "1px solid #e3e7f3",
                                    borderRadius: 1,
                                    bgcolor: "white",
                                  }}
                                >
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="caption" fontWeight={700} noWrap>
                                      {assignment.subjectName || assignment.subject}
                                    </Typography>
                                    {safeString(assignment.subjectNumber) && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ ml: 0.5 }}
                                      >
                                        No. {assignment.subjectNumber}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Tooltip title="Remove">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDelete(assignment.id)}
                                      sx={{ p: 0.75 }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>
          )}
        </Box>
      ) : (
        <Alert severity="info">No teacher assignments yet.</Alert>
      )}
      </Stack>
    </PageContainer>
  );
}
