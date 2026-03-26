import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { TERMS, getStudentSubjects, SCHOOL_NAME, SCHOOL_SUBTITLE } from "../constants";
import { useAuth } from "../context/AuthContext";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, CircularProgress, Button, Chip, Divider, Grid,
  FormControl, InputLabel, Select, MenuItem, Card, CardContent,
  useMediaQuery, useTheme, Alert
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const GRADE_LABELS = [
  { min: 75, label: "A", color: "#2e7d32", bg: "#e8f5e9", desc: "Distinction" },
  { min: 65, label: "B", color: "#1565c0", bg: "#e3f2fd", desc: "Very Good" },
  { min: 55, label: "C", color: "#e65100", bg: "#fff3e0", desc: "Credit Pass" },
  { min: 40, label: "S", color: "#555",    bg: "#f5f5f5", desc: "Simple Pass" },
  { min: 0,  label: "F", color: "#c62828", bg: "#ffebee", desc: "Failure" },
];

function getGrade(mark, grade) {
  const labels = grade >= 6 && grade <= 9
    ? [
        { min: 75, label: "A", color: "#2e7d32", bg: "#e8f5e9", desc: "Excellent" },
        { min: 65, label: "B", color: "#1565c0", bg: "#e3f2fd", desc: "Good" },
        { min: 55, label: "C", color: "#e65100", bg: "#fff3e0", desc: "Average" },
        { min: 40, label: "D", color: "#555",    bg: "#f5f5f5", desc: "Below Average" },
        { min: 0,  label: "E", color: "#c62828", bg: "#ffebee", desc: "Fail" },
      ]
    : GRADE_LABELS;
  for (const g of labels) {
    if (mark >= g.min) return g;
  }
  return labels[labels.length - 1];
}

