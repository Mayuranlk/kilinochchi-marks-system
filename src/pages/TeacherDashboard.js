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
  Select,
  Stack,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
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

const isCompletedForSubject = (students, marks, className, subjectName, targetTerm) => {
  const subjectStudents = students.filter(
    (e) =>
      normalize(e.className) === normalize(className) &&
      normalize(e.subjectName) === normalize(subjectName) &&
      normalize(pick(e.academicYear, e.year, "")) === normalize(targetTerm.year)
  );

  const studentIds = new Set(subjectStudents.map((s) => String(s.studentId)).filter(Boolean));

  const subjectMarks = marks.filter(
    (m) =>
      normalize(m.className) === normalize(className) &&
      normalize(pick(m.subjectName, m.subject, "")) === normalize(subjectName) &&
      normalize(pick(m.term, m.termName, "")) === normalize(targetTerm.term) &&
      normalize(pick(m.academicYear, m.year, "")) === normalize(targetTerm.year) &&
      studentIds.has(String(m.studentId))
  );

  const doneCount = new Set(subjectMarks.map((m) => String(m.studentId))).size;
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

export default function TeacherDashboard() {
  const navigate = useNavigate();

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
        (a) =>
          normalize(a.teacherId) === normalize(user.uid) ||
          normalize(a.teacherEmail) === normalize(user.email)
      );

      const mySubjectRows = myAssignments
        .map((assignment) => {
          const className = assignment.className;
          const subjectName = assignment.subjectName;

          const progressInfo = isCompletedForSubject(
            enrollments,
            marks,
            className,
            subjectName,
            targetTerm
          );

          return {
            className,
            subjectName,
            subjectId: assignment.subjectId || "",
            total: progressInfo.total,
            done: progressInfo.doneCount,
            pending: progressInfo.pending,
            progress: progressInfo.progress,
          };
        })
        .sort((a, b) => {
          const classDiff = String(a.className).localeCompare(String(b.className));
          if (classDiff !== 0) return classDiff;
          return String(a.subjectName).localeCompare(String(b.subjectName));
        });

      setSubjectRows(mySubjectRows);

      const myClass = classrooms.find(
        (c) =>
          normalize(c.classTeacherId) === normalize(user.uid) ||
          normalize(c.classTeacherEmail) === normalize(user.email)
      );

      if (myClass) {
        const className = myClass.className;
        const classStudents = enrollments.filter(
          (e) =>
            normalize(e.className) === normalize(className) &&
            normalize(pick(e.academicYear, e.year, "")) === normalize(targetTerm.year)
        );

        const uniqueStudentIds = new Set(
          classStudents.map((student) => String(student.studentId)).filter(Boolean)
        );

        const classSubjects = assignments
          .filter((a) => normalize(a.className) === normalize(className))
          .map((assignment) => {
            const teacherUser =
              users.find(
                (u) =>
                  normalize(u.id) === normalize(assignment.teacherId) ||
                  normalize(u.email) === normalize(assignment.teacherEmail)
              ) || null;

            const progressInfo = isCompletedForSubject(
              enrollments,
              marks,
              className,
              assignment.subjectName,
              targetTerm
            );

            const isMine =
              normalize(assignment.teacherId) === normalize(user.uid) ||
              normalize(assignment.teacherEmail) === normalize(user.email);

            return {
              subjectName: assignment.subjectName,
              subjectId: assignment.subjectId || "",
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
            };
          })
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return String(a.subjectName).localeCompare(String(b.subjectName));
          });

        const completedCount = classSubjects.filter((s) => s.completed).length;
        const pendingCount = classSubjects.length - completedCount;

        setClassTeacherData({
          className,
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
  (className, subjectName, subjectId = "") => {
    const params = new URLSearchParams();

    if (className) params.set("className", className);
    if (subjectName) params.set("subjectName", subjectName);
    if (subjectId) params.set("subjectId", subjectId);
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
                {terms.map((term) => (
                  <MenuItem key={term.id} value={buildTermKey(term)}>
                    {buildTermLabel(term)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={8}>
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
        </FilterCard>

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Assigned Classes"
              value={new Set(subjectRows.map((row) => row.className)).size}
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

        {classTeacherData && (
          <SectionCard
            title={`Class ${classTeacherData.className} Monitoring`}
            subtitle="Track pending and completed subjects for your class."
          >
            <Stack spacing={2}>
              <Grid container spacing={1}>
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

              <LinearProgress
                variant="determinate"
                value={classTeacherData.progress}
                sx={{ height: 8, borderRadius: 5 }}
              />

              <Typography variant="body2" color="text.secondary">
                {classTeacherData.progress}% overall class completion
              </Typography>

              <Stack spacing={1}>
                {classTeacherData.subjects.length === 0 ? (
                  <EmptyState title="No subjects assigned to this class" />
                ) : (
                  classTeacherData.subjects.map((subject) => (
                    <Box
                      key={subject.subjectId || subject.subjectName}
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor:
                          subject.completed
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
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                              {subject.subjectName}
                            </Typography>
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
                              openMarks(
                                classTeacherData.className,
                                subject.subjectName,
                                subject.subjectId
                              )
                            }
                            sx={{ alignSelf: "flex-start" }}
                          >
                            Enter Marks
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  ))
                )}
              </Stack>
            </Stack>
          </SectionCard>
        )}

        <SectionCard
          title="My Subject Work"
          subtitle="Enter marks for the subjects assigned to you."
        >
          {subjectRows.length === 0 ? (
            <EmptyState title="No assignments" />
          ) : (
            <Grid container spacing={1.5}>
              {subjectRows.map((row, i) => (
                <Grid item xs={12} md={6} key={i}>
                  <MobileListRow
                    title={`${row.className} - ${row.subjectName}`}
                    right={
                      <StatusChip
                        status={row.pending > 0 || row.total === 0 ? "pending" : "completed"}
                        label={row.pending > 0 || row.total === 0 ? "Pending" : "Completed"}
                      />
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
                          size="small"
                          startIcon={<EditNoteRoundedIcon />}
                          onClick={() =>
                            openMarks(row.className, row.subjectName, row.subjectId)
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