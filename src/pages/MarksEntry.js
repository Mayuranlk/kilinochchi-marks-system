import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  getDoc,
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

const normalizeGrade = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeSection = (value) => normalizeText(value);

const getAssignmentSubject = (assignment) =>
  normalizeText(assignment?.subject || assignment?.subjectName);

const getAcademicYearValue = (term) =>
  normalizeText(term?.year || term?.academicYear || "");

const isStudentActive = (student) => {
  const status = normalizeText(student?.status);
  return status === "" || status.toLowerCase() === "active";
};

const sortStudentsClientSide = (list) => {
  return [...list].sort((a, b) => {
    const gradeA = normalizeGrade(a.grade);
    const gradeB = normalizeGrade(b.grade);
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = normalizeSection(a.section).toUpperCase();
    const sectionB = normalizeSection(b.section).toUpperCase();
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const nameA = normalizeText(a.name).toLowerCase();
    const nameB = normalizeText(b.name).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return normalizeText(a.admissionNo)
      .toLowerCase()
      .localeCompare(normalizeText(b.admissionNo).toLowerCase());
  });
};

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

export default function MarksEntry() {
  const { profile, isAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [subjectEnrollments, setSubjectEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const [activeTerm, setActiveTerm] = useState(null);
  const [termLoading, setTermLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [initialDataLoading, setInitialDataLoading] = useState(true);

  const [filteredStudents, setFilteredStudents] = useState([]);
  const [marksByStudent, setMarksByStudent] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchActiveTerm();
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (profile || isAdmin) {
      fetchAssignments();
    }
  }, [profile, isAdmin]);

  const fetchActiveTerm = async () => {
    setTermLoading(true);
    try {
      const snap = await getDocs(collection(db, "academicTerms"));
      const active = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((t) => t.isActive === true);

      setActiveTerm(active || null);
    } catch (err) {
      setError("Failed to load active term: " + err.message);
    } finally {
      setTermLoading(false);
    }
  };

  const fetchInitialData = async () => {
    setInitialDataLoading(true);
    try {
      const [studentSnap, classroomSnap, enrollmentSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "studentSubjectEnrollments")),
      ]);

      const loadedStudents = studentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedClassrooms = classroomSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedEnrollments = enrollmentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setStudents(sortStudentsClientSide(loadedStudents));
      setClassrooms(loadedClassrooms);
      setSubjectEnrollments(loadedEnrollments);
    } catch (err) {
      setError("Failed to load marks entry data: " + err.message);
    } finally {
      setInitialDataLoading(false);
    }
  };

  const fetchAssignments = async () => {
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
        const firstSubject = getAssignmentSubject(first);

        setSelectedGrade(firstGrade || "");
        setSelectedSection(firstSection || "");
        setSelectedSubject(firstSubject || "");
      }
    } catch (err) {
      setError("Failed to load teacher assignments: " + err.message);
    } finally {
      setAssignmentsLoading(false);
    }
  };

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

  const currentAcademicYear = getAcademicYearValue(activeTerm);

  const matchingEnrollmentsForSelection = useMemo(() => {
    const grade = Number(selectedGrade);
    const section = normalizeSection(selectedSection);
    const subject = normalizeText(selectedSubject);

    if (!grade || !section) return [];

    const baseMatches = subjectEnrollments.filter((item) => {
      return (
        normalizeGrade(item.grade) === grade &&
        normalizeSection(item.section) === section &&
        (!subject || normalizeText(item.subjectName) === subject)
      );
    });

    if (!currentAcademicYear) {
      return baseMatches;
    }

    const sameYear = baseMatches.filter(
      (item) => normalizeText(item.academicYear) === currentAcademicYear
    );

    return sameYear.length > 0 ? sameYear : baseMatches;
  }, [subjectEnrollments, selectedGrade, selectedSection, selectedSubject, currentAcademicYear]);

  const adminSubjectOptions = useMemo(() => {
    const grade = Number(selectedGrade);
    const section = normalizeSection(selectedSection);

    if (!grade || !section) return [];

    const baseMatches = subjectEnrollments.filter((item) => {
      return (
        normalizeGrade(item.grade) === grade &&
        normalizeSection(item.section) === section
      );
    });

    const relevantMatches = currentAcademicYear
      ? (() => {
          const sameYear = baseMatches.filter(
            (item) => normalizeText(item.academicYear) === currentAcademicYear
          );
          return sameYear.length > 0 ? sameYear : baseMatches;
        })()
      : baseMatches;

    return [...new Set(relevantMatches.map((item) => normalizeText(item.subjectName)).filter(Boolean))].sort();
  }, [subjectEnrollments, selectedGrade, selectedSection, currentAcademicYear]);

  const teacherSubjectOptions = useMemo(() => {
    if (!selectedGrade || !selectedSection) return [];
    return [
      ...new Set(
        assignments
          .filter(
            (a) =>
              normalizeGrade(a.grade) === Number(selectedGrade) &&
              normalizeSection(a.section) === normalizeSection(selectedSection)
          )
          .map((a) => getAssignmentSubject(a))
          .filter(Boolean)
      ),
    ].sort();
  }, [assignments, selectedGrade, selectedSection]);

  const subjectOptions = isAdmin ? adminSubjectOptions : teacherSubjectOptions;

  useEffect(() => {
    if (
      selectedSection &&
      !sectionOptions.includes(normalizeSection(selectedSection))
    ) {
      setSelectedSection("");
    }
  }, [sectionOptions, selectedSection]);

  useEffect(() => {
    if (
      selectedSubject &&
      !subjectOptions.includes(normalizeText(selectedSubject))
    ) {
      setSelectedSubject("");
    }
  }, [subjectOptions, selectedSubject]);

  const fetchStudentsForSelection = useCallback(async () => {
    if (!selectedGrade || !selectedSection || !selectedSubject || !activeTerm) {
      setFilteredStudents([]);
      setMarksByStudent({});
      return;
    }

    setLoadingStudents(true);
    setSuccess("");
    setError("");

    try {
      const grade = Number(selectedGrade);
      const section = normalizeSection(selectedSection);
      const subject = normalizeText(selectedSubject);

      const eligibleStudentIds = new Set(
        matchingEnrollmentsForSelection.map((item) => item.studentId)
      );

      const selectedStudents = students
        .filter((student) => {
          return (
            normalizeGrade(student.grade) === grade &&
            normalizeSection(student.section) === section &&
            isStudentActive(student) &&
            eligibleStudentIds.has(student.id)
          );
        })
        .sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));

      setFilteredStudents(selectedStudents);

      const markReads = await Promise.all(
        selectedStudents.map(async (student) => {
          const markId = `${student.id}_${subject}_${activeTerm.term}_${activeTerm.year}`;
          const snap = await getDoc(doc(db, "marks", markId));
          return { student, snap, markId };
        })
      );

      const loadedMarks = {};
      markReads.forEach(({ student, snap }) => {
        if (snap.exists()) {
          const data = snap.data();
          loadedMarks[student.id] = {
            mark:
              data.mark !== undefined && data.mark !== null
                ? String(data.mark)
                : "",
            entryStatus: data.isMedicalAbsent
              ? "Medical Absent"
              : data.isAbsent
              ? "Absent"
              : "Present",
            absentReason: data.absentReason || "",
          };
        } else {
          loadedMarks[student.id] = {
            mark: "",
            entryStatus: "Present",
            absentReason: "",
          };
        }
      });

      setMarksByStudent(loadedMarks);
    } catch (err) {
      setError("Failed to load students and marks: " + err.message);
    } finally {
      setLoadingStudents(false);
    }
  }, [
    selectedGrade,
    selectedSection,
    selectedSubject,
    activeTerm,
    students,
    matchingEnrollmentsForSelection,
  ]);

  useEffect(() => {
    fetchStudentsForSelection();
  }, [fetchStudentsForSelection]);

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
          absentReason:
            entryStatus === "Present" ? "" : current.absentReason || "",
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

    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const batch = writeBatch(db);
      let recordsToSave = 0;

      filteredStudents.forEach((student) => {
        const entry = marksByStudent[student.id] || {
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

        const markId = `${student.id}_${normalizeText(selectedSubject)}_${activeTerm.term}_${activeTerm.year}`;
        const ref = doc(db, "marks", markId);

        batch.set(ref, {
          studentId: student.id,
          studentName: student.name || "",
          admissionNo: student.admissionNo || "",
          grade: Number(selectedGrade),
          section: normalizeSection(selectedSection),
          subject: normalizeText(selectedSubject),
          term: activeTerm.term,
          year: activeTerm.year,
          academicYear: currentAcademicYear,
          mark: hasNumericMark ? Number(entry.mark) : null,
          isAbsent,
          isMedicalAbsent,
          absentReason: isAbsent || isMedicalAbsent ? normalizeText(entry.absentReason) : "",
          approvalStatus: "approved",
          updatedBy: profile?.name || profile?.displayName || "Unknown",
          updatedById: profile?.uid || "",
          updatedAt: new Date().toISOString(),
        });

        recordsToSave++;
      });

      if (recordsToSave === 0) {
        setError("No marks or absence records to save.");
        setSaving(false);
        return;
      }

      await batch.commit();
      setSuccess(
        `Saved ${recordsToSave} mark record${recordsToSave !== 1 ? "s" : ""} for ${activeTerm.term} ${activeTerm.year}.`
      );
    } catch (err) {
      setError("Failed to save marks: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (termLoading || assignmentsLoading || initialDataLoading) {
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
          You have no subject assignments yet. Please contact the admin to
          assign you to a subject and class.
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
                setSelectedSubject("");
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
                setSelectedSubject("");
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
              value={selectedSubject}
              label="Subject"
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {subjectOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
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
          Select grade, section, and subject to load students.
        </Alert>
      ) : loadingStudents ? (
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
              {filteredStudents.length} students — Grade {selectedGrade}-{selectedSection} |{" "}
              {selectedSubject} | {activeTerm.term} {activeTerm.year}
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
                  {[
                    "#",
                    "Admission No",
                    "Name",
                    "Entry Status",
                    "Mark / Reason",
                    "Grade",
                  ].map((header) => (
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
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredStudents.map((student, idx) => {
                  const entry = marksByStudent[student.id] || {
                    mark: "",
                    entryStatus: "Present",
                    absentReason: "",
                  };

                  const gradeInfo =
                    entry.entryStatus === "Present"
                      ? getGradeChip(entry.mark)
                      : null;

                  return (
                    <TableRow key={student.id} hover>
                      <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                        {idx + 1}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                        {student.admissionNo || "—"}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                        {isMobile
                          ? normalizeText(student.name).split(" ")[0]
                          : student.name}
                      </TableCell>

                      <TableCell sx={{ px: { xs: 0.5, sm: 2 }, minWidth: 170 }}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={entry.entryStatus}
                            onChange={(e) =>
                              handleStatusChange(student.id, e.target.value)
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
                              handleMarkChange(student.id, e.target.value)
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
                              handleReasonChange(student.id, e.target.value)
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

                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No active students found with subject enrollment for{" "}
                      <strong>{selectedSubject}</strong> in Grade {selectedGrade}-
                      {selectedSection}.
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