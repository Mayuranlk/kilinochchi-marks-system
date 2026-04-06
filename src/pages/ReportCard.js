import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { db } from "../firebase";
import { SCHOOL_NAME, SCHOOL_SUBTITLE } from "../constants";
import { useAuth } from "../context/AuthContext";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeText(value) {
  return value == null ? "" : String(value).trim();
}

function lower(value) {
  return safeText(value).toLowerCase();
}

function normalizeGrade(value) {
  const match = safeText(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeAcademicYear(value) {
  const match = safeText(value).match(/\d{4}/);
  return match ? String(match[0]) : "";
}

function normalizeSubjectName(value) {
  return safeText(value)
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/&/g, "and")
    .replace(/,/g, "")
    .trim()
    .toLowerCase();
}

function getMarkSubject(mark) {
  return safeText(mark?.subjectName || mark?.subject);
}

function getMarkSubjectId(mark) {
  return safeText(mark?.subjectId);
}

function getMarkTerm(mark) {
  return safeText(mark?.termName || mark?.term || mark?.termLabel);
}

function getMarkYear(mark) {
  return normalizeAcademicYear(mark?.academicYear || mark?.year);
}

function getMarkValue(mark) {
  const raw = mark?.marks ?? mark?.mark ?? mark?.score ?? null;
  if (raw === "" || raw == null) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function getMarkStatus(mark) {
  if (mark?.isMedicalAbsent) return "medical_absent";
  if (mark?.isAbsent || mark?.absent) return "absent";

  const status = lower(mark?.attendanceStatus || mark?.status);
  if (status === "medical_absent") return "medical_absent";
  if (status === "absent") return "absent";

  return "present";
}

function getEnrollmentSubjectName(row) {
  return safeText(row?.subjectName || row?.subject);
}

function getEnrollmentSubjectId(row) {
  return safeText(row?.subjectId);
}

function getEnrollmentAcademicYear(row) {
  return normalizeAcademicYear(row?.academicYear || row?.year);
}

function getEnrollmentStatus(row) {
  return lower(row?.status || "active");
}

function isEnrollmentActive(row) {
  return ["", "active", "promoted", "current"].includes(getEnrollmentStatus(row));
}

function getStudentDisplayClass(student) {
  const grade = normalizeGrade(student?.grade);
  const section = safeText(student?.section || student?.className);

  if (!grade && !section) return "—";
  if (grade && section) return `Grade ${grade}-${section}`;
  if (grade) return `Grade ${grade}`;
  return section;
}

function getStudentAesthetic(student) {
  return safeText(student?.aestheticChoice || student?.aesthetic);
}

function getStudentBaskets(student) {
  return [student?.basket1, student?.basket2, student?.basket3]
    .map((x) => safeText(x))
    .filter(Boolean)
    .join(", ");
}

function getGradeMeta(mark, studentGrade) {
  const grade = normalizeGrade(studentGrade);

  const lowerGrades = [
    { min: 75, label: "A", color: "#2e7d32", bg: "#e8f5e9", desc: "Excellent" },
    { min: 65, label: "B", color: "#1565c0", bg: "#e3f2fd", desc: "Good" },
    { min: 55, label: "C", color: "#e65100", bg: "#fff3e0", desc: "Average" },
    { min: 40, label: "D", color: "#555", bg: "#f5f5f5", desc: "Below Average" },
    { min: 0, label: "E", color: "#c62828", bg: "#ffebee", desc: "Fail" },
  ];

  const upperGrades = [
    { min: 75, label: "A", color: "#2e7d32", bg: "#e8f5e9", desc: "Distinction" },
    { min: 65, label: "B", color: "#1565c0", bg: "#e3f2fd", desc: "Very Good" },
    { min: 55, label: "C", color: "#e65100", bg: "#fff3e0", desc: "Credit Pass" },
    { min: 40, label: "S", color: "#555", bg: "#f5f5f5", desc: "Simple Pass" },
    { min: 0, label: "F", color: "#c62828", bg: "#ffebee", desc: "Failure" },
  ];

  const bands = grade >= 6 && grade <= 9 ? lowerGrades : upperGrades;

  for (const band of bands) {
    if (Number(mark) >= band.min) return band;
  }

  return bands[bands.length - 1];
}

function calcAverageNumber(marksList) {
  const numeric = marksList.map((m) => getMarkValue(m)).filter((v) => v !== null);
  if (!numeric.length) return null;
  return numeric.reduce((sum, v) => sum + v, 0) / numeric.length;
}

function calcAverageText(marksList) {
  const avg = calcAverageNumber(marksList);
  return avg === null ? null : avg.toFixed(1);
}

function sortMarksByExpectedOrder(marks, expectedOrder) {
  return [...marks].sort((a, b) => {
    const aKey = getMarkSubjectId(a) || normalizeSubjectName(getMarkSubject(a));
    const bKey = getMarkSubjectId(b) || normalizeSubjectName(getMarkSubject(b));

    const ai = expectedOrder.indexOf(aKey);
    const bi = expectedOrder.indexOf(bKey);

    if (ai === -1 && bi === -1) {
      return getMarkSubject(a).localeCompare(getMarkSubject(b));
    }
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ReportCard() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const printRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [student, setStudent] = useState(null);
  const [allMarks, setAllMarks] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [allTerms, setAllTerms] = useState([]);
  const [term, setTerm] = useState("All");
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setLoadError("");

      try {
        const [studentSnap, marksSnap, termsSnap, enrollmentsSnap] = await Promise.all([
          getDoc(doc(db, "students", studentId)),
          getDocs(collection(db, "marks")),
          getDocs(collection(db, "academicTerms")),
          getDocs(collection(db, "studentSubjectEnrollments")),
        ]);

        const loadedStudent = studentSnap.exists()
          ? { id: studentSnap.id, ...studentSnap.data() }
          : null;

        const loadedMarks = marksSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((mark) => safeText(mark.studentId) === safeText(studentId));

        const loadedTerms = termsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        const loadedEnrollments = enrollmentsSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((row) => safeText(row.studentId) === safeText(studentId));

        setStudent(loadedStudent);
        setAllMarks(loadedMarks);
        setAllTerms(loadedTerms);
        setAllEnrollments(loadedEnrollments);

        const activeTerm = loadedTerms.find((row) => row.isActive === true) || null;

        const bestYear =
          normalizeAcademicYear(activeTerm?.year) ||
          normalizeAcademicYear(loadedStudent?.academicYear || loadedStudent?.year) ||
          normalizeAcademicYear(loadedMarks[0]?.academicYear || loadedMarks[0]?.year) ||
          String(new Date().getFullYear());

        setSelectedYear(bestYear);
      } catch (error) {
        console.error("ReportCard fetch error:", error);
        setLoadError("Failed to load report card.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [studentId]);

  const availableYears = useMemo(() => {
    const years = [
      ...allTerms.map((row) => normalizeAcademicYear(row.year)),
      ...allMarks.map((row) => getMarkYear(row)),
      ...allEnrollments.map((row) => getEnrollmentAcademicYear(row)),
      normalizeAcademicYear(student?.academicYear || student?.year),
    ].filter(Boolean);

    return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
  }, [allTerms, allMarks, allEnrollments, student]);

  const marksForYear = useMemo(() => {
    if (!selectedYear) return allMarks;
    return allMarks.filter((mark) => !getMarkYear(mark) || getMarkYear(mark) === selectedYear);
  }, [allMarks, selectedYear]);

  const availableTerms = useMemo(() => {
    const termSet = new Set();

    allTerms
      .filter((row) => !selectedYear || normalizeAcademicYear(row.year) === selectedYear)
      .forEach((row) => {
        if (safeText(row.term)) termSet.add(safeText(row.term));
      });

    marksForYear.forEach((row) => {
      if (getMarkTerm(row)) termSet.add(getMarkTerm(row));
    });

    return Array.from(termSet);
  }, [allTerms, marksForYear, selectedYear]);

  const expectedSubjects = useMemo(() => {
    const rows = allEnrollments
      .filter(isEnrollmentActive)
      .filter(
        (row) =>
          !selectedYear ||
          !getEnrollmentAcademicYear(row) ||
          getEnrollmentAcademicYear(row) === selectedYear
      );

    const map = new Map();

    rows.forEach((row) => {
      const subjectId = getEnrollmentSubjectId(row);
      const subjectName = getEnrollmentSubjectName(row);
      const key = subjectId || normalizeSubjectName(subjectName);

      if (!key || !subjectName) return;

      if (!map.has(key)) {
        map.set(key, { subjectId, subjectName });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );
  }, [allEnrollments, selectedYear]);

  const expectedOrder = useMemo(() => {
    return expectedSubjects.map(
      (row) => row.subjectId || normalizeSubjectName(row.subjectName)
    );
  }, [expectedSubjects]);

  const sortedAllMarks = useMemo(() => {
    return sortMarksByExpectedOrder(marksForYear, expectedOrder);
  }, [marksForYear, expectedOrder]);

  const filteredMarks = useMemo(() => {
    return term === "All"
      ? sortedAllMarks
      : sortedAllMarks.filter((mark) => getMarkTerm(mark) === term);
  }, [sortedAllMarks, term]);

  const groupedByTerm = useMemo(() => {
    const result = {};

    availableTerms.forEach((t) => {
      result[t] = sortMarksByExpectedOrder(
        marksForYear.filter((mark) => getMarkTerm(mark) === t),
        expectedOrder
      );
    });

    return result;
  }, [availableTerms, marksForYear, expectedOrder]);

  const missingSubjects = useMemo(() => {
    const scopeMarks =
      term === "All"
        ? marksForYear
        : marksForYear.filter((mark) => getMarkTerm(mark) === term);

    const enteredSubjects = new Set(
      scopeMarks
        .map((mark) => getMarkSubjectId(mark) || normalizeSubjectName(getMarkSubject(mark)))
        .filter(Boolean)
    );

    return expectedSubjects
      .filter(
        (row) => !enteredSubjects.has(row.subjectId || normalizeSubjectName(row.subjectName))
      )
      .map((row) => row.subjectName);
  }, [expectedSubjects, marksForYear, term]);

  const overallAverage = useMemo(() => calcAverageText(marksForYear), [marksForYear]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const content = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Report Card - ${safeText(student?.name || student?.fullName)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
            th { background: #1a237e; color: white; }
            h2, h3 { margin: 4px 0; }
            .header { text-align: center; margin-bottom: 20px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  function renderDesktopRow(mark) {
    const status = getMarkStatus(mark);
    const value = getMarkValue(mark);
    const rowKey = `${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`;

    if (status === "absent" || status === "medical_absent") {
      const label = status === "absent" ? "AB" : "MA";
      const bg = status === "absent" ? "#ffebee" : "#f3e5f5";
      const color = status === "absent" ? "#c62828" : "#6a1b9a";
      const remarks =
        safeText(mark.absentReason || mark.remarks) ||
        (status === "absent" ? "Absent" : "Medical Absent");

      return (
        <TableRow key={rowKey} hover>
          <TableCell>{getMarkSubject(mark)}</TableCell>
          <TableCell>
            <strong>{status === "absent" ? "Absent" : "Medical Absent"}</strong>
          </TableCell>
          <TableCell>
            <span
              style={{
                color,
                fontWeight: 700,
                background: bg,
                padding: "2px 10px",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              {label}
            </span>
          </TableCell>
          <TableCell>{remarks}</TableCell>
        </TableRow>
      );
    }

    const gradeMeta = getGradeMeta(value, student?.grade);

    return (
      <TableRow key={rowKey} hover>
        <TableCell>{getMarkSubject(mark)}</TableCell>
        <TableCell>{value}</TableCell>
        <TableCell>
          <span
            style={{
              color: gradeMeta.color,
              fontWeight: 700,
              background: gradeMeta.bg,
              padding: "2px 10px",
              borderRadius: 12,
              fontSize: 13,
            }}
          >
            {gradeMeta.label}
          </span>
        </TableCell>
        <TableCell>{safeText(mark.remarks) || gradeMeta.desc}</TableCell>
      </TableRow>
    );
  }

  function renderMobileRow(mark) {
    const status = getMarkStatus(mark);
    const rowKey = `${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`;

    if (status === "absent" || status === "medical_absent") {
      const label = status === "absent" ? "AB" : "MA";

      return (
        <Box
          key={rowKey}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          py={1}
          sx={{ borderBottom: "1px solid #eee" }}
        >
          <Typography variant="body2">{getMarkSubject(mark)}</Typography>
          <Chip
            label={label}
            size="small"
            sx={{
              bgcolor: status === "absent" ? "#ffebee" : "#f3e5f5",
              color: status === "absent" ? "#c62828" : "#6a1b9a",
              fontWeight: 700,
            }}
          />
        </Box>
      );
    }

    const value = getMarkValue(mark);
    const gradeMeta = getGradeMeta(value, student?.grade);

    return (
      <Box
        key={rowKey}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        py={1}
        sx={{ borderBottom: "1px solid #eee" }}
      >
        <Typography variant="body2">{getMarkSubject(mark)}</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" fontWeight={700}>
            {value}/100
          </Typography>
          <Chip
            label={gradeMeta.label}
            size="small"
            sx={{ bgcolor: gradeMeta.bg, color: gradeMeta.color, fontWeight: 700 }}
          />
        </Box>
      </Box>
    );
  }

  const backPath = isAdmin ? "/students" : "/teacher";

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(backPath)}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      {!!loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {!student ? (
        <Typography>Student not found.</Typography>
      ) : (
        <>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
            flexWrap="wrap"
            gap={1}
          >
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
              Report Card
            </Typography>

            <Box display="flex" gap={1} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={selectedYear}
                  label="Year"
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {availableYears.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Term</InputLabel>
                <Select
                  value={term}
                  label="Term"
                  onChange={(e) => setTerm(e.target.value)}
                >
                  <MenuItem value="All">All Terms</MenuItem>
                  {availableTerms.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!isMobile && (
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  onClick={handlePrint}
                  sx={{ bgcolor: "#1a237e" }}
                >
                  Print
                </Button>
              )}
            </Box>
          </Box>

          {missingSubjects.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Marks not yet entered for{" "}
              {term === "All" ? `academic year ${selectedYear}` : `${term} ${selectedYear}`}:{" "}
              <strong>{missingSubjects.join(", ")}</strong>
            </Alert>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3 } }} ref={printRef}>
            <Box textAlign="center" mb={2}>
              <Typography variant={isMobile ? "subtitle1" : "h5"} fontWeight={700} color="#1a237e">
                {SCHOOL_NAME}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {SCHOOL_SUBTITLE}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Student Report Card
              </Typography>
              <Box display="flex" justifyContent="center" gap={1} mt={1} flexWrap="wrap">
                <Chip label={`Year ${selectedYear || "—"}`} size="small" color="primary" />
                <Chip label={term === "All" ? "All Terms" : term} size="small" />
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {isMobile ? (
              <Card sx={{ mb: 2, bgcolor: "#f5f5f5" }}>
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Grid container spacing={1}>
                    {[
                      ["Name", student.name || student.fullName || "—"],
                      ["Adm No", student.admissionNo || "—"],
                      ["Class", getStudentDisplayClass(student)],
                      ["Religion", student.religion || "—"],
                    ].map(([label, value]) => (
                      <Grid item xs={6} key={label}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {value}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            ) : (
              <Grid container spacing={2} mb={2}>
                {[
                  ["Full Name", student.name || student.fullName || "—"],
                  ["Admission No", student.admissionNo || "—"],
                  ["Class", getStudentDisplayClass(student)],
                  ["Gender", student.gender || "—"],
                  ["Date of Birth", student.dob || "—"],
                  ["Religion", student.religion || "—"],
                  normalizeGrade(student.grade) <= 9
                    ? ["Aesthetic", getStudentAesthetic(student) || "—"]
                    : ["Baskets", getStudentBaskets(student) || "—"],
                ].map(([label, value]) => (
                  <Grid item xs={6} sm={4} key={label}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {value}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            )}

            <Divider sx={{ mb: 2 }} />

            {term !== "All" ? (
              <>
                <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={600} mb={1}>
                  {term} Results
                </Typography>

                {isMobile ? (
                  <Box>
                    {filteredMarks.map(renderMobileRow)}
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
                            <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredMarks.map(renderDesktopRow)}
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

                {filteredMarks.length > 0 && calcAverageText(filteredMarks) !== null && (
                  <Box mt={1} textAlign="right">
                    <Typography variant="body2" fontWeight={700}>
                      Average: {calcAverageText(filteredMarks)} / 100
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              availableTerms.map((t) => (
                <Box key={t} mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} color="#1a237e" mb={1}>
                    {t}
                  </Typography>

                  {isMobile ? (
                    <Box>
                      {(groupedByTerm[t] || []).map(renderMobileRow)}
                      {(groupedByTerm[t] || []).length === 0 && (
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
                              <TableCell key={h} sx={{ fontWeight: 600 }}>
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(groupedByTerm[t] || []).map(renderDesktopRow)}
                          {(groupedByTerm[t] || []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center">
                                No marks recorded.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  )}

                  {(groupedByTerm[t] || []).length > 0 &&
                    calcAverageText(groupedByTerm[t]) !== null && (
                      <Box mt={0.5} textAlign="right">
                        <Typography variant="body2" fontWeight={600}>
                          {t} Average: {calcAverageText(groupedByTerm[t])} / 100
                        </Typography>
                      </Box>
                    )}
                </Box>
              ))
            )}

            {marksForYear.length > 0 && overallAverage !== null && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={700}>
                    Overall Average
                  </Typography>
                  <Chip label={`${overallAverage} / 100`} color="primary" />
                </Box>
              </>
            )}
          </Paper>

          {isMobile && (
            <Box mt={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ bgcolor: "#1a237e" }}
              >
                Print Report Card
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}