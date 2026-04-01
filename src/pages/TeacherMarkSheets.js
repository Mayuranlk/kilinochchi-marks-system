import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import DescriptionIcon from "@mui/icons-material/Description";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const SCHOOL_NAME = "KN/Kilinochchi Central College";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function normalizeAcademicYear(value) {
  const raw = normalizeText(value);
  const match = raw.match(/\d{4}/);
  return match ? match[0] : String(new Date().getFullYear());
}

function buildFullClassName(grade, section) {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : "";
}

function getStudentName(student) {
  return normalizeText(student?.name || student?.fullName || "Unnamed Student");
}

function getStudentIndexNo(student) {
  return normalizeText(
    student?.indexNo || student?.indexNumber || student?.admissionNo || student?.admNo || ""
  );
}

function getEnrollmentClassName(enrollment) {
  const rawClassName = normalizeText(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClassName)) return rawClassName.toUpperCase();
  return buildFullClassName(enrollment?.grade, enrollment?.section || rawClassName);
}

function getEnrollmentSubjectId(enrollment) {
  return normalizeText(enrollment?.subjectId || "");
}

function getEnrollmentSubjectName(enrollment) {
  return normalizeText(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentAcademicYear(enrollment) {
  return normalizeAcademicYear(enrollment?.academicYear || enrollment?.year);
}

function isEnrollmentActive(enrollment) {
  const status = normalizeLower(enrollment?.status || "active");
  return ["", "active", "current", "promoted"].includes(status);
}

function getTermLabel(term) {
  return normalizeText(term?.term || term?.termName || term?.name || "");
}

function sortStudentsForSheet(rows) {
  return [...rows].sort((a, b) => {
    const aIndex = getStudentIndexNo(a.student);
    const bIndex = getStudentIndexNo(b.student);

    if (aIndex && bIndex) {
      const byIndex = aIndex.localeCompare(bIndex, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byIndex !== 0) return byIndex;
    }

    return getStudentName(a.student).localeCompare(getStudentName(b.student), undefined, {
      sensitivity: "base",
    });
  });
}

function chunkArray(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function TeacherMarkSheets() {
  const { isAdmin, profile } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [terms, setTerms] = useState([]);

  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("__ALL__");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [studentSnap, enrollmentSnap, termSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "academicTerms")),
      ]);

      const loadedStudents = studentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedEnrollments = enrollmentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => isEnrollmentActive(row));

      const loadedTerms = termSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const activeTerm = loadedTerms.find((t) => t.isActive === true) || null;

      setStudents(loadedStudents);
      setEnrollments(loadedEnrollments);
      setTerms(loadedTerms);

      if (activeTerm) {
        setSelectedYear(normalizeAcademicYear(activeTerm.year));
        setSelectedTerm(getTermLabel(activeTerm));
      } else {
        const enrollmentYears = loadedEnrollments
          .map((e) => getEnrollmentAcademicYear(e))
          .filter(Boolean);

        if (enrollmentYears.length) {
          const latest = [...new Set(enrollmentYears)].sort((a, b) => Number(b) - Number(a))[0];
          setSelectedYear(latest);
        }
      }
    } catch (err) {
      console.error("TeacherMarkSheets load error:", err);
      setError("Failed to load students, enrollments, or terms.");
    } finally {
      setLoading(false);
    }
  }

  const studentMap = useMemo(() => {
    return new Map(students.map((student) => [normalizeText(student.id), student]));
  }, [students]);

  const availableYears = useMemo(() => {
    const years = [
      ...terms.map((t) => normalizeAcademicYear(t.year)),
      ...enrollments.map((e) => getEnrollmentAcademicYear(e)),
      String(new Date().getFullYear()),
    ].filter(Boolean);

    return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
  }, [terms, enrollments]);

  const availableTerms = useMemo(() => {
    const termValues = terms
      .filter((t) => !selectedYear || normalizeAcademicYear(t.year) === selectedYear)
      .map((t) => getTermLabel(t))
      .filter(Boolean);

    return [...new Set(termValues)];
  }, [terms, selectedYear]);

  const filteredEnrollmentsByYear = useMemo(() => {
    return enrollments.filter((e) => {
      const year = getEnrollmentAcademicYear(e);
      return !selectedYear || !year || year === selectedYear;
    });
  }, [enrollments, selectedYear]);

  const classOptions = useMemo(() => {
    const classes = filteredEnrollmentsByYear
      .map((e) => getEnrollmentClassName(e))
      .filter(Boolean);

    return [...new Set(classes)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [filteredEnrollmentsByYear]);

  const subjectOptions = useMemo(() => {
    const rows = filteredEnrollmentsByYear.filter((e) => {
      const sameClass = !selectedClass || getEnrollmentClassName(e) === selectedClass;
      return sameClass;
    });

    const map = new Map();

    rows.forEach((row) => {
      const subjectId = getEnrollmentSubjectId(row);
      const subjectName = getEnrollmentSubjectName(row);
      const key = subjectId || subjectName;
      if (!key || !subjectName) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          subjectId,
          subjectName,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: "base" })
    );
  }, [filteredEnrollmentsByYear, selectedClass]);

  useEffect(() => {
    if (
      selectedSubject !== "__ALL__" &&
      !subjectOptions.some((s) => s.key === selectedSubject)
    ) {
      setSelectedSubject("__ALL__");
    }
  }, [subjectOptions, selectedSubject]);

  const sheetData = useMemo(() => {
    const rows = filteredEnrollmentsByYear.filter((enrollment) => {
      const sameClass =
        !selectedClass || getEnrollmentClassName(enrollment) === selectedClass;

      const subjectKey =
        getEnrollmentSubjectId(enrollment) || getEnrollmentSubjectName(enrollment);

      const sameSubject =
        selectedSubject === "__ALL__" || selectedSubject === subjectKey;

      return sameClass && sameSubject;
    });

    const grouped = new Map();

    rows.forEach((enrollment) => {
      const student = studentMap.get(normalizeText(enrollment.studentId));
      if (!student) return;

      const className = getEnrollmentClassName(enrollment);
      const subjectId = getEnrollmentSubjectId(enrollment);
      const subjectName = getEnrollmentSubjectName(enrollment);
      const key = `${className}__${subjectId || subjectName}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          className,
          subjectId,
          subjectName,
          rows: [],
        });
      }

      grouped.get(key).rows.push({
        enrollment,
        student,
      });
    });

    return Array.from(grouped.values())
      .map((sheet) => ({
        ...sheet,
        rows: sortStudentsForSheet(sheet.rows),
      }))
      .sort((a, b) => {
        const byClass = a.className.localeCompare(b.className, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (byClass !== 0) return byClass;
        return a.subjectName.localeCompare(b.subjectName, undefined, {
          sensitivity: "base",
        });
      });
  }, [filteredEnrollmentsByYear, selectedClass, selectedSubject, studentMap]);

  function buildSheetTableRows(sheet) {
    return sheet.rows.map((row, index) => [
      index + 1,
      getStudentIndexNo(row.student),
      getStudentName(row.student),
      "",
      "",
    ]);
  }

  function drawSheetToPdf(doc, sheet, x, y, width, pageHeight, isHalfPage = false) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(SCHOOL_NAME, x + width / 2, y, { align: "center" });

    doc.setFontSize(11);
    doc.text(`Teacher Mark Sheet - ${selectedYear}`, x + width / 2, y + 6, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Class ${sheet.className} - ${selectedTerm || "Term"}${sheet.subjectName ? ` - ${sheet.subjectName}` : ""}`,
      x + width / 2,
      y + 12,
      { align: "center" }
    );

    const rows = buildSheetTableRows(sheet);

    autoTable(doc, {
      startY: y + 18,
      margin: { left: x, right: doc.internal.pageSize.getWidth() - (x + width) },
      head: [["No", "Index No", "Student Name", "Marks", "Absent"]],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: [80, 80, 80],
        lineWidth: 0.1,
        valign: "middle",
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: width - 12 - 28 - 28 - 18, halign: "left" },
        3: { cellWidth: 28, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
      },
      tableWidth: width,
      pageBreak: "avoid",
    });

    const finalY = doc.lastAutoTable?.finalY || y + 30;
    const footerY = Math.min(finalY + 10, isHalfPage ? y + 122 : pageHeight - 20);

    doc.setFontSize(10);
    doc.text("Date: ____________________", x, footerY);
    doc.text("Teacher Signature: ____________________", x + width - 70, footerY);
  }

  async function handleDownloadPdf() {
    if (!selectedClass || !sheetData.length) {
      setError("Please select a class with enrolled subjects.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const contentWidth = pageWidth - marginX * 2;

      let firstPage = true;

      for (const sheet of sheetData) {
        const shouldUseHalfPage = sheet.rows.length <= 30;

        if (shouldUseHalfPage) {
          if (!firstPage) doc.addPage();

          drawSheetToPdf(doc, sheet, marginX, 16, contentWidth, pageHeight, true);
          firstPage = false;
        } else {
          const chunks = chunkArray(sheet.rows, 34);

          chunks.forEach((chunk, chunkIndex) => {
            if (!firstPage) doc.addPage();

            const partialSheet = {
              ...sheet,
              rows: chunk,
              subjectName:
                chunks.length > 1
                  ? `${sheet.subjectName} (${chunkIndex + 1}/${chunks.length})`
                  : sheet.subjectName,
            };

            drawSheetToPdf(doc, partialSheet, marginX, 16, contentWidth, pageHeight, false);
            firstPage = false;
          });
        }
      }

      const fileName = `TeacherMarkSheets_${selectedClass}_${selectedTerm || "Term"}_${selectedYear}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("PDF generation error:", err);
      setError("Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  }

  function buildPrintableHtml() {
    const safe = (value) =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const sections = sheetData
      .map((sheet) => {
        const rowsHtml = buildSheetTableRows(sheet)
          .map(
            (row) => `
              <tr>
                <td class="center">${safe(row[0])}</td>
                <td class="center">${safe(row[1])}</td>
                <td>${safe(row[2])}</td>
                <td></td>
                <td></td>
              </tr>
            `
          )
          .join("");

        return `
          <div class="sheet ${sheet.rows.length <= 30 ? "half" : "full"}">
            <div class="header">
              <div class="school">${safe(SCHOOL_NAME)}</div>
              <div class="title">Teacher Mark Sheet - ${safe(selectedYear)}</div>
              <div class="meta">Class ${safe(sheet.className)} - ${safe(
                selectedTerm || "Term"
              )} - ${safe(sheet.subjectName)}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="no">No</th>
                  <th class="index">Index No</th>
                  <th class="name">Student Name</th>
                  <th class="marks">Marks</th>
                  <th class="absent">Absent</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="footer">
              <div>Date: ____________________</div>
              <div>Teacher Signature: ____________________</div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <title>Teacher Mark Sheets</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body {
              font-family: Arial, sans-serif;
              color: #000;
              margin: 0;
              padding: 0;
            }
            .sheet {
              page-break-after: always;
              box-sizing: border-box;
              width: 100%;
            }
            .sheet:last-child {
              page-break-after: auto;
            }
            .header {
              text-align: center;
              margin-bottom: 8px;
            }
            .school {
              font-size: 16px;
              font-weight: 700;
            }
            .title {
              font-size: 14px;
              font-weight: 700;
              margin-top: 2px;
            }
            .meta {
              font-size: 12px;
              margin-top: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            th, td {
              border: 1px solid #333;
              padding: 6px 8px;
              font-size: 12px;
            }
            th {
              background: #f2f2f2;
            }
            td {
              height: 26px;
            }
            .center {
              text-align: center;
            }
            .no { width: 8%; }
            .index { width: 18%; }
            .name { width: 48%; }
            .marks { width: 16%; }
            .absent { width: 10%; }
            .footer {
              margin-top: 16px;
              display: flex;
              justify-content: space-between;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          ${sections}
        </body>
      </html>
    `;
  }

  function handlePrint() {
    if (!selectedClass || !sheetData.length) {
      setError("Please select a class with enrolled subjects.");
      return;
    }

    setError("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Unable to open print window.");
      return;
    }

    printWindow.document.write(buildPrintableHtml());
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  const summaryText = useMemo(() => {
    const subjects = sheetData.length;
    const studentsCount = sheetData.reduce((sum, sheet) => sum + sheet.rows.length, 0);

    return `${subjects} subject sheet${subjects !== 1 ? "s" : ""} · ${studentsCount} total row${
      studentsCount !== 1 ? "s" : ""
    }`;
  }, [sheetData]);

  if (!isAdmin) {
    return (
      <Box>
        <Alert severity="error">Only admin can generate teacher mark sheets.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1.2} alignItems="center" mb={1}>
            <DescriptionIcon sx={{ color: "#1a237e" }} />
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800} color="#1a237e">
              Teacher Mark Sheets
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Generate printable and downloadable PDF mark sheets for teachers using
            subject enrollments.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Alert severity="info">
          This page uses <strong>studentSubjectEnrollments</strong> so each subject sheet
          includes only students actually enrolled in that subject.
        </Alert>

        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid #e8eaf6",
            boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
          }}
        >
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Academic Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Academic Year"
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {availableYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Term</InputLabel>
                  <Select
                    value={selectedTerm}
                    label="Term"
                    onChange={(e) => setSelectedTerm(e.target.value)}
                  >
                    {availableTerms.map((term) => (
                      <MenuItem key={term} value={term}>
                        {term}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={selectedClass}
                    label="Class"
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setSelectedSubject("__ALL__");
                    }}
                  >
                    {classOptions.map((className) => (
                      <MenuItem key={className} value={className}>
                        {className}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth disabled={!selectedClass}>
                  <InputLabel>Subject</InputLabel>
                  <Select
                    value={selectedSubject}
                    label="Subject"
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <MenuItem value="__ALL__">All Subjects</MenuItem>
                    {subjectOptions.map((subject) => (
                      <MenuItem key={subject.key} value={subject.key}>
                        {subject.subjectName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              mt={3}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Typography variant="body2" color="text.secondary">
                {summaryText}
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadData}
                  disabled={loading || generating}
                >
                  Refresh
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={handlePrint}
                  disabled={loading || generating || !selectedClass || !sheetData.length}
                >
                  Print
                </Button>

                <Button
                  variant="contained"
                  startIcon={
                    generating ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />
                  }
                  onClick={handleDownloadPdf}
                  disabled={loading || generating || !selectedClass || !sheetData.length}
                  sx={{ bgcolor: "#1a237e" }}
                >
                  {generating ? "Generating PDF..." : "Download PDF"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {loading ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress />
          </Paper>
        ) : !selectedClass ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              Select year, term, class, and subject to generate teacher mark sheets.
            </Typography>
          </Paper>
        ) : sheetData.length === 0 ? (
          <Alert severity="warning">
            No enrolled students found for the selected filters.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {sheetData.map((sheet) => (
              <Grid item xs={12} md={6} key={`${sheet.className}_${sheet.subjectId || sheet.subjectName}`}>
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.05)",
                    height: "100%",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color="#1a237e">
                    {sheet.subjectName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Class {sheet.className} · {selectedTerm || "Term"} · {selectedYear}
                  </Typography>
                  <Typography variant="body2">
                    Students: <strong>{sheet.rows.length}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Layout: <strong>{sheet.rows.length <= 30 ? "Compact single sheet" : "Multi-page sheet"}</strong>
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            border: "1px solid #e8eaf6",
            bgcolor: "#fafbff",
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Output Format
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Columns: No, Index No, Student Name, Marks, Absent
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Footer: Date, Teacher Signature
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generated by: {profile?.name || profile?.email || "Admin"}
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}