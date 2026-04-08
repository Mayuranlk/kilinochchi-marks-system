import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  EmptyState,
  MobileListRow,
  PageContainer,
  StatCard,
  StatusChip,
} from "../components/ui";
import {
  normalizeText,
  isALGrade,
  buildALClassName,
  buildALDisplayClassName,
} from "../constants";

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const sanitizePhone = (phone) => String(phone || "").replace(/[^\d+]/g, "");

const buildTermKey = (term) =>
  `${pick(term.term, term.termName, "")}__${pick(term.year, term.academicYear, "")}`;

const buildTermLabel = (term) => {
  const termName = pick(term.term, term.termName, term.name, "Term");
  const year = pick(term.year, term.academicYear, "");
  return year ? `${termName} - ${year}` : termName;
};

const isActiveTerm = (term) => {
  const raw = pick(term.isActive, term.active, term.status);
  if (typeof raw === "boolean") return raw;
  return normalize(raw) === "active" || normalize(raw) === "true";
};

const parseGrade = (value) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const normalizeSection = (value) => {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
};

const normalizeAcademicYear = (value) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  return match ? match[0] : raw;
};

const getResolvedStream = (row = {}, fallback = {}) =>
  normalizeText(pick(row.stream, fallback.stream, ""));

const getResolvedSection = (row = {}, fallback = {}) =>
  normalizeSection(pick(row.section, row.className, fallback.section, fallback.className, ""));

const getResolvedGrade = (row = {}, fallback = {}) =>
  parseGrade(pick(row.grade, fallback.grade, ""));

const getComparableALClassName = (row = {}, fallback = {}) => {
  const explicit = pick(row.fullClassName, row.alClassName, "");
  if (explicit) return explicit;

  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return "";
};

const getClassDisplayName = (row = {}, fallback = {}) => {
  const explicitFull = pick(
    row.fullClassName,
    row.alClassName,
    fallback.fullClassName,
    fallback.alClassName,
    ""
  );
  if (explicitFull) return explicitFull;

  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  if (grade && section) return `${grade}${section}`;
  return normalizeText(pick(row.className, fallback.className, ""));
};

const getClassShortDisplayName = (row = {}, fallback = {}) => {
  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALDisplayClassName(grade, stream, section) || getClassDisplayName(row, fallback);
  }

  if (grade && section) return `${grade}${section}`;
  return normalizeText(pick(row.className, fallback.className, ""));
};

const getClassContext = (row = {}, fallback = {}) => {
  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  return {
    grade,
    section,
    stream,
    className: pick(row.className, fallback.className, ""),
    alClassName: pick(row.alClassName, fallback.alClassName, ""),
    fullClassName:
      getComparableALClassName(row, fallback) || getClassDisplayName(row, fallback),
  };
};

const matchesClassContext = (row = {}, target = {}, fallback = {}) => {
  const rowGrade = getResolvedGrade(row, fallback);
  const rowSection = getResolvedSection(row, fallback);
  const rowStream = normalize(getResolvedStream(row, fallback));

  const targetGrade = parseGrade(target.grade);
  const targetSection = normalizeSection(target.section);
  const targetStream = normalize(target.stream);

  const rowClassIdentity = normalize(
    getComparableALClassName(row, fallback) ||
      pick(row.fullClassName, row.alClassName, row.className, "") ||
      getClassDisplayName(row, fallback)
  );

  const targetClassIdentity = normalize(
    pick(target.fullClassName, target.alClassName, target.className, "")
  );

  if (isALGrade(targetGrade)) {
    if (rowClassIdentity && targetClassIdentity && rowClassIdentity === targetClassIdentity) {
      return true;
    }

    if (rowGrade !== targetGrade || rowSection !== targetSection) {
      return false;
    }

    if (!targetStream) {
      return true;
    }

    if (rowStream) {
      return rowStream === targetStream;
    }

    return false;
  }

  if (rowClassIdentity && targetClassIdentity) {
    return rowClassIdentity === targetClassIdentity;
  }

  return rowGrade === targetGrade && rowSection === targetSection;
};

