import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { GRADES, SUBJECTS_BY_GRADE } from "../constants";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem,
  Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Grid, Alert, Button, ToggleButton,
  ToggleButtonGroup, Card, CardContent, TextField, InputAdornment,
  useMediaQuery, useTheme, Avatar
} from "@mui/material";
import ArrowBackIcon  from "@mui/icons-material/ArrowBack";
import SearchIcon     from "@mui/icons-material/Search";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleIcon     from "@mui/icons-material/People";
import GradeIcon      from "@mui/icons-material/Grade";
import MenuBookIcon   from "@mui/icons-material/MenuBook";

export default function StudentsBySubject() {
  const navigate = useNavigate();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [mode,     setMode]     = useState("assigned");
  const [grade,    setGrade]    = useState(6);
  const [subject,  setSubject]  = useState("");
  const [term,     setTerm]     = useState("Term 1");
  const [year,     setYear]     = useState(2026);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState("");

  const rawSubjects = SUBJECTS_BY_GRADE[grade] || [];

  useEffect(() => { setSubject(""); setStudents([]); }, [grade]);

  const RELIGION_VALUES  = ["Buddhism","Hinduism","Islam","Catholicism","Christianity"];
  const AESTHETIC_VALUES = ["Art","Music","Dancing","Drama & Theatre"];

  const isReligionSub  = RELIGION_VALUES.includes(subject);
  const isAestheticSub = AESTHETIC_VALUES.includes(subject);
  const isBasketSub    = grade >= 10 && grade <= 11
    && !isReligionSub && !isAestheticSub
    && !["Tamil","Mathematics","Science","History","English"].includes(subject);

  const subjectTypeBadge = isReligionSub
    ? { label: "Religion",  color: "#7b1fa2" }
    : isAestheticSub
    ? { label: "Aesthetic", color: "#1565c0" }
    : isBasketSub
    ? { label: "Basket",    color: "#e65100" }
    : { label: "Core",      color: "#2e7d32" };

  const handleSearch = async () => {
    if (!subject) return;
    setLoading(true); setStudents([]);

    const studSnap    = await getDocs(collection(db, "students"));
    const allStudents = studSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => (s.status || "active") === "active");

    if (mode === "assigned") {
      const result = allStudents
        .filter(s => {
          if (s.grade !== grade) return false;
          if (isReligionSub)  return s.religion  === subject;
          if (isAestheticSub) return s.grade >= 6 && s.grade <= 9
            && s.aesthetic === subject;
          if (isBasketSub)    return [s.basket1, s.basket2, s.basket3]
            .includes(subject);
          return true; // core subject — all students in grade
        })
        .sort((a, b) =>
          a.section.localeCompare(b.section) || a.name.localeCompare(b.name)
        )
        .map(s => ({ ...s, mark: null }));
      setStudents(result);

    } else {
      const marksSnap = await getDocs(collection(db, "marks"));
      const marksList = marksSnap.docs
        .map(d => d.data())
        .filter(m =>
          m.subject === subject &&
          m.term    === term &&
          (m.year   === year || !m.year)
        );
      const result = marksList.map(m => {
        const student = allStudents.find(s => s.id === m.studentId);
        return student ? { ...student, mark: m.mark, hasMarks: true } : null;
      }).filter(Boolean).sort((a, b) => b.mark - a.mark);
      setStudents(result);
    }
    setLoading(false);
  };

  const filtered = students.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.admissionNo?.includes(search)
  );

  const getGradeLabel = (mark) => {
    if (mark === null || mark === undefined) return null;
    if (mark >= 75) return { label: "A", color: "success" };
    if (mark >= 65) return { label: "B", color: "primary" };
    if (mark >= 55) return { label: "C", color: "warning" };
    if (mark >= 35) return { label: "S", color: "default" };
    return { label: "F", color: "error" };
  };

  const avgMark = students.filter(s => s.mark !== null).length > 0
    ? (students.reduce((sum, s) => sum + (s.mark || 0), 0) /
       students.filter(s => s.mark !== null).length).toFixed(1)
    : null;

  return (
    <Box>

      {/* ── Header ── */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1, mb: 2,
        bgcolor: "white", borderRadius: 3, p: 2,
        boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
        border: "1px solid #e8eaf6"
      }}>
        <Button startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/students")}
          size="small" variant="outlined"
          sx={{ color: "#1a237e", borderColor: "#1a237e" }}>
          Back
        </Button>
        <MenuBookIcon sx={{ color: "#1a237e", ml: 1 }} />
        <Typography variant={isMobile ? "h6" : "h5"}
          fontWeight={800} color="#1a237e">
          Students by Subject
        </Typography>
      </Box>

      {/* ── Mode Toggle ── */}
      <Box mb={2} sx={{
        bgcolor: "white", borderRadius: 3, p: 2,
        boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
        border: "1px solid #e8eaf6"
      }}>
        <ToggleButtonGroup value={mode} exclusive
          onChange={(e, v) => { if (v) { setMode(v); setStudents([]); } }}
          size="small" fullWidth>
          <ToggleButton value="assigned" sx={{
            fontWeight: 600,
            "&.Mui-selected": {
              bgcolor: "#1a237e", color: "white",
              "&:hover": { bgcolor: "#283593" }
            }
          }}>
            <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
            Assigned Students
          </ToggleButton>
          <ToggleButton value="marks" sx={{
            fontWeight: 600,
            "&.Mui-selected": {
              bgcolor: "#1a237e", color: "white",
              "&:hover": { bgcolor: "#283593" }
            }
          }}>
            <GradeIcon sx={{ mr: 1, fontSize: 18 }} />
            By Marks
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary"
          mt={0.5} display="block">
          {mode === "assigned"
            ? "📋 View all students assigned to this subject by grade"
            : "📊 View students who have marks for this subject in a specific term"}
        </Typography>
      </Box>

      {/* ── Filters ── */}
      <Card sx={{
        mb: 2, bgcolor: "#f8f9ff",
        border: "1px solid #e8eaf6", borderRadius: 3
      }}>
        <CardContent sx={{ pb: "16px !important" }}>
          <Grid container spacing={1.5} alignItems="flex-end">
            <Grid item xs={6} sm={mode === "marks" ? 2 : 3}>
              <FormControl fullWidth size="small">
                <InputLabel>Grade</InputLabel>
                <Select value={grade} label="Grade"
                  onChange={e => setGrade(Number(e.target.value))}>
                  {GRADES.map(g => (
                    <MenuItem key={g} value={g}>Grade {g}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={mode === "marks" ? 3 : 5}>
              <FormControl fullWidth size="small">
                <InputLabel>Subject</InputLabel>
                <Select value={subject} label="Subject"
                  onChange={e => setSubject(e.target.value)}>
                  <MenuItem value="">Select subject...</MenuItem>
                  {rawSubjects.map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {mode === "marks" && (
              <>
                <Grid item xs={6} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Term</InputLabel>
                    <Select value={term} label="Term"
                      onChange={e => setTerm(e.target.value)}>
                      {["Term 1","Term 2","Term 3"].map(t => (
                        <MenuItem key={t} value={t}>{t}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Year</InputLabel>
                    <Select value={year} label="Year"
                      onChange={e => setYear(e.target.value)}>
                      {[2026,2025,2024].map(y => (
                        <MenuItem key={y} value={y}>{y}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={mode === "marks" ? 3 : 4}>
              <Button variant="contained" fullWidth
                onClick={handleSearch}
                disabled={!subject || loading}
                sx={{ bgcolor: "#1a237e", height: 40,
                  fontWeight: 700, borderRadius: 2 }}>
                {loading
                  ? <CircularProgress size={20} color="inherit" />
                  : "Search →"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Results ── */}
      {students.length > 0 && (
        <>
          {/* Subject type badge */}
          {subject && (
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <Chip label={subjectTypeBadge.label} size="small"
                sx={{ bgcolor: subjectTypeBadge.color,
                  color: "white", fontWeight: 700 }} />
              <Typography variant="body2" fontWeight={700} color="#1a237e">
                {subject}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                — Grade {grade}
              </Typography>
            </Box>
          )}

          {/* Summary cards */}
          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: "#e8eaf6", textAlign: "center",
                borderRadius: 3 }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="h4" fontWeight={700} color="#1a237e">
                    {students.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Students
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {mode === "marks" && avgMark && (
              <>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: "#e8f5e9", textAlign: "center",
                    borderRadius: 3 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h4" fontWeight={700} color="#2e7d32">
                        {avgMark}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Class Average
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: "#fff3e0", textAlign: "center",
                    borderRadius: 3 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h4" fontWeight={700} color="#e65100">
                        {students.filter(s => s.mark >= 35).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Passed
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: "#ffebee", textAlign: "center",
                    borderRadius: 3 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h4" fontWeight={700} color="#c62828">
                        {students.filter(s => s.mark < 35).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Failed
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          {/* Search bar */}
          <TextField fullWidth size="small" sx={{ mb: 2 }}
            placeholder="Search student name or admission no..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{
              sx: { borderRadius: 2 },
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "#1a237e" }} />
                </InputAdornment>
              )
            }} />

          {/* ── Table ── */}
          <Paper sx={{
            overflowX: "auto", borderRadius: 3,
            boxShadow: "0 2px 12px rgba(26,35,126,0.08)"
          }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#1a237e" }}>
                  {[
                    "#", "Student", "Grade",
                    // ✅ Only show Marks/Grade/Rank in marks mode
                    // No extra column in assigned mode
                    ...(mode === "marks" ? ["Marks", "Grade", "Rank"] : []),
                    "Action"
                  ].map(h => (
                    <TableCell key={h} sx={{
                      color: "white", fontWeight: 700,
                      fontSize: { xs: 11, sm: 13 }
                    }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((s, idx) => {
                  const gradeInfo = getGradeLabel(s.mark);
                  return (
                    <TableRow key={s.id} hover
                      sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>

                      {/* # */}
                      <TableCell sx={{ fontSize: { xs: 12, sm: 14 } }}>
                        {mode === "marks" ? (
                          <Avatar sx={{
                            width: 24, height: 24, fontSize: 12,
                            bgcolor: idx === 0 ? "#ffd700"
                              : idx === 1 ? "#c0c0c0"
                              : idx === 2 ? "#cd7f32" : "#e8eaf6",
                            color: idx < 3 ? "#000" : "#1a237e"
                          }}>
                            {idx + 1}
                          </Avatar>
                        ) : idx + 1}
                      </TableCell>

                      {/* Student */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {isMobile ? s.name.split(" ")[0] : s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.admissionNo}
                        </Typography>
                      </TableCell>

                      {/* Grade chip */}
                      <TableCell>
                        <Chip label={`G${s.grade}-${s.section}`}
                          size="small" color="primary"
                          sx={{ fontWeight: 700, fontSize: 11 }} />
                      </TableCell>

                      {/* Marks mode columns only */}
                      {mode === "marks" && (
                        <>
                          <TableCell>
                            <Typography fontWeight={700}>
                              {s.mark}/100
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {gradeInfo && (
                              <Chip label={gradeInfo.label} size="small"
                                color={gradeInfo.color} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}
                              color={idx === 0 ? "#f57f17" : "text.primary"}>
                              #{idx + 1}
                            </Typography>
                          </TableCell>
                        </>
                      )}

                      {/* Action */}
                      <TableCell>
                        <Button size="small" variant="outlined"
                          startIcon={!isMobile && <AssessmentIcon />}
                          onClick={() => navigate(`/report/${s.id}`)}
                          sx={{
                            fontSize: { xs: 10, sm: 13 },
                            minWidth: 0, px: { xs: 1, sm: 2 },
                            borderColor: "#1a237e", color: "#1a237e"
                          }}>
                          {isMobile ? "📊" : "Report"}
                        </Button>
                      </TableCell>

                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* No results */}
      {!loading && subject && students.length === 0 && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: 3 }}>
          No students found for <strong>{subject}</strong> in Grade {grade}.
          Click Search to load results.
        </Alert>
      )}

      {/* Empty state */}
      {!subject && (
        <Box textAlign="center" py={6}>
          <GradeIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography color="text.secondary" mt={1} variant="h6"
            fontWeight={600}>
            Select a grade and subject to view students
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Religion, Aesthetic, Basket and Core subjects all supported
          </Typography>
        </Box>
      )}

    </Box>
  );
}