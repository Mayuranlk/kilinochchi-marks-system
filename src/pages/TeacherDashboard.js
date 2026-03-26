import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Grid, Card, CardContent, CardActions, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Button,
  useMediaQuery, useTheme
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SchoolIcon from "@mui/icons-material/School";

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [students, setStudents] = useState([]);
  const [marksCount, setMarksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const studSnap = await getDocs(collection(db, "students"));
      const filtered = studSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.grade === profile?.grade && s.section === profile?.section);
      setStudents(filtered);

      const marksSnap = await getDocs(collection(db, "marks"));
      const myMarks = marksSnap.docs
        .map((d) => d.data())
        .filter((m) => m.grade === profile?.grade && m.section === profile?.section);
      setMarksCount(myMarks.length);
      setLoading(false);
    }
    if (profile) fetch();
  }, [profile]);

  const statCards = [
    {
      label: "My Students", value: students.length,
      icon: <PeopleIcon sx={{ fontSize: 34, color: "#1a237e" }} />, color: "#e8eaf6"
    },
    {
      label: "Marks Records", value: marksCount,
      icon: <GradeIcon sx={{ fontSize: 34, color: "#1b5e20" }} />, color: "#e8f5e9"
    },
    {
      label: "My Class", value: `${profile?.grade || "?"}-${profile?.section || "?"}`,
      icon: <SchoolIcon sx={{ fontSize: 34, color: "#e65100" }} />, color: "#fff3e0"
    },
  ];

  return (
    <Box>
      <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e" gutterBottom>
        Welcome, {profile?.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Class Teacher — Grade {profile?.grade}-{profile?.section} | Subjects: {(profile?.subjects || []).join(", ")}
      </Typography>

      {loading ? <CircularProgress /> : (
        <>
          {/* Stat Cards */}
          <Grid container spacing={2} mb={3}>
            {statCards.map((c) => (
              <Grid item xs={4} key={c.label}>
                <Card sx={{ bgcolor: c.color, boxShadow: 2 }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
                    <Box display="flex" alignItems="center" gap={1} flexDirection={{ xs: "column", sm: "row" }}>
                      {c.icon}
                      <Box textAlign={{ xs: "center", sm: "left" }}>
                        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} lineHeight={1}>
                          {c.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary"
                          sx={{ fontSize: { xs: 9, sm: 12 } }}>
                          {c.label}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            My Students — Grade {profile?.grade}-{profile?.section}
          </Typography>

          {/* Mobile Card View */}
          {isMobile ? (
            <Box>
              {students.map((s, idx) => (
                <Card key={s.id} sx={{ mb: 1.5, boxShadow: 2 }}>
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adm: {s.admissionNo} • {s.gender}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">#{idx + 1}</Typography>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2 }}>
                    <Button size="small" variant="outlined" startIcon={<AssessmentIcon />}
                      onClick={() => navigate(`/teacher/report/${s.id}`)}>
                      Report
                    </Button>
                  </CardActions>
                </Card>
              ))}
              {students.length === 0 && (
                <Typography align="center" color="text.secondary" mt={2}>
                  No students in your class yet.
                </Typography>
              )}
            </Box>
          ) : (
            /* Desktop Table View */
            <Paper sx={{ overflowX: "auto", mb: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["No.", "Admission No", "Name", "Gender", "Action"].map((h) => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((s, idx) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{s.admissionNo}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.gender}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<AssessmentIcon />}
                          onClick={() => navigate(`/teacher/report/${s.id}`)}>
                          Report
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No students in your class yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Button variant="contained" fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e", mt: isMobile ? 1 : 0 }}
            onClick={() => navigate("/teacher/marks")}>
            Go to Marks Entry
          </Button>
        </>
      )}
    </Box>
  );
}