const getSubjectIdentity = (row = {}) => {
  const subjectId = normalize(pick(row.subjectId, ""));
  const subjectNumber = normalize(pick(row.subjectNumber, ""));
  const subjectName = normalize(pick(row.subjectName, row.subject, ""));

  if (subjectId) return `id:${subjectId}`;
  if (subjectNumber) return `no:${subjectNumber}`;
  return `name:${subjectName}`;
};

const matchesSubject = (row = {}, subjectRow = {}) => {
  const rowSubjectId = normalize(pick(row.subjectId, ""));
  const rowSubjectNumber = normalize(pick(row.subjectNumber, ""));
  const rowSubjectName = normalize(pick(row.subjectName, row.subject, ""));

  const targetSubjectId = normalize(pick(subjectRow.subjectId, ""));
  const targetSubjectNumber = normalize(pick(subjectRow.subjectNumber, ""));
  const targetSubjectName = normalize(pick(subjectRow.subjectName, subjectRow.subject, ""));

  if (targetSubjectId && rowSubjectId) {
    return rowSubjectId === targetSubjectId;
  }

  if (targetSubjectNumber && rowSubjectNumber) {
    return rowSubjectNumber === targetSubjectNumber;
  }

  if (targetSubjectName && rowSubjectName) {
    return rowSubjectName === targetSubjectName;
  }

  return false;
};

