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
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
  LinearProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
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
    pick(item.id),
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

function sanitizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function buildSubjectProgressRow({
  assignment,
  enrollments,
  marks,
  targetTerm,
  teacherUser,
  isOwnedByCurrentTeacher,
}) {
  const className = makeClassName(assignment);
  const subjectName = pick(assignment.subjectName, assignment.subject, "");
  const subjectId = pick(assignment.subjectId, "");
  const teacherName = pick(
    assignment.teacherName,
    teacherUser?.name,
    teacherUser?.fullName,
    "Teacher"
  );
  const teacherPhone = pick(teacherUser?.phone, assignment.teacherPhone, "");

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
    subjectName,
    subjectId,
    teacherName,
    teacherPhone,
    totalStudents,
    completedStudents,
    pendingStudents,
    progress,
    status: totalStudents > 0 && completedStudents >= totalStudents ? "completed" : "pending",
    isOwnedByCurrentTeacher,
  };
}

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [teacherProfile, setTeacherProfile] = useState(null);
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [classTeacherClassroom, setClassTeacherClassroom] = useState(null);
  const [terms, setTerms] = useState([]);
  const [selectedTermKey, setSelectedTermKey] = useState("");
  const [dashboardRows, setDashboardRows] = useState([]);
  const [classTeacherSubjects, setClassTeacherSubjects] = useState([]);

  const activeTerm = useMemo(
    () =>
      terms.find(
        (t) =>
          `${pick(t.term, t.termName)}__${pick(t.year, t.academicYear)}` === selectedTermKey
      ) || null,
    [terms, selectedTermKey]
  );

  const classTeacherSummary = useMemo(() => {
    if (!classTeacherSubjects.length) {
      return {
        totalSubjects: 0,
        completed: 0,
        pending: 0,
        totalStudents: 0,
        progress: 0,
      };
    }

    const totalSubjects = classTeacherSubjects.length;
    const completed = classTeacherSubjects.filter((item) => item.status === "completed").length;
    const pending = totalSubjects - completed;
    const totalStudents = classTeacherSubjects[0]?.totalStudents || 0;
    const progress = totalSubjects > 0 ? Math.round((completed / totalSubjects) * 100) : 0;

    return {
      totalSubjects,
      completed,
      pending,
      totalStudents,
      progress,
    };
  }, [classTeacherSubjects]);

  const currentViewStats = useMemo(() => {
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

  const openMarksEntry = useCallback(
    ({ className, subjectName, subjectId }) => {
      navigate("/teacher/marks", {
        state: {
          className,
          subjectName,
          subjectId: subjectId || "",
          termKey: selectedTermKey || "",
        },
      });
    },
    [navigate, selectedTermKey]
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

        const profile =
          allUsers.find((u) => normalize(pick(u.uid, u.userId, u.id)) === normalize(currentUser.uid)) ||
          allUsers.find((u) => normalize(u.email) === normalize(currentUser.email)) || {
            id: currentUser.uid,
            uid: currentUser.uid,
            email: currentUser.email || "",
            fullName: currentUser.displayName || "Teacher",
            name: currentUser.displayName || "Teacher",
          };

        setTeacherProfile(profile);

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

        const mySubjectAssignments = allTeacherAssignments.filter((item) =>
          isTeacherMatch(item, currentUser, profile)
        );

        setSubjectAssignments(mySubjectAssignments);

        const mySubjectRows = mySubjectAssignments
          .map((assignment) => {
            const teacherUser =
              allUsers.find(
                (user) =>
                  normalize(user.id) === normalize(pick(assignment.teacherId)) ||
                  normalize(user.email) === normalize(pick(assignment.teacherEmail))
              ) || null;

            return buildSubjectProgressRow({
              assignment,
              enrollments: allEnrollments,
              marks: allMarks,
              targetTerm,
              teacherUser,
              isOwnedByCurrentTeacher: true,
            });
          })
          .sort((a, b) => {
            const classDiff = a.className.localeCompare(b.className);
            if (classDiff !== 0) return classDiff;
            return a.subjectName.localeCompare(b.subjectName);
          });

        setDashboardRows(mySubjectRows);

        const myClassroom =
          allClassrooms.find((item) => isTeacherMatch(item, currentUser, profile)) || null;

        setClassTeacherClassroom(myClassroom);

        if (myClassroom) {
          const className = makeClassName(myClassroom);

          const allAssignmentsForThisClass = allTeacherAssignments.filter(
            (assignment) => normalize(makeClassName(assignment)) === normalize(className)
          );

          const classSubjectRows = allAssignmentsForThisClass
            .map((assignment) => {
              const assignedTeacherUser =
                allUsers.find(
                  (user) =>
                    normalize(user.id) === normalize(pick(assignment.teacherId)) ||
                    normalize(user.email) === normalize(pick(assignment.teacherEmail))
                ) || null;

              const ownedByCurrentTeacher = isTeacherMatch(assignment, currentUser, profile);

              return buildSubjectProgressRow({
                assignment,
                enrollments: allEnrollments,
                marks: allMarks,
                targetTerm,
                teacherUser: assignedTeacherUser,
                isOwnedByCurrentTeacher: ownedByCurrentTeacher,
              });
            })
            .sort((a, b) => {
              if (a.status !== b.status) {
                return a.status === "pending" ? -1 : 1;
              }
              return a.subjectName.localeCompare(b.subjectName);
            });

          setClassTeacherSubjects(classSubjectRows);
        } else {
          setClassTeacherSubjects([]);
        }
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
              <Chip label={`Class Teacher Roles: ${classTeacherClassroom ? 1 : 0}`} />
            </Stack>
          </Grid>
        </FilterCard>

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Assigned Classes"
              value={currentViewStats.totalClasses}
              icon={<ClassRoundedIcon />}
              color="primary"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Assigned Subjects"
              value={currentViewStats.totalAssignedSubjects}
              icon={<MenuBookRoundedIcon />}
              color="secondary"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Completed"
              value={currentViewStats.completedSubjects}
              icon={<TaskAltRoundedIcon />}
              color="success"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Pending"
              value={currentViewStats.pendingSubjects}
              icon={<HourglassBottomRoundedIcon />}
              color="warning"
            />
          </Grid>
        </Grid>

        {classTeacherClassroom && (
          <SectionCard
            title={`Class ${makeClassName(classTeacherClassroom)} Monitoring`}
            subtitle="Track pending and completed subjects for your class."
          >
            <Stack spacing={2}>
              <Grid container spacing={1.25}>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    title="Students"
                    value={classTeacherSummary.totalStudents}
                    icon={<GroupsRoundedIcon />}
                    color="primary"
                    sx={{ boxShadow: "none" }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    title="Subjects"
                    value={classTeacherSummary.totalSubjects}
                    icon={<MenuBookRoundedIcon />}
                    color="secondary"
                    sx={{ boxShadow: "none" }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    title="Completed"
                    value={classTeacherSummary.completed}
                    icon={<TaskAltRoundedIcon />}
                    color="success"
                    sx={{ boxShadow: "none" }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    title="Pending"
                    value={classTeacherSummary.pending}
                    icon={<HourglassBottomRoundedIcon />}
                    color="error"
                    sx={{ boxShadow: "none" }}
                  />
                </Grid>
              </Grid>

              <Box>
                <LinearProgress
                  variant="determinate"
                  value={classTeacherSummary.progress}
                  sx={{ height: 8, borderRadius: 999, mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {classTeacherSummary.progress}% overall class completion
                </Typography>
              </Box>

              {classTeacherSubjects.length === 0 ? (
                <EmptyState
                  title="No subject assignments found"
                  description="No subject-teacher assignments were found for this class."
                />
              ) : (
                <Stack spacing={1}>
                  {classTeacherSubjects.map((subjectRow) => {
                    const phoneLabel = subjectRow.teacherPhone || "No phone";
                    const dialPhone = sanitizePhone(subjectRow.teacherPhone);

                    return (
                      <Box
                        key={`${subjectRow.className}-${subjectRow.subjectId || subjectRow.subjectName}`}
                        sx={{
                          p: 1.25,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          bgcolor:
                            subjectRow.status === "completed"
                              ? "rgba(34, 197, 94, 0.05)"
                              : "rgba(239, 68, 68, 0.04)",
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {subjectRow.subjectName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {subjectRow.completedStudents}/{subjectRow.totalStudents} students
                              </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography variant="body2" color="text.secondary">
                                {subjectRow.progress}%
                              </Typography>
                              <StatusChip
                                status={subjectRow.status === "completed" ? "completed" : "pending"}
                                label={subjectRow.status === "completed" ? "Completed" : "Pending"}
                              />
                            </Stack>
                          </Stack>

                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {subjectRow.teacherName}
                              </Typography>

                              {subjectRow.status !== "completed" && subjectRow.teacherPhone ? (
                                <Link
                                  href={`tel:${dialPhone}`}
                                  underline="hover"
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontSize: 14,
                                    fontWeight: 600,
                                  }}
                                >
                                  <PhoneRoundedIcon sx={{ fontSize: 16 }} />
                                  {phoneLabel}
                                </Link>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  {subjectRow.teacherPhone || ""}
                                </Typography>
                              )}
                            </Box>

                            {subjectRow.isOwnedByCurrentTeacher && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditNoteRoundedIcon />}
                                onClick={() =>
                                  openMarksEntry({
                                    className: subjectRow.className,
                                    subjectName: subjectRow.subjectName,
                                    subjectId: subjectRow.subjectId,
                                  })
                                }
                              >
                                Enter Marks
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </SectionCard>
        )}

        <SectionCard
          title="My Subject Work"
          subtitle="Enter marks for the subjects assigned to you."
        >
          {dashboardRows.length === 0 ? (
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
                    right={
                      <StatusChip
                        status={row.status === "completed" ? "completed" : "pending"}
                        label={row.status === "completed" ? "Completed" : "Pending"}
                      />
                    }
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
                            {row.progress}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {row.completedStudents}/{row.totalStudents}
                          </Typography>
                        </Stack>

                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditNoteRoundedIcon />}
                          onClick={() =>
                            openMarksEntry({
                              className: row.className,
                              subjectName: row.subjectName,
                              subjectId: row.subjectId,
                            })
                          }
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
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}