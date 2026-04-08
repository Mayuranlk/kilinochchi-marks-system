import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { GRADES, RELIGIONS } from "../constants";
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
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import {
  EmptyState,
  MobileListRow,
  PageContainer,
  ResponsiveTableWrapper,
  StatCard,
  StatusChip,
} from "../components/ui";

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

function isALGrade(value) {
  return parseGrade(value) >= 12;
}

function isActiveStatus(value) {
  return normalizeLower(value || "active") === "active";
}

function getStudentName(student) {
  return normalizeText(student?.name || student?.fullName || "Unnamed Student");
}

function getStudentAdmissionNo(student) {
  return normalizeText(
    student?.admissionNo ||
      student?.admissionNumber ||
      student?.admNo ||
      student?.indexNumber ||
      student?.indexNo ||
      ""
  );
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className || "");
}

function getStudentGrade(student) {
  return parseGrade(student?.grade);
}

function getStudentStream(student) {
  return normalizeText(student?.stream || "");
}

function getStudentSubjectNumber(student) {
  return normalizeText(student?.subjectNumber || "");
}

function getStudentClassName(student) {
  const grade = getStudentGrade(student);
  const section = getStudentSection(student);
  return buildFullClassName(grade, section);
}

function getStudentALClassName(student) {
  return normalizeText(student?.fullClassName || student?.alClassName || "");
}

function getStudentDisplayClass(student) {
  const grade = getStudentGrade(student);

  if (isALGrade(grade)) {
    const fullClassName = getStudentALClassName(student);
    if (fullClassName) return fullClassName;

    const stream = getStudentStream(student);
    const section = getStudentSection(student);

    if (grade && stream && section) return `${grade} ${stream} ${section}`;
    if (grade && stream) return `${grade} ${stream}`;
  }

  return getStudentClassName(student);
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
  return parseGrade(
    enrollment?.grade ||
      enrollment?.fullClassName ||
      enrollment?.alClassName ||
      enrollment?.className
  );
}

function getEnrollmentSection(enrollment) {
  return normalizeSection(enrollment?.section || enrollment?.className || "");
}

function getEnrollmentStream(enrollment) {
  return normalizeText(enrollment?.stream || "");
}

function getEnrollmentDisplayClass(enrollment) {
  const grade = getEnrollmentGrade(enrollment);

  if (isALGrade(grade)) {
    const fullClassName = normalizeText(
      enrollment?.fullClassName || enrollment?.alClassName || ""
    );
    if (fullClassName) return fullClassName;

    const stream = getEnrollmentStream(enrollment);
    const section = getEnrollmentSection(enrollment);

    if (grade && stream && section) return `${grade} ${stream} ${section}`;
    if (grade && stream) return `${grade} ${stream}`;
  }

  return getEnrollmentClassName(enrollment);
}

