import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getStudentSubjects, TERMS, SCHOOL_NAME, SCHOOL_SUBTITLE } from "../constants";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, CircularProgress, Button, Chip, Divider, Grid,
  FormControl, InputLabel, Select, MenuItem, Card, CardContent,
  Alert, useMediaQuery, useTheme
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import BarChartIcon from "@mui/icons-material/BarChart";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import WarningIcon from "@mui/icons-material/Warning";

// ── Grade helpers ──
function getGradeLetter(mark, grade) {
  if (grade >= 6 && grade <= 9) {
    if (mark >= 75) return { label: "A", color: "#2e7d32", bg: "#e8f5e9" };
    if (mark >= 65) return { label: "B", color: "#1565c0", bg: "#e3f2fd" };
    if (mark >= 55) return { label: "C", color: "#e65100", bg: "#fff3e0" };
    if (mark >= 40) return { label: "D", color: "#555",    bg: "#f5f5f5" };
    return               { label: "E", color: "#c62828", bg: "#ffebee" };
  }
  if (mark >= 75) return { label: "A", color: "#2e7d32", bg: "#e8f5e9" };
  if (mark >= 65) return { label: "B", color: "#1565c0", bg: "#e3f2fd" };
  if (mark >= 55) return { label: "C", color: "#e65100", bg: "#fff3e0" };
  if (mark >= 40) return { label: "S", color: "#555",    bg: "#f5f5f5" };
  return               { label: "F", color: "#c62828", bg: "#ffebee" };
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export default function ClassReport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const printRef = useRef();

  const [loading, setLoading]       = useState(true);
  const [students, setStudents]     = useState([]);
  const [allMarks, setAllMarks]     = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState("active");
  const [terms, setTerms]           = useState([]);

  useEffect(() => {
    async function fetchData() {
      if (!profile?.isClassTeacher) return;

      // ── Active term ──
      const tSnap = await getDocs(collection(db, "academicTerms"));
      const allTerms = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = allTerms.find(t => t.isActive) || null;
      setActiveTerm(active);
      setTerms(allTerms.sort((a, b) => b.year - a.year));

      // ── Students in this class ──
      const sSnap = await getDocs(collection(db, "students"));
      const classStudents = sSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s =>
          s.grade   === profile.classGrade &&
          s.section === profile.classSection &&
          (s.status || "active") === "active"
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(classStudents);

      // ── Marks ──
      const mSnap = await getDocs(collection(db, "marks"));
      const classMarks = mSnap.docs
        .map(d => d.data())
        .filter(m =>
          m.grade   === profile.classGrade &&
          m.section === profile.classSection
        );
      setAllMarks(classMarks);
      setLoading(false);
    }
    fetchData();
  }, [profile]);

  // ── Resolve which term to show ──
  const currentTerm = selectedTerm === "active"
    ? activeTerm
    : terms.find(t => t.id === selectedTerm) || null;

  // ── Filter marks for selected term ──
  const termMarks = currentTerm
    ? allMarks.filter(m =>
        m.term === currentTerm.term &&
        m.year === currentTerm.year
      )
    : [];

  // ── Get all subjects for this class ──
  const allSubjects = [...new Set(
    students.flatMap(s => getStudentSubjects(s))
  )];

  // ── Build per-student data ──
  const studentData = students.map(s => {
    const sSubjects = getStudentSubjects(s);
    const sMarks = {};
    let total = 0; let count = 0;

    sSubjects.forEach(sub => {
      const m = termMarks.find(
        mk => mk.studentId === s.id && mk.subject === sub
      );
      sMarks[sub] = m ? m.mark : null;
      if (m) { total += m.mark; count++; }
    });

    const average = count > 0 ? (total / count).toFixed(1) : null;
    return { ...s, sMarks, total, count, average };
  });

  // ── Rank by total (only students with marks) ──
  const ranked = [...studentData]
    .filter(s => s.count > 0)
    .sort((a, b) => b.total - a.total);

  let currentRank = 1;
  ranked.forEach((s, idx) => {
    if (idx > 0 && s.total === ranked[idx - 1].total) {
      s.rank = ranked[idx - 1].rank; // same rank for ties
    } else {
      s.rank = currentRank;
    }
    currentRank++;
  });

  // Merge rank back
  const finalData = studentData.map(s => {
    const r = ranked.find(r => r.id === s.id);
    return { ...s, rank: r?.rank || "—" };
  });

  // ── Subject Analysis ──
  const subjectAnalysis = allSubjects.map(sub => {
    const subMarks = termMarks
      .filter(m => m.subject === sub)
      .map(m => m.mark);

    if (subMarks.length === 0) return {
      subject: sub, count: 0, avg: null,
      highest: null, lowest: null, passRate: null,
      gradesDist: {}
    };

    const passThreshold = profile.classGrade >= 10 ? 40 : 40;
    const passed  = subMarks.filter(m => m >= passThreshold).length;
    const gradesDist = {};
    subMarks.forEach(m => {
      const g = getGradeLetter(m, profile.classGrade).label;
      gradesDist[g] = (gradesDist[g] || 0) + 1;
    });

    return {
      subject:   sub,
      count:     subMarks.length,
      avg:       avg(subMarks).toFixed(1),
      highest:   Math.max(...subMarks),
      lowest:    Math.min(...subMarks),
      passRate:  Math.round((passed / subMarks.length) * 100),
      gradesDist
    };
  });

  // ── Print handler ──
  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Class Report — Grade ${profile?.classGrade}-${profile?.classSection}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #000; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th, td { border: 1px solid #555; padding: 5px 8px; text-align: center; }
        th { background: #1a237e; color: white; }
        td:nth-child(2) { text-align: left; }
        .header { text-align: center; margin-bottom: 16px; }
        h2, h3 { margin: 4px 0; }
        .section-title { font-size: 14px; font-weight: bold;
          color: #1a237e; margin: 16px 0 6px; }
        .rank-1 { background: #fff9c4; }
        .rank-2 { background: #f5f5f5; }
        .rank-3 { background: #fbe9e7; }
        @media print { button { display: none !important; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (!profile?.isClassTeacher) return (
    <Box mt={4}>
      <Alert severity="error">
        You are not assigned as a Class Teacher.
      </Alert>
    </Box>
  );

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box>
  );

  return (
    <Box>
      {/* Header */}
      <Button startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/teacher")} sx={{ mb: 2 }}>
        Back to Dashboard
      </Button>

      <Box display="flex" justifyContent="space-between"
        alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"}
            fontWeight={700} color="#1a237e">
            Class Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grade {profile.classGrade}-{profile.classSection} •
            {students.length} students
          </Typography>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          {/* Term Selector */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Term</InputLabel>
            <Select value={selectedTerm} label="Term"
              onChange={e => setSelectedTerm(e.target.value)}>
              <MenuItem value="active">
                {activeTerm
                  ? `Active: ${activeTerm.term} ${activeTerm.year}`
                  : "Active Term"}
              </MenuItem>
              {terms.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.term} {t.year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!isMobile && (
            <Button variant="contained" startIcon={<PrintIcon />}
              onClick={handlePrint} sx={{ bgcolor: "#1a237e" }}>
              Print
            </Button>
          )}
        </Box>
      </Box>

      {!currentTerm ? (
        <Alert severity="warning" icon={<WarningIcon />}>
          No active term found. Select a term above.
        </Alert>
      ) : termMarks.length === 0 ? (
        <Alert severity="info">
          No marks entered yet for {currentTerm.term} {currentTerm.year}.
        </Alert>
      ) : (
        <Box ref={printRef}>

          {/* ── Print Header ── */}
          <Box textAlign="center" mb={2} className="header">
            <Typography variant="h6" fontWeight={700} color="#1a237e">
              {SCHOOL_NAME}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {SCHOOL_SUBTITLE}
            </Typography>
            <Typography variant="body2" fontWeight={600} mt={0.5}>
              Class Performance Report — Grade {profile.classGrade}-{profile.classSection}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentTerm.term} {currentTerm.year}
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {/* ══════════════════════════════
              SECTION 1: MARKS SCHEDULE
          ══════════════════════════════ */}
          <Typography className="section-title"
            variant="subtitle1" fontWeight={700} color="#1a237e" mb={1}>
            📋 Marks Schedule — {currentTerm.term} {currentTerm.year}
          </Typography>

          <Paper sx={{ overflowX: "auto", mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1a237e" }}>
                <TableRow>
                  <TableCell sx={{ color: "white", fontWeight: 700,
                    position: "sticky", left: 0, bgcolor: "#1a237e", zIndex: 2 }}>
                    Rank
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700,
                    position: "sticky", left: 50, bgcolor: "#1a237e", zIndex: 2,
                    minWidth: 140 }}>
                    Name
                  </TableCell>
                  {allSubjects.map(sub => (
                    <TableCell key={sub} sx={{
                      color: "white", fontWeight: 600,
                      fontSize: 11, minWidth: 70, textAlign: "center"
                    }}>
                      {sub.length > 10 ? sub.substring(0, 10) + "…" : sub}
                    </TableCell>
                  ))}
                  <TableCell sx={{ color: "white", fontWeight: 700,
                    textAlign: "center" }}>Total</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700,
                    textAlign: "center" }}>Avg</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700,
                    textAlign: "center" }}>Grade</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {finalData
                  .sort((a, b) => {
                    if (a.rank === "—") return 1;
                    if (b.rank === "—") return -1;
                    return a.rank - b.rank;
                  })
                  .map(s => {
                    const avgNum = parseFloat(s.average);
                    const gradeInfo = s.average
                      ? getGradeLetter(avgNum, profile.classGrade)
                      : null;
                    const rowBg = s.rank === 1 ? "#fff9c4"
                                : s.rank === 2 ? "#f5f5f5"
                                : s.rank === 3 ? "#fbe9e7"
                                : "white";
                    return (
                      <TableRow key={s.id} hover sx={{ bgcolor: rowBg }}>
                        <TableCell sx={{
                          fontWeight: 700, textAlign: "center",
                          position: "sticky", left: 0, bgcolor: rowBg
                        }}>
                          {s.rank === 1 ? "🥇"
                           : s.rank === 2 ? "🥈"
                           : s.rank === 3 ? "🥉"
                           : s.rank}
                        </TableCell>
                        <TableCell sx={{
                          fontWeight: 600, fontSize: 13,
                          position: "sticky", left: 50, bgcolor: rowBg
                        }}>
                          {isMobile ? s.name.split(" ")[0] : s.name}
                        </TableCell>
                        {allSubjects.map(sub => {
                          const mark = s.sMarks[sub];
                          const g = mark !== null
                            ? getGradeLetter(mark, profile.classGrade)
                            : null;
                          return (
                            <TableCell key={sub} sx={{
                              textAlign: "center",
                              bgcolor: mark !== null ? g.bg : "#fafafa"
                            }}>
                              {mark !== null ? (
                                <Typography variant="body2" fontWeight={600}
                                  color={g.color}>
                                  {mark}
                                </Typography>
                              ) : (
                                <Typography variant="caption"
                                  color="text.disabled">—</Typography>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell sx={{ textAlign: "center", fontWeight: 700 }}>
                          {s.count > 0 ? s.total : "—"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center", fontWeight: 700,
                          color: gradeInfo?.color }}>
                          {s.average || "—"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          {gradeInfo ? (
                            <span style={{
                              color: gradeInfo.color, fontWeight: 700,
                              background: gradeInfo.bg,
                              padding: "2px 10px", borderRadius: 12, fontSize: 13
                            }}>
                              {gradeInfo.label}
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Paper>

          {/* ══════════════════════════════
              SECTION 2: CLASS SUMMARY
          ══════════════════════════════ */}
          <Typography className="section-title"
            variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
            📊 Class Summary
          </Typography>
          <Grid container spacing={2} mb={3}>
            {[
              {
                label: "Class Average",
                value: (() => {
                  const avgs = finalData
                    .filter(s => s.average)
                    .map(s => parseFloat(s.average));
                  return avgs.length ? avg(avgs).toFixed(1) : "—";
                })(),
                color: "#e8eaf6", icon: "📈"
              },
              {
                label: "Highest Average",
                value: (() => {
                  const top = finalData.find(s => s.rank === 1);
                  return top?.average
                    ? `${top.average} (${top.name.split(" ")[0]})`
                    : "—";
                })(),
                color: "#e8f5e9", icon: "🥇"
              },
              {
                label: "Lowest Average",
                value: (() => {
                  const withMarks = finalData.filter(s => s.average);
                  if (!withMarks.length) return "—";
                  const bot = withMarks.reduce((a, b) =>
                    parseFloat(a.average) < parseFloat(b.average) ? a : b
                  );
                  return `${bot.average} (${bot.name.split(" ")[0]})`;
                })(),
                color: "#fff3e0", icon: "📉"
              },
              {
                label: "Students Ranked",
                value: `${finalData.filter(s => s.rank !== "—").length} / ${students.length}`,
                color: "#e3f2fd", icon: "👥"
              },
            ].map(c => (
              <Grid item xs={6} sm={3} key={c.label}>
                <Card sx={{ bgcolor: c.color, boxShadow: 1 }}>
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      {c.icon} {c.label}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} mt={0.3}>
                      {c.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ══════════════════════════════
              SECTION 3: SUBJECT ANALYSIS
          ══════════════════════════════ */}
          <Typography className="section-title"
            variant="subtitle1" fontWeight={700} color="#1a237e" mb={1}>
            🔬 Subject Analysis
          </Typography>
          <Paper sx={{ overflowX: "auto", mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#37474f" }}>
                <TableRow>
                  {["Subject", "Entered", "Average",
                    "Highest", "Lowest", "Pass Rate",
                    "A", "B", "C", "S/D", "F/E"].map(h => (
                    <TableCell key={h} sx={{
                      color: "white", fontWeight: 600,
                      textAlign: "center", fontSize: 12
                    }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {subjectAnalysis.map(sa => (
                  <TableRow key={sa.subject} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {sa.subject}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {sa.count > 0 ? (
                        <Chip label={sa.count} size="small"
                          color={sa.count === students.length ? "success" : "warning"} />
                      ) : (
                        <Chip label="0" size="small" color="error" />
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", fontWeight: 700,
                      color: sa.avg >= 65 ? "#2e7d32"
                           : sa.avg >= 40 ? "#e65100" : "#c62828" }}>
                      {sa.avg || "—"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", color: "#2e7d32",
                      fontWeight: 600 }}>
                      {sa.highest ?? "—"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", color: "#c62828",
                      fontWeight: 600 }}>
                      {sa.lowest ?? "—"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {sa.passRate !== null ? (
                        <Chip
                          label={`${sa.passRate}%`} size="small"
                          color={sa.passRate >= 80 ? "success"
                               : sa.passRate >= 50 ? "warning" : "error"} />
                      ) : "—"}
                    </TableCell>
                    {["A","B","C",
                      profile.classGrade <= 9 ? "D" : "S",
                      profile.classGrade <= 9 ? "E" : "F"
                    ].map(g => (
                      <TableCell key={g} sx={{ textAlign: "center" }}>
                        <Typography variant="body2" fontWeight={600}
                          color={g === "A" ? "#2e7d32"
                               : g === "B" ? "#1565c0"
                               : g === "C" ? "#e65100"
                               : ["D","S"].includes(g) ? "#555" : "#c62828"}>
                          {sa.gradesDist[g] || 0}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* ══════════════════════════════
              SECTION 4: TOP PERFORMERS
          ══════════════════════════════ */}
          <Typography className="section-title"
            variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
            🏆 Top Performers
          </Typography>
          <Grid container spacing={1.5} mb={3}>
            {ranked.slice(0, 5).map((s, idx) => (
              <Grid item xs={12} sm={6} md={4} key={s.id}>
                <Card sx={{
                  bgcolor: idx === 0 ? "#fff9c4"
                         : idx === 1 ? "#f5f5f5"
                         : idx === 2 ? "#fbe9e7" : "white",
                  border: "1px solid #e0e0e0",
                  boxShadow: idx < 3 ? 3 : 1
                }}>
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉"
                          : `#${idx + 1}`}
                      </Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Avg: {s.average} | Total: {s.total}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

        </Box>
      )}

      {/* Print Button Mobile */}
      {isMobile && termMarks.length > 0 && (
        <Button variant="contained" startIcon={<PrintIcon />}
          fullWidth onClick={handlePrint}
          sx={{ bgcolor: "#1a237e", mt: 2 }}>
          Print Class Report
        </Button>
      )}
    </Box>
  );
}