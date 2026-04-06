import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { SCHOOL_NAME, SCHOOL_SUBTITLE } from "../constants";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = text(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function buildFullClassName(grade, section) {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : "";
}

function normalizeSubjectName(value) {
  return text(value)
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/&/g, "and")
    .replace(/,/g, "")
    .trim()
    .toLowerCase();
}

function getStudentName(student) {
  return text(student?.fullName || student?.name || "Unnamed Student");
}

function getStudentAdmissionNo(student) {
  return text(student?.admissionNo || student?.admissionNumber || student?.admNo || "");
}

function getStudentGrade(student) {
  return parseGrade(student?.grade);
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className || "");
}

function getStudentClassName(student) {
  return buildFullClassName(getStudentGrade(student), getStudentSection(student));
}

function isStudentActive(student) {
  return lower(student?.status || "active") === "active";
}

function getEnrollmentClassName(enrollment) {
  const rawClassName = text(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();
  return buildFullClassName(enrollment?.grade, enrollment?.section || rawClassName);
}

function getEnrollmentSubjectName(enrollment) {
  return text(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentSubjectId(enrollment) {
  return text(enrollment?.subjectId || "");
}

function getEnrollmentAcademicYear(enrollment) {
  return String(enrollment?.academicYear || enrollment?.year || "");
}

function isEnrollmentActive(enrollment) {
  return lower(enrollment?.status || "active") === "active";
}

function getMarkSubject(mark) {
  return text(mark?.subjectName || mark?.subject || "");
}

function getMarkSubjectId(mark) {
  return text(mark?.subjectId || "");
}

function getMarkTerm(mark) {
  return text(mark?.termName || mark?.term || "");
}

function getMarkYear(mark) {
  return String(mark?.academicYear || mark?.year || "");
}

function getMarkValue(mark) {
  const value = mark?.marks ?? mark?.mark ?? mark?.score ?? null;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function markCountsAsEntered(mark) {
  return (
    getMarkValue(mark) !== null ||
    mark?.isAbsent === true ||
    mark?.absent === true ||
    lower(mark?.attendanceStatus) === "absent" ||
    lower(mark?.attendanceStatus) === "medical_absent"
  );
}

function getMarkClassName(mark) {
  const rawClassName = text(mark?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();
  return buildFullClassName(mark?.grade, mark?.section || rawClassName);
}

function normalizeClassroom(classroom) {
  const grade = parseGrade(classroom?.grade);
  const section = normalizeSection(classroom?.section || classroom?.className || "");

  return {
    ...classroom,
    grade,
    section,
    className:
      text(classroom?.className || classroom?.fullClassName) ||
      buildFullClassName(grade, section),
  };
}

function teacherMatchesProfile(record, profile) {
  const recordTeacherId = text(
    record?.teacherId || record?.classTeacherId || record?.teacherDocId
  );
  const recordUid = text(record?.teacherUid || record?.classTeacherUid || record?.uid);
  const recordEmail = lower(record?.teacherEmail || record?.classTeacherEmail || record?.email);
  const recordName = lower(record?.teacherName || record?.classTeacherName || record?.name);
  const recordSignatureNo = text(
    record?.teacherSignatureNo || record?.classTeacherSignatureNo || record?.signatureNo
  );

  const profileIds = [
    profile?.uid,
    profile?.id,
    profile?.teacherId,
    profile?.docId,
    profile?.userId,
  ]
    .map(text)
    .filter(Boolean);

  const profileEmails = [profile?.email].map(lower).filter(Boolean);
  const profileNames = [profile?.name, profile?.displayName].map(lower).filter(Boolean);
  const profileSignatureNos = [
    profile?.signatureNo,
    profile?.teacherSignatureNo,
    profile?.teacherNo,
  ]
    .map(text)
    .filter(Boolean);

  return (
    (recordTeacherId && profileIds.includes(recordTeacherId)) ||
    (recordUid && profileIds.includes(recordUid)) ||
    (recordEmail && profileEmails.includes(recordEmail)) ||
    (recordName && profileNames.includes(recordName)) ||
    (recordSignatureNo && profileSignatureNos.includes(recordSignatureNo))
  );
}

function getGradeLetter(mark, grade) {
  if (mark == null) return null;

  if (grade >= 6 && grade <= 9) {
    if (mark >= 75) return { label: "A", color: "#2e7d32", bg: "#e8f5e9" };
    if (mark >= 65) return { label: "B", color: "#1565c0", bg: "#e3f2fd" };
    if (mark >= 55) return { label: "C", color: "#e65100", bg: "#fff3e0" };
    if (mark >= 40) return { label: "D", color: "#555", bg: "#f5f5f5" };
    return { label: "E", color: "#c62828", bg: "#ffebee" };
  }

  if (mark >= 75) return { label: "A", color: "#2e7d32", bg: "#e8f5e9" };
  if (mark >= 65) return { label: "B", color: "#1565c0", bg: "#e3f2fd" };
  if (mark >= 55) return { label: "C", color: "#e65100", bg: "#fff3e0" };
  if (mark >= 40) return { label: "S", color: "#555", bg: "#f5f5f5" };
  return { label: "F", color: "#c62828", bg: "#ffebee" };
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shortSubject(name) {
  if (name.length <= 12) return name;
  return `${name.slice(0, 12)}…`;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ClassReport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const printRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [classTeacherClass, setClassTeacherClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [allMarks, setAllMarks] = useState([]);
  const [terms, setTerms] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState("active");

  useEffect(() => {
    async function fetchData() {
      if (!profile?.uid && !profile?.email && !profile?.name) return;

      setLoading(true);
      setLoadError("");

      try {
        const [termSnap, studentSnap, markSnap, classroomSnap, enrollmentSnap] =
          await Promise.all([
            getDocs(collection(db, "academicTerms")),
            getDocs(collection(db, "students")),
            getDocs(collection(db, "marks")),
            getDocs(collection(db, "classrooms")),
            getDocs(collection(db, "studentSubjectEnrollments")),
          ]);

        const allTerms = termSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const sortedTerms = [...allTerms].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
        const active = allTerms.find((term) => term.isActive === true) || null;

        setTerms(sortedTerms);
        setActiveTerm(active);

        const classrooms = classroomSnap.docs.map((doc) =>
          normalizeClassroom({ id: doc.id, ...doc.data() })
        );

        const matchedClassroom =
          classrooms.find((room) => teacherMatchesProfile(room, profile)) || null;

        setClassTeacherClass(matchedClassroom);

        if (!matchedClassroom) {
          setStudents([]);
          setEnrollments([]);
          setAllMarks([]);
          return;
        }

        const className = matchedClassroom.className;

        const allStudents = studentSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(isStudentActive);

        const classStudents = allStudents
          .filter((student) => getStudentClassName(student) === className)
          .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

        const classEnrollments = enrollmentSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(isEnrollmentActive)
          .filter((enrollment) => getEnrollmentClassName(enrollment) === className);

        const classMarks = markSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((mark) => getMarkClassName(mark) === className);

        setStudents(classStudents);
        setEnrollments(classEnrollments);
        setAllMarks(classMarks);
      } catch (error) {
        console.error("ClassReport fetch error:", error);
        setLoadError("Failed to load class report.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  const currentTerm = useMemo(() => {
    return selectedTerm === "active"
      ? activeTerm
      : terms.find((term) => term.id === selectedTerm) || null;
  }, [selectedTerm, activeTerm, terms]);

  const currentTermYear = useMemo(() => {
    return currentTerm ? String(currentTerm.year) : "";
  }, [currentTerm]);

  const currentTermName = useMemo(() => {
    return currentTerm ? text(currentTerm.term) : "";
  }, [currentTerm]);

  const classSubjects = useMemo(() => {
    const filteredEnrollments = enrollments.filter((enrollment) => {
      if (!currentTermYear) return true;
      const enrollmentYear = getEnrollmentAcademicYear(enrollment);
      return !enrollmentYear || enrollmentYear === currentTermYear;
    });

    const subjectMap = new Map();

    filteredEnrollments.forEach((enrollment) => {
      const subjectId = getEnrollmentSubjectId(enrollment);
      const subjectName = getEnrollmentSubjectName(enrollment);
      const key = subjectId || normalizeSubjectName(subjectName);

      if (!key) return;

      if (!subjectMap.has(key)) {
        subjectMap.set(key, { subjectId, subjectName });
      }
    });

    return Array.from(subjectMap.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );
  }, [enrollments, currentTermYear]);

  const termMarks = useMemo(() => {
    if (!currentTerm) return [];

    return allMarks.filter((mark) => {
      const sameTerm = getMarkTerm(mark) === currentTermName;
      const sameYear = getMarkYear(mark) === currentTermYear;
      return sameTerm && sameYear;
    });
  }, [allMarks, currentTerm, currentTermName, currentTermYear]);

  const studentRows = useMemo(() => {
    return students.map((student) => {
      const studentId = text(student.id);

      const studentEnrollments = enrollments.filter((enrollment) => {
        const sameStudent = text(enrollment.studentId) === studentId;
        const sameYear =
          !getEnrollmentAcademicYear(enrollment) ||
          getEnrollmentAcademicYear(enrollment) === currentTermYear;
        return sameStudent && sameYear;
      });

      const eligibleSubjects = new Map();

      studentEnrollments.forEach((enrollment) => {
        const subjectId = getEnrollmentSubjectId(enrollment);
        const subjectName = getEnrollmentSubjectName(enrollment);
        const key = subjectId || normalizeSubjectName(subjectName);
        if (!key) return;

        eligibleSubjects.set(key, {
          subjectId,
          subjectName,
        });
      });

      const marksBySubject = {};
      let total = 0;
      let enteredCount = 0;

      classSubjects.forEach((subjectInfo) => {
        const subjectKey = subjectInfo.subjectId || normalizeSubjectName(subjectInfo.subjectName);
        const isEligible = eligibleSubjects.has(subjectKey);

        if (!isEligible) {
          marksBySubject[subjectInfo.subjectName] = null;
          return;
        }

        const matchedMark = termMarks.find((mark) => {
          const sameStudent = text(mark.studentId) === studentId;

          const sameSubject =
            (subjectInfo.subjectId &&
              getMarkSubjectId(mark) &&
              subjectInfo.subjectId === getMarkSubjectId(mark)) ||
            normalizeSubjectName(subjectInfo.subjectName) ===
              normalizeSubjectName(getMarkSubject(mark));

          return sameStudent && sameSubject;
        });

        const markValue =
          matchedMark && markCountsAsEntered(matchedMark) ? getMarkValue(matchedMark) : null;

        marksBySubject[subjectInfo.subjectName] = markValue;

        if (markValue !== null) {
          total += markValue;
          enteredCount += 1;
        }
      });

      const avgValue = enteredCount > 0 ? Number((total / enteredCount).toFixed(1)) : null;

      return {
        ...student,
        marksBySubject,
        total,
        enteredCount,
        average: avgValue,
      };
    });
  }, [students, enrollments, classSubjects, termMarks, currentTermYear]);

  const rankedRows = useMemo(() => {
    const sortable = studentRows
      .filter((student) => student.enteredCount > 0)
      .sort((a, b) => b.total - a.total);

    let currentRank = 1;

    return sortable.map((student, index) => {
      if (index > 0 && student.total === sortable[index - 1].total) {
        return {
          ...student,
          rank: sortable[index - 1].rank,
        };
      }

      const row = {
        ...student,
        rank: currentRank,
      };

      currentRank = index + 2;
      return row;
    });
  }, [studentRows]);

  const finalRows = useMemo(() => {
    return studentRows.map((student) => {
      const rankedStudent = rankedRows.find((row) => row.id === student.id);
      return {
        ...student,
        rank: rankedStudent?.rank ?? "—",
      };
    });
  }, [studentRows, rankedRows]);

  const subjectAnalysis = useMemo(() => {
    return classSubjects.map((subjectInfo) => {
      const subjectMarks = termMarks
        .filter((mark) => {
          return (
            (subjectInfo.subjectId &&
              getMarkSubjectId(mark) &&
              subjectInfo.subjectId === getMarkSubjectId(mark)) ||
            normalizeSubjectName(subjectInfo.subjectName) ===
              normalizeSubjectName(getMarkSubject(mark))
          );
        })
        .map((mark) => getMarkValue(mark))
        .filter((value) => value !== null);

      if (!subjectMarks.length) {
        return {
          subject: subjectInfo.subjectName,
          count: 0,
          avg: null,
          highest: null,
          lowest: null,
          passRate: null,
          gradesDist: {},
        };
      }

      const passThreshold = 40;
      const passed = subjectMarks.filter((mark) => mark >= passThreshold).length;

      const gradesDist = {};
      subjectMarks.forEach((mark) => {
        const gradeLetter = getGradeLetter(mark, classTeacherClass?.grade || 0)?.label;
        if (!gradeLetter) return;
        gradesDist[gradeLetter] = (gradesDist[gradeLetter] || 0) + 1;
      });

      return {
        subject: subjectInfo.subjectName,
        count: subjectMarks.length,
        avg: Number(average(subjectMarks).toFixed(1)),
        highest: Math.max(...subjectMarks),
        lowest: Math.min(...subjectMarks),
        passRate: Math.round((passed / subjectMarks.length) * 100),
        gradesDist,
      };
    });
  }, [classSubjects, termMarks, classTeacherClass]);

  const classSummary = useMemo(() => {
    const averages = finalRows
      .filter((student) => student.average !== null)
      .map((student) => student.average);

    const topStudent = rankedRows.find((student) => student.rank === 1) || null;

    const lowestStudent = finalRows
      .filter((student) => student.average !== null)
      .reduce((lowest, current) => {
        if (!lowest) return current;
        return current.average < lowest.average ? current : lowest;
      }, null);

    return {
      classAverage: averages.length ? Number(average(averages).toFixed(1)) : "—",
      highestAverage:
        topStudent?.average !== null
          ? `${topStudent.average} (${getStudentName(topStudent).split(" ")[0]})`
          : "—",
      lowestAverage:
        lowestStudent?.average !== null
          ? `${lowestStudent.average} (${getStudentName(lowestStudent).split(" ")[0]})`
          : "—",
      rankedCount: `${rankedRows.length} / ${students.length}`,
    };
  }, [finalRows, rankedRows, students.length]);

  const sortedDisplayRows = useMemo(() => {
    return [...finalRows].sort((a, b) => {
      if (a.rank === "—") return 1;
      if (b.rank === "—") return -1;
      return a.rank - b.rank;
    });
  }, [finalRows]);

  const handlePrint = () => {
    if (!printRef.current || !classTeacherClass) return;

    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");

    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Class Report - ${classTeacherClass.className}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #000; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            th, td { border: 1px solid #555; padding: 5px 8px; text-align: center; }
            th { background: #1a237e; color: white; }
            td:nth-child(2) { text-align: left; }
            .header { text-align: center; margin-bottom: 16px; }
            .section-title { font-size: 14px; font-weight: bold; color: #1a237e; margin: 16px 0 6px; }
            @media print { button { display: none !important; } }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    win.document.close();
    win.focus();
    win.print();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  if (!classTeacherClass) {
    return (
      <Box mt={4}>
        <Alert severity="error">
          You are not assigned as a class teacher in the classrooms collection.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/teacher")}
        sx={{ mb: 2 }}
      >
        Back to Dashboard
      </Button>

      {!!loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
        flexWrap="wrap"
        gap={1}
      >
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Class Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grade {classTeacherClass.grade}-{classTeacherClass.section} • {students.length} students
          </Typography>
        </Box>

        <Box display="flex" gap={1} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Term</InputLabel>
            <Select
              value={selectedTerm}
              label="Term"
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              <MenuItem value="active">
                {activeTerm ? `Active: ${activeTerm.term} ${activeTerm.year}` : "Active Term"}
              </MenuItem>

              {terms.map((term) => (
                <MenuItem key={term.id} value={term.id}>
                  {term.term} {term.year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {!isMobile && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ bgcolor: "#1a237e" }}
            >
              Print
            </Button>
          )}
        </Box>
      </Box>

      {!currentTerm ? (
        <Alert severity="warning">No active term found. Select a term above.</Alert>
      ) : termMarks.length === 0 ? (
        <Alert severity="info">
          No marks entered yet for {currentTerm.term} {currentTerm.year}.
        </Alert>
      ) : (
        <Box ref={printRef}>
          <Box textAlign="center" mb={2} className="header">
            <Typography variant="h6" fontWeight={700} color="#1a237e">
              {SCHOOL_NAME}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {SCHOOL_SUBTITLE}
            </Typography>
            <Typography variant="body2" fontWeight={600} mt={0.5}>
              Class Performance Report — Grade {classTeacherClass.grade}-{classTeacherClass.section}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentTerm.term} {currentTerm.year}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1}>
            Marks Schedule — {currentTerm.term} {currentTerm.year}
          </Typography>

          <Paper sx={{ overflowX: "auto", mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1a237e" }}>
                <TableRow>
                  <TableCell
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      position: "sticky",
                      left: 0,
                      bgcolor: "#1a237e",
                      zIndex: 2,
                    }}
                  >
                    Rank
                  </TableCell>

                  <TableCell
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      position: "sticky",
                      left: 55,
                      bgcolor: "#1a237e",
                      zIndex: 2,
                      minWidth: 170,
                    }}
                  >
                    Name
                  </TableCell>

                  {classSubjects.map((subjectInfo) => (
                    <TableCell
                      key={subjectInfo.subjectId || subjectInfo.subjectName}
                      sx={{
                        color: "white",
                        fontWeight: 600,
                        fontSize: 11,
                        minWidth: 80,
                        textAlign: "center",
                      }}
                    >
                      {shortSubject(subjectInfo.subjectName)}
                    </TableCell>
                  ))}

                  <TableCell sx={{ color: "white", fontWeight: 700, textAlign: "center" }}>
                    Total
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700, textAlign: "center" }}>
                    Avg
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700, textAlign: "center" }}>
                    Grade
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {sortedDisplayRows.map((student) => {
                  const avgNum = student.average;
                  const avgGradeInfo =
                    avgNum !== null ? getGradeLetter(avgNum, classTeacherClass.grade) : null;

                  const rowBg =
                    student.rank === 1
                      ? "#fff9c4"
                      : student.rank === 2
                      ? "#f5f5f5"
                      : student.rank === 3
                      ? "#fbe9e7"
                      : "white";

                  return (
                    <TableRow key={student.id} hover sx={{ bgcolor: rowBg }}>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          textAlign: "center",
                          position: "sticky",
                          left: 0,
                          bgcolor: rowBg,
                          zIndex: 1,
                          minWidth: 55,
                        }}
                      >
                        {student.rank === 1
                          ? "🥇"
                          : student.rank === 2
                          ? "🥈"
                          : student.rank === 3
                          ? "🥉"
                          : student.rank}
                      </TableCell>

                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: 13,
                          position: "sticky",
                          left: 55,
                          bgcolor: rowBg,
                          zIndex: 1,
                        }}
                      >
                        {isMobile ? getStudentName(student).split(" ")[0] : getStudentName(student)}
                      </TableCell>

                      {classSubjects.map((subjectInfo) => {
                        const mark = student.marksBySubject[subjectInfo.subjectName];
                        const letterInfo =
                          mark !== null ? getGradeLetter(mark, classTeacherClass.grade) : null;

                        return (
                          <TableCell
                            key={`${student.id}-${subjectInfo.subjectId || subjectInfo.subjectName}`}
                            sx={{
                              textAlign: "center",
                              bgcolor: mark !== null ? letterInfo?.bg : "#fafafa",
                            }}
                          >
                            {mark !== null ? (
                              <Typography variant="body2" fontWeight={600} color={letterInfo?.color}>
                                {mark}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            )}
                          </TableCell>
                        );
                      })}

                      <TableCell sx={{ textAlign: "center", fontWeight: 700 }}>
                        {student.enteredCount > 0 ? student.total : "—"}
                      </TableCell>

                      <TableCell
                        sx={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: avgGradeInfo?.color,
                        }}
                      >
                        {student.average ?? "—"}
                      </TableCell>

                      <TableCell sx={{ textAlign: "center" }}>
                        {avgGradeInfo ? (
                          <span
                            style={{
                              color: avgGradeInfo.color,
                              fontWeight: 700,
                              background: avgGradeInfo.bg,
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 13,
                            }}
                          >
                            {avgGradeInfo.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>

          <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
            Class Summary
          </Typography>

          <Grid container spacing={2} mb={3}>
            {[
              {
                label: "Class Average",
                value: classSummary.classAverage,
                color: "#e8eaf6",
                icon: "📈",
              },
              {
                label: "Highest Average",
                value: classSummary.highestAverage,
                color: "#e8f5e9",
                icon: "🥇",
              },
              {
                label: "Lowest Average",
                value: classSummary.lowestAverage,
                color: "#fff3e0",
                icon: "📉",
              },
              {
                label: "Students Ranked",
                value: classSummary.rankedCount,
                color: "#e3f2fd",
                icon: "👥",
              },
            ].map((card) => (
              <Grid item xs={6} sm={3} key={card.label}>
                <Card sx={{ bgcolor: card.color, boxShadow: 1 }}>
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      {card.icon} {card.label}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} mt={0.3}>
                      {card.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1}>
            Subject Analysis
          </Typography>

          <Paper sx={{ overflowX: "auto", mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#37474f" }}>
                <TableRow>
                  {[
                    "Subject",
                    "Entered",
                    "Average",
                    "Highest",
                    "Lowest",
                    "Pass Rate",
                    "A",
                    "B",
                    "C",
                    classTeacherClass.grade <= 9 ? "D" : "S",
                    classTeacherClass.grade <= 9 ? "E" : "F",
                  ].map((head) => (
                    <TableCell
                      key={head}
                      sx={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        fontSize: 12,
                      }}
                    >
                      {head}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {subjectAnalysis.map((subjectRow) => (
                  <TableRow key={subjectRow.subject} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {subjectRow.subject}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ textAlign: "center" }}>
                      {subjectRow.count > 0 ? (
                        <Chip
                          label={subjectRow.count}
                          size="small"
                          color={subjectRow.count === students.length ? "success" : "warning"}
                        />
                      ) : (
                        <Chip label="0" size="small" color="error" />
                      )}
                    </TableCell>

                    <TableCell
                      sx={{
                        textAlign: "center",
                        fontWeight: 700,
                        color:
                          subjectRow.avg >= 65
                            ? "#2e7d32"
                            : subjectRow.avg >= 40
                            ? "#e65100"
                            : "#c62828",
                      }}
                    >
                      {subjectRow.avg ?? "—"}
                    </TableCell>

                    <TableCell sx={{ textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>
                      {subjectRow.highest ?? "—"}
                    </TableCell>

                    <TableCell sx={{ textAlign: "center", color: "#c62828", fontWeight: 600 }}>
                      {subjectRow.lowest ?? "—"}
                    </TableCell>

                    <TableCell sx={{ textAlign: "center" }}>
                      {subjectRow.passRate !== null ? (
                        <Chip
                          label={`${subjectRow.passRate}%`}
                          size="small"
                          color={
                            subjectRow.passRate >= 80
                              ? "success"
                              : subjectRow.passRate >= 50
                              ? "warning"
                              : "error"
                          }
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    {[
                      "A",
                      "B",
                      "C",
                      classTeacherClass.grade <= 9 ? "D" : "S",
                      classTeacherClass.grade <= 9 ? "E" : "F",
                    ].map((gradeKey) => (
                      <TableCell key={gradeKey} sx={{ textAlign: "center" }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={
                            gradeKey === "A"
                              ? "#2e7d32"
                              : gradeKey === "B"
                              ? "#1565c0"
                              : gradeKey === "C"
                              ? "#e65100"
                              : ["D", "S"].includes(gradeKey)
                              ? "#555"
                              : "#c62828"
                          }
                        >
                          {subjectRow.gradesDist[gradeKey] || 0}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
            Top Performers
          </Typography>

          <Grid container spacing={1.5} mb={3}>
            {rankedRows.slice(0, 5).map((student, idx) => (
              <Grid item xs={12} sm={6} md={4} key={student.id}>
                <Card
                  sx={{
                    bgcolor:
                      idx === 0
                        ? "#fff9c4"
                        : idx === 1
                        ? "#f5f5f5"
                        : idx === 2
                        ? "#fbe9e7"
                        : "white",
                    border: "1px solid #e0e0e0",
                    boxShadow: idx < 3 ? 3 : 1,
                  }}
                >
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5">
                        {idx === 0
                          ? "🥇"
                          : idx === 1
                          ? "🥈"
                          : idx === 2
                          ? "🥉"
                          : `#${idx + 1}`}
                      </Typography>

                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {getStudentName(student)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Avg: {student.average ?? "—"} | Total: {student.total}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {isMobile && termMarks.length > 0 && (
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          fullWidth
          onClick={handlePrint}
          sx={{ bgcolor: "#1a237e", mt: 2 }}
        >
          Print Class Report
        </Button>
      )}
    </Box>
  );
}