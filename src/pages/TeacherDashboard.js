import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Typography,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  PageContainer,
  SectionCard,
  StatCard,
  EmptyState,
  StatusChip,
  MobileListRow,
} from "../components/ui";

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [subjectRows, setSubjectRows] = useState([]);
  const [classTeacherData, setClassTeacherData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const user = auth.currentUser;

      const [
        assignmentsSnap,
        classroomsSnap,
        enrollmentsSnap,
        marksSnap,
      ] = await Promise.all([
        getDocs(collection(db, "teacherAssignments")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "marks")),
      ]);

      const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const classrooms = classroomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const enrollments = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const marks = marksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const myAssignments = assignments.filter(a =>
        a.teacherId === user.uid ||
        a.teacherEmail === user.email
      );

      // ---------- SUBJECT WORK ----------
      const subjectData = myAssignments.map(a => {
        const className = a.className;
        const subjectName = a.subjectName;

        const students = enrollments.filter(e =>
          e.className === className &&
          e.subjectName === subjectName
        );

        const studentIds = new Set(students.map(s => s.studentId));

        const marked = marks.filter(m =>
          m.className === className &&
          m.subjectName === subjectName &&
          studentIds.has(m.studentId)
        );

        const done = new Set(marked.map(m => m.studentId)).size;

        const total = students.length;
        const pending = total - done;

        return {
          className,
          subjectName,
          total,
          done,
          pending,
          progress: total ? Math.round((done / total) * 100) : 0,
        };
      });

      setSubjectRows(subjectData);

      // ---------- CLASS TEACHER ----------
      const myClass = classrooms.find(c =>
        c.classTeacherId === user.uid ||
        c.classTeacherEmail === user.email
      );

      if (myClass) {
        const className = myClass.className;

        const classSubjects = assignments.filter(a => a.className === className);

        const pendingSubjects = [];
        let completed = 0;

        classSubjects.forEach(a => {
          const students = enrollments.filter(e =>
            e.className === className &&
            e.subjectName === a.subjectName
          );

          const studentIds = new Set(students.map(s => s.studentId));

          const marked = marks.filter(m =>
            m.className === className &&
            m.subjectName === a.subjectName &&
            studentIds.has(m.studentId)
          );

          const done = new Set(marked.map(m => m.studentId)).size;

          if (done === students.length && students.length > 0) {
            completed++;
          } else {
            pendingSubjects.push(a.subjectName);
          }
        });

        setClassTeacherData({
          className,
          totalSubjects: classSubjects.length,
          completed,
          pending: pendingSubjects.length,
          pendingSubjects,
        });
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ---------- NAVIGATION WITH AUTO SELECT ----------
  const openMarks = (className, subjectName) => {
    navigate("/teacher/marks", {
      state: {
        className,
        subjectName,
      },
    });
  };

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
    <PageContainer title="Teacher Dashboard">

      {/* ---------- CLASS TEACHER MONITORING ---------- */}
      {classTeacherData && (
        <SectionCard title={`Class ${classTeacherData.className} Monitoring`}>
          <Stack spacing={2}>

            <Grid container spacing={1}>
              <Grid item xs={4}>
                <StatCard title="Subjects" value={classTeacherData.totalSubjects} />
              </Grid>
              <Grid item xs={4}>
                <StatCard title="Completed" value={classTeacherData.completed} />
              </Grid>
              <Grid item xs={4}>
                <StatCard title="Pending" value={classTeacherData.pending} />
              </Grid>
            </Grid>

            <LinearProgress
              variant="determinate"
              value={
                classTeacherData.totalSubjects
                  ? (classTeacherData.completed / classTeacherData.totalSubjects) * 100
                  : 0
              }
              sx={{ height: 8, borderRadius: 5 }}
            />

            {/* Pending Subjects */}
            <Box>
              <Typography variant="body2" mb={1}>
                Pending Subjects
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {classTeacherData.pendingSubjects.slice(0, 5).map((s) => (
                  <Chip key={s} label={s} color="warning" />
                ))}

                {classTeacherData.pendingSubjects.length > 5 && (
                  <Chip label={`+${classTeacherData.pendingSubjects.length - 5} more`} />
                )}
              </Stack>
            </Box>

            {/* MAIN ACTION */}
            <Button
              variant="contained"
              fullWidth
              onClick={() =>
                navigate("/teacher/marks", {
                  state: { className: classTeacherData.className },
                })
              }
            >
              Open Marks Entry
            </Button>

          </Stack>
        </SectionCard>
      )}

      {/* ---------- SUBJECT WORK ---------- */}
      <SectionCard title="My Subject Work">
        {subjectRows.length === 0 ? (
          <EmptyState title="No assignments" />
        ) : (
          <Grid container spacing={1.5}>
            {subjectRows.map((row, i) => (
              <Grid item xs={12} md={6} key={i}>
                <MobileListRow
                  title={`${row.className} - ${row.subjectName}`}
                  right={<StatusChip status={row.pending ? "pending" : "completed"} />}
                  footer={
                    <Stack spacing={1}>
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
                        onClick={() =>
                          openMarks(row.className, row.subjectName)
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

    </PageContainer>
  );
}