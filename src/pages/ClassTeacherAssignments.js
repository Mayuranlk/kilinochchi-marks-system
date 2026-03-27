import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { GRADES } from "../constants";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, CircularProgress, Chip, Grid, Card, CardContent,
  Alert, Avatar, useMediaQuery, useTheme
} from "@mui/material";
import HomeWorkIcon    from "@mui/icons-material/HomeWork";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon  from "@mui/icons-material/CheckCircle";
import SchoolIcon       from "@mui/icons-material/School";

const getAvatarColor = (name) => {
  const colors = [
    "#1a237e","#1565c0","#0277bd","#00695c",
    "#2e7d32","#6a1b9a","#880e4f","#e65100"
  ];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function ClassTeacherAssignments() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [classrooms, setClassrooms] = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [classSnap, teacherSnap] = await Promise.all([
          getDocs(collection(db, "classrooms")),
          getDocs(collection(db, "users"))
        ]);
        setClassrooms(
          classSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) =>
              a.grade - b.grade ||
              a.section.localeCompare(b.section)
            )
        );
        setTeachers(
          teacherSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => u.role === "teacher")
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getTeacher = (tid) =>
    teachers.find(t => t.id === tid) || null;

  // Classrooms that have a teacher assigned
  const assignedRooms   = classrooms.filter(c => c.classTeacherId);
  const unassignedRooms = classrooms.filter(c => !c.classTeacherId);

  // Group by grade for overview grid
  const groupedByGrade = GRADES.reduce((acc, g) => {
    const gc = classrooms.filter(c => c.grade === g);
    if (gc.length > 0) acc[g] = gc;
    return acc;
  }, {});

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={5}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>

      {/* ── Header ── */}
      <Box sx={{
        bgcolor: "white", borderRadius: 3,
        p: { xs: 2, sm: 2.5 }, mb: 2,
        boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
        border: "1px solid #e8eaf6"
      }}>
        <Typography variant={isMobile ? "h6" : "h5"}
          fontWeight={800} color="#1a237e">
          Class Teacher Assignments
        </Typography>
        <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
          <Chip icon={<CheckCircleIcon />}
            label={`Assigned: ${assignedRooms.length}`}
            size="small" color="success"
            sx={{ fontWeight: 700 }} />
          <Chip icon={<WarningAmberIcon />}
            label={`Unassigned: ${unassignedRooms.length}`}
            size="small"
            color={unassignedRooms.length > 0 ? "warning" : "default"}
            sx={{ fontWeight: 700 }} />
          <Chip
            label={`Total Classes: ${classrooms.length}`}
            size="small" color="primary"
            sx={{ fontWeight: 700 }} />
        </Box>
        <Typography variant="caption" color="text.secondary" mt={0.5}
          display="block">
          ✏️ To update assignments, go to{" "}
          <strong>Classrooms</strong> and edit the classroom.
        </Typography>
      </Box>

      {/* ── Unassigned Warning ── */}
      {unassignedRooms.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
            ⚠️ Classes without a Class Teacher:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {unassignedRooms.map(c => (
              <Chip
                key={c.id}
                label={`G${c.grade}-${c.section}`}
                size="small" color="warning" variant="outlined"
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary"
            mt={0.5} display="block">
            Go to <strong>Classrooms</strong> → Edit → assign a Class Teacher.
          </Typography>
        </Alert>
      )}

      {classrooms.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No classrooms created yet. Go to{" "}
          <strong>Classrooms</strong> to add classrooms first.
        </Alert>
      ) : assignedRooms.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No class teachers assigned yet. Go to{" "}
          <strong>Classrooms</strong> → Edit each classroom to assign a teacher.
        </Alert>
      ) : (
        <>
          {/* ── Desktop Table ── */}
          {!isMobile ? (
            <Paper sx={{
              borderRadius: 3, overflow: "hidden",
              boxShadow: "0 2px 16px rgba(26,35,126,0.08)",
              border: "1px solid #e8eaf6", mb: 3
            }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1a237e" }}>
                    {["#","Assigned Class","Class Teacher",
                      "Email","Phone","Signature No"].map(h => (
                      <TableCell key={h} sx={{
                        color: "white", fontWeight: 700, fontSize: 13
                      }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignedRooms.map((c, idx) => {
                    const t = getTeacher(c.classTeacherId);
                    return (
                      <TableRow key={c.id} hover
                        sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Chip
                            icon={<HomeWorkIcon
                              sx={{ fontSize: "14px !important" }} />}
                            label={`Grade ${c.grade} - ${c.section}${c.stream ? ` (${c.stream})` : ""}`}
                            color="primary" size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell>
                          {t ? (
                            <Box display="flex" alignItems="center"
                              gap={1.5}>
                              <Avatar sx={{
                                bgcolor: getAvatarColor(t.name),
                                width: 34, height: 34,
                                fontSize: 14, fontWeight: 700
                              }}>
                                {t.name?.charAt(0)}
                              </Avatar>
                              <Typography variant="body2" fontWeight={700}>
                                {t.name}
                              </Typography>
                            </Box>
                          ) : (
                            <Chip label="Teacher not found"
                              size="small" color="error"
                              variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption"
                            color="text.secondary">
                            {t?.email || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>{t?.phone || "—"}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {t?.signatureNo || "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          ) : (
            /* ── Mobile Cards ── */
            <Box mb={3}>
              {assignedRooms.map(c => {
                const t = getTeacher(c.classTeacherId);
                return (
                  <Card key={c.id} sx={{
                    mb: 1.5, borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.08)"
                  }}>
                    <CardContent>
                      <Box display="flex" gap={1.5}
                        alignItems="flex-start">
                        <Avatar sx={{
                          bgcolor: t ? getAvatarColor(t.name) : "#e0e0e0",
                          width: 44, height: 44,
                          fontSize: 18, fontWeight: 700
                        }}>
                          {t?.name?.charAt(0) || "?"}
                        </Avatar>
                        <Box flex={1}>
                          <Box display="flex" justifyContent="space-between"
                            alignItems="center">
                            <Typography variant="subtitle2" fontWeight={700}>
                              {t?.name || "Unknown Teacher"}
                            </Typography>
                            <Chip
                              icon={<HomeWorkIcon
                                sx={{ fontSize: "12px !important" }} />}
                              label={`G${c.grade}-${c.section}`}
                              color="primary" size="small"
                              sx={{ fontWeight: 700 }}
                            />
                          </Box>
                          {t?.email && (
                            <Typography variant="caption"
                              color="text.secondary" display="block">
                              {t.email}
                            </Typography>
                          )}
                          {t?.phone && (
                            <Typography variant="caption"
                              color="text.secondary" display="block">
                              📞 {t.phone}
                            </Typography>
                          )}
                          {t?.signatureNo && (
                            <Typography variant="caption"
                              color="text.secondary" display="block">
                              ✍️ {t.signatureNo}
                            </Typography>
                          )}
                          {c.stream && (
                            <Chip label={c.stream} size="small"
                              color="warning"
                              sx={{ mt: 0.5, fontWeight: 600 }} />
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* ── Grade-wise Overview Grid ── */}
          <Typography variant="subtitle1" fontWeight={800}
            color="#1a237e" mb={1.5}>
            📊 Grade-wise Overview
          </Typography>
          <Grid container spacing={1.5}>
            {Object.entries(groupedByGrade).map(([g, gClassrooms]) => (
              <Grid item xs={12} sm={6} md={4} key={g}>
                <Paper sx={{
                  p: 1.5, borderRadius: 3,
                  border: "1px solid #e8eaf6",
                  boxShadow: "0 1px 6px rgba(26,35,126,0.06)"
                }}>
                  <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                    <SchoolIcon sx={{ color: "#1a237e", fontSize: 18 }} />
                    <Typography variant="subtitle2" fontWeight={800}
                      color="#1a237e">
                      Grade {g}
                    </Typography>
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={0.8}>
                    {gClassrooms.map(c => {
                      const t = getTeacher(c.classTeacherId);
                      return (
                        <Box key={c.id} sx={{
                          p: 1, borderRadius: 2, minWidth: 85,
                          bgcolor: t ? "#e8f5e9" : "#fff3e0",
                          border: `1px solid ${t ? "#a5d6a7" : "#ffcc80"}`
                        }}>
                          <Typography variant="caption" fontWeight={800}
                            color={t ? "#2e7d32" : "#e65100"}>
                            Section {c.section}
                          </Typography>
                          <Typography variant="caption" display="block"
                            color="text.secondary"
                            sx={{ fontSize: 10 }}>
                            {t
                              ? t.name.split(" ")[0]
                              : "⚠️ None"}
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