import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { SCHOOL_NAME, SCHOOL_SUBTITLE, getStudentSubjects } from "../constants";
import { useAuth } from "../context/AuthContext";
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const safeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const lower = (value) => safeString(value).toLowerCase();

const normalizeGrade = (value) => {
  const raw = safeString(value);
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const normalizeAcademicYear = (value) => {
  const raw = safeString(value);
  const match = raw.match(/\d{4}/);
  return match ? String(match[0]) : "";
};

const normalizeSubjectName = (value) =>
  safeString(value).replace(/\s+/g, "").toLowerCase();

const getMarkSubject = (mark) =>
  safeString(mark.subjectName || mark.subject);

const getMarkTerm = (mark) =>
  safeString(mark.term || mark.termName || mark.termLabel);

const getMarkYear = (mark) =>
  normalizeAcademicYear(mark.academicYear || mark.year);

const getMarkValue = (mark) => {
  const raw = mark.mark ?? mark.marks ?? mark.score ?? "";
  if (raw === "" || raw === null || raw === undefined) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const getMarkStatus = (mark) => {
  if (mark?.isMedicalAbsent) return "medical_absent";
  if (mark?.isAbsent) return "absent";

  const status = lower(mark?.attendanceStatus || mark?.status);
  if (status === "medical_absent") return "medical_absent";
  if (status === "absent") return "absent";

  return "present";
};

const getStudentDisplayClass = (student) => {
  const grade = normalizeGrade(student?.grade);
  const section = safeString(student?.section || student?.className);
  if (!grade && !section) return "—";
  if (grade && section) return `Grade ${grade}-${section}`;
  if (grade) return `Grade ${grade}`;
  return section;
};

const getStudentAesthetic = (student) =>
  safeString(student?.aestheticChoice || student?.aesthetic);

const getStudentBaskets = (student) =>
  [student?.basket1, student?.basket2, student?.basket3]
    .map((x) => safeString(x))
    .filter(Boolean)
    .join(", ");

const getAvailableTermsFromMarks = (marks) => {
  const terms = Array.from(
    new Set(marks.map((m) => getMarkTerm(m)).filter(Boolean))
  );
  return terms;
};

const subjectSortForStudent = (student, marksList) => {
  if (!student) return marksList;

  const expectedSubjects = (getStudentSubjects(student) || []).map((s) =>
    normalizeSubjectName(s)
  );

  return [...marksList].sort((a, b) => {
    const aName = normalizeSubjectName(getMarkSubject(a));
    const bName = normalizeSubjectName(getMarkSubject(b));

    const ai = expectedSubjects.indexOf(aName);
    const bi = expectedSubjects.indexOf(bName);

    if (ai === -1 && bi === -1) {
      return getMarkSubject(a).localeCompare(getMarkSubject(b));
    }
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
};

const getGradeMeta = (mark, studentGrade) => {
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

  const labels = grade >= 6 && grade <= 9 ? lowerGrades : upperGrades;

  for (const row of labels) {
    if (Number(mark) >= row.min) return row;
  }

  return labels[labels.length - 1];
};

const calcAverage = (marksList) => {
  const numeric = marksList
    .map((m) => getMarkValue(m))
    .filter((v) => v !== null);

  if (!numeric.length) return null;

  const avg = numeric.reduce((sum, v) => sum + v, 0) / numeric.length;
  return avg.toFixed(1);
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function ReportCard() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const printRef = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [student, setStudent] = useState(null);
  const [allMarks, setAllMarks] = useState([]);
  const [availableTerms, setAvailableTerms] = useState([]);
  const [term, setTerm] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const [studentSnap, marksSnap, termsSnap] = await Promise.all([
          getDoc(doc(db, "students", studentId)),
          getDocs(collection(db, "marks")),
          getDocs(collection(db, "academicTerms")),
        ]);

        if (studentSnap.exists()) {
          setStudent({ id: studentSnap.id, ...studentSnap.data() });
        } else {
          setStudent(null);
        }

        const studentMarks = marksSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((mark) => safeString(mark.studentId) === safeString(studentId));

        setAllMarks(studentMarks);

        const activeTermsFromDb = termsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((row) => safeString(row.term))
          .map((row) => safeString(row.term));

        const uniqueTerms = Array.from(
          new Set([...activeTermsFromDb, ...getAvailableTermsFromMarks(studentMarks)])
        ).filter(Boolean);

        setAvailableTerms(uniqueTerms);
      } catch (error) {
        console.error("ReportCard fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [studentId]);

  const backPath = isAdmin ? "/students" : "/teacher";

  const sortedAllMarks = useMemo(() => {
    return subjectSortForStudent(student, allMarks);
  }, [student, allMarks]);

  const filteredMarks = useMemo(() => {
    const rows =
      term === "All"
        ? sortedAllMarks
        : sortedAllMarks.filter((mark) => getMarkTerm(mark) === term);

    return rows;
  }, [sortedAllMarks, term]);

  const groupedByTerm = useMemo(() => {
    const result = {};
    availableTerms.forEach((t) => {
      result[t] = subjectSortForStudent(
        student,
        allMarks.filter((mark) => getMarkTerm(mark) === t)
      );
    });
    return result;
  }, [availableTerms, allMarks, student]);

  const expectedSubjects = useMemo(() => {
    return student ? getStudentSubjects(student) || [] : [];
  }, [student]);

  const missingSubjects = useMemo(() => {
    if (!expectedSubjects.length) return [];

    const enteredSubjects = new Set(
      allMarks.map((m) => normalizeSubjectName(getMarkSubject(m))).filter(Boolean)
    );

    return expectedSubjects.filter(
      (subject) => !enteredSubjects.has(normalizeSubjectName(subject))
    );
  }, [expectedSubjects, allMarks]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const content = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Report Card - ${safeString(student?.name)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
            th { background: #1a237e; color: white; }
            h2, h3 { margin: 4px 0; }
            .header { text-align: center; margin-bottom: 20px; }
            .grade-chip {
              display: inline-block;
              padding: 2px 10px;
              border-radius: 12px;
              font-weight: bold;
              font-size: 13px;
            }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const renderDesktopRow = (mark) => {
    const status = getMarkStatus(mark);
    const value = getMarkValue(mark);

    if (status === "absent") {
      return (
        <TableRow key={`${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`} hover>
          <TableCell>{getMarkSubject(mark)}</TableCell>
          <TableCell>
            <strong>Absent</strong>
          </TableCell>
          <TableCell>
            <span
              style={{
                color: "#c62828",
                fontWeight: 700,
                background: "#ffebee",
                padding: "2px 10px",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              AB
            </span>
          </TableCell>
          <TableCell>{safeString(mark.absentReason || mark.remarks) || "Absent"}</TableCell>
        </TableRow>
      );
    }

    if (status === "medical_absent") {
      return (
        <TableRow key={`${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`} hover>
          <TableCell>{getMarkSubject(mark)}</TableCell>
          <TableCell>
            <strong>Medical Absent</strong>
          </TableCell>
          <TableCell>
            <span
              style={{
                color: "#6a1b9a",
                fontWeight: 700,
                background: "#f3e5f5",
                padding: "2px 10px",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              MA
            </span>
          </TableCell>
          <TableCell>{safeString(mark.absentReason || mark.remarks) || "Medical Absent"}</TableCell>
        </TableRow>
      );
    }

    const gradeMeta = getGradeMeta(value, student?.grade);

    return (
      <TableRow key={`${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`} hover>
        <TableCell>{getMarkSubject(mark)}</TableCell>
        <TableCell>
          <strong>{value}</strong> / 100
        </TableCell>
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
        <TableCell>{gradeMeta.desc}</TableCell>
      </TableRow>
    );
  };

  const renderMobileRow = (mark) => {
    const status = getMarkStatus(mark);

    if (status === "absent") {
      return (
        <Box
          key={`${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          py={1}
          sx={{ borderBottom: "1px solid #eee" }}
        >
          <Typography variant="body2">{getMarkSubject(mark)}</Typography>
          <Chip
            label="AB"
            size="small"
            sx={{ bgcolor: "#ffebee", color: "#c62828", fontWeight: 700 }}
          />
        </Box>
      );
    }

    if (status === "medical_absent") {
      return (
        <Box
          key={`${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          py={1}
          sx={{ borderBottom: "1px solid #eee" }}
        >
          <Typography variant="body2">{getMarkSubject(mark)}</Typography>
          <Chip
            label="MA"
            size="small"
            sx={{ bgcolor: "#f3e5f5", color: "#6a1b9a", fontWeight: 700 }}
          />
        </Box>
      );
    }

    const value = getMarkValue(mark);
    const gradeMeta = getGradeMeta(value, student?.grade);

    return (
      <Box
        key={`${mark.id || getMarkSubject(mark)}-${getMarkTerm(mark)}`}
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
            sx={{
              bgcolor: gradeMeta.bg,
              color: gradeMeta.color,
              fontWeight: 700,
              minWidth: 32,
            }}
          />
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(backPath)}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

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
            <Typography
              variant={isMobile ? "h6" : "h5"}
              fontWeight={700}
              color="#1a237e"
            >
              Report Card
            </Typography>

            <Box display="flex" gap={1} flexWrap="wrap">
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
              Marks not yet entered for: <strong>{missingSubjects.join(", ")}</strong>
            </Alert>
          )}

          <Paper sx={{ p: { xs: 2, sm: 3 } }} ref={printRef}>
            <Box textAlign="center" mb={2}>
              <Typography
                variant={isMobile ? "subtitle1" : "h5"}
                fontWeight={700}
                color="#1a237e"
              >
                {SCHOOL_NAME}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {SCHOOL_SUBTITLE}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Student Report Card
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {isMobile ? (
              <Card sx={{ mb: 2, bgcolor: "#f5f5f5" }}>
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Grid container spacing={1}>
                    {[
                      ["Name", student.name],
                      ["Adm No", student.admissionNo],
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
                  ["Full Name", student.name],
                  ["Admission No", student.admissionNo],
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
                <Typography
                  variant={isMobile ? "subtitle1" : "h6"}
                  fontWeight={600}
                  mb={1}
                >
                  {term} Results
                </Typography>

                {isMobile ? (
                  <Box>
                    {filteredMarks.map(renderMobileRow)}
                    {filteredMarks.length === 0 && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                        py={2}
                      >
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

                {filteredMarks.length > 0 && calcAverage(filteredMarks) !== null && (
                  <Box mt={1} textAlign="right">
                    <Typography variant="body2" fontWeight={700}>
                      Average: {calcAverage(filteredMarks)} / 100
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              availableTerms.map((t) => (
                <Box key={t} mb={3}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    color="#1a237e"
                    mb={1}
                  >
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
                    calcAverage(groupedByTerm[t]) !== null && (
                      <Box mt={0.5} textAlign="right">
                        <Typography variant="body2" fontWeight={600}>
                          {t} Average: {calcAverage(groupedByTerm[t])} / 100
                        </Typography>
                      </Box>
                    )}
                </Box>
              ))
            )}

            {allMarks.length > 0 && calcAverage(allMarks) !== null && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography
                    variant={isMobile ? "subtitle1" : "h6"}
                    fontWeight={700}
                  >
                    Overall Average
                  </Typography>
                  <Chip
                    label={`${calcAverage(allMarks)} / 100`}
                    color={
                      Number(calcAverage(allMarks)) >= 65
                        ? "success"
                        : Number(calcAverage(allMarks)) >= 40
                        ? "warning"
                        : "error"
                    }
                    sx={{ fontSize: { xs: 13, sm: 16 }, fontWeight: 700, px: 1 }}
                  />
                </Box>
              </>
            )}
          </Paper>

          {isMobile && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              fullWidth
              onClick={handlePrint}
              sx={{ bgcolor: "#1a237e", mt: 2 }}
            >
              Print Report Card
            </Button>
          )}
        </>
      )}
    </Box>
  );
}