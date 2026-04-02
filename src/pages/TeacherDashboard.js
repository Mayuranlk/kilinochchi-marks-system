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
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
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
import { FormControl, InputLabel, Select, LinearProgress, Chip } from "@mui/material";

const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");
const normalize = (value) => String(value || "").trim().toLowerCase();
const asNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};
const makeClassName = (item = {}) =>
  pick(item.className, `${pick(item.grade, "")}${pick(item.section, "")}`.trim());
const isSameTeacher = (item, user) => {
  const itemTeacherId = normalize(pick(item.teacherId, item.teacherUid, item.userId));
  const itemTeacherEmail = normalize(pick(item.teacherEmail, item.email));
  return (
    itemTeacherId === normalize(user.uid) ||
    itemTeacherEmail === normalize(user.email)
  );
};
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

export default function TeacherDashboard() {
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
    () => terms.find((t) => `${pick(t.term, t.termName)}__${pick(t.year, t.academicYear)}` === selectedTermKey) || null,
    [terms, selectedTermKey]
  );

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User is not logged in.");

      const [
        usersSnap,
        teacherAssignmentsSnap,
        classTeacherAssignmentsSnap,
        academicTermsSnap,
        enrollmentsSnap,
        marksSnap,
      ] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "teacherAssignments")),
        getDocs(collection(db, "classTeacherAssignments")),
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

      const allTeacherAssignments = teacherAssignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const allClassTeacherAssignments = classTeacherAssignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const allTerms = academicTermsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const allEnrollments = enrollmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const allMarks = marksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const mySubjectAssignments = allTeacherAssignments.filter((item) => isSameTeacher(item, currentUser));
      const myClassTeacherAssignments = allClassTeacherAssignments.filter((item) => isSameTeacher(item, currentUser));

      setSubjectAssignments(mySubjectAssignments);
      setClassTeacherAssignments(myClassTeacherAssignments);

      const sortedTerms = allTerms.sort((a, b) => {
        const yearDiff = Number(pick(b.year, b.academicYear, 0)) - Number(pick(a.year, a.academicYear, 0));
        if (yearDiff !== 0) return yearDiff;
        return String(pick(a.term, a.termName, "")).localeCompare(String(pick(b.term, b.termName, "")));
      });
      setTerms(sortedTerms);

      const defaultTerm =
        sortedTerms.find(isActiveTerm) ||
        sortedTerms[0] ||
        null;

      if (!selectedTermKey && defaultTerm) {
        setSelectedTermKey(`${pick(defaultTerm.term, defaultTerm.termName)}__${pick(defaultTerm.year, defaultTerm.academicYear)}`);
      }

      const targetTerm = defaultTerm
        ? {
            term: pick(defaultTerm.term, defaultTerm.termName),
            year: pick(defaultTerm.year, defaultTerm.academicYear),
          }
        : {
            term: "",
            year: "",
          };

      const rows = mySubjectAssignments.map((assignment) => {
        const className = makeClassName(assignment);
        const subjectName = pick(assignment.subjectName, assignment.subject, "");
        const subjectId = pick(assignment.subjectId, "");
        const grade = pick(assignment.grade, "");
        const section = pick(assignment.section, "");

        const enrolledStudents = allEnrollments.filter((enrollment) => {
          const enrollmentClass = makeClassName(enrollment);
          const sameClass = normalize(enrollmentClass) === normalize(className);
          const sameSubject =
            normalize(pick(enrollment.subjectId, "")) === normalize(subjectId) ||
            normalize(pick(enrollment.subjectName, "")) === normalize(subjectName);
          const sameYear =
            !targetTerm.year ||
            normalize(pick(enrollment.academicYear, enrollment.year, "")) === normalize(targetTerm.year);

          return sameClass && sameSubject && sameYear;
        });

        const relatedMarks = allMarks.filter((mark) => {
          const sameClass =
            normalize(makeClassName(mark)) === normalize(className);
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
            .filter((m) => {
              const score = asNumber(pick(m.mark, m.marks, m.score));
              return score !== null || Boolean(pick(m.absent, m.isAbsent, false));
            })
            .map((m) => String(pick(m.studentId, m.admissionNo, m.indexNo, m.id)))
        );

        const totalStudents = enrolledStudents.length;
        const completedStudents = markedStudentIds.size;
        const progress = totalStudents > 0 ? Math.min(100, Math.round((completedStudents / totalStudents) * 100)) : 0;

        return {
          id: assignment.id,
          className,
          grade,
          section,
          subjectName,
          teacherName: pick(profile.fullName, profile.name, currentUser.displayName, "Teacher"),
          totalStudents,
          completedStudents,
          pendingStudents: Math.max(0, totalStudents - completedStudents),
          progress,
          status: totalStudents > 0 && completedStudents >= totalStudents ? "completed" : "pending",
        };
      });

      setDashboardRows(rows);

      const classRows = myClassTeacherAssignments.map((assignment) => {
        const className = makeClassName(assignment);
        const grade = pick(assignment.grade, "");
        const section = pick(assignment.section, "");

        const subjectsForClass = rows.filter((row) => normalize(row.className) === normalize(className));
        const totalSubjects = subjectsForClass.length;
        const completedSubjects = subjectsForClass.filter((row) => row.status === "completed").length;
        const totalStudents = Array.from(
          new Set(
            allEnrollments
              .filter((enrollment) => normalize(makeClassName(enrollment)) === normalize(className))
              .map((enrollment) => String(pick(enrollment.studentId, enrollment.id)))
          )
        ).length;

        return {
          id: assignment.id,
          className,
          grade,
          section,
          totalStudents,
          totalSubjects,
          completedSubjects,
          pendingSubjects: Math.max(0, totalSubjects - completedSubjects),
          progress: totalSubjects > 0 ? Math.round((completedSubjects / totalSubjects) * 100) : 0,
          subjects: subjectsForClass,
          status: totalSubjects > 0 && completedSubjects >= totalSubjects ? "completed" : "pending",
        };
      });

      setClassTeacherRows(classRows);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load teacher dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTermKey]);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const filteredDashboardRows = useMemo(() => {
    if (!activeTerm) return dashboardRows;
    return dashboardRows;
  }, [activeTerm, dashboardRows]);

  const stats = useMemo(() => {
    const totalClasses = new Set(filteredDashboardRows.map((row) => row.className)).size;
    const totalAssignedSubjects = filteredDashboardRows.length;
    const completedSubjects = filteredDashboardRows.filter((row) => row.status === "completed").length;
    const pendingSubjects = filteredDashboardRows.filter((row) => row.status !== "completed").length;

    return {
      totalClasses,
      totalAssignedSubjects,
      completedSubjects,
      pendingSubjects,
    };
  }, [filteredDashboardRows]);

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
      subtitle={`Welcome ${pick(teacherProfile?.fullName, teacherProfile?.name, auth.currentUser?.displayName, "Teacher")}`}
      actions={
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
          onClick={() => loadDashboard(true)}
          fullWidth={false}
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
                  const key = `${pick(term.term, term.termName)}__${pick(term.year, term.academicYear)}`;
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
            <Tab icon={<DashboardRoundedIcon fontSize="small" />} iconPosition="start" label="My Subject Work" />
            <Tab icon={<SchoolRoundedIcon fontSize="small" />} iconPosition="start" label="Class Teacher View" />
          </Tabs>

          {tab === 0 ? (
            filteredDashboardRows.length === 0 ? (
              <EmptyState
                title="No subject assignments found"
                description="This teacher does not currently have subject assignments for the selected term."
              />
            ) : (
              <Grid container spacing={1.5}>
                {filteredDashboardRows.map((row) => (
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
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
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

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" color="text.secondary">
                                {subjectRow.progress}%
                              </Typography>
                              <StatusChip status={subjectRow.status} />
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