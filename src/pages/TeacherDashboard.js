import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Typography,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  EmptyState,
  FilterCard,
  MobileListRow,
  PageContainer,
  SectionCard,
  StatCard,
  StatusChip,
} from "../components/ui";

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const asNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const makeClassName = (item = {}) =>
  pick(
    item.className,
    item.fullClassName,
    item.assignedClass,
    item.classLabel,
    `${pick(item.grade, item.classGrade, "")}${pick(item.section, item.classSection, "")}`.trim()
  );

const isActiveTerm = (term) => {
  const raw = pick(term.isActive, term.active, term.status);
  if (typeof raw === "boolean") return raw;
  return normalize(raw) === "active" || normalize(raw) === "true";
};

const buildTermLabel = (term) => {
  const termName = pick(term.term, term.termName, term.name, "Term");
  const year = pick(term.year, term.academicYear, "");
  return year ? `${termName} - ${year}` : termName;
};

function isTeacherMatch(item, currentUser, profile) {
  const idCandidates = [
    pick(item.teacherId),
    pick(item.teacherUid),
    pick(item.userId),
    pick(item.classTeacherId),
    pick(item.classTeacherUid),
    pick(item.assignedTeacherId),
    pick(item.uid),
  ]
    .map(normalize)
    .filter(Boolean);

  const emailCandidates = [
    pick(item.teacherEmail),
    pick(item.classTeacherEmail),
    pick(item.email),
  ]
    .map(normalize)
    .filter(Boolean);

  const nameCandidates = [
    pick(item.teacherName),
    pick(item.classTeacherName),
    pick(item.name),
    pick(item.fullName),
  ]
    .map(normalize)
    .filter(Boolean);

  const myIds = [
    normalize(currentUser?.uid),
    normalize(profile?.uid),
    normalize(profile?.userId),
    normalize(profile?.id),
  ].filter(Boolean);

  const myEmails = [
    normalize(currentUser?.email),
    normalize(profile?.email),
  ].filter(Boolean);

  const myNames = [
    normalize(profile?.fullName),
    normalize(profile?.name),
    normalize(currentUser?.displayName),
  ].filter(Boolean);

  return (
    idCandidates.some((value) => myIds.includes(value)) ||
    emailCandidates.some((value) => myEmails.includes(value)) ||
    nameCandidates.some((value) => myNames.includes(value))
  );
}

