import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { TERMS } from "../constants";
import { useAuth } from "../context/AuthContext";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, CircularProgress, Button, Chip, Divider, Grid,
  FormControl, InputLabel, Select, MenuItem, Card, CardContent,
  useMediaQuery, useTheme
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const GRADE_LABELS = [
  { min: 75, label: "A", color: "#2e7d32", bg: "#e8f5e9" },
  { min: 65, label: "B", color: "#1565c0", bg: "#e3f2fd" },
  { min: 55, label: "C", color: "#e65100", bg: "#fff3e0" },
  { min: 35, label: "S", color: "#555", bg: "#f5f5f5" },
  { min: 0,  label: "F", color: "#c62828", bg: "#ffebee" },
];

function getGrade(mark) {
  for (const g of GRADE_LABELS) {
    if (mark >= g.min) return g;
  }
  return { label: "F", color: "#c62828", bg: "#ffebee" };
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
        @media print { button { display: none; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const filteredMarks = term === "All" ? allMarks : allMarks.filter((m) => m.term === term);

  const grouped = TERMS.reduce((acc, t) => {
    acc[t] = allMarks.filter((m) => m.term === t);
    return acc;
  }, {});

  const calcAverage = (marksList) => {
    if (!marksList.length) return null;
    return (marksList.reduce((s, m) => s + m.mark, 0) / marksList.length).toFixed(1);
  };

  const backPath = isAdmin ? "/students" : "/teacher";

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>
        Back
      </Button>

      {loading ? (
        <CircularProgress />
      ) : !student ? (
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

          {/* Printable Area */}
          <Paper sx={{ p: { xs: 2, sm: 3 } }} ref={printRef}>
            {/* School Header */}
            <Box textAlign="center" mb={2}>
              <Typography variant={isMobile ? "subtitle1" : "h5"} fontWeight={700} color="#1a237e">
                Kilinochchi Marks Management System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Student Report Card — Academic Year 2025/2026
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {/* Student Info — Mobile Card Style */}
            {isMobile ? (
              <Card sx={{ mb: 2, bgcolor: "#f5f5f5" }}>
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Grid container spacing={1}>
                    {[
                      ["Name", student.name],
                      ["Adm No", student.admissionNo],
                      ["Grade", `Grade ${student.grade}-${student.section}`],
                      ["Gender", student.gender],
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
                  ["Full Name", student.name],
                  ["Admission No", student.admissionNo],
                  ["Grade", `Grade ${student.grade}`],
                  ["Section", student.section],
                  ["Gender", student.gender],
                  ["Date of Birth", student.dob || "—"],
                ].map(([label, value]) => (
                  <Grid item xs={6} sm={4} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body1" fontWeight={600}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
            )}
            <Divider sx={{ mb: 2 }} />

            {/* Marks */}
            {term !== "All" ? (
              <>
                <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={600} mb={1}>
                  {term} Results
                </Typography>
                {isMobile ? (
                  /* Mobile marks cards */
                  <Box>
                    {filteredMarks.map((m) => {
                      const g = getGrade(m.mark);
                      return (
                        <Box key={m.subject} display="flex" justifyContent="space-between"
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
                    })}
                    {filteredMarks.length === 0 && (
                      <Typography variant="body2" color="text.secondary" align="center" py={2}>
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
                            <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredMarks.map((m) => {
                          const g = getGrade(m.mark);
                          return (
                            <TableRow key={m.subject} hover>
                              <TableCell>{m.subject}</TableCell>
                              <TableCell><strong>{m.mark}</strong> / 100</TableCell>
                              <TableCell>
                                <span style={{ color: g.color, fontWeight: 700 }}>{g.label}</span>
                              </TableCell>
                              <TableCell>
                                {m.mark >= 75 ? "Excellent" : m.mark >= 65 ? "Good" :
                                  m.mark >= 55 ? "Average" : m.mark >= 35 ? "Pass" : "Fail"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredMarks.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">No marks for {term}.</TableCell>
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
              /* All Terms View */
              TERMS.map((t) => (
                <Box key={t} mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} color="#1a237e" mb={1}>
                    {t}
                  </Typography>
                  {isMobile ? (
                    <Box>
                      {grouped[t].map((m) => {
                        const g = getGrade(m.mark);
                        return (
                          <Box key={m.subject} display="flex" justifyContent="space-between"
                            alignItems="center" py={0.8}
                            sx={{ borderBottom: "1px solid #eee" }}>
                            <Typography variant="body2">{m.subject}</Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight={700}>{m.mark}/100</Typography>
                              <Chip label={g.label} size="small"
                                sx={{ bgcolor: g.bg, color: g.color, fontWeight: 700, minWidth: 32 }} />
                            </Box>
                          </Box>
                        );
                      })}
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
                          {grouped[t].map((m) => {
                            const g = getGrade(m.mark);
                            return (
                              <TableRow key={m.subject} hover>
                                <TableCell>{m.subject}</TableCell>
                                <TableCell><strong>{m.mark}</strong> / 100</TableCell>
                                <TableCell>
                                  <span style={{ color: g.color, fontWeight: 700 }}>{g.label}</span>
                                </TableCell>
                                <TableCell>
                                  {m.mark >= 75 ? "Excellent" : m.mark >= 65 ? "Good" :
                                    m.mark >= 55 ? "Average" : m.mark >= 35 ? "Pass" : "Fail"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {grouped[t].length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
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
                    color={Number(calcAverage(allMarks)) >= 65 ? "success" :
                      Number(calcAverage(allMarks)) >= 35 ? "warning" : "error"}
                    sx={{ fontSize: { xs: 13, sm: 16 }, fontWeight: 700, px: 1 }}
                  />
                </Box>
              </>
            )}
          </Paper>

          {/* Print Button — Mobile Bottom */}
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