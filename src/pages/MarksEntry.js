import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";

const ENTRY_STATUSES = ["Present", "Absent", "Medical Absent"];

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();

const normalizeGrade = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const normalizeSection = (value) => normalizeText(value);

const getAcademicYearValue = (term) =>
  normalizeText(term?.year || term?.academicYear || "");

const isActiveLike = (value) => {
  const status = normalizeLower(value);
  return status === "" || status === "active";
};

const getAssignmentSubjectId = (assignment) =>
  normalizeText(assignment?.subjectId);

const getAssignmentSubjectName = (assignment) =>
  normalizeText(
    assignment?.subjectName || assignment?.subject || assignment?.name || ""
  );

const getSubjectName = (subject) =>
  normalizeText(subject?.name || subject?.subjectName || subject?.subject || "");

const getSubjectId = (subject) => normalizeText(subject?.id || subject?.subjectId);

const getEnrollmentSubjectId = (enrollment) =>
  normalizeText(enrollment?.subjectId);

const getEnrollmentSubjectName = (enrollment) =>
  normalizeText(
    enrollment?.subjectName || enrollment?.subject || enrollment?.name || ""
  );

const getEnrollmentAcademicYear = (enrollment) =>
  normalizeText(enrollment?.academicYear || enrollment?.year || "");

const getEnrollmentStudentName = (enrollment) =>
  normalizeText(
    enrollment?.studentName || enrollment?.name || enrollment?.studentFullName || ""
  );

const getEnrollmentAdmissionNo = (enrollment) =>
  normalizeText(
    enrollment?.admissionNo || enrollment?.indexNumber || enrollment?.studentAdmissionNo || ""
  );

const getGradeChip = (mark) => {
  if (mark === "" || mark === undefined || mark === null) return null;
  const n = Number(mark);
  if (Number.isNaN(n)) return null;
  if (n >= 75) return { label: "A", color: "success" };
  if (n >= 65) return { label: "B", color: "primary" };
  if (n >= 55) return { label: "C", color: "warning" };
  if (n >= 35) return { label: "S", color: "default" };
  return { label: "F", color: "error" };
};

