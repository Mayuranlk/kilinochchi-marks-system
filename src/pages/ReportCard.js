import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
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
import { SCHOOL_NAME } from "../constants";
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

function getStudentGradeDivision(student) {
  const grade = normalizeGrade(student?.grade);
  const division = safeText(student?.section || student?.className);

  if (!grade && !division) return "-";
  if (grade && division) return `Grade ${grade} - Division ${division}`;
  if (grade) return `Grade ${grade}`;
  return `Division ${division}`;
}

function getStudentDisplayName(student) {
  return safeText(student?.name || student?.fullName) || "-";
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
  const selectedTermLabel = term === "All" ? "All Terms" : term;
  const studentDisplayName = getStudentDisplayName(student);
  const studentGradeDivision = getStudentGradeDivision(student);
  const reportMetaItems = [
    ["Year", selectedYear || "-"],
    ["Term", selectedTermLabel || "-"],
    ["Student Name", studentDisplayName],
    ["Admission Number", student?.admissionNo || "-"],
    ["Grade / Division", studentGradeDivision],
  ];

  const pillSx = {
    display: "inline-flex",
    alignItems: "center",
    px: 1.75,
    py: 0.85,
    borderRadius: 999,
    border: "1px solid #c9d7f4",
    bgcolor: "#eef4ff",
    color: "#163976",
    fontWeight: 800,
    fontSize: 13,
  };
  const sectionCardSx = {
    border: "1px solid #e1e8f4",
    borderRadius: 4,
    px: { xs: 1.5, sm: 2.25 },
    py: { xs: 1.5, sm: 2.25 },
    bgcolor: "#ffffff",
    boxShadow: "0 14px 34px rgba(15, 53, 123, 0.06)",
  };
  const tablePaperSx = {
    overflowX: "auto",
    borderRadius: 3,
    border: "1px solid #dbe4f3",
    boxShadow: "none",
    bgcolor: "#ffffff",
  };
  const mobileResultsSx = {
    px: { xs: 1.5, sm: 2 },
    py: 0.25,
    borderRadius: 3,
    border: "1px solid #dbe4f3",
    bgcolor: "#ffffff",
  };
  const supportingTextSx = {
    mt: 0.75,
    color: "#6a7b97",
  };

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
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              padding: 24px;
              color: #172033;
              background: #ffffff;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #d6deeb;
              padding: 10px 12px;
              text-align: left;
            }
            th {
              background: #163976;
              color: white;
            }
            .report-card-shell {
              border: 1px solid #dbe4f3;
              border-radius: 24px;
              overflow: hidden;
            }
            .report-card-hero {
              background: linear-gradient(135deg, #102b66 0%, #1f4b99 52%, #4f83d8 100%);
              color: white;
              padding: 28px;
            }
            .report-card-kicker {
              margin: 0 0 8px;
              font-size: 11px;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              opacity: 0.8;
            }
            .report-card-school-name {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .report-card-title {
              margin: 8px 0 0;
              font-size: 16px;
              opacity: 0.95;
            }
            .report-card-meta-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 12px;
              margin-top: 24px;
            }
            .report-card-meta-item {
              background: rgba(255, 255, 255, 0.95);
              border: 1px solid rgba(213, 225, 245, 0.95);
              border-radius: 16px;
              padding: 14px 16px;
              color: #172033;
            }
            .report-card-meta-label {
              margin: 0 0 6px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #6a7b97;
            }
            .report-card-meta-value {
              margin: 0;
              font-size: 16px;
              font-weight: 700;
            }
            .report-card-body {
              padding: 24px;
            }
            .report-card-main-block,
            .report-card-term-block {
              border: 1px solid #e1e8f4;
              border-radius: 18px;
              padding: 18px;
              margin-bottom: 18px;
              background: #ffffff;
            }
            .report-card-section-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
            }
            .report-card-section-title {
              margin: 0;
              font-size: 20px;
              color: #163976;
            }
            .report-card-pill {
              display: inline-block;
              padding: 8px 14px;
              border-radius: 999px;
              border: 1px solid #c9d7f4;
              background: #eef4ff;
              color: #163976;
              font-size: 13px;
              font-weight: 700;
            }
            .report-card-summary {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              margin-top: 24px;
              padding: 18px 20px;
              border-radius: 18px;
              background: linear-gradient(135deg, #f4f8ff 0%, #ffffff 100%);
              border: 1px solid #dbe4f3;
            }
            .report-card-summary-title {
              margin: 0;
              font-size: 20px;
              font-weight: 700;
              color: #163976;
            }
            @media (max-width: 900px) {
              body { padding: 16px; }
              .report-card-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media print {
              body { padding: 0; }
            }
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
          py={1.2}
          sx={{ borderBottom: "1px solid #e4eaf4" }}
        >
          <Typography variant="body2" fontWeight={600}>
            {getMarkSubject(mark)}
          </Typography>
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
        py={1.2}
        sx={{ borderBottom: "1px solid #e4eaf4" }}
      >
        <Typography variant="body2" fontWeight={600}>
          {getMarkSubject(mark)}
        </Typography>
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

          <Paper
            ref={printRef}
            className="report-card-shell"
            elevation={0}
            sx={{
              overflow: "hidden",
              borderRadius: { xs: 4, sm: 6 },
              border: "1px solid #dbe4f3",
              boxShadow: "0 24px 60px rgba(15, 53, 123, 0.10)",
              background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 24%)",
            }}
          >
            <Box
              className="report-card-hero"
              sx={{
                position: "relative",
                overflow: "hidden",
                mx: { xs: -2, sm: -3 },
                mt: { xs: -2, sm: -3 },
                px: { xs: 2, sm: 3.5 },
                py: { xs: 2.5, sm: 3.5 },
                color: "white",
                textAlign: "left",
                background: "linear-gradient(135deg, #102b66 0%, #1f4b99 52%, #4f83d8 100%)",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  top: -120,
                  right: -70,
                  background: "rgba(255,255,255,0.10)",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  bottom: -110,
                  right: 60,
                  background: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <Typography className="report-card-kicker" sx={{ mb: 1, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.8 }}>
                Academic Record
              </Typography>
              <Typography className="report-card-school-name" variant={isMobile ? "h6" : "h4"} fontWeight={800}>
                {SCHOOL_NAME}
              </Typography>
              <Typography className="report-card-title" variant="body1" sx={{ mt: 1, opacity: 0.92 }}>
                Student Report Card
              </Typography>
              <Box
                className="report-card-meta-grid"
                sx={{
                  display: "grid",
                  gap: 1.5,
                  mt: 3,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(5, minmax(0, 1fr))",
                  },
                }}
              >
                {reportMetaItems.map(([label, value]) => (
                  <Box
                    key={label}
                    className="report-card-meta-item"
                    sx={{
                      borderRadius: 3,
                      px: 2,
                      py: 1.75,
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(213, 225, 245, 0.95)",
                      color: "#172033",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <Typography
                      className="report-card-meta-label"
                      sx={{
                        mb: 0.75,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#6a7b97",
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      className="report-card-meta-value"
                      sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 800 }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              className="report-card-body"
              sx={{
                px: { xs: 2, sm: 3 },
                pb: { xs: 2.5, sm: 3.5 },
              }}
            >

              {term !== "All" ? (
                <Box className="report-card-main-block" sx={sectionCardSx}>
                  <Box
                    className="report-card-section-header"
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: { xs: "flex-start", sm: "center" },
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1.25,
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        className="report-card-section-title"
                        variant={isMobile ? "subtitle1" : "h6"}
                        fontWeight={800}
                        color="#163976"
                      >
                        {selectedTermLabel} Results
                      </Typography>
                      <Typography variant="body2" sx={supportingTextSx}>
                        Year {selectedYear || "-"} performance summary for {studentDisplayName}.
                      </Typography>
                    </Box>
                    <Box component="span" className="report-card-pill" sx={pillSx}>
                      {selectedYear || "-"} | {selectedTermLabel}
                    </Box>
              </Box>

                  {isMobile ? (
                    <Box sx={mobileResultsSx}>
                      {filteredMarks.map(renderMobileRow)}
                      {filteredMarks.length === 0 && (
                        <Typography variant="body2" color="text.secondary" align="center" py={2}>
                          No marks recorded for {term}.
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Paper elevation={0} sx={tablePaperSx}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: "#163976" }}>
                          <TableRow>
                            {["Subject", "Marks", "Grade", "Remarks"].map((heading) => (
                              <TableCell key={heading} sx={{ color: "white", fontWeight: 700 }}>
                                {heading}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredMarks.map(renderDesktopRow)}
                          {filteredMarks.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center">
                                No marks recorded for {term}.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  )}

                  {filteredMarks.length > 0 && calcAverageText(filteredMarks) !== null && (
                    <Box mt={2} display="flex" justifyContent="flex-end">
                      <Box component="span" className="report-card-pill" sx={pillSx}>
                        Term Average {calcAverageText(filteredMarks)} / 100
                      </Box>
                    </Box>
                  )}
                </Box>
            ) : (
              <Box sx={{ display: "grid", gap: 2 }}>
                {availableTerms.length > 0 ? (
                  availableTerms.map((t) => {
                    const termMarks = groupedByTerm[t] || [];
                    const termAverage = calcAverageText(termMarks);

                    return (
                      <Box key={t} className="report-card-term-block" sx={sectionCardSx}>
                        <Box
                          className="report-card-section-header"
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: { xs: "flex-start", sm: "center" },
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 1.25,
                            mb: 2,
                          }}
                        >
                          <Box>
                            <Typography
                              className="report-card-section-title"
                              variant={isMobile ? "subtitle1" : "h6"}
                              fontWeight={800}
                              color="#163976"
                            >
                              {t}
                            </Typography>
                            <Typography variant="body2" sx={supportingTextSx}>
                              Consolidated subject performance for {t}.
                            </Typography>
                          </Box>
                          {termAverage !== null && (
                            <Box component="span" className="report-card-pill" sx={pillSx}>
                              Avg {termAverage} / 100
                            </Box>
                          )}
                        </Box>

                        {isMobile ? (
                          <Box sx={mobileResultsSx}>
                            {termMarks.map(renderMobileRow)}
                            {termMarks.length === 0 && (
                              <Typography variant="body2" color="text.secondary" align="center" py={2}>
                                No marks recorded for {t}.
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Paper elevation={0} sx={tablePaperSx}>
                            <Table size="small">
                              <TableHead sx={{ bgcolor: "#edf3ff" }}>
                                <TableRow>
                                  {["Subject", "Marks", "Grade", "Remarks"].map((heading) => (
                                    <TableCell key={heading} sx={{ fontWeight: 700, color: "#163976" }}>
                                      {heading}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {termMarks.map(renderDesktopRow)}
                                {termMarks.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={4} align="center">
                                      No marks recorded for {t}.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </Paper>
                        )}
                      </Box>
                    );
                  })
                ) : (
                  <Box
                    className="report-card-main-block"
                    sx={{
                      ...sectionCardSx,
                      textAlign: "center",
                      color: "#6a7b97",
                    }}
                  >
                    No marks recorded for {selectedYear || "the selected year"}.
                  </Box>
                )}
              </Box>
            )}

            {marksForYear.length > 0 && overallAverage !== null && (
              <Box
                className="report-card-summary"
                sx={{
                  mt: 2.5,
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { xs: "flex-start", sm: "center" },
                }}
              >
                <Box>
                  <Typography
                    className="report-card-summary-title"
                    variant={isMobile ? "subtitle1" : "h6"}
                  >
                    Year Average
                  </Typography>
                  <Typography variant="body2" sx={supportingTextSx}>
                    Across all recorded subjects in {selectedYear || "the selected year"}.
                  </Typography>
                </Box>
                <Box
                  component="span"
                  className="report-card-pill"
                  sx={{ ...pillSx, px: 2.25, py: 1 }}
                >
                  {overallAverage} / 100
                </Box>
              </Box>
            )}
            </Box>
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
