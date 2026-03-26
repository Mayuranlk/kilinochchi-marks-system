/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, updateDoc, doc, addDoc, writeBatch
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADES, SECTIONS } from "../constants";
import {
  Box, Typography, Button, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Dialog,
  DialogTitle, DialogContent, DialogActions, Chip, CircularProgress,
  Grid, Alert, Card, CardContent, Stepper, Step, StepLabel,
  FormControlLabel, Checkbox, useMediaQuery, useTheme
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

const STREAMS = ["Maths", "Bio", "Technology", "Arts", "Commerce"];

// Subject groups by grade range
const SUBJECT_GROUPS = {
  "6-9":  ["Tamil", "English", "Mathematics", "Science", "History",
            "Geography", "Civic Education", "Health & PE", "Art"],
  "10-11": ["Tamil", "English", "Mathematics", "Science", "History",
             "Geography", "Civic Education", "Health & PE",
             "Optional Subject 1", "Optional Subject 2"],
  "AL":   ["Common General Test", "Common IT", "Stream Subject 1",
            "Stream Subject 2", "Stream Subject 3"],
};

function getSubjectGroup(grade) {
  if (grade <= 9) return "6-9";
  if (grade <= 11) return "10-11";
  return "AL";
}

function getNextGrade(grade) {
  if (grade >= 13) return null; // graduated
  return grade + 1;
}

function getTransitionType(fromGrade) {
  if (fromGrade === 9)  return "critical"; // 9→10 subject change
  if (fromGrade === 11) return "al";       // 11→12 stream selection
  if (fromGrade === 13) return "graduate"; // 13→ completed
  return "normal";
}

export default function YearEndPromotion() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [fromYear, setFromYear] = useState(2026);
  const [toYear, setToYear] = useState(2027);
  const [grade, setGrade] = useState(6);
  const [section, setSection] = useState("A");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  // Per-student status
  const [studentStatus, setStudentStatus] = useState({});
  // For AL stream dialog
  const [streamDialog, setStreamDialog] = useState(false);
  const [streams, setStreams] = useState({});
  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  const transitionType = getTransitionType(grade);
  const nextGrade = getNextGrade(grade);

  const fetchStudents = async () => {
    if (!grade || !section) return;
    setLoading(true); setSuccess(""); setError("");
    const snap = await getDocs(collection(db, "students"));
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s =>
        s.grade === grade &&
        s.section === section &&
        (s.academicYear === fromYear || !s.academicYear)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(list);

    // Default all to promote
    const statusMap = {};
    list.forEach(s => { statusMap[s.id] = "promote"; });
    setStudentStatus(statusMap);

    // Default streams for AL
    const streamMap = {};
    list.forEach(s => { streamMap[s.id] = s.stream || ""; });
    setStreams(streamMap);

    setLoading(false);
    setStep(1);
  };

  const handleStatusChange = (studentId, status) => {
    setStudentStatus(prev => ({ ...prev, [studentId]: status }));
  };

  const handlePromoteAll = async () => {
    // For AL transition, check all streams selected
    if (transitionType === "al") {
      const promoting = Object.entries(studentStatus)
        .filter(([, s]) => s === "promote").map(([id]) => id);
      const missingStream = promoting.some(id => !streams[id]);
      if (missingStream) {
        return setError("Please select A/L stream for all students being promoted.");
      }
    }
    setConfirmOpen(true);
  };

  const executePromotion = async () => {
    setConfirmOpen(false);
    setPromoting(true); setError(""); setSuccess("");
    try {
      const batch = writeBatch(db);
      let promoted = 0, detained = 0, graduated = 0;

      for (const s of students) {
        const status = studentStatus[s.id];
        const studentRef = doc(db, "students", s.id);

        if (status === "promote" && transitionType !== "graduate") {
          const newGrade = nextGrade;
          const newGroup = getSubjectGroup(newGrade);
          const oldGroup = getSubjectGroup(grade);
          const subjectsChanged = newGroup !== oldGroup;

          const updateData = {
            grade: newGrade,
            academicYear: toYear,
            promotionStatus: "active",
            previousGrade: grade,
            previousYear: fromYear,
          };

          // Subject group change
          if (subjectsChanged) {
            updateData.subjectGroup = newGroup;
          }

          // AL stream
          if (transitionType === "al") {
            updateData.stream = streams[s.id];
            updateData.subjectGroup = "AL";
          }

          batch.update(studentRef, updateData);

          // Log promotion history
          await addDoc(collection(db, "promotionHistory"), {
            studentId: s.id,
            studentName: s.name,
            fromGrade: grade,
            toGrade: newGrade,
            fromYear,
            toYear,
            stream: streams[s.id] || null,
            subjectsChanged,
            promotedAt: new Date().toISOString(),
          });
          promoted++;

        } else if (status === "detain") {
          batch.update(studentRef, {
            academicYear: toYear,
            promotionStatus: "detained",
            previousGrade: grade,
            previousYear: fromYear,
          });
          await addDoc(collection(db, "promotionHistory"), {
            studentId: s.id,
            studentName: s.name,
            fromGrade: grade,
            toGrade: grade, // stays same
            fromYear,
            toYear,
            promotedAt: new Date().toISOString(),
            detained: true,
          });
          detained++;

        } else if (status === "promote" && transitionType === "graduate") {
          batch.update(studentRef, {
            grade: 13,
            academicYear: toYear,
            promotionStatus: "completed",
          });
          await addDoc(collection(db, "promotionHistory"), {
            studentId: s.id,
            studentName: s.name,
            fromGrade: 13,
            toGrade: null,
            fromYear,
            toYear,
            graduated: true,
            promotedAt: new Date().toISOString(),
          });
          graduated++;
        }
      }

      await batch.commit();
      setSuccess(
        `✅ Promotion complete! ` +
        `${promoted} promoted${detained ? `, ${detained} detained` : ""}` +
        `${graduated ? `, ${graduated} graduated` : ""}.`
      );
      setStep(2);
      setStudents([]);
    } catch (err) {
      setError("Promotion failed: " + err.message);
    }
    setPromoting(false);
  };

  const promotingCount = Object.values(studentStatus).filter(s => s === "promote").length;
  const detainedCount = Object.values(studentStatus).filter(s => s === "detain").length;

  return (
    <Box>
      <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e" gutterBottom>
        Year End Promotion
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Promote students to next grade at the end of academic year.
      </Typography>

      {/* Stepper */}
      <Stepper activeStep={step} sx={{ mb: 3 }}
        orientation={isMobile ? "vertical" : "horizontal"}>
        {["Select Class", "Review Students", "Done"].map(label => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          {success}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Step 0 — Select Class */}
      {step === 0 && (
        <Card sx={{ maxWidth: 500 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              Select Class to Promote
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>From Year</InputLabel>
                  <Select value={fromYear} label="From Year"
                    onChange={(e) => { setFromYear(e.target.value); setToYear(e.target.value + 1); }}>
                    {[2024, 2025, 2026].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>To Year</InputLabel>
                  <Select value={toYear} label="To Year" disabled>
                    <MenuItem value={toYear}>{toYear}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Grade</InputLabel>
                  <Select value={grade} label="Grade"
                    onChange={(e) => setGrade(e.target.value)}>
                    {GRADES.map(g => (
                      <MenuItem key={g} value={g}>Grade {g}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Section</InputLabel>
                  <Select value={section} label="Section"
                    onChange={(e) => setSection(e.target.value)}>
                    {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Transition info */}
              <Grid item xs={12}>
                {transitionType === "normal" && (
                  <Alert severity="info" icon={<ArrowForwardIcon />}>
                    Grade {grade} → Grade {nextGrade} | No subject changes
                  </Alert>
                )}
                {transitionType === "critical" && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    Grade 9 → Grade 10 | ⚠️ Subject group changes to O/L subjects!
                  </Alert>
                )}
                {transitionType === "al" && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    Grade 11 → Grade 12 | ⚠️ Students must select A/L Stream!
                  </Alert>
                )}
                {transitionType === "graduate" && (
                  <Alert severity="success" icon={<EmojiEventsIcon />}>
                    Grade 13 → 🎓 Students will be marked as Graduated!
                  </Alert>
                )}
              </Grid>
            </Grid>
          </CardContent>
          <Box px={2} pb={2}>
            <Button variant="contained" fullWidth onClick={fetchStudents}
              disabled={loading} sx={{ bgcolor: "#1a237e" }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : "Load Students →"}
            </Button>
          </Box>
        </Card>
      )}

      {/* Step 1 — Review Students */}
      {step === 1 && students.length > 0 && (
        <Box>
          {/* Summary bar */}
          <Card sx={{ mb: 2, bgcolor: "#e8eaf6" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                <Typography variant="body2" fontWeight={600}>
                  Grade {grade}-{section} → Grade {transitionType === "graduate" ? "🎓" : nextGrade}-{section}
                </Typography>
                <Chip label={`${promotingCount} Promoting`} color="success" size="small" />
                {detainedCount > 0 && <Chip label={`${detainedCount} Detained`} color="error" size="small" />}
                {transitionType === "critical" && (
                  <Chip label="⚠️ Subject Change" color="warning" size="small" />
                )}
                {transitionType === "al" && (
                  <Chip label="⚠️ Stream Required" color="warning" size="small" />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* AL Stream selector */}
          {transitionType === "al" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ⚠️ Select A/L Stream for each student below before promoting.
            </Alert>
          )}

          {/* Subject change notice */}
          {transitionType === "critical" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ⚠️ These students will move from <strong>Grade 9 (Junior)</strong> subjects
              to <strong>Grade 10 (O/L)</strong> subjects automatically.
            </Alert>
          )}

          {isMobile ? (
            /* Mobile card view */
            <Box>
              {students.map((s) => (
                <Card key={s.id} sx={{ mb: 1.5, boxShadow: 2,
                  border: studentStatus[s.id] === "detain" ? "2px solid #c62828" : "1px solid #e0e0e0" }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adm: {s.admissionNo}
                        </Typography>
                      </Box>
                      <FormControl size="small" sx={{ minWidth: 110 }}>
                        <Select value={studentStatus[s.id] || "promote"}
                          onChange={(e) => handleStatusChange(s.id, e.target.value)}>
                          <MenuItem value="promote">
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <CheckCircleIcon sx={{ fontSize: 14, color: "green" }} /> Promote
                            </Box>
                          </MenuItem>
                          <MenuItem value="detain">
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <WarningIcon sx={{ fontSize: 14, color: "red" }} /> Detain
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    {/* AL Stream picker */}
                    {transitionType === "al" && studentStatus[s.id] === "promote" && (
                      <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>A/L Stream *</InputLabel>
                        <Select value={streams[s.id] || ""} label="A/L Stream *"
                          onChange={(e) => setStreams(prev => ({ ...prev, [s.id]: e.target.value }))}>
                          {STREAMS.map(st => <MenuItem key={st} value={st}>{st}</MenuItem>)}
                        </Select>
                      </FormControl>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            /* Desktop table view */
            <Paper sx={{ overflowX: "auto", mb: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["#", "Admission No", "Name",
                      transitionType === "al" ? "A/L Stream" : "Current Grade",
                      "Status"].map(h => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((s, idx) => (
                    <TableRow key={s.id} hover
                      sx={{ bgcolor: studentStatus[s.id] === "detain" ? "#ffebee" : "inherit" }}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{s.admissionNo}</TableCell>
                      <TableCell fontWeight={600}>{s.name}</TableCell>
                      <TableCell>
                        {transitionType === "al" && studentStatus[s.id] === "promote" ? (
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Stream *</InputLabel>
                            <Select value={streams[s.id] || ""} label="Stream *"
                              onChange={(e) => setStreams(prev => ({ ...prev, [s.id]: e.target.value }))}>
                              {STREAMS.map(st => <MenuItem key={st} value={st}>{st}</MenuItem>)}
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip label={`Grade ${s.grade}`} size="small" color="primary" />
                        )}
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select value={studentStatus[s.id] || "promote"}
                            onChange={(e) => handleStatusChange(s.id, e.target.value)}>
                            <MenuItem value="promote">✅ Promote</MenuItem>
                            <MenuItem value="detain">⚠️ Detain</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Grid container spacing={2} mt={1}>
            <Grid item xs={6}>
              <Button fullWidth variant="outlined"
                onClick={() => { setStep(0); setStudents([]); }}>
                ← Back
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth variant="contained" onClick={handlePromoteAll}
                disabled={promoting} sx={{ bgcolor: "#1a237e" }}>
                {promoting
                  ? <CircularProgress size={22} color="inherit" />
                  : `Promote ${promotingCount} Students →`}
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Step 1 — No students found */}
      {step === 1 && students.length === 0 && !loading && (
        <Box textAlign="center" py={4}>
          <SchoolIcon sx={{ fontSize: 48, color: "text.secondary" }} />
          <Typography color="text.secondary" mt={1}>
            No students found for Grade {grade}-{section} in {fromYear}.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setStep(0)}>
            ← Go Back
          </Button>
        </Box>
      )}

      {/* Step 2 — Done */}
      {step === 2 && (
        <Box textAlign="center" py={4}>
          <EmojiEventsIcon sx={{ fontSize: 64, color: "#ffd54f" }} />
          <Typography variant="h6" fontWeight={700} mt={1} color="#1a237e">
            Promotion Complete! 🎉
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Students have been moved to {toYear}.
          </Typography>
          <Button variant="contained" sx={{ bgcolor: "#1a237e", mt: 3 }}
            onClick={() => { setStep(0); setSuccess(""); }}>
            Promote Another Class
          </Button>
        </Box>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        fullScreen={isMobile} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Promotion</DialogTitle>
        <DialogContent>
          <Typography variant="body1" mb={1}>
            Are you sure you want to promote students?
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Chip icon={<ArrowForwardIcon />}
              label={`Grade ${grade}-${section} (${fromYear}) → Grade ${nextGrade || "🎓"}-${section} (${toYear})`}
              color="primary" />
            <Chip icon={<CheckCircleIcon />}
              label={`${promotingCount} students will be promoted`} color="success" />
            {detainedCount > 0 && (
              <Chip icon={<WarningIcon />}
                label={`${detainedCount} students will be detained`} color="error" />
            )}
            {transitionType === "critical" && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Subject group will change to O/L subjects for Grade 10.
              </Alert>
            )}
            {transitionType === "al" && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Students will be assigned their selected A/L streams.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={executePromotion} variant="contained"
            fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
            Yes, Promote Now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}