/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADES } from "../constants";
import {
  Box,
  Typography,
  Button,
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
  Chip,
  CircularProgress,
  Grid,
  Alert,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

const STREAMS = ["Maths", "Bio", "Technology", "Arts", "Commerce"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function buildFullClassName(grade, section) {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : "";
}

function getStudentName(student) {
  return normalizeText(student?.name || student?.fullName || "Unnamed Student");
}

function getStudentAdmissionNo(student) {
  return normalizeText(
    student?.admissionNo || student?.admissionNumber || student?.admNo || ""
  );
}

function getStudentGrade(student) {
  return parseGrade(student?.grade);
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className || "");
}

function getStudentAcademicYear(student) {
  return String(student?.academicYear || student?.year || "");
}

function isStudentActive(student) {
  return normalizeLower(student?.status || "active") === "active";
}

function getEnrollmentAcademicYear(enrollment) {
  return String(enrollment?.academicYear || enrollment?.year || "");
}

function getEnrollmentClassName(enrollment) {
  const rawClassName = normalizeText(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();
  return buildFullClassName(enrollment?.grade, enrollment?.section || rawClassName);
}

function getEnrollmentGrade(enrollment) {
  return parseGrade(enrollment?.grade || enrollment?.className);
}

function getEnrollmentSection(enrollment) {
  return normalizeSection(enrollment?.section || enrollment?.className || "");
}

function getEnrollmentSubjectName(enrollment) {
  return normalizeText(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentSubjectId(enrollment) {
  return normalizeText(enrollment?.subjectId || "");
}

function isEnrollmentActive(enrollment) {
  return normalizeLower(enrollment?.status || "active") === "active";
}

function getNextGrade(grade) {
  if (grade >= 13) return null;
  return grade + 1;
}

function getTransitionType(fromGrade) {
  if (fromGrade === 9) return "critical";
  if (fromGrade === 11) return "al";
  if (fromGrade === 13) return "graduate";
  return "normal";
}

export default function YearEndPromotion() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const currentYear = new Date().getFullYear();

  const [fromYear, setFromYear] = useState(currentYear);
  const [toYear, setToYear] = useState(currentYear + 1);
  const [grade, setGrade] = useState(6);
  const [section, setSection] = useState("A");
  const [students, setStudents] = useState([]);
  const [allClassrooms, setAllClassrooms] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  const [studentStatus, setStudentStatus] = useState({});
  const [streams, setStreams] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const transitionType = getTransitionType(grade);
  const nextGrade = getNextGrade(grade);

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    try {
      const [classroomSnap, enrollmentSnap] = await Promise.all([
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "studentSubjectEnrollments")),
      ]);

      const classrooms = classroomSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const enrollments = enrollmentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setAllClassrooms(classrooms);
      setAllEnrollments(enrollments);
    } catch (err) {
      setError(`Failed to load promotion data: ${err.message}`);
    }
  };

  const availableYears = useMemo(() => {
    const studentYears = students
      .map((s) => Number(getStudentAcademicYear(s)))
      .filter((y) => Number.isFinite(y));

    const enrollmentYears = allEnrollments
      .map((e) => Number(getEnrollmentAcademicYear(e)))
      .filter((y) => Number.isFinite(y));

    const classYears = allClassrooms
      .map((c) => Number(c.year || c.academicYear))
      .filter((y) => Number.isFinite(y));

    return [...new Set([currentYear - 1, currentYear, currentYear + 1, ...studentYears, ...enrollmentYears, ...classYears])]
      .sort((a, b) => a - b);
  }, [students, allEnrollments, allClassrooms, currentYear]);

  const availableSections = useMemo(() => {
    const classroomSections = allClassrooms
      .filter((c) => parseGrade(c.grade) === Number(grade))
      .map((c) => normalizeSection(c.section || c.className))
      .filter(Boolean);

    const fallback = ["A", "B", "C", "D"];
    return [...new Set([...classroomSections, ...fallback])].sort((a, b) => a.localeCompare(b));
  }, [allClassrooms, grade]);

  const fetchStudents = async () => {
    if (!grade || !section) return;

    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const snap = await getDocs(collection(db, "students"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((student) => {
          const sameGrade = getStudentGrade(student) === Number(grade);
          const sameSection = getStudentSection(student) === normalizeSection(section);
          const sameYear =
            !getStudentAcademicYear(student) ||
            getStudentAcademicYear(student) === String(fromYear);

          return sameGrade && sameSection && sameYear && isStudentActive(student);
        })
        .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

      setStudents(list);

      const statusMap = {};
      list.forEach((student) => {
        statusMap[student.id] = "promote";
      });
      setStudentStatus(statusMap);

      const streamMap = {};
      list.forEach((student) => {
        streamMap[student.id] = normalizeText(student.stream);
      });
      setStreams(streamMap);

      setStep(1);
    } catch (err) {
      setError(`Failed to load students: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, status) => {
    setStudentStatus((prev) => ({ ...prev, [studentId]: status }));
  };

  const handlePromoteAll = async () => {
    if (transitionType === "al") {
      const promotingIds = Object.entries(studentStatus)
        .filter(([, status]) => status === "promote")
        .map(([id]) => id);

      const hasMissingStream = promotingIds.some((id) => !normalizeText(streams[id]));
      if (hasMissingStream) {
        setError("Please select A/L stream for all students being promoted.");
        return;
      }
    }

    setConfirmOpen(true);
  };

 const executePromotion = async () => {
  setConfirmOpen(false);
  setPromoting(true);
  setError("");
  setSuccess("");

  try {
    const batch = writeBatch(db);

    let promoted = 0;
    let detained = 0;
    let graduated = 0;

    for (const student of students) {
      const status = studentStatus[student.id];
      const studentRef = doc(db, "students", student.id);

      const currentGrade = getStudentGrade(student);
      const currentSection = getStudentSection(student);
      const nextGrade = getNextGrade(currentGrade);

      const currentEnrollments = allEnrollments.filter((e) => {
        return (
          normalizeText(e.studentId) === normalizeText(student.id) &&
          (!getEnrollmentAcademicYear(e) ||
            getEnrollmentAcademicYear(e) === String(fromYear)) &&
          isEnrollmentActive(e)
        );
      });

      // ✅ PROMOTE
      if (status === "promote" && transitionType !== "graduate") {
        batch.update(studentRef, {
          grade: nextGrade,
          section: currentSection,
          className: currentSection,
          academicYear: toYear,
          year: toYear,
          promotionStatus: "active",
          previousGrade: currentGrade,
          previousYear: fromYear,
          updatedAt: new Date().toISOString(),
          ...(transitionType === "al" && {
            stream: normalizeText(streams[student.id]),
          }),
        });

        // 🔥 DO NOT MODIFY SUBJECTS → mark old as completed
        currentEnrollments.forEach((enrollment) => {
          const ref = doc(db, "studentSubjectEnrollments", enrollment.id);

          batch.update(ref, {
            status: "completed",
            completedYear: toYear,
            updatedAt: new Date().toISOString(),
          });
        });

        promoted++;
      }

      // ✅ DETAIN
      else if (status === "detain") {
        batch.update(studentRef, {
          grade: currentGrade,
          section: currentSection,
          className: currentSection,
          academicYear: toYear,
          year: toYear,
          promotionStatus: "detained",
          previousYear: fromYear,
          updatedAt: new Date().toISOString(),
        });

        detained++;
      }

      // ✅ GRADUATE
      else if (status === "promote" && transitionType === "graduate") {
        batch.update(studentRef, {
          status: "completed",
          promotionStatus: "completed",
          academicYear: toYear,
          year: toYear,
          updatedAt: new Date().toISOString(),
        });

        currentEnrollments.forEach((enrollment) => {
          const ref = doc(db, "studentSubjectEnrollments", enrollment.id);

          batch.update(ref, {
            status: "completed",
            updatedAt: new Date().toISOString(),
          });
        });

        graduated++;
      }
    }

    await batch.commit();

    setSuccess(
      `✅ Promotion complete! ${promoted} promoted` +
        `${detained ? `, ${detained} detained` : ""}` +
        `${graduated ? `, ${graduated} graduated` : ""}`
    );

    setStep(2);
    setStudents([]);

  } catch (err) {
    setError(`Promotion failed: ${err.message}`);
  } finally {
    setPromoting(false);
  }
};

  const promotingCount = Object.values(studentStatus).filter((status) => status === "promote").length;
  const detainedCount = Object.values(studentStatus).filter((status) => status === "detain").length;

  return (
    <Box>
      <Typography
        variant={isMobile ? "h6" : "h5"}
        fontWeight={700}
        color="#1a237e"
        gutterBottom
      >
        Year End Promotion
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Promote students to the next grade and carry forward their enrollment year safely.
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 3 }} orientation={isMobile ? "vertical" : "horizontal"}>
        {["Select Class", "Review Students", "Done"].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {step === 0 && (
        <Card sx={{ maxWidth: 560 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              Select Class to Promote
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>From Year</InputLabel>
                  <Select
                    value={fromYear}
                    label="From Year"
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFromYear(value);
                      setToYear(value + 1);
                    }}
                  >
                    {availableYears.map((y) => (
                      <MenuItem key={y} value={y}>
                        {y}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>To Year</InputLabel>
                  <Select value={toYear} label="To Year" disabled>
                    <MenuItem value={toYear}>{toYear}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Grade</InputLabel>
                  <Select
                    value={grade}
                    label="Grade"
                    onChange={(e) => setGrade(Number(e.target.value))}
                  >
                    {GRADES.map((g) => (
                      <MenuItem key={g} value={g}>
                        Grade {g}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={section}
                    label="Section"
                    onChange={(e) => setSection(e.target.value)}
                  >
                    {availableSections.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                {transitionType === "normal" && (
                  <Alert severity="info" icon={<ArrowForwardIcon />}>
                    Grade {grade} → Grade {nextGrade}
                  </Alert>
                )}

                {transitionType === "critical" && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    Grade 9 → Grade 10. Review optional subject enrollments after promotion.
                  </Alert>
                )}

                {transitionType === "al" && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    Grade 11 → Grade 12. Select an A/L stream for each promoted student.
                  </Alert>
                )}

                {transitionType === "graduate" && (
                  <Alert severity="success" icon={<EmojiEventsIcon />}>
                    Grade 13 students will be marked as completed.
                  </Alert>
                )}
              </Grid>
            </Grid>
          </CardContent>

          <Box px={2} pb={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={fetchStudents}
              disabled={loading}
              sx={{ bgcolor: "#1a237e" }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "Load Students →"}
            </Button>
          </Box>
        </Card>
      )}

      {step === 1 && students.length > 0 && (
        <Box>
          <Card sx={{ mb: 2, bgcolor: "#e8eaf6" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                <Typography variant="body2" fontWeight={600}>
                  Grade {grade}-{section} → Grade {transitionType === "graduate" ? "🎓" : nextGrade}-{section}
                </Typography>

                <Chip label={`${promotingCount} Promoting`} color="success" size="small" />

                {detainedCount > 0 && (
                  <Chip label={`${detainedCount} Detained`} color="error" size="small" />
                )}

                {transitionType === "critical" && (
                  <Chip label="Review Enrollments After Move" color="warning" size="small" />
                )}

                {transitionType === "al" && (
                  <Chip label="A/L Stream Required" color="warning" size="small" />
                )}
              </Box>
            </CardContent>
          </Card>

          {transitionType === "al" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Select A/L stream for each student below before promotion.
            </Alert>
          )}

          {transitionType === "critical" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Grade 9 → 10 and similar subject-structure changes should be reviewed with enrollment tools after promotion.
            </Alert>
          )}

          {isMobile ? (
            <Box>
              {students.map((student) => (
                <Card
                  key={student.id}
                  sx={{
                    mb: 1.5,
                    boxShadow: 2,
                    border:
                      studentStatus[student.id] === "detain"
                        ? "2px solid #c62828"
                        : "1px solid #e0e0e0",
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {getStudentName(student)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adm: {getStudentAdmissionNo(student) || "—"}
                        </Typography>
                      </Box>

                      <FormControl size="small" sx={{ minWidth: 110 }}>
                        <Select
                          value={studentStatus[student.id] || "promote"}
                          onChange={(e) => handleStatusChange(student.id, e.target.value)}
                        >
                          <MenuItem value="promote">Promote</MenuItem>
                          <MenuItem value="detain">Detain</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    {transitionType === "al" && studentStatus[student.id] === "promote" && (
                      <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>A/L Stream *</InputLabel>
                        <Select
                          value={streams[student.id] || ""}
                          label="A/L Stream *"
                          onChange={(e) =>
                            setStreams((prev) => ({ ...prev, [student.id]: e.target.value }))
                          }
                        >
                          {STREAMS.map((stream) => (
                            <MenuItem key={stream} value={stream}>
                              {stream}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Paper sx={{ overflowX: "auto", mb: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["#", "Admission No", "Name", transitionType === "al" ? "A/L Stream" : "Current Grade", "Status"].map(
                      (head) => (
                        <TableCell key={head} sx={{ color: "white", fontWeight: 600 }}>
                          {head}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {students.map((student, idx) => (
                    <TableRow
                      key={student.id}
                      hover
                      sx={{
                        bgcolor: studentStatus[student.id] === "detain" ? "#ffebee" : "inherit",
                      }}
                    >
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{getStudentAdmissionNo(student) || "—"}</TableCell>
                      <TableCell fontWeight={600}>{getStudentName(student)}</TableCell>

                      <TableCell>
                        {transitionType === "al" && studentStatus[student.id] === "promote" ? (
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Stream *</InputLabel>
                            <Select
                              value={streams[student.id] || ""}
                              label="Stream *"
                              onChange={(e) =>
                                setStreams((prev) => ({ ...prev, [student.id]: e.target.value }))
                              }
                            >
                              {STREAMS.map((stream) => (
                                <MenuItem key={stream} value={stream}>
                                  {stream}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip label={`Grade ${getStudentGrade(student)}`} size="small" color="primary" />
                        )}
                      </TableCell>

                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={studentStatus[student.id] || "promote"}
                            onChange={(e) => handleStatusChange(student.id, e.target.value)}
                          >
                            <MenuItem value="promote">✅ Promote</MenuItem>
                            <MenuItem value="detain">⚠️ Detain</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Grid container spacing={2} mt={1}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setStep(0);
                  setStudents([]);
                }}
              >
                ← Back
              </Button>
            </Grid>

            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                onClick={handlePromoteAll}
                disabled={promoting}
                sx={{ bgcolor: "#1a237e" }}
              >
                {promoting ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  `Promote ${promotingCount} Students →`
                )}
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}

      {step === 1 && students.length === 0 && !loading && (
        <Box textAlign="center" py={4}>
          <SchoolIcon sx={{ fontSize: 48, color: "text.secondary" }} />
          <Typography color="text.secondary" mt={1}>
            No students found for Grade {grade}-{section} in {fromYear}.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setStep(0)}>
            ← Go Back
          </Button>
        </Box>
      )}

      {step === 2 && (
        <Box textAlign="center" py={4}>
          <EmojiEventsIcon sx={{ fontSize: 64, color: "#ffd54f" }} />
          <Typography variant="h6" fontWeight={700} mt={1} color="#1a237e">
            Promotion Complete! 🎉
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Students have been moved to {toYear}.
          </Typography>
          <Button
            variant="contained"
            sx={{ bgcolor: "#1a237e", mt: 3 }}
            onClick={() => {
              setStep(0);
              setSuccess("");
            }}
          >
            Promote Another Class
          </Button>
        </Box>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        fullScreen={isMobile}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Promotion</DialogTitle>
        <DialogContent>
          <Typography variant="body1" mb={1}>
            Are you sure you want to promote students?
          </Typography>

          <Box display="flex" flexDirection="column" gap={1}>
            <Chip
              icon={<ArrowForwardIcon />}
              label={`Grade ${grade}-${section} (${fromYear}) → Grade ${nextGrade || "🎓"}-${section} (${toYear})`}
              color="primary"
            />

            <Chip
              icon={<CheckCircleIcon />}
              label={`${promotingCount} students will be promoted`}
              color="success"
            />

            {detainedCount > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${detainedCount} students will be detained`}
                color="error"
              />
            )}

            {transitionType === "critical" && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Review subject enrollments after promotion for changed grade structures.
              </Alert>
            )}

            {transitionType === "al" && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Students will be assigned their selected A/L streams on the student record.
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            onClick={executePromotion}
            variant="contained"
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}
          >
            Yes, Promote Now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}