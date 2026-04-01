import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditNoteIcon from "@mui/icons-material/EditNote";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BarChartIcon from "@mui/icons-material/BarChart";
import SchoolIcon from "@mui/icons-material/School";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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
  return `${parseGrade(grade)}${normalizeSection(section)}`;
}

function getStudentName(student) {
  return normalizeText(student?.name || student?.fullName || "Unnamed Student");
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className || "");
}

function isStudentActive(student) {
  return normalizeLower(student?.status || "active") === "active";
}

function getStudentAdmissionNo(student) {
  return normalizeText(
    student?.admissionNo || student?.admissionNumber || student?.admNo
  );
}

function getMarkSubject(mark) {
  return normalizeText(mark?.subjectName || mark?.subject || "");
}

function getMarkSubjectId(mark) {
  return normalizeText(mark?.subjectId || "");
}

function getMarkYear(mark) {
  return String(mark?.academicYear || mark?.year || "");
}

function getMarkTerm(mark) {
  return normalizeText(mark?.term || mark?.termName || mark?.termLabel || "");
}

function getMarkValue(mark) {
  const value = mark?.mark ?? mark?.marks ?? mark?.score ?? null;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hasMarkEntry(mark) {
  return (
    getMarkValue(mark) !== null ||
    mark?.isAbsent === true ||
    mark?.isMedicalAbsent === true ||
    normalizeLower(mark?.attendanceStatus) === "absent" ||
    normalizeLower(mark?.attendanceStatus) === "medical_absent"
  );
}

function getMarkClassName(mark) {
  if (normalizeText(mark?.className)) {
    const value = normalizeText(mark.className);
    return /^\d+[A-Z]+$/i.test(value)
      ? value.toUpperCase()
      : buildFullClassName(mark?.grade, value);
  }

  if (mark?.grade || mark?.section) {
    return buildFullClassName(mark.grade, mark.section);
  }

  return "";
}

function getTeacherAssignmentSubject(assignment) {
  return normalizeText(assignment?.subjectName || assignment?.subject || "");
}

function getTeacherAssignmentSubjectId(assignment) {
  return normalizeText(assignment?.subjectId || "");
}

function getTeacherAssignmentSection(assignment) {
  const raw = normalizeText(assignment?.section || assignment?.className || "");
  if (/^\d+[A-Z]+$/i.test(raw)) {
    return normalizeSection(raw.replace(/^\d+/, ""));
  }
  return normalizeSection(raw);
}

function getTeacherAssignmentClassName(assignment) {
  const rawClassName = normalizeText(assignment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();
  return buildFullClassName(assignment?.grade, assignment?.section || rawClassName);
}

function getEnrollmentClassName(enrollment) {
  const rawClassName = normalizeText(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();
  return buildFullClassName(enrollment?.grade, enrollment?.section || rawClassName);
}

function getEnrollmentSubject(enrollment) {
  return normalizeText(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentSubjectId(enrollment) {
  return normalizeText(enrollment?.subjectId || "");
}

function isEnrollmentActive(enrollment) {
  const status = normalizeLower(enrollment?.status || "active");
  return ["", "active", "current", "promoted"].includes(status);
}

function normalizeSubjectKey(subjectId, subjectName) {
  const id = normalizeText(subjectId);
  if (id) return `id:${id}`;
  return `name:${normalizeLower(subjectName).replace(/\s+/g, "")}`;
}

function subjectMatches(subjectAId, subjectAName, subjectBId, subjectBName) {
  return (
    normalizeSubjectKey(subjectAId, subjectAName) ===
    normalizeSubjectKey(subjectBId, subjectBName)
  );
}

function getInitials(name = "") {
  return normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function statusColor(status) {
  if (status === "done") return "success";
  if (status === "partial") return "warning";
  if (status === "pending") return "error";
  return "default";
}

function statusLabel(status) {
  if (status === "done") return "Done";
  if (status === "partial") return "Partial";
  if (status === "pending") return "Pending";
  return "No Data";
}

function progressBarColor(status) {
  if (status === "done") return "#2e7d32";
  if (status === "partial") return "#f57f17";
  if (status === "pending") return "#c62828";
  return "#90a4ae";
}

function teacherMatchesProfile(record, profile) {
  const recordTeacherId = normalizeText(
    record?.teacherId || record?.classTeacherId || record?.teacherDocId
  );
  const recordUid = normalizeText(
    record?.teacherUid || record?.classTeacherUid || record?.uid
  );
  const recordEmail = normalizeLower(
    record?.teacherEmail || record?.classTeacherEmail || record?.email
  );
  const recordName = normalizeLower(
    record?.teacherName || record?.classTeacherName || record?.name
  );
  const recordSignatureNo = normalizeText(
    record?.teacherSignatureNo || record?.classTeacherSignatureNo || record?.signatureNo
  );

  const profileIds = [
    profile?.uid,
    profile?.id,
    profile?.teacherId,
    profile?.docId,
    profile?.userId,
  ]
    .map(normalizeText)
    .filter(Boolean);

  const profileEmails = [profile?.email].map(normalizeLower).filter(Boolean);
  const profileNames = [profile?.name, profile?.displayName]
    .map(normalizeLower)
    .filter(Boolean);
  const profileSignatureNos = [
    profile?.signatureNo,
    profile?.teacherSignatureNo,
    profile?.teacherNo,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return (
    (recordTeacherId && profileIds.includes(recordTeacherId)) ||
    (recordUid && profileIds.includes(recordUid)) ||
    (recordEmail && profileEmails.includes(recordEmail)) ||
    (recordName && profileNames.includes(recordName)) ||
    (recordSignatureNo && profileSignatureNos.includes(recordSignatureNo))
  );
}

function normalizeClassroom(classroom) {
  const grade = parseGrade(classroom?.grade);
  const section = normalizeSection(
    classroom?.section || classroom?.className || ""
  );
  const year = String(classroom?.year || classroom?.academicYear || "");
  return {
    ...classroom,
    grade,
    section,
    year,
    className:
      normalizeText(classroom?.className || classroom?.fullClassName) ||
      buildFullClassName(grade, section),
  };
}

function StatCard({ title, value, subtitle, icon, bg }) {
  return (
    <Card
      sx={{
        bgcolor: bg,
        borderRadius: 3,
        border: "1px solid #e8eaf6",
        boxShadow: "0 2px 10px rgba(26,35,126,0.08)",
        height: "100%",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.2} alignItems="center" mb={1.2}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Stack>

        <Typography variant="h4" fontWeight={800} lineHeight={1}>
          {value}
        </Typography>

        {subtitle ? (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mt={1}
          >
            {subtitle}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ title, description, buttonText, onClick, icon }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        border: "1px solid #e8eaf6",
        boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
        height: "100%",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.2} alignItems="center" mb={1.2}>
          {icon}
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>

        <Button
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={onClick}
          sx={{ borderColor: "#1a237e", color: "#1a237e" }}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [classTeacherClass, setClassTeacherClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!profile?.uid && !profile?.email && !profile?.name) return;

      setLoading(true);
      setLoadError("");

      try {
        const [
          termSnap,
          assignmentSnap,
          studentSnap,
          marksSnap,
          classroomSnap,
          enrollmentSnap,
        ] = await Promise.all([
          getDocs(collection(db, "academicTerms")),
          getDocs(collection(db, "teacherAssignments")),
          getDocs(collection(db, "students")),
          getDocs(collection(db, "marks")),
          getDocs(collection(db, "classrooms")),
          getDocs(collection(db, "studentSubjectEnrollments")),
        ]);

        const active =
          termSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .find((term) => term.isActive === true) || null;

        setActiveTerm(active);

        const allAssignments = assignmentSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => normalizeLower(a.status || "active") === "active");

        const myAssignments = allAssignments
          .filter((assignment) => teacherMatchesProfile(assignment, profile))
          .sort((a, b) => {
            const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
            if (gradeDiff !== 0) return gradeDiff;
            return getTeacherAssignmentSection(a).localeCompare(
              getTeacherAssignmentSection(b)
            );
          });

        setAssignments(myAssignments);

        const classrooms = classroomSnap.docs.map((d) =>
          normalizeClassroom({ id: d.id, ...d.data() })
        );

        const matchedClassTeacherClass =
          classrooms.find((room) => teacherMatchesProfile(room, profile)) || null;

        setClassTeacherClass(matchedClassTeacherClass);

        const allStudents = studentSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const studentsById = new Map(
          allStudents.map((student) => [normalizeText(student.id), student])
        );

        const allEnrollments = enrollmentSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((enrollment) => isEnrollmentActive(enrollment));

        setEnrollments(allEnrollments);

        const allMarks = marksSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const myAssignmentPairs = myAssignments.map((assignment) => ({
          className: getTeacherAssignmentClassName(assignment),
          subjectId: getTeacherAssignmentSubjectId(assignment),
          subjectName: getTeacherAssignmentSubject(assignment),
          grade: parseGrade(assignment.grade),
          section: getTeacherAssignmentSection(assignment),
        }));

        const myEnrollments = allEnrollments.filter((enrollment) => {
          const enrollmentClassName = getEnrollmentClassName(enrollment);
          const enrollmentSubjectId = getEnrollmentSubjectId(enrollment);
          const enrollmentSubjectName = getEnrollmentSubject(enrollment);

          return myAssignmentPairs.some((pair) => {
            const sameClass = pair.className === enrollmentClassName;
            const sameSubject = subjectMatches(
              pair.subjectId,
              pair.subjectName,
              enrollmentSubjectId,
              enrollmentSubjectName
            );
            return sameClass && sameSubject;
          });
        });

        const myStudentIds = [
          ...new Set(
            myEnrollments.map((e) => normalizeText(e.studentId)).filter(Boolean)
          ),
        ];

        const myStudents = myStudentIds
          .map((studentId) => studentsById.get(studentId))
          .filter(Boolean)
          .filter((student) => isStudentActive(student))
          .sort((a, b) => {
            const gradeDiff = parseGrade(a.grade) - parseGrade(b.grade);
            if (gradeDiff !== 0) return gradeDiff;

            const sectionDiff = getStudentSection(a).localeCompare(
              getStudentSection(b)
            );
            if (sectionDiff !== 0) return sectionDiff;

            return getStudentName(a).localeCompare(getStudentName(b));
          });

        setStudents(myStudents);

        const myMarks = allMarks.filter((mark) => {
          const markClassName = getMarkClassName(mark);
          const markSubjectId = getMarkSubjectId(mark);
          const markSubjectName = getMarkSubject(mark);

          return myAssignmentPairs.some((pair) => {
            const sameClass = pair.className === markClassName;
            const sameSubject = subjectMatches(
              pair.subjectId,
              pair.subjectName,
              markSubjectId,
              markSubjectName
            );

            return sameClass && sameSubject;
          });
        });

        setMarks(myMarks);

        if (matchedClassTeacherClass && active) {
          const className = matchedClassTeacherClass.className;

          const classAssignments = allAssignments.filter(
            (assignment) => getTeacherAssignmentClassName(assignment) === className
          );

          const classEnrollments = allEnrollments.filter((enrollment) => {
            const sameClass = getEnrollmentClassName(enrollment) === className;
            const enrollmentYear = String(enrollment.academicYear || "");
            const sameYear =
              !enrollmentYear || enrollmentYear === String(active.year || "");
            return sameClass && sameYear;
          });

          const groupedSubjectsMap = new Map();

          classAssignments.forEach((assignment) => {
            const subjectId = getTeacherAssignmentSubjectId(assignment);
            const subjectName = getTeacherAssignmentSubject(assignment);
            const key = normalizeSubjectKey(subjectId, subjectName);
            if (!key) return;

            if (!groupedSubjectsMap.has(key)) {
              groupedSubjectsMap.set(key, {
                subjectId,
                subjectName,
              });
            }
          });

          classEnrollments.forEach((enrollment) => {
            const subjectId = getEnrollmentSubjectId(enrollment);
            const subjectName = getEnrollmentSubject(enrollment);
            const key = normalizeSubjectKey(subjectId, subjectName);
            if (!key) return;

            if (!groupedSubjectsMap.has(key)) {
              groupedSubjectsMap.set(key, {
                subjectId,
                subjectName,
              });
            }
          });

          const progress = Array.from(groupedSubjectsMap.values())
            .map((subjectInfo) => {
              const eligibleEnrollments = classEnrollments.filter((enrollment) =>
                subjectMatches(
                  subjectInfo.subjectId,
                  subjectInfo.subjectName,
                  getEnrollmentSubjectId(enrollment),
                  getEnrollmentSubject(enrollment)
                )
              );

              const eligibleStudentIds = new Set(
                eligibleEnrollments
                  .map((enrollment) => normalizeText(enrollment.studentId))
                  .filter(Boolean)
              );

              const total = eligibleStudentIds.size;

              if (total === 0) {
                return {
                  subject: subjectInfo.subjectName || "Unnamed Subject",
                  entered: 0,
                  total: 0,
                  percent: 0,
                  status: "no_students",
                };
              }

              const markedStudentIds = new Set(
                allMarks
                  .filter((mark) => {
                    const sameClass = getMarkClassName(mark) === className;
                    const sameTerm =
                      !active?.term || getMarkTerm(mark) === normalizeText(active.term);
                    const sameYear =
                      !active?.year || getMarkYear(mark) === String(active.year);

                    const sameSubject = subjectMatches(
                      subjectInfo.subjectId,
                      subjectInfo.subjectName,
                      getMarkSubjectId(mark),
                      getMarkSubject(mark)
                    );

                    return (
                      sameClass &&
                      sameTerm &&
                      sameYear &&
                      sameSubject &&
                      hasMarkEntry(mark)
                    );
                  })
                  .map((mark) => normalizeText(mark.studentId))
                  .filter((studentId) => studentId && eligibleStudentIds.has(studentId))
              );

              const entered = markedStudentIds.size;
              const percent = Math.round((entered / total) * 100);
              const status =
                entered === 0 ? "pending" : entered < total ? "partial" : "done";

              return {
                subject: subjectInfo.subjectName || "Unnamed Subject",
                entered,
                total,
                percent,
                status,
              };
            })
            .filter((row) => row.status !== "no_students")
            .sort((a, b) => {
              const order = { pending: 0, partial: 1, done: 2 };
              return order[a.status] - order[b.status] || a.subject.localeCompare(b.subject);
            });

          setSubjectProgress(progress);
        } else {
          setSubjectProgress([]);
        }
      } catch (error) {
        console.error("TeacherDashboard fetch error:", error);
        setLoadError("Failed to load teacher dashboard.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  const myClasses = useMemo(() => {
    return [
      ...new Map(
        assignments.map((assignment) => [
          getTeacherAssignmentClassName(assignment),
          {
            grade: parseGrade(assignment.grade),
            section: getTeacherAssignmentSection(assignment),
            className: getTeacherAssignmentClassName(assignment),
          },
        ])
      ).values(),
    ];
  }, [assignments]);

  const groupedClasses = useMemo(() => {
    return assignments.reduce((acc, assignment) => {
      const classLabel = `Grade ${parseGrade(assignment.grade)}-${getTeacherAssignmentSection(
        assignment
      )}`;
      if (!acc[classLabel]) acc[classLabel] = [];
      acc[classLabel].push(getTeacherAssignmentSubject(assignment));
      return acc;
    }, {});
  }, [assignments]);

  const completedAssignmentsCount = useMemo(() => {
    if (!activeTerm) return 0;

    return assignments.filter((assignment) => {
      const className = getTeacherAssignmentClassName(assignment);
      const subjectId = getTeacherAssignmentSubjectId(assignment);
      const subjectName = getTeacherAssignmentSubject(assignment);

      const eligibleStudentIds = new Set(
        enrollments
          .filter((enrollment) => {
            const sameClass = getEnrollmentClassName(enrollment) === className;
            const enrollmentYear = String(enrollment.academicYear || "");
            const sameYear =
              !enrollmentYear || enrollmentYear === String(activeTerm.year || "");
            const sameSubject = subjectMatches(
              subjectId,
              subjectName,
              getEnrollmentSubjectId(enrollment),
              getEnrollmentSubject(enrollment)
            );

            return sameClass && sameYear && sameSubject && isEnrollmentActive(enrollment);
          })
          .map((enrollment) => normalizeText(enrollment.studentId))
          .filter(Boolean)
      );

      if (eligibleStudentIds.size === 0) return false;

      const markedStudentIds = new Set(
        marks
          .filter((mark) => {
            const sameClass = getMarkClassName(mark) === className;
            const sameTerm = getMarkTerm(mark) === normalizeText(activeTerm.term);
            const sameYear = getMarkYear(mark) === String(activeTerm.year);
            const sameSubject = subjectMatches(
              subjectId,
              subjectName,
              getMarkSubjectId(mark),
              getMarkSubject(mark)
            );

            return sameClass && sameTerm && sameYear && sameSubject && hasMarkEntry(mark);
          })
          .map((mark) => normalizeText(mark.studentId))
          .filter((studentId) => studentId && eligibleStudentIds.has(studentId))
      );

      return markedStudentIds.size === eligibleStudentIds.size;
    }).length;
  }, [assignments, enrollments, marks, activeTerm]);

  const marksCount = marks.length;
  const isClassTeacher = !!classTeacherClass;

  const monitorStats = useMemo(() => {
    const totalSubjects = subjectProgress.length;
    const done = subjectProgress.filter((s) => s.status === "done").length;
    const partial = subjectProgress.filter((s) => s.status === "partial").length;
    const pending = subjectProgress.filter((s) => s.status === "pending").length;
    const averagePercent = totalSubjects
      ? Math.round(
          subjectProgress.reduce((sum, row) => sum + Number(row.percent || 0), 0) /
            totalSubjects
        )
      : 0;

    return { totalSubjects, done, partial, pending, averagePercent };
  }, [subjectProgress]);

  const statCards = [
    {
      label: "My Students",
      value: students.length,
      subtitle: `${myClasses.length} class${myClasses.length !== 1 ? "es" : ""}`,
      icon: <PeopleIcon sx={{ fontSize: 32, color: "#1a237e" }} />,
      color: "#e8eaf6",
    },
    {
      label: "Marks Entered",
      value: marksCount,
      subtitle: "My assigned subjects",
      icon: <GradeIcon sx={{ fontSize: 32, color: "#1b5e20" }} />,
      color: "#e8f5e9",
    },
    {
      label: "Assignments",
      value: assignments.length,
      subtitle: `${completedAssignmentsCount} completed this term`,
      icon: <MenuBookIcon sx={{ fontSize: 32, color: "#e65100" }} />,
      color: "#fff3e0",
    },
  ];

  const quickActions = [
    {
      title: "Marks Entry",
      description: "Open teacher marks entry for your assigned classes and subjects.",
      buttonText: "Open Marks",
      onClick: () => navigate("/teacher/marks"),
      icon: <EditNoteIcon sx={{ color: "#1a237e" }} />,
    },
    {
      title: "Student Reports",
      description: "Open report cards for students in your assigned classes.",
      buttonText: "Open Students",
      onClick: () => navigate("/teacher/marks"),
      icon: <AssessmentIcon sx={{ color: "#2e7d32" }} />,
    },
    isClassTeacher
      ? {
          title: "Class Teacher Report",
          description: "Monitor completion and overall class progress.",
          buttonText: "Open Report",
          onClick: () => navigate("/teacher/class-report"),
          icon: <BarChartIcon sx={{ color: "#6a1b9a" }} />,
        }
      : null,
  ].filter(Boolean);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          mb: 3,
          borderRadius: 4,
          border: "1px solid #e8eaf6",
          background:
            "linear-gradient(135deg, rgba(26,35,126,0.08) 0%, rgba(255,255,255,1) 60%)",
          boxShadow: "0 4px 18px rgba(26,35,126,0.08)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <SchoolIcon sx={{ color: "#1a237e" }} />
              <Typography
                variant={isMobile ? "h6" : "h4"}
                fontWeight={800}
                color="#1a237e"
              >
                Welcome, {profile?.name || "Teacher"}
              </Typography>
            </Stack>

            <Typography variant="body1" color="text.secondary">
              Teacher dashboard for assignments, marks entry, and class progress
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5}>
              <Chip
                icon={<MenuBookIcon />}
                label={`${assignments.length} Assignment${
                  assignments.length !== 1 ? "s" : ""
                }`}
                color="primary"
                size="small"
              />

              {activeTerm ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Active Term: ${activeTerm.term} ${activeTerm.year}`}
                  color="success"
                  size="small"
                />
              ) : (
                <Chip
                  icon={<WarningIcon />}
                  label="No Active Term"
                  color="warning"
                  size="small"
                />
              )}

              {isClassTeacher && classTeacherClass ? (
                <Chip
                  label={`Class Teacher · G${classTeacherClass.grade}-${classTeacherClass.section}`}
                  color="secondary"
                  size="small"
                />
              ) : null}
            </Stack>
          </Box>

          <Stack direction={{ xs: "row", md: "column" }} spacing={1}>
            <Button
              variant="contained"
              onClick={() => navigate("/teacher/marks")}
              sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
            >
              Open Marks Entry
            </Button>

            {isClassTeacher && (
              <Button
                variant="outlined"
                onClick={() => navigate("/teacher/class-report")}
                sx={{ borderColor: "#1a237e", color: "#1a237e" }}
              >
                Class Report
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {assignments.length === 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          You have no subject assignments yet. Ask admin to assign your classes and subjects.
        </Alert>
      )}

      <Grid container spacing={2} mb={3}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={4} key={card.label}>
            <StatCard
              title={card.label}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              bg={card.color}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} mb={3}>
        {quickActions.map((item) => (
          <Grid item xs={12} md={4} key={item.title}>
            <QuickActionCard {...item} />
          </Grid>
        ))}
      </Grid>

      {isClassTeacher && classTeacherClass && (
        <Box mb={3}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid #e8eaf6",
              boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={1.5}
              mb={2}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700} color="#1a237e">
                  Class Progress Monitor
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Grade {classTeacherClass.grade}-{classTeacherClass.section}
                  {activeTerm ? ` · ${activeTerm.term} ${activeTerm.year}` : ""}
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={<BarChartIcon />}
                onClick={() => navigate("/teacher/class-report")}
                sx={{ borderColor: "#1a237e", color: "#1a237e" }}
              >
                Full Class Report
              </Button>
            </Stack>

            {!activeTerm ? (
              <Alert severity="warning">
                No active term. Ask admin to activate a term.
              </Alert>
            ) : subjectProgress.length === 0 ? (
              <Alert severity="info">No class progress data available yet.</Alert>
            ) : (
              <>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  <Chip
                    label={`Subjects: ${monitorStats.totalSubjects}`}
                    color="primary"
                    size="small"
                  />
                  <Chip
                    label={`Done: ${monitorStats.done}`}
                    color="success"
                    size="small"
                  />
                  <Chip
                    label={`Partial: ${monitorStats.partial}`}
                    color="warning"
                    size="small"
                  />
                  <Chip
                    label={`Pending: ${monitorStats.pending}`}
                    color="error"
                    size="small"
                  />
                  <Chip
                    label={`Average Progress: ${monitorStats.averagePercent}%`}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                {isMobile ? (
                  <Box>
                    {subjectProgress.map((sp) => (
                      <Card
                        key={sp.subject}
                        variant="outlined"
                        sx={{
                          mb: 1.2,
                          borderRadius: 2,
                          bgcolor:
                            sp.status === "done"
                              ? "#f1f8f1"
                              : sp.status === "partial"
                              ? "#fffde7"
                              : "#fff5f5",
                        }}
                      >
                        <CardContent>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mb={1}
                          >
                            <Typography variant="body2" fontWeight={700}>
                              {sp.subject}
                            </Typography>
                            <Chip
                              label={statusLabel(sp.status)}
                              size="small"
                              color={statusColor(sp.status)}
                            />
                          </Box>

                          <LinearProgress
                            variant="determinate"
                            value={sp.percent}
                            sx={{
                              height: 7,
                              borderRadius: 4,
                              bgcolor: "#e0e0e0",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: progressBarColor(sp.status),
                              },
                            }}
                          />

                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mt={0.8}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {sp.entered}/{sp.total} students
                            </Typography>
                            <Typography variant="caption" fontWeight={700}>
                              {sp.percent}%
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#1a237e" }}>
                        <TableRow>
                          {["#", "Subject", "Progress", "Students", "%", "Status"].map(
                            (head) => (
                              <TableCell
                                key={head}
                                sx={{ color: "white", fontWeight: 600 }}
                              >
                                {head}
                              </TableCell>
                            )
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {subjectProgress.map((sp, idx) => (
                          <TableRow
                            key={sp.subject}
                            hover
                            sx={{
                              bgcolor:
                                sp.status === "done"
                                  ? "#f1f8f1"
                                  : sp.status === "partial"
                                  ? "#fffde7"
                                  : "#fff5f5",
                            }}
                          >
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>
                                {sp.subject}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 160 }}>
                              <LinearProgress
                                variant="determinate"
                                value={sp.percent}
                                sx={{
                                  height: 8,
                                  borderRadius: 4,
                                  bgcolor: "#e0e0e0",
                                  "& .MuiLinearProgress-bar": {
                                    bgcolor: progressBarColor(sp.status),
                                  },
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              {sp.entered} / {sp.total}
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                color={progressBarColor(sp.status)}
                              >
                                {sp.percent}%
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={statusLabel(sp.status)}
                                size="small"
                                color={statusColor(sp.status)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                )}
              </>
            )}
          </Paper>
        </Box>
      )}

      {Object.keys(groupedClasses).length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
            My Teaching Assignments
          </Typography>

          <Grid container spacing={1.5}>
            {Object.entries(groupedClasses).map(([classLabel, subjects]) => (
              <Grid item xs={12} sm={6} md={4} key={classLabel}>
                <Paper
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 1px 6px rgba(26,35,126,0.07)",
                    height: "100%",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    color="#1a237e"
                    mb={1}
                  >
                    {classLabel}
                  </Typography>

                  <Box display="flex" flexWrap="wrap" gap={0.6}>
                    {subjects.map((subject) => (
                      <Chip
                        key={`${classLabel}-${subject}`}
                        label={subject}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    ))}
                  </Box>

                  <Button
                    size="small"
                    variant="text"
                    startIcon={<EditNoteIcon />}
                    sx={{ mt: 1.2, color: "#1a237e", p: 0 }}
                    onClick={() => navigate("/teacher/marks")}
                  >
                    Enter Marks
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Paper
            sx={{
              borderRadius: 3,
              boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
              border: "1px solid #e8eaf6",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: "#1a237e",
                color: "white",
              }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                My Students ({students.length})
              </Typography>
            </Box>

            {isMobile ? (
              <Box p={1.5}>
                {students.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textAlign="center"
                    py={2}
                  >
                    No students found in your assigned classes.
                  </Typography>
                ) : (
                  students.map((student, idx) => (
                    <Card key={student.id} variant="outlined" sx={{ mb: 1.2, borderRadius: 2 }}>
                      <CardContent sx={{ pb: 1.2 }}>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Avatar sx={{ bgcolor: "#1a237e", width: 36, height: 36 }}>
                            {getInitials(getStudentName(student))}
                          </Avatar>

                          <Box flex={1}>
                            <Typography variant="body2" fontWeight={700}>
                              {getStudentName(student)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Adm: {getStudentAdmissionNo(student) || "—"} · G
                              {parseGrade(student.grade)}-{getStudentSection(student)}
                            </Typography>
                          </Box>

                          <Typography variant="caption" color="text.secondary">
                            #{idx + 1}
                          </Typography>
                        </Stack>

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AssessmentIcon />}
                          sx={{ mt: 1.2, borderColor: "#1a237e", color: "#1a237e" }}
                          onClick={() => navigate(`/teacher/report/${student.id}`)}
                        >
                          Report
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>
            ) : (
              <Table size="small">
                <TableHead sx={{ bgcolor: "#f5f7ff" }}>
                  <TableRow>
                    {["#", "Adm No", "Name", "Grade", "Gender", "Action"].map((head) => (
                      <TableCell key={head} sx={{ fontWeight: 700 }}>
                        {head}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((student, idx) => (
                    <TableRow key={student.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{getStudentAdmissionNo(student) || "—"}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Avatar
                            sx={{
                              width: 30,
                              height: 30,
                              bgcolor: "#1a237e",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {getInitials(getStudentName(student))}
                          </Avatar>
                          <Typography variant="body2" fontWeight={700}>
                            {getStudentName(student)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`G${parseGrade(student.grade)}-${getStudentSection(student)}`}
                          size="small"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>{student.gender || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AssessmentIcon />}
                          onClick={() => navigate(`/teacher/report/${student.id}`)}
                          sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                        >
                          Report
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No students found in your assigned classes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {students.length > 0 && (
              <Box p={2}>
                <Button
                  variant="contained"
                  fullWidth={isMobile}
                  startIcon={<EditNoteIcon />}
                  sx={{ bgcolor: "#1a237e" }}
                  onClick={() => navigate("/teacher/marks")}
                >
                  Go to Marks Entry
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 3,
              boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
              border: "1px solid #e8eaf6",
              height: "100%",
            }}
          >
            <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
              Teaching Snapshot
            </Typography>

            <Stack spacing={1.2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Assigned classes
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {myClasses.length}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Assigned subjects
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {assignments.length}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Completed assignments
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {completedAssignmentsCount}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Students in scope
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {students.length}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Marks in scope
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {marksCount}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Class teacher role
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {isClassTeacher ? "Yes" : "No"}
                </Typography>
              </Box>

              {isClassTeacher && classTeacherClass && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Class teacher class
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    G{classTeacherClass.grade}-{classTeacherClass.section}
                  </Typography>
                </Box>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              Quick Links
            </Typography>

            <Stack spacing={1}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate("/teacher/marks")}
                sx={{
                  justifyContent: "space-between",
                  borderColor: "#e8eaf6",
                  color: "#1a237e",
                }}
                endIcon={<ArrowForwardIcon />}
              >
                Marks Entry
              </Button>

              {isClassTeacher && (
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate("/teacher/class-report")}
                  sx={{
                    justifyContent: "space-between",
                    borderColor: "#e8eaf6",
                    color: "#1a237e",
                  }}
                  endIcon={<ArrowForwardIcon />}
                >
                  Class Report
                </Button>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}