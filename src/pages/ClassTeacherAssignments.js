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
import {
  isALGrade,
  buildALClassName,
  normalizeText,
} from "../constants";

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

const getRoomFullLabel = (room) => {
  const explicitFull = safeString(room.fullClassName);
  if (explicitFull) return explicitFull;

  const explicitAL = safeString(room.alClassName);
  if (explicitAL) return explicitAL;

  const grade = normalizeGrade(room.grade);
  const section = normalizeSection(room.section || room.className);
  const stream = safeString(room.stream);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  if (grade && section) return `${grade}${section}`;
  return safeString(room.className) || "—";
};

const getRoomCompactLabel = (room) => {
  const grade = normalizeGrade(room.grade);
  const section = normalizeSection(room.section || room.className);
  const stream = safeString(room.stream);

  if (isALGrade(grade) && stream && section) {
    return `${grade} ${stream} ${section}`;
  }

  return `G${grade || "-"}-${section || "-"}`;
};

const sortClassrooms = (rows) => {
  return [...rows].sort((a, b) => {
    const gradeDiff =
      (normalizeGrade(a.grade) || 0) - (normalizeGrade(b.grade) || 0);
    if (gradeDiff !== 0) return gradeDiff;

    const streamDiff = safeString(a.stream).localeCompare(safeString(b.stream));
    if (streamDiff !== 0) return streamDiff;

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
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setLoadError("");

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
        setLoadError("Failed to load classrooms or teachers.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getTeacher = (room) => {
    const teacherId = safeString(room.classTeacherId);
    const teacherUid = safeString(room.classTeacherUid);
    const teacherEmail = safeString(room.classTeacherEmail).toLowerCase();
    const teacherName = safeString(room.classTeacherName).toLowerCase();
    const signatureNo = safeString(room.classTeacherSignatureNo);

    const direct = teachers.find((teacher) => teacher.id === teacherId);
    if (direct) return direct;

    return (
      teachers.find((teacher) => {
        const rowUid = safeString(teacher.uid || teacher.authUid || teacher.userId);
        const rowEmail = safeString(teacher.email).toLowerCase();
        const rowName = safeString(
          teacher.name || teacher.displayName || teacher.fullName
        ).toLowerCase();
        const rowSignature = safeString(
          teacher.signatureNo ||
            teacher.signatureNumber ||
            teacher.teacherSignatureNo ||
            teacher.teacherNo
        );

        return (
          (teacherUid && rowUid && teacherUid === rowUid) ||
          (teacherEmail && rowEmail && teacherEmail === rowEmail) ||
          (teacherName && rowName && teacherName === rowName) ||
          (signatureNo && rowSignature && signatureNo === rowSignature)
        );
      }) || null
    );
  };

  const assignedRooms = useMemo(
    () =>
      classrooms.filter(
        (room) =>
          safeString(room.classTeacherId) ||
          safeString(room.classTeacherName) ||
          safeString(room.classTeacherEmail)
      ),
    [classrooms]
  );

  const unassignedRooms = useMemo(
    () =>
      classrooms.filter(
        (room) =>
          !safeString(room.classTeacherId) &&
          !safeString(room.classTeacherName) &&
          !safeString(room.classTeacherEmail)
      ),
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
          To update assignments, go to <strong>Classrooms</strong> and edit the classroom.
        </Typography>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {loadError}
        </Alert>
      )}

      {unassignedRooms.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
            Classes without a Class Teacher:
          </Typography>

          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {unassignedRooms.map((room) => (
              <Chip
                key={room.id}
                label={getRoomCompactLabel(room)}
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
          No classrooms created yet. Go to <strong>Classrooms</strong> to add classrooms first.
        </Alert>
      ) : assignedRooms.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No class teachers assigned yet. Go to <strong>Classrooms</strong> → Edit each classroom to assign a teacher.
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
                    const teacher = getTeacher(room);

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
                            label={getRoomFullLabel(room)}
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
                                  bgcolor: getAvatarColor(
                                    safeString(teacher.name || teacher.displayName || teacher.fullName)
                                  ),
                                  width: 34,
                                  height: 34,
                                  fontSize: 14,
                                  fontWeight: 700,
                                }}
                              >
                                {safeString(
                                  teacher.name || teacher.displayName || teacher.fullName
                                ).charAt(0) || "T"}
                              </Avatar>

                              <Typography variant="body2" fontWeight={700}>
                                {teacher.name || teacher.displayName || teacher.fullName || "—"}
                              </Typography>
                            </Box>
                          ) : (
                            <Chip
                              label={safeString(room.classTeacherName) || "Teacher not found"}
                              size="small"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </TableCell>

                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {teacher?.email || safeString(room.classTeacherEmail) || "—"}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {teacher?.phone ||
                            safeString(room.classTeacherPhone) ||
                            "—"}
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {teacher?.signatureNo ||
                              safeString(room.classTeacherSignatureNo) ||
                              "—"}
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
                const teacher = getTeacher(room);

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
                            bgcolor: teacher
                              ? getAvatarColor(
                                  safeString(
                                    teacher.name || teacher.displayName || teacher.fullName
                                  )
                                )
                              : "#e0e0e0",
                            width: 44,
                            height: 44,
                            fontSize: 18,
                            fontWeight: 700,
                          }}
                        >
                          {safeString(
                            teacher?.name || teacher?.displayName || teacher?.fullName
                          ).charAt(0) || "?"}
                        </Avatar>

                        <Box flex={1}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="subtitle2" fontWeight={700}>
                              {teacher?.name ||
                                teacher?.displayName ||
                                teacher?.fullName ||
                                safeString(room.classTeacherName) ||
                                "Unknown Teacher"}
                            </Typography>

                            <Chip
                              icon={
                                <HomeWorkIcon
                                  sx={{ fontSize: "12px !important" }}
                                />
                              }
                              label={getRoomCompactLabel(room)}
                              color="primary"
                              size="small"
                              sx={{ fontWeight: 700 }}
                            />
                          </Box>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            mt={0.4}
                          >
                            {getRoomFullLabel(room)}
                          </Typography>

                          {(teacher?.email || safeString(room.classTeacherEmail)) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {teacher?.email || safeString(room.classTeacherEmail)}
                            </Typography>
                          )}

                          {(teacher?.phone || safeString(room.classTeacherPhone)) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              📞 {teacher?.phone || safeString(room.classTeacherPhone)}
                            </Typography>
                          )}

                          {(teacher?.signatureNo || safeString(room.classTeacherSignatureNo)) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              ✍️ {teacher?.signatureNo || safeString(room.classTeacherSignatureNo)}
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
                      const teacher = getTeacher(room);

                      return (
                        <Box
                          key={room.id}
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            minWidth: 110,
                            bgcolor: teacher ? "#e8f5e9" : "#fff3e0",
                            border: `1px solid ${teacher ? "#a5d6a7" : "#ffcc80"}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={800}
                            color={teacher ? "#2e7d32" : "#e65100"}
                          >
                            {safeString(room.stream)
                              ? `${safeString(room.stream)} ${normalizeSection(room.section) || "-"}`
                              : `Section ${normalizeSection(room.section) || "-"}`}
                          </Typography>

                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                            sx={{ fontSize: 10 }}
                          >
                            {teacher
                              ? safeString(
                                  teacher.name || teacher.displayName || teacher.fullName
                                ).split(" ")[0]
                              : "None"}
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