function getEnrollmentSubjectName(enrollment) {
  return normalizeText(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentSubjectId(enrollment) {
  return normalizeText(enrollment?.subjectId || "");
}

function getEnrollmentSubjectNumber(enrollment) {
  return normalizeText(enrollment?.subjectNumber || enrollment?.subjectNo || "");
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

function getSubjectTypeBadge(subject, grade) {
  const normalizedSubject = normalizeText(subject);

  if (!normalizedSubject) {
    return { label: "Subject", color: "#2e7d32" };
  }

  if (isALGrade(grade)) {
    return { label: "A/L Subject", color: "#6a1b9a" };
  }

  const lower = normalizedSubject.toLowerCase();
  const religionSet = new Set(RELIGIONS.map((r) => normalizeLower(r)));

  if (religionSet.has(lower)) {
    return { label: "Religion", color: "#7b1fa2" };
  }

  const aestheticKeywords = [
    "art",
    "music",
    "dancing",
    "drama",
    "theatre",
    "literary texts",
  ];

  const basketKeywords = [
    "information & communication technology",
    "agriculture",
    "home economics",
    "health & physical education",
    "communication & media studies",
    "design & construction technology",
    "business & accounting studies",
    "geography",
    "civic education",
    "entrepreneurship studies",
  ];

  if (aestheticKeywords.some((keyword) => lower.includes(keyword))) {
    return { label: "Aesthetic", color: "#1565c0" };
  }

  if (grade >= 10 && grade <= 11 && basketKeywords.some((keyword) => lower.includes(keyword))) {
    return { label: "Basket", color: "#e65100" };
  }

  return { label: "Core", color: "#2e7d32" };
}

function buildSubjectOptionKey(subjectName, subjectNumber) {
  const name = normalizeText(subjectName);
  const number = normalizeText(subjectNumber);
  return number ? `${name}__${number}` : `${name}__`;
}

function parseSubjectOptionKey(key) {
  const [subjectName = "", subjectNumber = ""] = String(key || "").split("__");
  return {
    subjectName: normalizeText(subjectName),
    subjectNumber: normalizeText(subjectNumber),
  };
}

function buildSubjectDisplayName(subjectName, subjectNumber) {
  const name = normalizeText(subjectName);
  const number = normalizeText(subjectNumber);
  return number ? `${name} (${number})` : name;
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

  const loadBaseData = useCallback(async () => {
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
  }, [currentYear]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    setSubject("");
    setStudents([]);
    setSearch("");
  }, [grade, mode]);

  const studentsById = useMemo(() => {
    return new Map(
      allStudents.map((student) => [normalizeText(student.id), student])
    );
  }, [allStudents]);

  const availableSubjects = useMemo(() => {
    const selectedGrade = Number(grade);
    const map = new Map();

    allEnrollments
      .filter((enrollment) => getEnrollmentGrade(enrollment) === selectedGrade)
      .forEach((enrollment) => {
        const subjectName = getEnrollmentSubjectName(enrollment);
        const subjectNumber = isALGrade(selectedGrade)
          ? getEnrollmentSubjectNumber(enrollment)
          : "";
        const label = buildSubjectDisplayName(subjectName, subjectNumber);
        const key = buildSubjectOptionKey(subjectName, subjectNumber);

        if (!subjectName || !label) return;

        if (!map.has(key)) {
          map.set(key, { key, label });
        }
      });

    return [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
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

  const selectedSubjectParts = useMemo(
    () => parseSubjectOptionKey(subject),
    [subject]
  );

  const selectedSubjectName = selectedSubjectParts.subjectName;
  const selectedSubjectNumber = selectedSubjectParts.subjectNumber;

  const subjectTypeBadge = useMemo(
    () => getSubjectTypeBadge(selectedSubjectName, grade),
    [selectedSubjectName, grade]
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
        const sameSubject =
          getEnrollmentSubjectName(enrollment) === selectedSubjectName;
        const sameSubjectNumber = isALGrade(selectedGrade)
          ? getEnrollmentSubjectNumber(enrollment) === selectedSubjectNumber
          : true;
        const sameYear =
          !selectedYear ||
          !getEnrollmentAcademicYear(enrollment) ||
          getEnrollmentAcademicYear(enrollment) === selectedYear;

        return sameGrade && sameSubject && sameSubjectNumber && sameYear;
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
        .map((student) => {
          const matchingEnrollment = matchingEnrollments.find(
            (enrollment) =>
              normalizeText(enrollment.studentId) === normalizeText(student.id)
          );

          return {
            ...student,
            section: getStudentSection(student),
            grade: getStudentGrade(student),
            className: getStudentClassName(student),
            stream:
              getStudentStream(student) || getEnrollmentStream(matchingEnrollment),
            fullClassName:
              getStudentALClassName(student) ||
              normalizeText(
                matchingEnrollment?.fullClassName ||
                  matchingEnrollment?.alClassName ||
                  ""
              ),
            subjectNumber:
              getStudentSubjectNumber(student) ||
              getEnrollmentSubjectNumber(matchingEnrollment),
            displayClass:
              getEnrollmentDisplayClass(matchingEnrollment) ||
              getStudentDisplayClass(student),
          };
        })
        .sort((a, b) => {
          const classDiff = normalizeText(a.displayClass).localeCompare(
            normalizeText(b.displayClass),
            undefined,
            { numeric: true, sensitivity: "base" }
          );
          if (classDiff !== 0) return classDiff;

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
          matchingEnrollmentForSubject ||
          getMarkSubject(mark) === selectedSubjectName;

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
      const displayClass = normalizeLower(student.displayClass);
      const stream = normalizeLower(student.stream);

      return (
        name.includes(query) ||
        admissionNo.includes(query) ||
        displayClass.includes(query) ||
        stream.includes(query)
      );
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

  const passedCount =
    mode === "marks"
      ? students.filter((student) => (student.mark ?? -1) >= 35).length
      : 0;

  const failedCount =
    mode === "marks"
      ? students.filter((student) => (student.mark ?? 999) < 35).length
      : 0;

  const selectedSubjectLabel = buildSubjectDisplayName(
    selectedSubjectName,
    selectedSubjectNumber
  );

  return (
    <PageContainer
      title="Students by Subject"
      subtitle="View enrolled students or ranking by marks for a selected subject, term, and year."
      actions={
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/students")}
          size={isMobile ? "small" : "medium"}
          variant="outlined"
          fullWidth={isMobile}
          sx={{ color: "#1a237e", borderColor: "#1a237e" }}
        >
          Back
        </Button>
      }
    >

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
                    <MenuItem key={s.key} value={s.key}>
                      {s.label}
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
                {loading ? <CircularProgress size={20} color="inherit" /> : "Search"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {students.length > 0 && (
        <>
          {selectedSubjectName && (
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              mb={1.5}
              flexWrap="wrap"
              sx={{
                bgcolor: "white",
                borderRadius: 3,
                p: 1.5,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
              }}
            >
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
                {selectedSubjectLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Grade {grade}
              </Typography>
              {mode === "marks" ? (
                <Typography variant="caption" color="text.secondary">
                  {term} {year}
                </Typography>
              ) : null}
            </Box>
          )}

          {isMobile ? (
            <Box
              sx={{
                bgcolor: "white",
                borderRadius: 3,
                p: 1.5,
                mb: 2,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 800, color: "#1a237e", mb: 1 }}
              >
                Quick Summary
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <StatusChip status="active" label={`${students.length} students`} />
                {mode === "marks" && avgMark ? (
                  <StatusChip status="saved" label={`Avg ${avgMark}`} />
                ) : null}
                {mode === "marks" ? (
                  <StatusChip status="completed" label={`${passedCount} passed`} />
                ) : null}
                {mode === "marks" ? (
                  <StatusChip status="error" label={`${failedCount} failed`} />
                ) : null}
              </Box>
            </Box>
          ) : (
            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={12} sm={6} lg={mode === "marks" ? 3 : 4}>
                <StatCard
                  title="Total Students"
                  value={students.length}
                  icon={<PeopleIcon />}
                  color="primary"
                />
              </Grid>

              {mode === "marks" && avgMark ? (
                <Grid item xs={12} sm={6} lg={3}>
                  <StatCard
                    title="Class Average"
                    value={avgMark}
                    icon={<GradeIcon />}
                    color="success"
                  />
                </Grid>
              ) : null}

              {mode === "marks" ? (
                <Grid item xs={12} sm={6} lg={3}>
                  <StatCard
                    title="Passed"
                    value={passedCount}
                    icon={<GradeIcon />}
                    color="warning"
                  />
                </Grid>
              ) : null}

              {mode === "marks" ? (
                <Grid item xs={12} sm={6} lg={3}>
                  <StatCard
                    title="Failed"
                    value={failedCount}
                    icon={<GradeIcon />}
                    color="error"
                  />
                </Grid>
              ) : null}
            </Grid>
          )}

          <TextField
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            placeholder="Search student name, admission no, class, or stream..."
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

          {filtered.length === 0 ? (
            <EmptyState
              title="No students match your search"
              description="Try a different name, admission number, class, or stream."
            />
          ) : isMobile ? (
            <Stack spacing={1.25}>
              {filtered.map((student, idx) => {
                const gradeInfo = getGradeLabel(student.mark);
                const studentGrade = getStudentGrade(student);
                const alStudent = isALGrade(studentGrade);
                const markLabel = student.isMedicalAbsent
                  ? "Medical"
                  : student.isAbsent
                  ? "Absent"
                  : student.mark !== null
                  ? `${student.mark}/100`
                  : "No mark";

                return (
                  <MobileListRow
                    key={student.id}
                    compact
                    title={`${idx + 1}. ${getStudentName(student)}`}
                    subtitle={`Admission: ${getStudentAdmissionNo(student) || "-"}`}
                    right={
                      mode === "marks" ? (
                        <StatusChip
                          status={student.mark !== null ? "saved" : "pending"}
                          label={`Rank #${idx + 1}`}
                        />
                      ) : (
                        <StatusChip status="active" label="Assigned" />
                      )
                    }
                    meta={
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant="outlined"
                          color="primary"
                          label={
                            alStudent
                              ? student.displayClass || "-"
                              : `G${getStudentGrade(student)}-${getStudentSection(student)}`
                          }
                        />
                        {student.stream ? (
                          <Chip size="small" variant="outlined" label={student.stream} />
                        ) : null}
                        {alStudent && student.subjectNumber ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            color="secondary"
                            label={`No. ${student.subjectNumber}`}
                          />
                        ) : null}
                      </Stack>
                    }
                    footer={
                      <Stack spacing={1}>
                        {mode === "marks" ? (
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              bgcolor: "#f8f9ff",
                              border: "1px solid #e8eaf6",
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              spacing={1}
                            >
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Result
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {markLabel}
                                </Typography>
                              </Box>
                              {gradeInfo &&
                              !student.isAbsent &&
                              !student.isMedicalAbsent ? (
                                <Chip
                                  label={`Grade ${gradeInfo.label}`}
                                  size="small"
                                  color={gradeInfo.color}
                                />
                              ) : null}
                            </Stack>
                          </Box>
                        ) : null}
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth
                          startIcon={<AssessmentIcon />}
                          onClick={() => navigate(`/report/${student.id}`)}
                          sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                        >
                          View Report
                        </Button>
                      </Stack>
                    }
                  />
                );
              })}
            </Stack>
          ) : (
            <Paper
              sx={{
                borderRadius: 3,
                boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
                overflow: "hidden",
              }}
            >
              <ResponsiveTableWrapper minWidth={860}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#1a237e" }}>
                      {[
                        "#",
                        "Student",
                        "Class",
                        ...(mode === "marks" ? ["Marks", "Grade", "Rank"] : []),
                        "Action",
                      ].map((heading) => (
                        <TableCell
                          key={heading}
                          sx={{
                            color: "white",
                            fontWeight: 700,
                            fontSize: { xs: 11, sm: 13 },
                            whiteSpace: "nowrap",
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
                      const studentGrade = getStudentGrade(student);
                      const alStudent = isALGrade(studentGrade);

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
                              {getStudentName(student)}
                            </Typography>

                            <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.25}>
                              <Typography variant="caption" color="text.secondary">
                                {getStudentAdmissionNo(student) || "-"}
                              </Typography>

                              {alStudent && student.subjectNumber ? (
                                <Chip
                                  label={`No: ${student.subjectNumber}`}
                                  size="small"
                                  sx={{ height: 18, fontSize: 10 }}
                                  color="secondary"
                                  variant="outlined"
                                />
                              ) : null}
                            </Stack>
                          </TableCell>

                          <TableCell>
                            {alStudent ? (
                              <Stack spacing={0.5}>
                                <Chip
                                  label={student.displayClass || "-"}
                                  size="small"
                                  color="primary"
                                  sx={{ fontWeight: 700, fontSize: 11, maxWidth: 220 }}
                                />
                                {student.stream ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {student.stream}
                                  </Typography>
                                ) : null}
                              </Stack>
                            ) : (
                              <Chip
                                label={`G${getStudentGrade(student)}-${getStudentSection(student)}`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 700, fontSize: 11 }}
                              />
                            )}
                          </TableCell>

                          {mode === "marks" ? (
                            <>
                              <TableCell>
                                <Typography fontWeight={700}>
                                  {student.isMedicalAbsent
                                    ? "Medical"
                                    : student.isAbsent
                                    ? "Absent"
                                    : student.mark !== null
                                    ? `${student.mark}/100`
                                    : "-"}
                                </Typography>
                              </TableCell>

                              <TableCell>
                                {gradeInfo &&
                                !student.isAbsent &&
                                !student.isMedicalAbsent ? (
                                  <Chip
                                    label={gradeInfo.label}
                                    size="small"
                                    color={gradeInfo.color}
                                  />
                                ) : null}
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
                          ) : null}

                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AssessmentIcon />}
                              onClick={() => navigate(`/report/${student.id}`)}
                              sx={{
                                fontSize: 13,
                                px: 2,
                                borderColor: "#1a237e",
                                color: "#1a237e",
                              }}
                            >
                              Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTableWrapper>
            </Paper>
          )}
        </>
      )}

      {!loading && subject && students.length === 0 && (
        <EmptyState
          title="No students found"
          description={`No students were found for ${selectedSubjectLabel} in Grade ${grade}.`}
        />
      )}

      {!subject && !loading && (
        <EmptyState
          title="Select a grade and subject"
          description="Uses live student subject enrollments as the source of truth."
        />
      )}
    </PageContainer>
  );
}