export default function ReportCard() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const printRef = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [student, setStudent] = useState(null);
  const [allMarks, setAllMarks] = useState([]);
  const [term, setTerm] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const sSnap = await getDoc(doc(db, "students", studentId));
      if (sSnap.exists()) setStudent({ id: sSnap.id, ...sSnap.data() });
      const mSnap = await getDocs(collection(db, "marks"));
      const studentMarks = mSnap.docs
        .map((d) => d.data())
        .filter((m) => m.studentId === studentId);
      setAllMarks(studentMarks);
      setLoading(false);
    }
    fetch();
  }, [studentId]);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Report Card - ${student?.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
        th { background: #1a237e; color: white; }
        h2, h3 { margin: 4px 0; }
        .header { text-align: center; margin-bottom: 20px; }
        .grade-chip { display: inline-block; padding: 2px 10px;
                      border-radius: 12px; font-weight: bold; font-size: 13px; }
        @media print { button { display: none; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Sort marks by student's subject order from getStudentSubjects ──
  const sortMarks = (marksList) => {
    if (!student) return marksList;
    const subjectOrder = getStudentSubjects(student);
    return [...marksList].sort((a, b) => {
      const ai = subjectOrder.indexOf(a.subject);
      const bi = subjectOrder.indexOf(b.subject);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  };

  const filteredMarks = sortMarks(
    term === "All" ? allMarks : allMarks.filter((m) => m.term === term)
  );

  const grouped = TERMS.reduce((acc, t) => {
    acc[t] = sortMarks(allMarks.filter((m) => m.term === t));
    return acc;
  }, {});

  const calcAverage = (marksList) => {
    if (!marksList.length) return null;
    return (marksList.reduce((s, m) => s + m.mark, 0) / marksList.length).toFixed(1);
  };

  // ── Expected subjects for this student ──
  const expectedSubjects = student ? getStudentSubjects(student) : [];
  const backPath = isAdmin ? "/students" : "/teacher";

  // ── Marks row renderer ──
  const renderMarksRow = (m) => {
    const g = getGrade(m.mark, student?.grade);
    return (
      <TableRow key={`${m.subject}-${m.term}`} hover>
        <TableCell>{m.subject}</TableCell>
        <TableCell><strong>{m.mark}</strong> / 100</TableCell>
        <TableCell>
          <span style={{
            color: g.color, fontWeight: 700,
            background: g.bg, padding: "2px 10px",
            borderRadius: 12, fontSize: 13
          }}>
            {g.label}
          </span>
        </TableCell>
        <TableCell>{g.desc}</TableCell>
      </TableRow>
    );
  };

  const renderMobileRow = (m) => {
    const g = getGrade(m.mark, student?.grade);
    return (
      <Box key={`${m.subject}-${m.term}`}
        display="flex" justifyContent="space-between"
        alignItems="center" py={1}
        sx={{ borderBottom: "1px solid #eee" }}>
        <Typography variant="body2">{m.subject}</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" fontWeight={700}>{m.mark}/100</Typography>
          <Chip label={g.label} size="small"
            sx={{ bgcolor: g.bg, color: g.color, fontWeight: 700, minWidth: 32 }} />
        </Box>
      </Box>
    );
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box>
  );

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>
        Back
      </Button>

      {!student ? (
        <Typography>Student not found.</Typography>
      ) : (
        <>
          {/* Controls */}
          <Box display="flex" justifyContent="space-between" alignItems="center"
            mb={2} flexWrap="wrap" gap={1}>
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
              Report Card
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Term</InputLabel>
                <Select value={term} label="Term"
                  onChange={(e) => setTerm(e.target.value)}>
                  <MenuItem value="All">All Terms</MenuItem>
                  {TERMS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
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

          {/* Missing subjects warning */}
          {(() => {
            const enteredSubjects = [...new Set(allMarks.map(m => m.subject))];
            const missing = expectedSubjects.filter(s => !enteredSubjects.includes(s));
            return missing.length > 0 ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Marks not yet entered for: <strong>{missing.join(", ")}</strong>
              </Alert>
            ) : null;
          })()}

          {/* Printable Area */}
          <Paper sx={{ p: { xs: 2, sm: 3 } }} ref={printRef}>

            {/* School Header */}
            <Box textAlign="center" mb={2}>
              <Typography variant={isMobile ? "subtitle1" : "h5"}
                fontWeight={700} color="#1a237e">
                {SCHOOL_NAME}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {SCHOOL_SUBTITLE}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Student Report Card — Academic Year 2025/2026
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {/* Student Info */}
            {isMobile ? (
              <Card sx={{ mb: 2, bgcolor: "#f5f5f5" }}>
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Grid container spacing={1}>
                    {[
                      ["Name",     student.name],
                      ["Adm No",   student.admissionNo],
                      ["Grade",    `Grade ${student.grade}-${student.section}`],
                      ["Religion", student.religion || "—"],
                    ].map(([label, value]) => (
                      <Grid item xs={6} key={label}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>{value}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            ) : (
              <Grid container spacing={2} mb={2}>
                {[
                  ["Full Name",    student.name],
                  ["Admission No", student.admissionNo],
                  ["Grade",        `Grade ${student.grade}`],
                  ["Section",      student.section],
                  ["Gender",       student.gender],
                  ["Date of Birth",student.dob || "—"],
                  ["Religion",     student.religion || "—"],
                  student.grade <= 9
                    ? ["Aesthetic", student.aesthetic || "—"]
                    : student.grade <= 11
                      ? ["Baskets", [student.basket1, student.basket2, student.basket3]
                          .filter(Boolean).join(", ") || "—"]
                      : null,
                ].filter(Boolean).map(([label, value]) => (
                  <Grid item xs={6} sm={4} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body1" fontWeight={600}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
            )}
            <Divider sx={{ mb: 2 }} />

            {/* Marks Section */}
            {term !== "All" ? (
              <>
                <Typography variant={isMobile ? "subtitle1" : "h6"}
                  fontWeight={600} mb={1}>
                  {term} Results
                </Typography>
                {isMobile ? (
                  <Box>
                    {filteredMarks.map(renderMobileRow)}
                    {filteredMarks.length === 0 && (
                      <Typography variant="body2" color="text.secondary"
                        align="center" py={2}>
                        No marks recorded for {term}.
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Paper sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#1a237e" }}>
                        <TableRow>
                          {["Subject", "Marks", "Grade", "Remarks"].map((h) => (
                            <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredMarks.map(renderMarksRow)}
                        {filteredMarks.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              No marks for {term}.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Paper>
                )}
                {filteredMarks.length > 0 && (
                  <Box mt={1} textAlign="right">
                    <Typography variant="body2" fontWeight={700}>
                      Average: {calcAverage(filteredMarks)} / 100
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              TERMS.map((t) => (
                <Box key={t} mb={3}>
                  <Typography variant="subtitle1" fontWeight={600}
                    color="#1a237e" mb={1}>
                    {t}
                  </Typography>
                  {isMobile ? (
                    <Box>
                      {grouped[t].map(renderMobileRow)}
                      {grouped[t].length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          No marks recorded.
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Paper sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: "#e8eaf6" }}>
                          <TableRow>
                            {["Subject", "Marks", "Grade", "Remarks"].map((h) => (
                              <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {grouped[t].map(renderMarksRow)}
                          {grouped[t].length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center"
                                sx={{ color: "text.secondary" }}>
                                No marks recorded.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  )}
                  {grouped[t].length > 0 && (
                    <Box mt={0.5} textAlign="right">
                      <Typography variant="body2" fontWeight={600}>
                        {t} Average: {calcAverage(grouped[t])} / 100
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))
            )}

            {/* Overall Summary */}
            {allMarks.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={700}>
                    Overall Average
                  </Typography>
                  <Chip
                    label={`${calcAverage(allMarks)} / 100`}
                    color={
                      Number(calcAverage(allMarks)) >= 65 ? "success" :
                      Number(calcAverage(allMarks)) >= 40 ? "warning" : "error"
                    }
                    sx={{ fontSize: { xs: 13, sm: 16 }, fontWeight: 700, px: 1 }}
                  />
                </Box>
              </>
            )}
          </Paper>

          {/* Print Button — Mobile */}
          {isMobile && (
            <Button variant="contained" startIcon={<PrintIcon />} fullWidth
              onClick={handlePrint} sx={{ bgcolor: "#1a237e", mt: 2 }}>
              Print Report Card
            </Button>
          )}
        </>
      )}
    </Box>
  );
}