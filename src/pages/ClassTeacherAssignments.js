import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { GRADES, SECTIONS } from "../constants";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, CircularProgress, Chip, Grid, Card, CardContent,
  Alert, Avatar, useMediaQuery, useTheme
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function ClassTeacherAssignments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const snap = await getDocs(collection(db, "users"));
      setTeachers(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.role === "teacher" && (u.status || "active") === "active")
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setLoading(false);
    }
    fetchData();
  }, []);

  const classTeachers = teachers.filter(t => t.isClassTeacher);

  // ── Build full grid: all grade-section combos ──
  const allClasses = [];
  GRADES.forEach(g => SECTIONS.forEach(s => allClasses.push({ grade: g, section: s })));

  const assignedKeys = classTeachers.map(t => `${t.classGrade}-${t.classSection}`);
  const unassignedClasses = allClasses.filter(
    c => !assignedKeys.includes(`${c.grade}-${c.section}`)
  );

  const getAvatarColor = (name) => {
    const colors = ["#1a237e","#1565c0","#0277bd","#00695c",
                    "#2e7d32","#6a1b9a","#880e4f","#e65100"];
    let hash = 0;
    for (let i = 0; i < (name?.length || 0); i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box mb={2}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
          Class Teacher Assignments
        </Typography>
        <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
          <Chip
            icon={<CheckCircleIcon />}
            label={`Assigned: ${classTeachers.length}`}
            size="small" color="success" />
          <Chip
            icon={<WarningAmberIcon />}
            label={`Unassigned: ${unassignedClasses.length}`}
            size="small"
            color={unassignedClasses.length > 0 ? "warning" : "default"} />
          <Chip
            label={`Total Classes: ${allClasses.length}`}
            size="small" color="primary" />
        </Box>
      </Box>

      {/* Unassigned Warning */}
      {unassignedClasses.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
            ⚠️ Classes without a Class Teacher:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {unassignedClasses.map(c => (
              <Chip key={`${c.grade}-${c.section}`}
                label={`G${c.grade}-${c.section}`}
                size="small" color="warning" variant="outlined" />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
            Go to <strong>Manage Teachers</strong> → click 🏫 icon to assign.
          </Typography>
        </Alert>
      )}

      {classTeachers.length === 0 ? (
        <Alert severity="info">
          No class teachers assigned yet. Go to <strong>Manage Teachers</strong> and
          use the 🏫 button to assign class teachers.
        </Alert>
      ) : (
        <>
          {/* ── Desktop Table ── */}
          {!isMobile ? (
            <Paper sx={{ borderRadius: 3, overflow: "hidden",
              boxShadow: "0 2px 16px rgba(26,35,126,0.08)", mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1a237e" }}>
                    {["#", "Class Teacher", "Email", "Phone",
                      "Signature No", "Assigned Class"].map(h => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {classTeachers
                    .sort((a, b) => a.classGrade - b.classGrade ||
                      a.classSection?.localeCompare(b.classSection))
                    .map((t, idx) => (
                    <TableRow key={t.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar sx={{
                            bgcolor: getAvatarColor(t.name),
                            width: 36, height: 36, fontSize: 15, fontWeight: 700
                          }}>
                            {t.name?.charAt(0)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={700}>
                            {t.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {t.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{t.phone || "—"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {t.signatureNo || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<HomeWorkIcon sx={{ fontSize: "14px !important" }} />}
                          label={`Grade ${t.classGrade} - ${t.classSection}`}
                          color="primary" size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ) : (
            /* ── Mobile Cards ── */
            <Box mb={3}>
              {classTeachers
                .sort((a, b) => a.classGrade - b.classGrade ||
                  a.classSection?.localeCompare(b.classSection))
                .map(t => (
                <Card key={t.id} sx={{
                  mb: 1.5, borderRadius: 3,
                  border: "1px solid #e8eaf6",
                  boxShadow: "0 2px 8px rgba(26,35,126,0.08)"
                }}>
                  <CardContent>
                    <Box display="flex" gap={1.5} alignItems="flex-start">
                      <Avatar sx={{
                        bgcolor: getAvatarColor(t.name),
                        width: 44, height: 44, fontSize: 18, fontWeight: 700
                      }}>
                        {t.name?.charAt(0)}
                      </Avatar>
                      <Box flex={1}>
                        <Box display="flex" justifyContent="space-between"
                          alignItems="center">
                          <Typography variant="subtitle2" fontWeight={700}>
                            {t.name}
                          </Typography>
                          <Chip
                            icon={<HomeWorkIcon sx={{ fontSize: "12px !important" }} />}
                            label={`G${t.classGrade}-${t.classSection}`}
                            color="primary" size="small" />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {t.email}
                        </Typography>
                        {t.phone && (
                          <Typography variant="caption" color="text.secondary"
                            display="block">📞 {t.phone}</Typography>
                        )}
                        {t.signatureNo && (
                          <Typography variant="caption" color="text.secondary"
                            display="block">✍️ {t.signatureNo}</Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}

          {/* ── Grade-wise Summary Grid ── */}
          <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
            📊 Grade-wise Overview
          </Typography>
          <Grid container spacing={1.5}>
            {GRADES.map(g => (
              <Grid item xs={12} sm={6} md={4} key={g}>
                <Paper sx={{ p: 1.5, borderRadius: 2,
                  border: "1px solid #e8eaf6",
                  boxShadow: "0 1px 6px rgba(26,35,126,0.06)" }}>
                  <Typography variant="subtitle2" fontWeight={700}
                    color="#1a237e" mb={1}>
                    Grade {g}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.8}>
                    {SECTIONS.map(s => {
                      const ct = classTeachers.find(
                        t => t.classGrade === g && t.classSection === s
                      );
                      return (
                        <Box key={s} sx={{
                          p: 1, borderRadius: 1.5, minWidth: 80,
                          bgcolor: ct ? "#e8f5e9" : "#fff3e0",
                          border: `1px solid ${ct ? "#a5d6a7" : "#ffcc80"}`
                        }}>
                          <Typography variant="caption" fontWeight={700}
                            color={ct ? "#2e7d32" : "#e65100"}>
                            Section {s}
                          </Typography>
                          <Typography variant="caption" display="block"
                            color="text.secondary" sx={{ fontSize: 10 }}>
                            {ct ? ct.name.split(" ")[0] : "⚠️ None"}
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