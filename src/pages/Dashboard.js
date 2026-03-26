import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Grid, Card, CardContent, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Paper,
  Button, Chip, useMediaQuery, useTheme
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import PersonIcon from "@mui/icons-material/Person";
import AssessmentIcon from "@mui/icons-material/Assessment";

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [marksCount, setMarksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [studSnap, usersSnap, marksSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "marks")),
      ]);
      setStudents(studSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTeachers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "teacher"));
      setMarksCount(marksSnap.size);
      setLoading(false);
    }
    fetchAll();
  }, []);

  const statCards = [
    { label: "Total Students", value: students.length, icon: <PeopleIcon sx={{ fontSize: 34, color: "#1a237e" }} />, color: "#e8eaf6", path: "/students" },
    { label: "Total Teachers", value: teachers.length, icon: <PersonIcon sx={{ fontSize: 34, color: "#1b5e20" }} />, color: "#e8f5e9", path: "/teachers" },
    { label: "Marks Records", value: marksCount, icon: <GradeIcon sx={{ fontSize: 34, color: "#e65100" }} />, color: "#fff3e0", path: "/marks" },
    { label: "Classes Active", value: [...new Set(students.map((s) => `${s.grade}-${s.section}`))].length, icon: <AssessmentIcon sx={{ fontSize: 34, color: "#4a148c" }} />, color: "#f3e5f5", path: "/students" },
  ];

  return (
    <Box>
      <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e" gutterBottom>
        Admin Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Overview of Kilinochchi Marks Management System
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box>
      ) : (
        <>
          <Grid container spacing={2} mb={3}>
            {statCards.map((c) => (
              <Grid item xs={6} md={3} key={c.label}>
                <Card sx={{ bgcolor: c.color, boxShadow: 2, cursor: "pointer",
                  "&:hover": { boxShadow: 5, transform: "translateY(-2px)", transition: "all 0.2s" } }}
                  onClick={() => navigate(c.path)}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {c.icon}
                      <Box>
                        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} lineHeight={1}>
                          {c.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 12 } }}>
                          {c.label}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" fontWeight={600} mb={1}>Recent Students</Typography>
          <Paper sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1a237e" }}>
                <TableRow>
                  {(isMobile
                    ? ["Adm No", "Name", "Grade", ""]
                    : ["Admission No", "Name", "Grade", "Section", "Gender", "Action"]
                  ).map((h) => (
                    <TableCell key={h} sx={{ color: "white", fontWeight: 600,
                      fontSize: { xs: 11, sm: 14 }, px: { xs: 1, sm: 2 } }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {students.slice(0, 5).map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontSize: { xs: 12, sm: 14 }, px: { xs: 1, sm: 2 } }}>{s.admissionNo}</TableCell>
                    <TableCell sx={{ fontSize: { xs: 12, sm: 14 }, px: { xs: 1, sm: 2 } }}>{s.name}</TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                      <Chip label={`G${s.grade}`} size="small" color="primary" sx={{ fontSize: 11 }} />
                    </TableCell>
                    {!isMobile && <TableCell>{s.section}</TableCell>}
                    {!isMobile && <TableCell>{s.gender}</TableCell>}
                    <TableCell sx={{ px: { xs: 0.5, sm: 2 } }}>
                      <Button size="small" variant="outlined"
                        onClick={() => navigate(`/report/${s.id}`)}
                        sx={{ minWidth: 0, px: { xs: 1, sm: 2 }, fontSize: { xs: 10, sm: 13 } }}>
                        {isMobile ? <AssessmentIcon fontSize="small" /> : "Report"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 4 : 6} align="center">No students added yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {students.length > 5 && (
            <Button variant="contained" sx={{ bgcolor: "#1a237e", mt: 2 }}
              fullWidth={isMobile} onClick={() => navigate("/students")}>
              View All Students
            </Button>
          )}
        </>
      )}
    </Box>
  );
}