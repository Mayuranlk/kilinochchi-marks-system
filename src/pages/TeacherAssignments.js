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
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const GRADES = [6, 7, 8, 9, 10, 11];
const SECTIONS = ["A", "B", "C", "D", "E", "F"];

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

const subjectKey = (row) => {
  const sid = safeString(row.subjectId);
  if (sid) return `id:${sid}`;
  return `name:${normalizeSubjectName(row.subjectName || row.subject)}`;
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

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [teacherSnap, subjectSnap, assignmentSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "teacher"))),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "teacherAssignments")),
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

      setTeachers(teacherRows);
      setSubjects(subjectRows);
      setAssignments(assignmentRows);
    } catch (err) {
      console.error("TeacherAssignments fetch error:", err);
      setError("Failed to load teachers, subjects, or assignments.");
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

  const availableSubjects = useMemo(() => {
    if (!selectedGrades.length) {
      return subjects;
    }

    return subjects.filter((subject) =>
      selectedGrades.some((grade) => subjectMatchesGrade(subject, grade))
    );
  }, [subjects, selectedGrades]);

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
      selectedSections.forEach((section) => {
        selectedSubjectRows.forEach((subject) => {
          if (!subjectMatchesGrade(subject, grade)) return;

          combos.push({
            grade: Number(grade),
            section: safeString(section),
            subjectId: subject.id,
            subjectName: getSubjectName(subject),
            subjectCode: getSubjectCode(subject),
          });
        });
      });
    });

    return combos;
  }, [selectedGrades, selectedSections, selectedSubjectRows]);

  const previewCount = previewCombos.length;

  const toggleGrade = (grade) => {
    setSelectedGrades((prev) => {
      const next = prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort((a, b) => a - b);

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

  const toggleSubject = (key) => {
    setSelectedSubjectKeys((prev) =>
      prev.includes(key)
        ? prev.filter((s) => s !== key)
        : [...prev, key]
    );
  };

  const toggleAllGrades = () => {
    setSelectedGrades((prev) =>
      prev.length === GRADES.length ? [] : [...GRADES]
    );
    setSelectedSubjectKeys([]);
  };

  const toggleAllSections = () => {
    setSelectedSections((prev) =>
      prev.length === SECTIONS.length ? [] : [...SECTIONS]
    );
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
            `${combo.subjectName} - G${combo.grade}-${combo.section}`
          );
          return;
        }

        conflicts.push(
          `${combo.subjectName} - G${combo.grade}-${combo.section} already assigned to ${safeString(existing.teacherName) || "another teacher"}`
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
            className: `${row.grade}${row.section}`,
            subjectId: safeString(row.subjectId),
            subjectName: safeString(row.subjectName),
            subject: safeString(row.subjectName),
            subjectCode: safeString(row.subjectCode),
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

  const groupedAssignments = teachers
    .map((teacher) => ({
      ...teacher,
      assignments: assignments
        .filter((assignment) => safeString(assignment.teacherId) === teacher.id)
        .sort((a, b) => {
          const gradeDiff = Number(a.grade) - Number(b.grade);
          if (gradeDiff !== 0) return gradeDiff;

          const sectionDiff = safeString(a.section).localeCompare(safeString(b.section));
          if (sectionDiff !== 0) return sectionDiff;

          return safeString(a.subjectName || a.subject).localeCompare(
            safeString(b.subjectName || b.subject)
          );
        }),
    }))
    .filter((teacher) => teacher.assignments.length > 0);

  return (
    <Box>
      <Box mb={2}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
          Teacher Assignments
        </Typography>

        <Box display="flex" gap={0.5} mt={0.75} flexWrap="wrap">
          <Chip
            label={`${assignments.length} Total`}
            size="small"
            color="primary"
          />
          <Chip
            label={`${teachers.length} Teachers`}
            size="small"
            color="success"
          />
          <Chip
            label={`${subjects.length} Active Subjects`}
            size="small"
            color="secondary"
          />
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Paper
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 3,
          borderRadius: 3,
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
            Step 1 — Select Teacher
          </Typography>

          <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
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

        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                border: "1px solid #e8eaf6",
                borderRadius: 2,
                p: 2,
                bgcolor: selectedGrades.length > 0 ? "#e8eaf6" : "#fafafa",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#1a237e">
                  Step 2 — Grade
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0 }}
                  onClick={toggleAllGrades}
                >
                  {selectedGrades.length === GRADES.length ? "None" : "All"}
                </Button>
              </Box>

              <FormGroup>
                {GRADES.map((grade) => (
                  <FormControlLabel
                    key={grade}
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

          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                border: "1px solid #e8eaf6",
                borderRadius: 2,
                p: 2,
                bgcolor: selectedSections.length > 0 ? "#e8f5e9" : "#fafafa",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#2e7d32">
                  Step 3 — Section
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#2e7d32" }}
                  onClick={toggleAllSections}
                >
                  {selectedSections.length === SECTIONS.length ? "None" : "All"}
                </Button>
              </Box>

              <FormGroup>
                {SECTIONS.map((section) => (
                  <FormControlLabel
                    key={section}
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

          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                border: "1px solid #e8eaf6",
                borderRadius: 2,
                p: 2,
                bgcolor: selectedSubjectKeys.length > 0 ? "#fff3e0" : "#fafafa",
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={700} color="#e65100">
                  Step 4 — Subject
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: 11, p: 0, minWidth: 0, color: "#e65100" }}
                  onClick={toggleAllSubjects}
                >
                  {selectedSubjectKeys.length === availableSubjects.length ? "None" : "All"}
                </Button>
              </Box>

              <FormGroup>
                {availableSubjects.map((subject) => {
                  const key = subjectKey({
                    subjectId: subject.id,
                    subjectName: getSubjectName(subject),
                  });

                  return (
                    <FormControlLabel
                      key={key}
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
                        <Typography variant="body2" sx={{ fontSize: 13 }}>
                          {getSubjectName(subject)}
                        </Typography>
                      }
                    />
                  );
                })}
              </FormGroup>

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

        <Box mt={2.5} display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {previewCount > 0 && (
            <Box
              sx={{
                bgcolor: "#e8eaf6",
                px: 2,
                py: 1,
                borderRadius: 2,
                border: "1px solid #1a237e",
              }}
            >
              <Typography variant="body2" fontWeight={700} color="#1a237e">
                <CheckCircleIcon
                  sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }}
                />
                Will create <strong>{previewCount}</strong> assignment
                {previewCount !== 1 ? "s" : ""}
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || previewCount === 0 || !selectedTeacher}
            sx={{ bgcolor: "#1a237e", px: 3 }}
          >
            {saving ? "Saving..." : `Save ${previewCount > 0 ? previewCount : ""} Assignments`}
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      ) : groupedAssignments.length > 0 ? (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
            Current Assignments
          </Typography>

          {isMobile ? (
            groupedAssignments.map((teacher) => (
              <Card
                key={teacher.id}
                sx={{
                  mb: 1.5,
                  borderRadius: 3,
                  border: "1px solid #e8eaf6",
                  boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
                }}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Avatar
                      sx={{
                        bgcolor: getAvatarColor(teacher.name),
                        width: 32,
                        height: 32,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {safeString(teacher.name).charAt(0) || "T"}
                    </Avatar>

                    <Typography variant="subtitle2" fontWeight={700} color="#1a237e">
                      {teacher.name}
                    </Typography>

                    <Chip
                      label={`${teacher.assignments.length}`}
                      size="small"
                      color="primary"
                      sx={{ ml: "auto" }}
                    />
                  </Box>

                  {teacher.assignments.map((assignment) => (
                    <Box
                      key={assignment.id}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      py={0.5}
                      sx={{ borderBottom: "1px solid #f0f0f0" }}
                    >
                      <Box display="flex" gap={0.8} flexWrap="wrap" alignItems="center">
                        <Chip
                          label={`G${assignment.grade}-${assignment.section}`}
                          size="small"
                          color="primary"
                        />
                        <Typography variant="body2">
                          {assignment.subjectName || assignment.subject}
                        </Typography>
                      </Box>

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(assignment.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            ))
          ) : (
            <Paper
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
              }}
            >
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["#", "Teacher", "Grade", "Section", "Subject", "Action"].map((head) => (
                      <TableCell key={head} sx={{ color: "white", fontWeight: 600 }}>
                        {head}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {assignments
                    .slice()
                    .sort((a, b) => {
                      const gradeDiff = Number(a.grade) - Number(b.grade);
                      if (gradeDiff !== 0) return gradeDiff;

                      const sectionDiff = safeString(a.section).localeCompare(
                        safeString(b.section)
                      );
                      if (sectionDiff !== 0) return sectionDiff;

                      return safeString(a.subjectName || a.subject).localeCompare(
                        safeString(b.subjectName || b.subject)
                      );
                    })
                    .map((assignment, index) => (
                      <TableRow
                        key={assignment.id}
                        hover
                        sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {assignment.teacherName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`Grade ${assignment.grade}`}
                            size="small"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>{assignment.section}</TableCell>
                        <TableCell>{assignment.subjectName || assignment.subject}</TableCell>
                        <TableCell>
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(assignment.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      ) : (
        <Alert severity="info">No teacher assignments yet.</Alert>
      )}
    </Box>
  );
}