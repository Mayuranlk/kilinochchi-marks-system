import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SchoolIcon from "@mui/icons-material/School";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const safeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const lower = (value) => safeString(value).toLowerCase();

const normalizeGrade = (value) => {
  const raw = safeString(value);
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const normalizeSection = (value) => {
  const raw = safeString(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : "";
};

const getAvatarColor = (name) => {
  const colors = [
    "#1a237e",
    "#1565c0",
    "#0277bd",
    "#00695c",
    "#2e7d32",
    "#6a1b9a",
    "#880e4f",
    "#e65100",
  ];

  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const isActiveTeacher = (teacher) => {
  return lower(teacher.status || "active") === "active";
};

const sortClassrooms = (rows) => {
  return [...rows].sort((a, b) => {
    const gradeDiff =
      (normalizeGrade(a.grade) || 0) - (normalizeGrade(b.grade) || 0);
    if (gradeDiff !== 0) return gradeDiff;

    return normalizeSection(a.section).localeCompare(normalizeSection(b.section));
  });
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function ClassTeacherAssignments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const [classSnap, teacherSnap] = await Promise.all([
          getDocs(collection(db, "classrooms")),
          getDocs(collection(db, "users")),
        ]);

        const classroomRows = sortClassrooms(
          classSnap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );

        const teacherRows = teacherSnap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter(
            (row) => lower(row.role) === "teacher" && isActiveTeacher(row)
          )
          .sort((a, b) => safeString(a.name).localeCompare(safeString(b.name)));

        setClassrooms(classroomRows);
        setTeachers(teacherRows);
      } catch (error) {
        console.error("ClassTeacherAssignments fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getTeacher = (teacherId) =>
    teachers.find((teacher) => teacher.id === safeString(teacherId)) || null;

  const assignedRooms = useMemo(
    () => classrooms.filter((room) => safeString(room.classTeacherId)),
    [classrooms]
  );

  const unassignedRooms = useMemo(
    () => classrooms.filter((room) => !safeString(room.classTeacherId)),
    [classrooms]
  );

  const groupedByGrade = useMemo(() => {
    const map = new Map();

    classrooms.forEach((room) => {
      const grade = normalizeGrade(room.grade);
      if (!grade) return;

      if (!map.has(grade)) {
        map.set(grade, []);
      }

      map.get(grade).push(room);
    });

    return Array.from(map.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [classrooms]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
          border: "1px solid #e8eaf6",
        }}
      >
        <Typography
          variant={isMobile ? "h6" : "h5"}
          fontWeight={800}
          color="#1a237e"
        >
          Class Teacher Assignments
        </Typography>

        <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
          <Chip
            icon={<CheckCircleIcon />}
            label={`Assigned: ${assignedRooms.length}`}
            size="small"
            color="success"
            sx={{ fontWeight: 700 }}
          />
          <Chip
            icon={<WarningAmberIcon />}
            label={`Unassigned: ${unassignedRooms.length}`}
            size="small"
            color={unassignedRooms.length > 0 ? "warning" : "default"}
            sx={{ fontWeight: 700 }}
          />
          <Chip
            label={`Total Classes: ${classrooms.length}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          mt={0.5}
          display="block"
        >
          To update assignments, go to <strong>Classrooms</strong> and edit the
          classroom.
        </Typography>
      </Box>

      {unassignedRooms.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
            Classes without a Class Teacher:
          </Typography>

          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {unassignedRooms.map((room) => (
              <Chip
                key={room.id}
                label={`G${normalizeGrade(room.grade) || "-"}-${normalizeSection(room.section) || "-"}`}
                size="small"
                color="warning"
                variant="outlined"
              />
            ))}
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            mt={0.5}
            display="block"
          >
            Go to <strong>Classrooms</strong> → Edit → assign a Class Teacher.
          </Typography>
        </Alert>
      )}

      {classrooms.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No classrooms created yet. Go to <strong>Classrooms</strong> to add
          classrooms first.
        </Alert>
      ) : assignedRooms.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No class teachers assigned yet. Go to <strong>Classrooms</strong> →
          Edit each classroom to assign a teacher.
        </Alert>
      ) : (
        <>
          {!isMobile ? (
            <Paper
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                boxShadow: "0 2px 16px rgba(26,35,126,0.08)",
                border: "1px solid #e8eaf6",
                mb: 3,
              }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1a237e" }}>
                    {["#", "Assigned Class", "Class Teacher", "Email", "Phone", "Signature No"].map(
                      (head) => (
                        <TableCell
                          key={head}
                          sx={{
                            color: "white",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {head}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {assignedRooms.map((room, index) => {
                    const teacher = getTeacher(room.classTeacherId);

                    return (
                      <TableRow
                        key={room.id}
                        hover
                        sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                      >
                        <TableCell>{index + 1}</TableCell>

                        <TableCell>
                          <Chip
                            icon={
                              <HomeWorkIcon
                                sx={{ fontSize: "14px !important" }}
                              />
                            }
                            label={`Grade ${normalizeGrade(room.grade) || "-"} - ${normalizeSection(room.section) || "-"}${
                              safeString(room.stream) ? ` (${room.stream})` : ""
                            }`}
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>

                        <TableCell>
                          {teacher ? (
                            <Box display="flex" alignItems="center" gap={1.5}>
                              <Avatar
                                sx={{
                                  bgcolor: getAvatarColor(teacher.name),
                                  width: 34,
                                  height: 34,
                                  fontSize: 14,
                                  fontWeight: 700,
                                }}
                              >
                                {safeString(teacher.name).charAt(0) || "T"}
                              </Avatar>

                              <Typography variant="body2" fontWeight={700}>
                                {teacher.name}
                              </Typography>
                            </Box>
                          ) : (
                            <Chip
                              label="Teacher not found"
                              size="small"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </TableCell>

                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {teacher?.email || "—"}
                          </Typography>
                        </TableCell>

                        <TableCell>{teacher?.phone || "—"}</TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {teacher?.signatureNo || "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          ) : (
            <Box mb={3}>
              {assignedRooms.map((room) => {
                const teacher = getTeacher(room.classTeacherId);

                return (
                  <Card
                    key={room.id}
                    sx={{
                      mb: 1.5,
                      borderRadius: 3,
                      border: "1px solid #e8eaf6",
                      boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
                    }}
                  >
                    <CardContent>
                      <Box display="flex" gap={1.5} alignItems="flex-start">
                        <Avatar
                          sx={{
                            bgcolor: teacher ? getAvatarColor(teacher.name) : "#e0e0e0",
                            width: 44,
                            height: 44,
                            fontSize: 18,
                            fontWeight: 700,
                          }}
                        >
                          {safeString(teacher?.name).charAt(0) || "?"}
                        </Avatar>

                        <Box flex={1}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="subtitle2" fontWeight={700}>
                              {teacher?.name || "Unknown Teacher"}
                            </Typography>

                            <Chip
                              icon={
                                <HomeWorkIcon
                                  sx={{ fontSize: "12px !important" }}
                                />
                              }
                              label={`G${normalizeGrade(room.grade) || "-"}-${normalizeSection(room.section) || "-"}`}
                              color="primary"
                              size="small"
                              sx={{ fontWeight: 700 }}
                            />
                          </Box>

                          {teacher?.email && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {teacher.email}
                            </Typography>
                          )}

                          {teacher?.phone && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              📞 {teacher.phone}
                            </Typography>
                          )}

                          {teacher?.signatureNo && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              ✍️ {teacher.signatureNo}
                            </Typography>
                          )}

                          {safeString(room.stream) && (
                            <Chip
                              label={room.stream}
                              size="small"
                              color="warning"
                              sx={{ mt: 0.5, fontWeight: 600 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          <Typography
            variant="subtitle1"
            fontWeight={800}
            color="#1a237e"
            mb={1.5}
          >
            Grade-wise Overview
          </Typography>

          <Grid container spacing={1.5}>
            {groupedByGrade.map(([grade, gradeClassrooms]) => (
              <Grid item xs={12} sm={6} md={4} key={grade}>
                <Paper
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 1px 6px rgba(26,35,126,0.06)",
                  }}
                >
                  <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                    <SchoolIcon sx={{ color: "#1a237e", fontSize: 18 }} />
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      color="#1a237e"
                    >
                      Grade {grade}
                    </Typography>
                  </Box>

                  <Box display="flex" flexWrap="wrap" gap={0.8}>
                    {gradeClassrooms.map((room) => {
                      const teacher = getTeacher(room.classTeacherId);

                      return (
                        <Box
                          key={room.id}
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            minWidth: 85,
                            bgcolor: teacher ? "#e8f5e9" : "#fff3e0",
                            border: `1px solid ${teacher ? "#a5d6a7" : "#ffcc80"}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={800}
                            color={teacher ? "#2e7d32" : "#e65100"}
                          >
                            Section {normalizeSection(room.section) || "-"}
                          </Typography>

                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                            sx={{ fontSize: 10 }}
                          >
                            {teacher ? safeString(teacher.name).split(" ")[0] : "None"}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}