function buildSubjectProgressRow({
  assignment,
  enrollments,
  marks,
  targetTerm,
}) {
  const className = makeClassName(assignment);
  const subjectName = pick(assignment.subjectName, assignment.subject, "");
  const subjectId = pick(assignment.subjectId, "");
  const grade = pick(assignment.grade, assignment.classGrade, "");
  const section = pick(assignment.section, assignment.classSection, "");

  const enrolledStudents = enrollments.filter((enrollment) => {
    const sameClass = normalize(makeClassName(enrollment)) === normalize(className);

    const sameSubject =
      normalize(pick(enrollment.subjectId, "")) === normalize(subjectId) ||
      normalize(pick(enrollment.subjectName, "")) === normalize(subjectName);

    const sameYear =
      !targetTerm.year ||
      normalize(pick(enrollment.academicYear, enrollment.year, "")) ===
        normalize(targetTerm.year);

    const status = normalize(pick(enrollment.status, "active"));

    return sameClass && sameSubject && sameYear && (!status || status === "active");
  });

  const relatedMarks = marks.filter((mark) => {
    const sameClass = normalize(makeClassName(mark)) === normalize(className);

    const sameSubject =
      normalize(pick(mark.subjectId, "")) === normalize(subjectId) ||
      normalize(pick(mark.subjectName, mark.subject, "")) === normalize(subjectName);

    const sameTerm =
      !targetTerm.term ||
      normalize(pick(mark.term, mark.termName, "")) === normalize(targetTerm.term);

    const sameYear =
      !targetTerm.year ||
      normalize(pick(mark.academicYear, mark.year, "")) === normalize(targetTerm.year);

    return sameClass && sameSubject && sameTerm && sameYear;
  });

  const markedStudentIds = new Set(
    relatedMarks
      .filter((mark) => {
        const score = asNumber(pick(mark.mark, mark.marks, mark.score));
        return score !== null || Boolean(pick(mark.absent, mark.isAbsent, false));
      })
      .map((mark) => String(pick(mark.studentId, "")))
      .filter(Boolean)
  );

  const totalStudents = enrolledStudents.length;
  const completedStudents = markedStudentIds.size;
  const pendingStudents = Math.max(0, totalStudents - completedStudents);
  const progress =
    totalStudents > 0 ? Math.min(100, Math.round((completedStudents / totalStudents) * 100)) : 0;

  return {
    id: assignment.id,
    className,
    grade,
    section,
    subjectName,
    subjectId,
    teacherName: pick(
      assignment.teacherName,
      assignment.classTeacherName,
      assignment.name,
      "Teacher"
    ),
    totalStudents,
    completedStudents,
    pendingStudents,
    progress,
    status: totalStudents > 0 && completedStudents >= totalStudents ? "completed" : "pending",
  };
}

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  const [teacherProfile, setTeacherProfile] = useState(null);
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [classTeacherAssignments, setClassTeacherAssignments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTermKey, setSelectedTermKey] = useState("");
  const [dashboardRows, setDashboardRows] = useState([]);
  const [classTeacherRows, setClassTeacherRows] = useState([]);

  const activeTerm = useMemo(
    () =>
      terms.find(
        (t) =>
          `${pick(t.term, t.termName)}__${pick(t.year, t.academicYear)}` === selectedTermKey
      ) || null,
    [terms, selectedTermKey]
  );

  const loadDashboard = useCallback(
    async (silent = false) => {
      try {
        setError("");
        if (silent) setRefreshing(true);
        else setLoading(true);

        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("User is not logged in.");

        const [
          usersSnap,
          teacherAssignmentsSnap,
          classroomsSnap,
          academicTermsSnap,
          enrollmentsSnap,
          marksSnap,
        ] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "teacherAssignments")),
          getDocs(collection(db, "classrooms")),
          getDocs(query(collection(db, "academicTerms"), orderBy("year", "desc"))).catch(() =>
            getDocs(collection(db, "academicTerms"))
          ),
          getDocs(collection(db, "studentSubjectEnrollments")),
          getDocs(collection(db, "marks")),
        ]);

        const allUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const profile =
          allUsers.find((u) => normalize(pick(u.uid, u.userId)) === normalize(currentUser.uid)) ||
          allUsers.find((u) => normalize(u.email) === normalize(currentUser.email)) || {
            id: currentUser.uid,
            uid: currentUser.uid,
            email: currentUser.email || "",
            fullName: currentUser.displayName || "Teacher",
            name: currentUser.displayName || "Teacher",
          };

        setTeacherProfile(profile);

        const allTeacherAssignments = teacherAssignmentsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const allClassrooms = classroomsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const allTerms = academicTermsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const allEnrollments = enrollmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const allMarks = marksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const mySubjectAssignments = allTeacherAssignments.filter((item) =>
          isTeacherMatch(item, currentUser, profile)
        );

        const myClassTeacherAssignments = allClassrooms.filter((item) =>
          isTeacherMatch(item, currentUser, profile)
        );

        setSubjectAssignments(mySubjectAssignments);
        setClassTeacherAssignments(myClassTeacherAssignments);

        const sortedTerms = allTerms.sort((a, b) => {
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

        const effectiveSelectedTermKey =
          selectedTermKey ||
          (defaultTerm
            ? `${pick(defaultTerm.term, defaultTerm.termName)}__${pick(
                defaultTerm.year,
                defaultTerm.academicYear
              )}`
            : "");

        if (!selectedTermKey && defaultTerm) {
          setSelectedTermKey(effectiveSelectedTermKey);
        }

        const chosenTerm =
          sortedTerms.find(
            (t) =>
              `${pick(t.term, t.termName)}__${pick(t.year, t.academicYear)}` ===
              effectiveSelectedTermKey
          ) || defaultTerm;

        const targetTerm = chosenTerm
          ? {
              term: pick(chosenTerm.term, chosenTerm.termName),
              year: pick(chosenTerm.year, chosenTerm.academicYear),
            }
          : {
              term: "",
              year: "",
            };

        const mySubjectRows = mySubjectAssignments
          .map((assignment) =>
            buildSubjectProgressRow({
              assignment,
              enrollments: allEnrollments,
              marks: allMarks,
              targetTerm,
            })
          )
          .sort((a, b) => {
            const classDiff = a.className.localeCompare(b.className);
            if (classDiff !== 0) return classDiff;
            return a.subjectName.localeCompare(b.subjectName);
          });

        setDashboardRows(mySubjectRows);

        const classRows = myClassTeacherAssignments
          .map((classroom) => {
            const className = makeClassName(classroom);
            const grade = pick(classroom.grade, "");
            const section = pick(classroom.section, "");

            const allAssignmentsForThisClass = allTeacherAssignments.filter(
              (assignment) => normalize(makeClassName(assignment)) === normalize(className)
            );

            const subjectRowsForClass = allAssignmentsForThisClass
              .map((assignment) =>
                buildSubjectProgressRow({
                  assignment,
                  enrollments: allEnrollments,
                  marks: allMarks,
                  targetTerm,
                })
              )
              .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

            const totalSubjects = subjectRowsForClass.length;
            const completedSubjects = subjectRowsForClass.filter(
              (row) => row.status === "completed"
            ).length;

            const uniqueStudents = new Set(
              allEnrollments
                .filter((enrollment) => {
                  const sameClass =
                    normalize(makeClassName(enrollment)) === normalize(className);
                  const sameYear =
                    !targetTerm.year ||
                    normalize(pick(enrollment.academicYear, enrollment.year, "")) ===
                      normalize(targetTerm.year);
                  return sameClass && sameYear;
                })
                .map((enrollment) => String(pick(enrollment.studentId, "")))
                .filter(Boolean)
            );

            return {
              id: classroom.id,
              className,
              grade,
              section,
              totalStudents: uniqueStudents.size,
              totalSubjects,
              completedSubjects,
              pendingSubjects: Math.max(0, totalSubjects - completedSubjects),
              progress:
                totalSubjects > 0
                  ? Math.round((completedSubjects / totalSubjects) * 100)
                  : 0,
              subjects: subjectRowsForClass,
              status:
                totalSubjects > 0 && completedSubjects >= totalSubjects
                  ? "completed"
                  : "pending",
            };
          })
          .sort((a, b) => a.className.localeCompare(b.className));

        setClassTeacherRows(classRows);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load teacher dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedTermKey]
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const totalClasses = new Set(dashboardRows.map((row) => row.className)).size;
    const totalAssignedSubjects = dashboardRows.length;
    const completedSubjects = dashboardRows.filter((row) => row.status === "completed").length;
    const pendingSubjects = dashboardRows.filter((row) => row.status !== "completed").length;

    return {
      totalClasses,
      totalAssignedSubjects,
      completedSubjects,
      pendingSubjects,
    };
  }, [dashboardRows]);

  if (loading) {
    return (
      <PageContainer title="Teacher Dashboard" subtitle="Loading teacher overview...">
        <SectionCard>
          <Stack alignItems="center" spacing={2} py={6}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading dashboard data...
            </Typography>
          </Stack>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Teacher Dashboard"
      subtitle={`Welcome ${pick(
        teacherProfile?.fullName,
        teacherProfile?.name,
        auth.currentUser?.displayName,
        "Teacher"
      )}`}
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
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}

        <FilterCard
          title="Current View"
          subtitle="Review marks completion by class and subject."
        >
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="teacher-dashboard-term-label">Academic Term</InputLabel>
              <Select
                labelId="teacher-dashboard-term-label"
                label="Academic Term"
                value={selectedTermKey}
                onChange={(e) => setSelectedTermKey(e.target.value)}
              >
                {terms.map((term) => {
                  const key = `${pick(term.term, term.termName)}__${pick(
                    term.year,
                    term.academicYear
                  )}`;
                  return (
                    <MenuItem key={term.id} value={key}>
                      {buildTermLabel(term)}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={8}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
              flexWrap="wrap"
              useFlexGap
              sx={{ height: "100%" }}
            >
              {activeTerm ? <Chip label={buildTermLabel(activeTerm)} color="primary" /> : null}
              <Chip label={`Subject Assignments: ${subjectAssignments.length}`} />
              <Chip label={`Class Teacher Roles: ${classTeacherAssignments.length}`} />
            </Stack>
          </Grid>
        </FilterCard>

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Assigned Classes"
              value={stats.totalClasses}
              icon={<ClassRoundedIcon />}
              color="primary"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Assigned Subjects"
              value={stats.totalAssignedSubjects}
              icon={<MenuBookRoundedIcon />}
              color="secondary"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Completed"
              value={stats.completedSubjects}
              icon={<TaskAltRoundedIcon />}
              color="success"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Pending"
              value={stats.pendingSubjects}
              icon={<HourglassBottomRoundedIcon />}
              color="warning"
            />
          </Grid>
        </Grid>

        <SectionCard
          title="Work Overview"
          subtitle="Subject teacher status and class teacher monitoring."
        >
          <Tabs
            value={tab}
            onChange={(_, newValue) => setTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2 }}
          >
            <Tab
              icon={<DashboardRoundedIcon fontSize="small" />}
              iconPosition="start"
              label="My Subject Work"
            />
            <Tab
              icon={<SchoolRoundedIcon fontSize="small" />}
              iconPosition="start"
              label="Class Teacher View"
            />
          </Tabs>

          {tab === 0 ? (
            dashboardRows.length === 0 ? (
              <EmptyState
                title="No subject assignments found"
                description="This teacher does not currently have subject assignments for the selected term."
              />
            ) : (
              <Grid container spacing={1.5}>
                {dashboardRows.map((row) => (
                  <Grid item xs={12} md={6} xl={4} key={row.id}>
                    <MobileListRow
                      title={`${row.className} - ${row.subjectName}`}
                      subtitle={`${row.completedStudents}/${row.totalStudents} students completed`}
                      right={<StatusChip status={row.status} />}
                      footer={
                        <Stack spacing={1}>
                          <LinearProgress
                            variant="determinate"
                            value={row.progress}
                            sx={{ height: 8, borderRadius: 999 }}
                          />
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="space-between"
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Typography variant="body2" color="text.secondary">
                              {row.progress}% completed
                            </Typography>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Chip size="small" label={`Total ${row.totalStudents}`} />
                              <Chip size="small" color="success" label={`Done ${row.completedStudents}`} />
                              <Chip size="small" color="warning" label={`Pending ${row.pendingStudents}`} />
                            </Stack>
                          </Stack>

                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<EditNoteRoundedIcon />}
                            onClick={() => navigate("/teacher/marks")}
                          >
                            Enter Marks
                          </Button>
                        </Stack>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            )
          ) : classTeacherRows.length === 0 ? (
            <EmptyState
              title="No class teacher assignments found"
              description="This teacher is not currently assigned as a class teacher."
            />
          ) : (
            <Stack spacing={1.5}>
              {classTeacherRows.map((row) => (
                <SectionCard
                  key={row.id}
                  title={`Class ${row.className}`}
                  subtitle={`${row.completedSubjects}/${row.totalSubjects} subject mark entries completed`}
                  action={<StatusChip status={row.status} />}
                  contentSx={{ pt: 2 }}
                >
                  <Stack spacing={1.5}>
                    <Grid container spacing={1.25}>
                      <Grid item xs={6} sm={3}>
                        <StatCard
                          title="Students"
                          value={row.totalStudents}
                          icon={<SchoolRoundedIcon />}
                          color="primary"
                          sx={{ boxShadow: "none" }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <StatCard
                          title="Subjects"
                          value={row.totalSubjects}
                          icon={<MenuBookRoundedIcon />}
                          color="secondary"
                          sx={{ boxShadow: "none" }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <StatCard
                          title="Completed"
                          value={row.completedSubjects}
                          icon={<AssignmentTurnedInRoundedIcon />}
                          color="success"
                          sx={{ boxShadow: "none" }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <StatCard
                          title="Pending"
                          value={row.pendingSubjects}
                          icon={<HourglassBottomRoundedIcon />}
                          color="warning"
                          sx={{ boxShadow: "none" }}
                        />
                      </Grid>
                    </Grid>

                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={row.progress}
                        sx={{ height: 8, borderRadius: 999, mb: 1 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {row.progress}% overall class completion
                      </Typography>
                    </Box>

                    <Divider />

                    {row.subjects.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No subject teacher assignments found for this class.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {row.subjects.map((subjectRow) => (
                          <Stack
                            key={`${row.id}-${subjectRow.subjectName}`}
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1.25}
                            sx={{
                              p: 1.25,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 2,
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {subjectRow.subjectName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {subjectRow.completedStudents}/{subjectRow.totalStudents} students
                              </Typography>
                            </Box>

                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              sx={{ width: { xs: "100%", sm: "auto" } }}
                            >
                              <Typography variant="body2" color="text.secondary">
                                {subjectRow.progress}%
                              </Typography>
                              <StatusChip status={subjectRow.status} />
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditNoteRoundedIcon />}
                                onClick={() => navigate("/teacher/marks")}
                              >
                                Marks Entry
                              </Button>
                            </Stack>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </SectionCard>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}