const dedupeBy = (items = [], buildKey) => {
  const map = new Map();
  items.forEach((item) => {
    const key = buildKey(item);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

const isCompletedForSubject = (
  students,
  marks,
  classContext,
  subjectRow,
  targetTerm
) => {
  const targetYear = normalizeAcademicYear(targetTerm.year);
  const targetTermName = normalize(pick(targetTerm.term, targetTerm.termName, ""));

  const subjectStudentsRaw = students.filter((enrollment) => {
    const sameClass = matchesClassContext(enrollment, classContext);
    const sameSubject = matchesSubject(enrollment, subjectRow);
    const sameYear =
      normalizeAcademicYear(pick(enrollment.academicYear, enrollment.year, "")) === targetYear;

    return sameClass && sameSubject && sameYear;
  });

  const subjectStudents = dedupeBy(
    subjectStudentsRaw,
    (row) => String(pick(row.studentId, row.id, "")).trim()
  );

  const studentIds = new Set(
    subjectStudents.map((row) => String(pick(row.studentId, row.id, "")).trim()).filter(Boolean)
  );

  const subjectMarksRaw = marks.filter((mark) => {
    const sameClass = matchesClassContext(mark, classContext);
    const sameSubject = matchesSubject(mark, subjectRow);
    const sameTerm = normalize(pick(mark.term, mark.termName, "")) === targetTermName;
    const sameYear =
      normalizeAcademicYear(pick(mark.academicYear, mark.year, "")) === targetYear;
    const studentId = String(pick(mark.studentId, "")).trim();

    return sameClass && sameSubject && sameTerm && sameYear && studentIds.has(studentId);
  });

  const subjectMarks = dedupeBy(subjectMarksRaw, (row) => String(pick(row.studentId, "")).trim());

  const doneCount = subjectMarks.length;
  const total = subjectStudents.length;
  const pending = Math.max(0, total - doneCount);
  const progress = total ? Math.round((doneCount / total) * 100) : 0;
  const completed = total > 0 && doneCount === total;

  return {
    total,
    doneCount,
    pending,
    progress,
    completed,
  };
};

const sectionCardSx = {
  borderRadius: 3,
  border: "1px solid #e8eaf6",
  boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
  backgroundColor: "white",
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [terms, setTerms] = useState([]);
  const [selectedTermKey, setSelectedTermKey] = useState("");

  const [teacherName, setTeacherName] = useState("Teacher");
  const [subjectRows, setSubjectRows] = useState([]);
  const [classTeacherData, setClassTeacherData] = useState(null);

  const activeTerm = useMemo(
    () => terms.find((term) => buildTermKey(term) === selectedTermKey) || null,
    [terms, selectedTermKey]
  );

  const loadDashboard = async (silent = false) => {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      const user = auth.currentUser;
      if (!user) throw new Error("User is not logged in.");

      const [
        usersSnap,
        assignmentsSnap,
        classroomsSnap,
        enrollmentsSnap,
        marksSnap,
        termsSnap,
      ] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "teacherAssignments")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "marks")),
        getDocs(collection(db, "academicTerms")),
      ]);

      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const assignments = assignmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const classrooms = classroomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const enrollments = enrollmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const marks = marksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const loadedTerms = termsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const currentTeacher =
        users.find(
          (u) =>
            normalize(u.id) === normalize(user.uid) ||
            normalize(u.uid) === normalize(user.uid) ||
            normalize(u.email) === normalize(user.email)
        ) || null;

      setTeacherName(
        pick(currentTeacher?.name, currentTeacher?.fullName, user.displayName, "Teacher")
      );

      const sortedTerms = [...loadedTerms].sort((a, b) => {
        const yearDiff =
          Number(pick(b.year, b.academicYear, 0)) -
          Number(pick(a.year, a.academicYear, 0));
        if (yearDiff !== 0) return yearDiff;
        return String(pick(a.term, a.termName, "")).localeCompare(
          String(pick(b.term, b.termName, ""))
        );
      });

      setTerms(sortedTerms);

      const defaultTerm = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;
      const effectiveTermKey =
        selectedTermKey || (defaultTerm ? buildTermKey(defaultTerm) : "");

      if (!selectedTermKey && defaultTerm) {
        setSelectedTermKey(effectiveTermKey);
      }

      const chosenTerm =
        sortedTerms.find((term) => buildTermKey(term) === effectiveTermKey) || defaultTerm;

      const targetTerm = {
        term: pick(chosenTerm?.term, chosenTerm?.termName, ""),
        year: String(pick(chosenTerm?.year, chosenTerm?.academicYear, "")),
      };

      const myAssignments = assignments.filter(
        (assignment) =>
          normalize(assignment.teacherId) === normalize(user.uid) ||
          normalize(assignment.teacherEmail) === normalize(user.email)
      );

      const dedupedAssignments = dedupeBy(myAssignments, (assignment) => {
        const classIdentity = normalize(getClassDisplayName(assignment));
        const subjectIdentity = getSubjectIdentity(assignment);
        const stream = normalize(getResolvedStream(assignment));
        return `${classIdentity}__${subjectIdentity}__${stream}`;
      });

      const dedupedSubjectRowsMap = new Map();

      dedupedAssignments.forEach((assignment) => {
        const classIdentity = getClassDisplayName(assignment);
        const classShort = getClassShortDisplayName(assignment);
        const classContext = getClassContext(assignment);
        const subjectName = pick(assignment.subjectName, assignment.subject, "");
        const subjectId = pick(assignment.subjectId, "");
        const subjectNumber = pick(assignment.subjectNumber, "");
        const stream = normalizeText(assignment.stream);

        if (!subjectName && !subjectId && !subjectNumber) return;

        const progressInfo = isCompletedForSubject(
          enrollments,
          marks,
          classContext,
          {
            subjectName,
            subjectId,
            subjectNumber,
          },
          targetTerm
        );

        const rowKey = `${normalize(classIdentity)}__${getSubjectIdentity({
          subjectId,
          subjectName,
          subjectNumber,
        })}__${normalize(stream)}`;

        if (!dedupedSubjectRowsMap.has(rowKey)) {
          dedupedSubjectRowsMap.set(rowKey, {
            className: pick(assignment.className, ""),
            fullClassName: classIdentity,
            displayClassName: classShort,
            stream,
            streamCode: pick(assignment.streamCode, ""),
            subjectName,
            subjectId,
            subjectNumber,
            total: progressInfo.total,
            done: progressInfo.doneCount,
            pending: progressInfo.pending,
            progress: progressInfo.progress,
          });
        }
      });

      const mySubjectRows = Array.from(dedupedSubjectRowsMap.values()).sort((a, b) => {
        const classDiff = String(a.fullClassName).localeCompare(String(b.fullClassName), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (classDiff !== 0) return classDiff;
        return String(a.subjectName).localeCompare(String(b.subjectName), undefined, {
          sensitivity: "base",
        });
      });

      setSubjectRows(mySubjectRows);

      const myClass = classrooms.find(
        (c) =>
          normalize(c.classTeacherId) === normalize(user.uid) ||
          normalize(c.classTeacherEmail) === normalize(user.email)
      );

      if (myClass) {
        const classIdentity = getClassDisplayName(myClass);
        const classContext = getClassContext(myClass);
        const classStream = normalizeText(myClass.stream);

        const classStudentsRaw = enrollments.filter(
          (enrollment) =>
            matchesClassContext(enrollment, classContext) &&
            normalizeAcademicYear(pick(enrollment.academicYear, enrollment.year, "")) ===
              normalizeAcademicYear(targetTerm.year)
        );

        const classStudents = dedupeBy(
          classStudentsRaw,
          (row) => String(pick(row.studentId, row.id, "")).trim()
        );

        const uniqueStudentIds = new Set(
          classStudents.map((student) => String(pick(student.studentId, student.id, "")).trim()).filter(Boolean)
        );

        const dedupedClassSubjects = new Map();

        dedupeBy(
          assignments.filter((assignment) => matchesClassContext(assignment, classContext)),
          (assignment) => `${getSubjectIdentity(assignment)}__${normalize(getResolvedStream(assignment))}`
        ).forEach((assignment) => {
          const teacherUser =
            users.find(
              (u) =>
                normalize(u.id) === normalize(assignment.teacherId) ||
                normalize(u.email) === normalize(assignment.teacherEmail)
            ) || null;

          const subjectName = pick(assignment.subjectName, assignment.subject, "");
          const subjectId = pick(assignment.subjectId, "");
          const subjectNumber = pick(assignment.subjectNumber, "");

          if (!subjectName && !subjectId && !subjectNumber) return;

          const progressInfo = isCompletedForSubject(
            enrollments,
            marks,
            getClassContext(assignment),
            {
              subjectName,
              subjectId,
              subjectNumber,
            },
            targetTerm
          );

          const isMine =
            normalize(assignment.teacherId) === normalize(user.uid) ||
            normalize(assignment.teacherEmail) === normalize(user.email);

          const rowKey = `${getSubjectIdentity({ subjectId, subjectName, subjectNumber })}__${normalize(
            getResolvedStream(assignment)
          )}`;

          if (!dedupedClassSubjects.has(rowKey)) {
            dedupedClassSubjects.set(rowKey, {
              subjectName,
              subjectId,
              subjectNumber,
              teacherName: pick(
                teacherUser?.name,
                teacherUser?.fullName,
                assignment.teacherName,
                "Teacher"
              ),
              teacherPhone: pick(teacherUser?.phone, ""),
              total: progressInfo.total,
              done: progressInfo.doneCount,
              pending: progressInfo.pending,
              progress: progressInfo.progress,
              completed: progressInfo.completed,
              isMine,
            });
          }
        });

        const classSubjects = Array.from(dedupedClassSubjects.values()).sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return String(a.subjectName).localeCompare(String(b.subjectName), undefined, {
            sensitivity: "base",
          });
        });

        const completedCount = classSubjects.filter((subject) => subject.completed).length;
        const pendingCount = classSubjects.length - completedCount;

        setClassTeacherData({
          className: pick(myClass.className, ""),
          fullClassName: classIdentity,
          displayClassName: getClassShortDisplayName(myClass),
          stream: classStream,
          totalStudents: uniqueStudentIds.size,
          totalSubjects: classSubjects.length,
          completed: completedCount,
          pending: pendingCount,
          progress: classSubjects.length
            ? Math.round((completedCount / classSubjects.length) * 100)
            : 0,
          subjects: classSubjects,
        });
      } else {
        setClassTeacherData(null);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load teacher dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTermKey) {
      loadDashboard(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTermKey]);

  const openMarks = useCallback(
    (row) => {
      const params = new URLSearchParams();

      params.set("fullClassName", row.fullClassName || "");
      params.set("stream", row.stream || "");
      params.set("subjectName", row.subjectName || "");
      params.set("subjectId", row.subjectId || "");

      if (selectedTermKey) params.set("termKey", selectedTermKey);

      navigate(`/teacher/marks?${params.toString()}`);
    },
    [navigate, selectedTermKey]
  );

  if (loading) {
    return (
      <PageContainer title="Teacher Dashboard">
        <Box textAlign="center" py={6}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Teacher Dashboard"
      subtitle={`Welcome ${teacherName}`}
      actions={
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
          onClick={() => loadDashboard(true)}
        >
          Refresh
        </Button>
      }
    >
      <Stack spacing={2.25}>
        {error ? <Alert severity="error">{error}</Alert> : null}

        <Paper
          sx={{
            ...sectionCardSx,
            p: 2,
            position: { xs: "sticky", md: "static" },
            top: { xs: 76, md: "auto" },
            zIndex: { xs: 2, md: "auto" },
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
                  Current View
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Review marks completion by class and subject.
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="teacher-dashboard-term-label">Academic Term</InputLabel>
                <Select
                  labelId="teacher-dashboard-term-label"
                  label="Academic Term"
                  value={selectedTermKey}
                  onChange={(e) => setSelectedTermKey(e.target.value)}
                >
                  {terms.map((term) => (
                    <MenuItem key={term.id} value={buildTermKey(term)}>
                      {buildTermLabel(term)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                justifyContent={{ xs: "flex-start", md: "flex-end" }}
              >
                {activeTerm ? <Chip label={buildTermLabel(activeTerm)} color="primary" /> : null}
                <Chip label={`Subject Assignments: ${subjectRows.length}`} />
                <Chip label={`Class Teacher Roles: ${classTeacherData ? 1 : 0}`} />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {isMobile ? (
          <Paper sx={{ ...sectionCardSx, p: 1.5 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1a237e" }}>
                Quick Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusChip
                  status="active"
                  label={`${new Set(subjectRows.map((row) => row.fullClassName)).size} classes`}
                />
                <StatusChip status="saved" label={`${subjectRows.length} subjects`} />
                <StatusChip
                  status="completed"
                  label={`${subjectRows.filter((row) => row.pending === 0 && row.total > 0).length} completed`}
                />
                <StatusChip
                  status="pending"
                  label={`${subjectRows.filter((row) => row.pending > 0 || row.total === 0).length} pending`}
                />
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}>
              <StatCard
                title="Assigned Classes"
                value={new Set(subjectRows.map((row) => row.fullClassName)).size}
                icon={<ClassRoundedIcon />}
                color="primary"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                title="Assigned Subjects"
                value={subjectRows.length}
                icon={<MenuBookRoundedIcon />}
                color="secondary"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                title="Completed"
                value={subjectRows.filter((row) => row.pending === 0 && row.total > 0).length}
                icon={<CheckCircleRoundedIcon />}
                color="success"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                title="Pending"
                value={subjectRows.filter((row) => row.pending > 0 || row.total === 0).length}
                icon={<HourglassBottomRoundedIcon />}
                color="warning"
              />
            </Grid>
          </Grid>
        )}

        {classTeacherData && (
          <Paper sx={{ ...sectionCardSx, p: 2.25 }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={1}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
                    Class Monitoring
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {classTeacherData.fullClassName}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {classTeacherData.stream ? (
                    <Chip
                      label={classTeacherData.stream}
                      color="secondary"
                      variant="outlined"
                    />
                  ) : null}
                  <Chip
                    label={`${classTeacherData.progress}% Completed`}
                    color={classTeacherData.progress === 100 ? "success" : "warning"}
                  />
                </Stack>
              </Stack>

              {isMobile ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <StatusChip status="active" label={`${classTeacherData.totalStudents} students`} />
                  <StatusChip status="saved" label={`${classTeacherData.totalSubjects} subjects`} />
                  <StatusChip status="completed" label={`${classTeacherData.completed} completed`} />
                  <StatusChip status="pending" label={`${classTeacherData.pending} pending`} />
                </Stack>
              ) : (
                <Grid container spacing={1.25}>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Students"
                      value={classTeacherData.totalStudents}
                      icon={<GroupRoundedIcon />}
                      color="primary"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Subjects"
                      value={classTeacherData.totalSubjects}
                      icon={<MenuBookRoundedIcon />}
                      color="secondary"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Completed"
                      value={classTeacherData.completed}
                      icon={<CheckCircleRoundedIcon />}
                      color="success"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Pending"
                      value={classTeacherData.pending}
                      icon={<HourglassBottomRoundedIcon />}
                      color="error"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                </Grid>
              )}

              <Box>
                <LinearProgress
                  variant="determinate"
                  value={classTeacherData.progress}
                  sx={{ height: 8, borderRadius: 5 }}
                />
                <Typography variant="body2" color="text.secondary" mt={0.75}>
                  {classTeacherData.progress}% overall class completion
                </Typography>
              </Box>

              <Stack spacing={1}>
                {classTeacherData.subjects.length === 0 ? (
                  <EmptyState title="No subjects assigned to this class" />
                ) : (
                  classTeacherData.subjects.map((subject) =>
                    isMobile ? (
                      <MobileListRow
                        key={subject.subjectId || `${subject.subjectName}_${subject.subjectNumber}`}
                        compact
                        title={subject.subjectName}
                        subtitle={`${subject.done}/${subject.total} students`}
                        right={
                          <StatusChip
                            status={subject.completed ? "completed" : "pending"}
                            label={subject.completed ? "Completed" : "Pending"}
                          />
                        }
                        meta={
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {subject.subjectNumber ? (
                              <Chip size="small" variant="outlined" label={`No. ${subject.subjectNumber}`} />
                            ) : null}
                            <Chip size="small" variant="outlined" label={`${subject.progress}%`} />
                            <Chip size="small" variant="outlined" label={subject.teacherName} />
                          </Stack>
                        }
                        footer={
                          <Stack spacing={1}>
                            {!subject.completed && subject.teacherPhone ? (
                              <Link
                                href={`tel:${sanitizePhone(subject.teacherPhone)}`}
                                underline="hover"
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                  fontWeight: 700,
                                  width: "fit-content",
                                }}
                              >
                                <PhoneRoundedIcon sx={{ fontSize: 18 }} />
                                {subject.teacherPhone}
                              </Link>
                            ) : null}

                            {subject.isMine ? (
                              <Button
                                variant="outlined"
                                startIcon={<EditNoteRoundedIcon />}
                                onClick={() =>
                                  openMarks({
                                    className: classTeacherData.className,
                                    fullClassName: classTeacherData.fullClassName,
                                    stream: classTeacherData.stream,
                                    subjectName: subject.subjectName,
                                    subjectId: subject.subjectId,
                                  })
                                }
                                fullWidth
                              >
                                Enter Marks
                              </Button>
                            ) : null}
                          </Stack>
                        }
                        sx={{
                          bgcolor: subject.completed
                            ? "rgba(34,197,94,0.06)"
                            : "rgba(239,68,68,0.04)",
                        }}
                      />
                    ) : (
                      <Box
                        key={subject.subjectId || `${subject.subjectName}_${subject.subjectNumber}`}
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: subject.completed
                            ? "rgba(34,197,94,0.06)"
                            : "rgba(239,68,68,0.04)",
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            spacing={1}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                  {subject.subjectName}
                                </Typography>
                                {subject.subjectNumber ? (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`No. ${subject.subjectNumber}`}
                                  />
                                ) : null}
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                {subject.done}/{subject.total} students
                              </Typography>
                            </Box>

                            <StatusChip
                              status={subject.completed ? "completed" : "pending"}
                              label={subject.completed ? "Completed" : "Pending"}
                            />
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Typography variant="body2" color="text.secondary">
                              {subject.progress}%
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                              {subject.teacherName}
                            </Typography>
                          </Stack>

                          {!subject.completed && subject.teacherPhone ? (
                            <Link
                              href={`tel:${sanitizePhone(subject.teacherPhone)}`}
                              underline="hover"
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.75,
                                fontWeight: 700,
                                width: "fit-content",
                              }}
                            >
                              <PhoneRoundedIcon sx={{ fontSize: 18 }} />
                              {subject.teacherPhone}
                            </Link>
                          ) : null}

                          {subject.isMine ? (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<EditNoteRoundedIcon />}
                              onClick={() =>
                                openMarks({
                                  className: classTeacherData.className,
                                  fullClassName: classTeacherData.fullClassName,
                                  stream: classTeacherData.stream,
                                  subjectName: subject.subjectName,
                                  subjectId: subject.subjectId,
                                })
                              }
                              sx={{ alignSelf: "flex-start" }}
                            >
                              Enter Marks
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>
                    )
                  )
                )}
              </Stack>
            </Stack>
          </Paper>
        )}

        <Paper sx={{ ...sectionCardSx, p: 2.25 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
                  My Subject Work
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter marks for the subjects assigned to you.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<AutoStoriesRoundedIcon />}
                  label={`${subjectRows.length} Subjects`}
                  variant="outlined"
                />
                <Chip
                  icon={<TimelineRoundedIcon />}
                  label={`${subjectRows.filter((row) => row.pending > 0 || row.total === 0).length} Pending`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            </Stack>

            {subjectRows.length === 0 ? (
              <EmptyState title="No assignments" />
            ) : (
              <Grid container spacing={1.5}>
                {subjectRows.map((row, i) => (
                  <Grid item xs={12} md={6} key={`${row.fullClassName}_${row.subjectId}_${row.subjectName}_${i}`}>
                    <MobileListRow
                      compact={isMobile}
                      title={`${row.displayClassName} - ${row.subjectName}`}
                      right={
                        <StatusChip
                          status={row.pending > 0 || row.total === 0 ? "pending" : "completed"}
                          label={row.pending > 0 || row.total === 0 ? "Pending" : "Completed"}
                        />
                      }
                      meta={
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {row.stream ? (
                            <Chip size="small" variant="outlined" label={row.stream} />
                          ) : null}
                          {row.subjectNumber ? (
                            <Chip size="small" variant="outlined" label={`No. ${row.subjectNumber}`} />
                          ) : null}
                        </Stack>
                      }
                      footer={
                        <Stack spacing={1}>
                          <Typography variant="body2" color="text.secondary">
                            {row.done}/{row.total} students completed
                          </Typography>

                          <LinearProgress
                            variant="determinate"
                            value={row.progress}
                            sx={{ height: 6, borderRadius: 5 }}
                          />

                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">
                              {row.progress}%
                            </Typography>

                            <Typography variant="body2">
                              {row.done}/{row.total}
                            </Typography>
                          </Stack>

                          <Button
                            variant="contained"
                            size={isMobile ? "medium" : "small"}
                            startIcon={<EditNoteRoundedIcon />}
                            onClick={() => openMarks(row)}
                            fullWidth={isMobile}
                          >
                            Enter Marks
                          </Button>
                        </Stack>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        </Paper>
      </Stack>
    </PageContainer>
  );
}
