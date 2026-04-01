import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  AESTHETIC_SUBJECTS,
  BASKET_A,
  BASKET_B,
  BASKET_C,
  GRADES,
  RELIGIONS,
  SUBJECTS_BY_GRADE,
} from "../constants";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
  Grid,
  Alert,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  useMediaQuery,
  useTheme,
  Avatar,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import MenuBookIcon from "@mui/icons-material/MenuBook";

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

function isActiveStatus(value) {
  return normalizeLower(value || "active") === "active";
}

function getStudentName(student) {
  return normalizeText(student?.name || student?.fullName || "Unnamed Student");
}

function getStudentAdmissionNo(student) {
  return normalizeText(
    student?.admissionNo || student?.admissionNumber || student?.admNo || ""
  );
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className || "");
}

function getStudentGrade(student) {
  return parseGrade(student?.grade);
}

function getStudentClassName(student) {
  const grade = getStudentGrade(student);
  const section = getStudentSection(student);
  return buildFullClassName(grade, section);
}

function getEnrollmentClassName(enrollment) {
  const rawClassName = normalizeText(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();

  return buildFullClassName(
    enrollment?.grade,
    enrollment?.section || rawClassName
  );
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

function getEnrollmentAcademicYear(enrollment) {
  return String(enrollment?.academicYear || enrollment?.year || "");
}

function isEnrollmentActive(enrollment) {
  return isActiveStatus(enrollment?.status);
}

function getMarkSubject(mark) {
  return normalizeText(mark?.subjectName || mark?.subject || "");
}

function getMarkSubjectId(mark) {
  return normalizeText(mark?.subjectId || "");
}

function getMarkTerm(mark) {
  return normalizeText(mark?.term || mark?.termName || mark?.termLabel || "");
}

function getMarkYear(mark) {
  return String(mark?.academicYear || mark?.year || "");
}

function getMarkClassName(mark) {
  const rawClassName = normalizeText(mark?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();

  return buildFullClassName(mark?.grade, mark?.section || rawClassName);
}

function getMarkValue(mark) {
  const raw = mark?.mark ?? mark?.marks ?? mark?.score ?? null;
  if (raw === null || raw === undefined || raw === "") return null;

  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function isAbsentMark(mark) {
  return (
    mark?.isAbsent === true ||
    normalizeLower(mark?.attendanceStatus) === "absent" ||
    normalizeLower(mark?.status) === "absent" ||
    mark?.absent === true
  );
}

function isMedicalAbsentMark(mark) {
  return (
    mark?.isMedicalAbsent === true ||
    normalizeLower(mark?.attendanceStatus) === "medical_absent" ||
    normalizeLower(mark?.attendanceStatus) === "medical absent"
  );
}

function hasMarkEntry(mark) {
  return (
    getMarkValue(mark) !== null ||
    isAbsentMark(mark) ||
    isMedicalAbsentMark(mark)
  );
}

function getGradeLabel(mark) {
  if (mark === null || mark === undefined) return null;
  if (mark >= 75) return { label: "A", color: "success" };
  if (mark >= 65) return { label: "B", color: "primary" };
  if (mark >= 55) return { label: "C", color: "warning" };
  if (mark >= 35) return { label: "S", color: "default" };
  return { label: "F", color: "error" };
}

function getBasketSubjects() {
  return [...BASKET_A, ...BASKET_B, ...BASKET_C];
}

function getSubjectTypeBadge(subject, grade) {
  const normalizedSubject = normalizeText(subject);

  const isReligion = RELIGIONS.includes(normalizedSubject);
  const isAesthetic = AESTHETIC_SUBJECTS.includes(normalizedSubject);
  const isBasket =
    grade >= 10 &&
    grade <= 11 &&
    getBasketSubjects().includes(normalizedSubject);

  if (isReligion) return { label: "Religion", color: "#7b1fa2" };
  if (isAesthetic) return { label: "Aesthetic", color: "#1565c0" };
  if (isBasket) return { label: "Basket", color: "#e65100" };
  return { label: "Core", color: "#2e7d32" };
}

function getInitials(name = "") {
  return normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export default function StudentsBySubject() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const currentYear = new Date().getFullYear();

  const [mode, setMode] = useState("assigned");
  const [grade, setGrade] = useState(6);
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [year, setYear] = useState(currentYear);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [allStudents, setAllStudents] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [allMarks, setAllMarks] = useState([]);
  const [allTerms, setAllTerms] = useState([]);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    setSubject("");
    setStudents([]);
    setSearch("");
  }, [grade, mode]);

  const loadBaseData = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [studentSnap, enrollmentSnap, marksSnap, termSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "marks")),
        getDocs(collection(db, "academicTerms")),
      ]);

      const studentsData = studentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((student) => isActiveStatus(student?.status || "active"));

      const enrollmentsData = enrollmentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((enrollment) => isEnrollmentActive(enrollment));

      const marksData = marksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const termsData = termSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setAllStudents(studentsData);
      setAllEnrollments(enrollmentsData);
      setAllMarks(marksData);
      setAllTerms(termsData);

      const activeTerm = termsData.find((t) => t.isActive === true);
      if (activeTerm) {
        setTerm(normalizeText(activeTerm.term) || "Term 1");
        setYear(Number(activeTerm.year) || currentYear);
      }
    } catch (error) {
      console.error("StudentsBySubject load error:", error);
      setLoadError("Failed to load students, enrollments, or marks.");
    } finally {
      setLoading(false);
    }
  };

  const studentsById = useMemo(() => {
    return new Map(
      allStudents.map((student) => [normalizeText(student.id), student])
    );
  }, [allStudents]);

  const availableSubjects = useMemo(() => {
    const enrollmentSubjects = allEnrollments
      .filter((enrollment) => getEnrollmentGrade(enrollment) === Number(grade))
      .map((enrollment) => getEnrollmentSubjectName(enrollment));

    const fallbackSubjects = SUBJECTS_BY_GRADE[grade] || [];

    return uniqueSorted([...enrollmentSubjects, ...fallbackSubjects]);
  }, [allEnrollments, grade]);

  const availableYears = useMemo(() => {
    const termYears = allTerms
      .map((t) => Number(t.year))
      .filter((y) => Number.isFinite(y));

    const enrollmentYears = allEnrollments
      .map((e) => Number(getEnrollmentAcademicYear(e)))
      .filter((y) => Number.isFinite(y));

    const markYears = allMarks
      .map((m) => Number(getMarkYear(m)))
      .filter((y) => Number.isFinite(y));

    const merged = [
      ...new Set([currentYear, ...termYears, ...enrollmentYears, ...markYears]),
    ];

    return merged.sort((a, b) => b - a);
  }, [allTerms, allEnrollments, allMarks, currentYear]);

  const subjectTypeBadge = useMemo(
    () => getSubjectTypeBadge(subject, grade),
    [subject, grade]
  );

  const handleSearch = async () => {
    if (!subject) return;

    setLoading(true);
    setStudents([]);
    setLoadError("");

    try {
      const selectedGrade = Number(grade);
      const selectedYear = String(year);
      const selectedTerm = normalizeText(term);

      const matchingEnrollments = allEnrollments.filter((enrollment) => {
        const sameGrade = getEnrollmentGrade(enrollment) === selectedGrade;
        const sameSubject = getEnrollmentSubjectName(enrollment) === subject;
        const sameYear =
          !selectedYear ||
          !getEnrollmentAcademicYear(enrollment) ||
          getEnrollmentAcademicYear(enrollment) === selectedYear;

        return sameGrade && sameSubject && sameYear;
      });

      const eligibleStudentIds = [
        ...new Set(
          matchingEnrollments
            .map((enrollment) => normalizeText(enrollment.studentId))
            .filter(Boolean)
        ),
      ];

      const eligibleStudents = eligibleStudentIds
        .map((studentId) => studentsById.get(studentId))
        .filter(Boolean)
        .map((student) => ({
          ...student,
          section: getStudentSection(student),
          grade: getStudentGrade(student),
          className: getStudentClassName(student),
        }))
        .sort((a, b) => {
          const sectionDiff = getStudentSection(a).localeCompare(
            getStudentSection(b)
          );
          if (sectionDiff !== 0) return sectionDiff;
          return getStudentName(a).localeCompare(getStudentName(b));
        });

      if (mode === "assigned") {
        setStudents(
          eligibleStudents.map((student) => ({
            ...student,
            mark: null,
            hasMarks: false,
            isAbsent: false,
            isMedicalAbsent: false,
          }))
        );
        return;
      }

      const relevantMarks = allMarks.filter((mark) => {
        const sameTerm = getMarkTerm(mark) === selectedTerm;
        const sameYear = getMarkYear(mark) === selectedYear;
        const markStudentId = normalizeText(mark.studentId);
        const inEligibleSet = eligibleStudentIds.includes(markStudentId);

        const matchingEnrollmentForSubject = matchingEnrollments.some(
          (enrollment) =>
            getEnrollmentSubjectId(enrollment) &&
            getMarkSubjectId(mark) &&
            getEnrollmentSubjectId(enrollment) === getMarkSubjectId(mark)
        );

        const sameSubject =
          matchingEnrollmentForSubject || getMarkSubject(mark) === subject;

        return sameTerm && sameYear && sameSubject && inEligibleSet && hasMarkEntry(mark);
      });

      const bestMarkByStudentId = new Map();

      relevantMarks.forEach((mark) => {
        const studentId = normalizeText(mark.studentId);
        if (!studentId) return;

        const current = bestMarkByStudentId.get(studentId);
        const currentValue = current ? getMarkValue(current) : null;
        const nextValue = getMarkValue(mark);

        if (!current) {
          bestMarkByStudentId.set(studentId, mark);
          return;
        }

        if (currentValue === null && nextValue !== null) {
          bestMarkByStudentId.set(studentId, mark);
          return;
        }

        if (currentValue !== null && nextValue !== null && nextValue > currentValue) {
          bestMarkByStudentId.set(studentId, mark);
          return;
        }

        if (currentValue === null && nextValue === null) {
          if (!isAbsentMark(current) && isAbsentMark(mark)) {
            bestMarkByStudentId.set(studentId, mark);
          }
        }
      });

      const result = eligibleStudents
        .map((student) => {
          const matchedMark = bestMarkByStudentId.get(normalizeText(student.id));
          if (!matchedMark) return null;

          return {
            ...student,
            mark: getMarkValue(matchedMark),
            hasMarks: true,
            isAbsent: isAbsentMark(matchedMark),
            isMedicalAbsent: isMedicalAbsentMark(matchedMark),
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aValue = a.mark ?? -1;
          const bValue = b.mark ?? -1;
          if (bValue !== aValue) return bValue - aValue;
          return getStudentName(a).localeCompare(getStudentName(b));
        });

      setStudents(result);
    } catch (error) {
      console.error("StudentsBySubject search error:", error);
      setLoadError("Failed to build subject-wise student list.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const query = normalizeLower(search);
    if (!query) return students;

    return students.filter((student) => {
      const name = normalizeLower(getStudentName(student));
      const admissionNo = normalizeLower(getStudentAdmissionNo(student));
      return name.includes(query) || admissionNo.includes(query);
    });
  }, [students, search]);

  const marksOnly = students.filter((student) => student.mark !== null);

  const avgMark =
    mode === "marks" && marksOnly.length > 0
      ? (
          marksOnly.reduce((sum, student) => sum + (student.mark || 0), 0) /
          marksOnly.length
        ).toFixed(1)
      : null;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 2,
          bgcolor: "white",
          borderRadius: 3,
          p: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
          border: "1px solid #e8eaf6",
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/students")}
          size="small"
          variant="outlined"
          sx={{ color: "#1a237e", borderColor: "#1a237e" }}
        >
          Back
        </Button>

        <MenuBookIcon sx={{ color: "#1a237e", ml: 1 }} />
        <Typography
          variant={isMobile ? "h6" : "h5"}
          fontWeight={800}
          color="#1a237e"
        >
          Students by Subject
        </Typography>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {loadError}
        </Alert>
      )}

      <Box
        mb={2}
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          p: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
          border: "1px solid #e8eaf6",
        }}
      >
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(event, value) => {
            if (value) {
              setMode(value);
              setStudents([]);
            }
          }}
          size="small"
          fullWidth
        >
          <ToggleButton
            value="assigned"
            sx={{
              fontWeight: 600,
              "&.Mui-selected": {
                bgcolor: "#1a237e",
                color: "white",
                "&:hover": { bgcolor: "#283593" },
              },
            }}
          >
            <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
            Assigned Students
          </ToggleButton>

          <ToggleButton
            value="marks"
            sx={{
              fontWeight: 600,
              "&.Mui-selected": {
                bgcolor: "#1a237e",
                color: "white",
                "&:hover": { bgcolor: "#283593" },
              },
            }}
          >
            <GradeIcon sx={{ mr: 1, fontSize: 18 }} />
            By Marks
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography
          variant="caption"
          color="text.secondary"
          mt={0.5}
          display="block"
        >
          {mode === "assigned"
            ? "Enrollment-driven subject list for the selected grade"
            : "Students with marks for the selected subject, term, and year"}
        </Typography>
      </Box>

      <Card
        sx={{
          mb: 2,
          bgcolor: "#f8f9ff",
          border: "1px solid #e8eaf6",
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ pb: "16px !important" }}>
          <Grid container spacing={1.5} alignItems="flex-end">
            <Grid item xs={6} sm={mode === "marks" ? 2 : 3}>
              <FormControl fullWidth size="small">
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

            <Grid item xs={6} sm={mode === "marks" ? 3 : 5}>
              <FormControl fullWidth size="small">
                <InputLabel>Subject</InputLabel>
                <Select
                  value={subject}
                  label="Subject"
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <MenuItem value="">Select subject...</MenuItem>
                  {availableSubjects.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {mode === "marks" && (
              <>
                <Grid item xs={6} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Term</InputLabel>
                    <Select
                      value={term}
                      label="Term"
                      onChange={(e) => setTerm(e.target.value)}
                    >
                      {["Term 1", "Term 2", "Term 3"].map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={year}
                      label="Year"
                      onChange={(e) => setYear(Number(e.target.value))}
                    >
                      {availableYears.map((y) => (
                        <MenuItem key={y} value={y}>
                          {y}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            <Grid item xs={12} sm={mode === "marks" ? 3 : 4}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSearch}
                disabled={!subject || loading}
                sx={{
                  bgcolor: "#1a237e",
                  height: 40,
                  fontWeight: 700,
                  borderRadius: 2,
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : "Search →"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {students.length > 0 && (
        <>
          {subject && (
            <Box display="flex" alignItems="center" gap={1} mb={1.5} flexWrap="wrap">
              <Chip
                label={subjectTypeBadge.label}
                size="small"
                sx={{
                  bgcolor: subjectTypeBadge.color,
                  color: "white",
                  fontWeight: 700,
                }}
              />
              <Typography variant="body2" fontWeight={700} color="#1a237e">
                {subject}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                — Grade {grade}
              </Typography>
            </Box>
          )}

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: "#e8eaf6", textAlign: "center", borderRadius: 3 }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="h4" fontWeight={700} color="#1a237e">
                    {students.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Students
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {mode === "marks" && avgMark && (
              <>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: "#e8f5e9", textAlign: "center", borderRadius: 3 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h4" fontWeight={700} color="#2e7d32">
                        {avgMark}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Class Average
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: "#fff3e0", textAlign: "center", borderRadius: 3 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h4" fontWeight={700} color="#e65100">
                        {students.filter((s) => (s.mark ?? -1) >= 35).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Passed
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: "#ffebee", textAlign: "center", borderRadius: 3 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h4" fontWeight={700} color="#c62828">
                        {students.filter((s) => (s.mark ?? 999) < 35).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Failed
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          <TextField
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            placeholder="Search student name or admission no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              sx: { borderRadius: 2 },
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "#1a237e" }} />
                </InputAdornment>
              ),
            }}
          />

          <Paper
            sx={{
              overflowX: "auto",
              borderRadius: 3,
              boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#1a237e" }}>
                  {[
                    "#",
                    "Student",
                    "Grade",
                    ...(mode === "marks" ? ["Marks", "Grade", "Rank"] : []),
                    "Action",
                  ].map((heading) => (
                    <TableCell
                      key={heading}
                      sx={{
                        color: "white",
                        fontWeight: 700,
                        fontSize: { xs: 11, sm: 13 },
                      }}
                    >
                      {heading}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {filtered.map((student, idx) => {
                  const gradeInfo = getGradeLabel(student.mark);

                  return (
                    <TableRow
                      key={student.id}
                      hover
                      sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                    >
                      <TableCell sx={{ fontSize: { xs: 12, sm: 14 } }}>
                        {mode === "marks" ? (
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              fontSize: 12,
                              bgcolor:
                                idx === 0
                                  ? "#ffd700"
                                  : idx === 1
                                  ? "#c0c0c0"
                                  : idx === 2
                                  ? "#cd7f32"
                                  : "#e8eaf6",
                              color: idx < 3 ? "#000" : "#1a237e",
                            }}
                          >
                            {idx + 1}
                          </Avatar>
                        ) : (
                          idx + 1
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {isMobile
                            ? getStudentName(student).split(" ")[0]
                            : getStudentName(student)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getStudentAdmissionNo(student) || "—"}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={`G${getStudentGrade(student)}-${getStudentSection(student)}`}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700, fontSize: 11 }}
                        />
                      </TableCell>

                      {mode === "marks" && (
                        <>
                          <TableCell>
                            <Typography fontWeight={700}>
                              {student.isMedicalAbsent
                                ? "Medical"
                                : student.isAbsent
                                ? "Absent"
                                : student.mark !== null
                                ? `${student.mark}/100`
                                : "—"}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            {gradeInfo && !student.isAbsent && !student.isMedicalAbsent && (
                              <Chip
                                label={gradeInfo.label}
                                size="small"
                                color={gradeInfo.color}
                              />
                            )}
                          </TableCell>

                          <TableCell>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              color={idx === 0 ? "#f57f17" : "text.primary"}
                            >
                              #{idx + 1}
                            </Typography>
                          </TableCell>
                        </>
                      )}

                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={!isMobile && <AssessmentIcon />}
                          onClick={() => navigate(`/report/${student.id}`)}
                          sx={{
                            fontSize: { xs: 10, sm: 13 },
                            minWidth: 0,
                            px: { xs: 1, sm: 2 },
                            borderColor: "#1a237e",
                            color: "#1a237e",
                          }}
                        >
                          {isMobile ? "📊" : "Report"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={mode === "marks" ? 6 : 4} align="center">
                      No students match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {!loading && subject && students.length === 0 && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: 3 }}>
          No students found for <strong>{subject}</strong> in Grade {grade}.
        </Alert>
      )}

      {!subject && !loading && (
        <Box textAlign="center" py={6}>
          <GradeIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography color="text.secondary" mt={1} variant="h6" fontWeight={600}>
            Select a grade and subject to view students
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Uses live student subject enrollments as the source of truth
          </Typography>
        </Box>
      )}
    </Box>
  );
}