const sortEnrollmentRows = (rows) => {
  return [...rows].sort((a, b) => {
    const aAdmission = normalizeText(a.admissionNo).toLowerCase();
    const bAdmission = normalizeText(b.admissionNo).toLowerCase();

    if (aAdmission && bAdmission && aAdmission !== bAdmission) {
      return aAdmission.localeCompare(bAdmission, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    const aName = normalizeText(a.studentName).toLowerCase();
    const bName = normalizeText(b.studentName).toLowerCase();
    if (aName !== bName) return aName.localeCompare(bName);

    return normalizeText(a.studentId).localeCompare(normalizeText(b.studentId));
  });
};

const buildMarkDocId = ({ studentId, subjectId, subjectName, term, year }) => {
  const safeSubjectKey = subjectId || normalizeText(subjectName);
  return `${studentId}_${safeSubjectKey}_${term}_${year}`;
};

const subjectMatchesAssignment = (subject, assignment) => {
  const subjectId = getSubjectId(subject);
  const subjectName = getSubjectName(subject);

  const assignmentSubjectId = getAssignmentSubjectId(assignment);
  const assignmentSubjectName = getAssignmentSubjectName(assignment);

  if (assignmentSubjectId && subjectId) {
    return assignmentSubjectId === subjectId;
  }

  return normalizeLower(subjectName) === normalizeLower(assignmentSubjectName);
};

const enrollmentMatchesSubject = (enrollment, subject) => {
  const enrollmentSubjectId = getEnrollmentSubjectId(enrollment);
  const enrollmentSubjectName = getEnrollmentSubjectName(enrollment);
  const subjectId = getSubjectId(subject);
  const subjectName = getSubjectName(subject);

  if (subjectId && enrollmentSubjectId) {
    return enrollmentSubjectId === subjectId;
  }

  return normalizeLower(enrollmentSubjectName) === normalizeLower(subjectName);
};

export default function MarksEntry() {
  const { profile, isAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [classrooms, setClassrooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [activeTerm, setActiveTerm] = useState(null);

  const [baseLoading, setBaseLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [allEnrollmentsForClass, setAllEnrollmentsForClass] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [marksByStudent, setMarksByStudent] = useState({});

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const currentAcademicYear = getAcademicYearValue(activeTerm);

  const loadBaseData = useCallback(async () => {
    setBaseLoading(true);
    try {
      const [termSnap, classroomSnap, subjectSnap] = await Promise.all([
        getDocs(collection(db, "academicTerms")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "subjects")),
      ]);

      const active = termSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((t) => t.isActive === true);

      setActiveTerm(active || null);

      setClassrooms(
        classroomSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setSubjects(
        subjectSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      setError("Failed to load initial marks entry data: " + err.message);
    } finally {
      setBaseLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!profile && !isAdmin) return;

    setAssignmentsLoading(true);
    try {
      const snap = await getDocs(collection(db, "assignments"));
      const allAssignments = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const myAssignments = isAdmin
        ? allAssignments
        : allAssignments.filter((a) => a.teacherId === profile?.uid);

      setAssignments(myAssignments);

      if (!isAdmin && myAssignments.length > 0) {
        const first = myAssignments[0];
        const firstGrade = normalizeGrade(first.grade);
        const firstSection = normalizeSection(first.section);

        setSelectedGrade(firstGrade || "");
        setSelectedSection(firstSection || "");
      }
    } catch (err) {
      setError("Failed to load teacher assignments: " + err.message);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const adminGradeOptions = useMemo(() => {
    return [...new Set(classrooms.map((c) => normalizeGrade(c.grade)).filter(Boolean))].sort(
      (a, b) => a - b
    );
  }, [classrooms]);

  const teacherGradeOptions = useMemo(() => {
    return [...new Set(assignments.map((a) => normalizeGrade(a.grade)).filter(Boolean))].sort(
      (a, b) => a - b
    );
  }, [assignments]);

  const gradeOptions = isAdmin ? adminGradeOptions : teacherGradeOptions;

  const adminSectionOptions = useMemo(() => {
    if (!selectedGrade) return [];
    return [
      ...new Set(
        classrooms
          .filter((c) => normalizeGrade(c.grade) === Number(selectedGrade))
          .map((c) => normalizeSection(c.section))
          .filter(Boolean)
      ),
    ].sort();
  }, [classrooms, selectedGrade]);

  const teacherSectionOptions = useMemo(() => {
    if (!selectedGrade) return [];
    return [
      ...new Set(
        assignments
          .filter((a) => normalizeGrade(a.grade) === Number(selectedGrade))
          .map((a) => normalizeSection(a.section))
          .filter(Boolean)
      ),
    ].sort();
  }, [assignments, selectedGrade]);

  const sectionOptions = isAdmin ? adminSectionOptions : teacherSectionOptions;

  useEffect(() => {
    if (
      selectedSection &&
      !sectionOptions.includes(normalizeSection(selectedSection))
    ) {
      setSelectedSection("");
      setSelectedSubjectId("");
    }
  }, [sectionOptions, selectedSection]);

  const loadClassEnrollments = useCallback(async () => {
    if (!selectedGrade || !selectedSection) {
      setAllEnrollmentsForClass([]);
      return;
    }

    try {
      const grade = Number(selectedGrade);
      const section = normalizeSection(selectedSection);

      const enrollmentQuery = query(
        collection(db, "studentSubjectEnrollments"),
        where("grade", "==", grade),
        where("section", "==", section)
      );

      const snap = await getDocs(enrollmentQuery);

      let loaded = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      loaded = loaded.filter((item) => isActiveLike(item.status));

      if (currentAcademicYear) {
        const sameYear = loaded.filter(
          (item) => getEnrollmentAcademicYear(item) === currentAcademicYear
        );
        if (sameYear.length > 0) {
          loaded = sameYear;
        }
      }

      setAllEnrollmentsForClass(loaded);
    } catch (err) {
      setError("Failed to load subject enrollments: " + err.message);
      setAllEnrollmentsForClass([]);
    }
  }, [selectedGrade, selectedSection, currentAcademicYear]);

  useEffect(() => {
    loadClassEnrollments();
  }, [loadClassEnrollments]);

  const availableSubjectsFromEnrollments = useMemo(() => {
    if (!selectedGrade || !selectedSection) return [];

    const matchedSubjects = subjects.filter((subject) =>
      allEnrollmentsForClass.some((enrollment) =>
        enrollmentMatchesSubject(enrollment, subject)
      )
    );

    return matchedSubjects.sort((a, b) =>
      getSubjectName(a).localeCompare(getSubjectName(b))
    );
  }, [subjects, allEnrollmentsForClass, selectedGrade, selectedSection]);

  const teacherSubjectOptions = useMemo(() => {
    if (!selectedGrade || !selectedSection) return [];

    return availableSubjectsFromEnrollments.filter((subject) =>
      assignments.some((assignment) => {
        return (
          normalizeGrade(assignment.grade) === Number(selectedGrade) &&
          normalizeSection(assignment.section) === normalizeSection(selectedSection) &&
          subjectMatchesAssignment(subject, assignment)
        );
      })
    );
  }, [
    availableSubjectsFromEnrollments,
    assignments,
    selectedGrade,
    selectedSection,
  ]);

  const subjectOptions = isAdmin
    ? availableSubjectsFromEnrollments
    : teacherSubjectOptions;

  useEffect(() => {
    if (!selectedSubjectId) return;

    const stillValid = subjectOptions.some(
      (subject) => getSubjectId(subject) === selectedSubjectId
    );

    if (!stillValid) {
      setSelectedSubjectId("");
    }
  }, [subjectOptions, selectedSubjectId]);

  useEffect(() => {
    if (!selectedGrade || !selectedSection) {
      setSelectedSubjectId("");
      setFilteredRows([]);
      setMarksByStudent({});
    }
  }, [selectedGrade, selectedSection]);

  const selectedSubject = useMemo(() => {
    return (
      subjectOptions.find((subject) => getSubjectId(subject) === selectedSubjectId) ||
      null
    );
  }, [subjectOptions, selectedSubjectId]);

  const loadRowsAndMarks = useCallback(async () => {
    if (!selectedGrade || !selectedSection || !selectedSubject || !activeTerm) {
      setFilteredRows([]);
      setMarksByStudent({});
      return;
    }

    setRowsLoading(true);
    setSuccess("");
    setError("");

    try {
      const relevantEnrollments = allEnrollmentsForClass.filter((enrollment) =>
        enrollmentMatchesSubject(enrollment, selectedSubject)
      );

      const rows = sortEnrollmentRows(
        relevantEnrollments.map((enrollment) => ({
          enrollmentId: enrollment.id,
          studentId: normalizeText(enrollment.studentId),
          studentName: getEnrollmentStudentName(enrollment) || "Unnamed Student",
          admissionNo: getEnrollmentAdmissionNo(enrollment),
          grade: normalizeGrade(enrollment.grade),
          section: normalizeSection(enrollment.section),
          subjectId:
            getEnrollmentSubjectId(enrollment) || getSubjectId(selectedSubject),
          subjectName:
            getEnrollmentSubjectName(enrollment) || getSubjectName(selectedSubject),
          academicYear:
            getEnrollmentAcademicYear(enrollment) || currentAcademicYear,
          rawEnrollment: enrollment,
        }))
      );

      setFilteredRows(rows);

      if (rows.length === 0) {
        setMarksByStudent({});
        setRowsLoading(false);
        return;
      }

      const marksQuery = query(
        collection(db, "marks"),
        where("grade", "==", Number(selectedGrade)),
        where("section", "==", normalizeSection(selectedSection)),
        where("term", "==", activeTerm.term),
        where("year", "==", activeTerm.year)
      );

      const marksSnap = await getDocs(marksQuery);
      const selectedSubjectIdValue = getSubjectId(selectedSubject);
      const selectedSubjectNameValue = getSubjectName(selectedSubject);

      const relevantMarks = marksSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((mark) => {
          const sameStudent = rows.some((row) => row.studentId === mark.studentId);
          if (!sameStudent) return false;

          const markSubjectId = normalizeText(mark.subjectId);
          const markSubjectName = normalizeText(mark.subjectName || mark.subject);

          if (selectedSubjectIdValue && markSubjectId) {
            return markSubjectId === selectedSubjectIdValue;
          }

          return normalizeLower(markSubjectName) === normalizeLower(selectedSubjectNameValue);
        });

      const loadedMarks = {};
      rows.forEach((row) => {
        loadedMarks[row.studentId] = {
          mark: "",
          entryStatus: "Present",
          absentReason: "",
        };
      });

      relevantMarks.forEach((mark) => {
        loadedMarks[mark.studentId] = {
          mark:
            mark.mark !== undefined && mark.mark !== null ? String(mark.mark) : "",
          entryStatus: mark.isMedicalAbsent
            ? "Medical Absent"
            : mark.isAbsent
            ? "Absent"
            : "Present",
          absentReason: mark.absentReason || "",
        };
      });

      setMarksByStudent(loadedMarks);
    } catch (err) {
      setError("Failed to load enrollment rows and marks: " + err.message);
      setFilteredRows([]);
      setMarksByStudent({});
    } finally {
      setRowsLoading(false);
    }
  }, [
    selectedGrade,
    selectedSection,
    selectedSubject,
    activeTerm,
    allEnrollmentsForClass,
    currentAcademicYear,
  ]);

  useEffect(() => {
    loadRowsAndMarks();
  }, [loadRowsAndMarks]);

  const handleMarkChange = (studentId, value) => {
    if (value === "" || (Number(value) >= 0 && Number(value) <= 100)) {
      setMarksByStudent((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {
            mark: "",
            entryStatus: "Present",
            absentReason: "",
          }),
          mark: value,
        },
      }));
    }
  };

  const handleStatusChange = (studentId, entryStatus) => {
    setMarksByStudent((prev) => {
      const current = prev[studentId] || {
        mark: "",
        entryStatus: "Present",
        absentReason: "",
      };

      return {
        ...prev,
        [studentId]: {
          ...current,
          entryStatus,
          mark: entryStatus === "Present" ? current.mark : "",
          absentReason: entryStatus === "Present" ? "" : current.absentReason || "",
        },
      };
    });
  };

  const handleReasonChange = (studentId, absentReason) => {
    setMarksByStudent((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          mark: "",
          entryStatus: "Present",
          absentReason: "",
        }),
        absentReason,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedSubject) {
      setError("Please select a subject.");
      return;
    }

    if (!activeTerm) {
      setError("No active term. Please activate a term first.");
      return;
    }

    if (filteredRows.length === 0) {
      setError("No enrolled students found for this class and subject.");
      return;
    }

    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const batch = writeBatch(db);
      let recordsToSave = 0;

      filteredRows.forEach((row) => {
        const entry = marksByStudent[row.studentId] || {
          mark: "",
          entryStatus: "Present",
          absentReason: "",
        };

        const isAbsent = entry.entryStatus === "Absent";
        const isMedicalAbsent = entry.entryStatus === "Medical Absent";
        const hasNumericMark =
          entry.mark !== "" &&
          entry.mark !== undefined &&
          entry.mark !== null &&
          !Number.isNaN(Number(entry.mark));

        if (!hasNumericMark && !isAbsent && !isMedicalAbsent) {
          return;
        }

        const subjectId = row.subjectId || getSubjectId(selectedSubject);
        const subjectName = row.subjectName || getSubjectName(selectedSubject);

        const markId = buildMarkDocId({
          studentId: row.studentId,
          subjectId,
          subjectName,
          term: activeTerm.term,
          year: activeTerm.year,
        });

        const ref = doc(db, "marks", markId);

        batch.set(
          ref,
          {
            enrollmentId: row.enrollmentId,
            studentId: row.studentId,
            studentName: row.studentName,
            admissionNo: row.admissionNo || "",
            grade: Number(selectedGrade),
            section: normalizeSection(selectedSection),

            subjectId: subjectId || "",
            subjectName: subjectName || "",
            subject: subjectName || "",

            term: activeTerm.term,
            year: activeTerm.year,
            academicYear: row.academicYear || currentAcademicYear || "",

            mark: hasNumericMark ? Number(entry.mark) : null,
            isAbsent,
            isMedicalAbsent,
            absentReason:
              isAbsent || isMedicalAbsent ? normalizeText(entry.absentReason) : "",

            approvalStatus: "approved",
            updatedBy: profile?.name || profile?.displayName || "Unknown",
            updatedById: profile?.uid || "",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        recordsToSave++;
      });

      if (recordsToSave === 0) {
        setError("No marks or absence records to save.");
        setSaving(false);
        return;
      }

      await batch.commit();

      setSuccess(
        `Saved ${recordsToSave} mark record${
          recordsToSave !== 1 ? "s" : ""
        } for ${activeTerm.term} ${activeTerm.year}.`
      );
    } catch (err) {
      setError("Failed to save marks: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (baseLoading || assignmentsLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin && assignments.length === 0) {
    return (
      <Box mt={4}>
        <Alert severity="warning" icon={<WarningIcon />}>
          You have no subject assignments yet. Please contact the admin to assign
          you to a subject and class.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant={isMobile ? "h6" : "h5"}
        fontWeight={700}
        color="#1a237e"
        gutterBottom
      >
        Marks Entry
      </Typography>

      {activeTerm ? (
        <Card sx={{ mb: 2, bgcolor: "#e8f5e9", border: "2px solid #2e7d32" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <CheckCircleIcon sx={{ color: "#2e7d32" }} />
              <Typography variant="subtitle2" fontWeight={700} color="#2e7d32">
                Active: {activeTerm.term} {activeTerm.year}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeTerm.startDate} → {activeTerm.endDate}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
          No active term set. Please ask admin to activate a term before entering
          marks.
        </Alert>
      )}

      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Grade</InputLabel>
            <Select
              value={selectedGrade}
              label="Grade"
              onChange={(e) => {
                setSelectedGrade(Number(e.target.value));
                setSelectedSection("");
                setSelectedSubjectId("");
              }}
            >
              {gradeOptions.map((g) => (
                <MenuItem key={g} value={g}>
                  Grade {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small" disabled={!selectedGrade}>
            <InputLabel>Section</InputLabel>
            <Select
              value={selectedSection}
              label="Section"
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setSelectedSubjectId("");
              }}
            >
              {sectionOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl
            fullWidth
            size="small"
            disabled={!selectedGrade || !selectedSection || !activeTerm}
          >
            <InputLabel>Subject</InputLabel>
            <Select
              value={selectedSubjectId}
              label="Subject"
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              {subjectOptions.map((subject) => (
                <MenuItem key={getSubjectId(subject)} value={getSubjectId(subject)}>
                  {getSubjectName(subject)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Subjects available here are limited to your current assignments.
        </Alert>
      )}

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!activeTerm ? null : !selectedSubject ? (
        <Alert severity="info">
          Select grade, section, and subject to load enrolled students.
        </Alert>
      ) : rowsLoading ? (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
            flexWrap="wrap"
            gap={1}
          >
            <Typography variant="body2" color="text.secondary">
              {filteredRows.length} students — Grade {selectedGrade}-{selectedSection} |{" "}
              {getSubjectName(selectedSubject)} | {activeTerm.term} {activeTerm.year}
            </Typography>

            {!isMobile && (
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{ bgcolor: "#1a237e" }}
              >
                {saving ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Save All Marks"
                )}
              </Button>
            )}
          </Box>

          <Paper sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1a237e" }}>
                <TableRow>
                  {["#", "Admission No", "Name", "Entry Status", "Mark / Reason", "Grade"].map(
                    (header) => (
                      <TableCell
                        key={header}
                        sx={{
                          color: "white",
                          fontWeight: 600,
                          fontSize: { xs: 11, sm: 14 },
                          px: { xs: 1, sm: 2 },
                        }}
                      >
                        {header}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredRows.map((row, idx) => {
                  const entry = marksByStudent[row.studentId] || {
                    mark: "",
                    entryStatus: "Present",
                    absentReason: "",
                  };

                  const gradeInfo =
                    entry.entryStatus === "Present"
                      ? getGradeChip(entry.mark)
                      : null;

                  return (
                    <TableRow key={row.enrollmentId} hover>
                      <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                        {idx + 1}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                        {row.admissionNo || "—"}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                        {isMobile
                          ? normalizeText(row.studentName).split(" ")[0]
                          : row.studentName}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 0.5, sm: 2 }, minWidth: 170 }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={entry.entryStatus}
                            onChange={(e) =>
                              handleStatusChange(row.studentId, e.target.value)
                            }
                          >
                            {ENTRY_STATUSES.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>

                      <TableCell sx={{ px: { xs: 0.5, sm: 2 }, minWidth: 180 }}>
                        {entry.entryStatus === "Present" ? (
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, max: 100 }}
                            value={entry.mark ?? ""}
                            onChange={(e) =>
                              handleMarkChange(row.studentId, e.target.value)
                            }
                            sx={{ width: { xs: 90, sm: 120 } }}
                            placeholder="0–100"
                            disabled={!activeTerm}
                          />
                        ) : (
                          <TextField
                            size="small"
                            value={entry.absentReason || ""}
                            onChange={(e) =>
                              handleReasonChange(row.studentId, e.target.value)
                            }
                            sx={{ width: { xs: 120, sm: 180 } }}
                            placeholder={
                              entry.entryStatus === "Medical Absent"
                                ? "Medical reason"
                                : "Absent reason"
                            }
                          />
                        )}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 0.5, sm: 2 } }}>
                        {entry.entryStatus === "Present" ? (
                          gradeInfo ? (
                            <Chip
                              label={gradeInfo.label}
                              color={gradeInfo.color}
                              size="small"
                            />
                          ) : (
                            "—"
                          )
                        ) : (
                          <Chip
                            label={
                              entry.entryStatus === "Medical Absent" ? "MA" : "AB"
                            }
                            color="warning"
                            size="small"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No student subject enrollments found for{" "}
                      <strong>{getSubjectName(selectedSubject)}</strong> in Grade{" "}
                      {selectedGrade}-{selectedSection}. Run subject enrollment
                      generation first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            fullWidth
            sx={{ bgcolor: "#1a237e", mt: 2 }}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Save All Marks"
            )}
          </Button>
        </>
      )}
    </Box>
  );
}