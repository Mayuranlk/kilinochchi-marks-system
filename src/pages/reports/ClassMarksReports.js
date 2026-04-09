// src/pages/reports/ClassMarksReports.js

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { buildClassMarksReportData } from "../../utils/classMarksReportBuilder";
import { flattenSchemaColumns, getOverallExclusionNote } from "../../utils/reportSchemas";
import {
  exportAllClassesReportsZip,
  exportClassMarksExcel,
  exportClassMarksPdf,
  getClassMarksSchedulePreviewLayout,
} from "../../utils/classMarksExportUtils";

const CURRENT_YEAR = new Date().getFullYear();

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
}

function createPreviewCellStyle({ compact = false, header = false, align = "center", minWidth }) {
  return {
    border: "1px solid #999",
    padding: compact ? "4px 5px" : "6px 8px",
    background: header ? "#f5f5f5" : undefined,
    whiteSpace: compact ? "normal" : "nowrap",
    wordBreak: compact ? "break-word" : "normal",
    overflowWrap: compact ? "anywhere" : "normal",
    textAlign: align,
    verticalAlign: "middle",
    ...(header ? { fontWeight: 700 } : null),
    ...(minWidth ? { minWidth } : null),
  };
}

function SchedulePreview({ reportData }) {
  const { schema, rows, className, year, termName } = reportData;
  const flatColumns = flattenSchemaColumns(schema);
  const overallExclusionNote = getOverallExclusionNote(schema);
  const previewLayout = useMemo(
    () => getClassMarksSchedulePreviewLayout(reportData),
    [reportData]
  );
  const headCellStyle = createPreviewCellStyle({
    compact: previewLayout.compact,
    header: true,
  });
  const bodyCellStyle = createPreviewCellStyle({ compact: previewLayout.compact });
  const nameCellStyle = createPreviewCellStyle({
    compact: previewLayout.compact,
    align: "left",
    minWidth: previewLayout.compact ? 150 : 180,
  });

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          KN/Kilinochchi Central College - Mark Schedule
        </Typography>

        <Typography variant="body2" sx={{ mb: 2 }}>
          Grade - {className} Year - {year} Term - {termName.replace("Term ", "")}
        </Typography>

        <Box sx={{ overflowX: "auto" }}>
          <table
            style={{
              width: previewLayout.compact ? `${previewLayout.tableWidth}px` : "100%",
              borderCollapse: "collapse",
              minWidth: previewLayout.compact
                ? `${previewLayout.minWidth}px`
                : previewLayout.minWidth,
              tableLayout: previewLayout.compact ? "fixed" : "auto",
              fontSize: previewLayout.fontSize,
            }}
          >
            {previewLayout.compact && (
              <colgroup>
                {previewLayout.columnWidths.map((width, index) => (
                  <col key={index} style={{ width: `${width}px` }} />
                ))}
              </colgroup>
            )}
            <thead>
              <tr>
                <th style={headCellStyle} rowSpan={2}>No</th>
                <th style={headCellStyle} rowSpan={2}>Student ID</th>
                <th style={headCellStyle} rowSpan={2}>Index No</th>
                <th style={headCellStyle} rowSpan={2}>Students Name</th>

                {schema.groups.map((group) => (
                  <th key={group.key} style={headCellStyle} colSpan={group.columns.length}>
                    {group.label || ""}
                  </th>
                ))}

                <th style={headCellStyle} rowSpan={2}>Total</th>
                <th style={headCellStyle} rowSpan={2}>Average</th>
                <th style={headCellStyle} rowSpan={2}>Rank</th>
              </tr>
              <tr>
                {flatColumns.map((column) => (
                  <th key={column.key} style={headCellStyle}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id}>
                  <td style={bodyCellStyle}>{row.rowNo}</td>
                  <td style={bodyCellStyle}>{row.studentId}</td>
                  <td style={bodyCellStyle}>{row.studentIndexNo}</td>
                  <td style={nameCellStyle}>
                    {row.studentName}
                  </td>

                  {flatColumns.map((column) => (
                    <td key={column.key} style={bodyCellStyle}>
                      {row.absencesByColumn[column.key]
                        ? "AB"
                        : row.marksByColumn[column.key] ?? ""}
                    </td>
                  ))}

                  <td style={bodyCellStyle}>{formatNumber(row.total)}</td>
                  <td style={bodyCellStyle}>{formatNumber(row.average)}</td>
                  <td style={bodyCellStyle}>{row.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>

        {overallExclusionNote && (
          <Typography
            variant="caption"
            sx={{ mt: 1.5, display: "block", fontStyle: "italic", color: "text.secondary" }}
          >
            {overallExclusionNote}
          </Typography>
        )}

        <Grid container spacing={2} sx={{ mt: 3 }}>
          <Grid item xs={4}>
            <Typography variant="body2">
              {reportData.classroom?.classTeacherName || "Class Teacher"}
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="body2" align="center">
              {reportData.classroom?.sectionHeadName || "Sectional Head"}
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="body2" align="right">
              Principal
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function AnalysisPreview({ reportData }) {
  const { schema, analysis, className, year, termName } = reportData;
  const flatColumns = flattenSchemaColumns(schema);
  const compact = Number(reportData?.grade || 0) >= 10 && Number(reportData?.grade || 0) <= 11;
  const headCellStyle = createPreviewCellStyle({ compact, header: true });
  const bodyCellStyle = createPreviewCellStyle({ compact });
  const labelCellStyle = createPreviewCellStyle({
    compact,
    align: "left",
  });

  const rows = [
    { label: "Students's Total", getValue: (key) => analysis[key]?.total ?? 0 },
    { label: "Appeared", getValue: (key) => analysis[key]?.appeared ?? 0 },
    { label: "0-10", getValue: (key) => analysis[key]?.bands?.["0-10"] ?? 0 },
    { label: "11-20", getValue: (key) => analysis[key]?.bands?.["11-20"] ?? 0 },
    { label: "21-30", getValue: (key) => analysis[key]?.bands?.["21-30"] ?? 0 },
    { label: "31-34", getValue: (key) => analysis[key]?.bands?.["31-34"] ?? 0 },
    { label: "35-40", getValue: (key) => analysis[key]?.bands?.["35-40"] ?? 0 },
    { label: "41-50", getValue: (key) => analysis[key]?.bands?.["41-50"] ?? 0 },
    { label: "51-60", getValue: (key) => analysis[key]?.bands?.["51-60"] ?? 0 },
    { label: "61-70", getValue: (key) => analysis[key]?.bands?.["61-70"] ?? 0 },
    { label: "71-80", getValue: (key) => analysis[key]?.bands?.["71-80"] ?? 0 },
    { label: "81-90", getValue: (key) => analysis[key]?.bands?.["81-90"] ?? 0 },
    { label: "91-100", getValue: (key) => analysis[key]?.bands?.["91-100"] ?? 0 },
    { label: "Students >40marks", getValue: (key) => analysis[key]?.passCount ?? 0 },
    { label: "Pass Percentage", getValue: (key) => formatNumber(analysis[key]?.passPercentage ?? 0) },
  ];

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          KN/Kilinochchi Central College - Mark Analysis
        </Typography>

        <Typography variant="body2" sx={{ mb: 2 }}>
          Grade - {className} Year - {year} Term - {termName.replace("Term ", "")}
        </Typography>

        <Box sx={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: compact ? 1120 : 1200,
              fontSize: compact ? 11 : 12,
            }}
          >
            <thead>
              <tr>
                <th style={headCellStyle}> </th>
                {flatColumns.map((column) => (
                  <th key={column.key} style={headCellStyle}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...labelCellStyle, fontWeight: 600 }}>
                    {row.label}
                  </td>
                  {flatColumns.map((column) => (
                    <td key={column.key} style={bodyCellStyle}>
                      {row.getValue(column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>

        <Grid container spacing={2} sx={{ mt: 3 }}>
          <Grid item xs={4}>
            <Typography variant="body2">
              {reportData.classroom?.classTeacherName || "Class Teacher"}
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="body2" align="center">
              {reportData.classroom?.sectionHeadName || "Sectional Head"}
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="body2" align="right">
              Principal
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default function ClassMarksReports() {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState("");

  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [terms, setTerms] = useState([]);

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === selectedClassId) || null,
    [classrooms, selectedClassId]
  );

  const reportData = useMemo(() => {
    if (!selectedClassroom) return null;

    try {
      return buildClassMarksReportData({
        students,
        enrollments,
        marks,
        classrooms,
        grade: selectedClassroom.grade,
        className: selectedClassroom.className,
        section: selectedClassroom.section,
        termName: selectedTerm,
        year: selectedYear,
      });
    } catch (err) {
      console.error("Report build failed:", err);
      return null;
    }
  }, [students, enrollments, marks, classrooms, selectedClassroom, selectedTerm, selectedYear]);

  const filteredClassrooms = useMemo(() => {
    return classrooms
      .filter((item) => {
        const grade = Number(item.grade);
        const year = Number(item.year || item.academicYear || 0);

        return (
          year === Number(selectedYear) &&
          ((grade >= 6 && grade <= 9) || (grade >= 10 && grade <= 11))
        );
      })
      .sort((a, b) => {
        const gradeDiff = Number(a.grade) - Number(b.grade);
        if (gradeDiff !== 0) return gradeDiff;
        return String(a.className).localeCompare(String(b.className));
      });
  }, [classrooms, selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set(
      classrooms
        .map((item) => Number(item.year || item.academicYear || 0))
        .filter(Boolean)
    );
    return Array.from(years).sort((a, b) => a - b);
  }, [classrooms]);

  useEffect(() => {
    loadBaseData();
  }, []);

  async function loadBaseData() {
    try {
      setLoading(true);
      setError("");

      const [studentsSnap, enrollmentsSnap, marksSnap, classroomsSnap, termsSnap] =
        await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "studentSubjectEnrollments")),
          getDocs(collection(db, "marks")),
          getDocs(collection(db, "classrooms")),
          getDocs(collection(db, "academicTerms")),
        ]);

      const studentsData = studentsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const enrollmentsData = enrollmentsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const marksData = marksSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const classroomsData = classroomsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const termsData = termsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setStudents(studentsData);
      setEnrollments(enrollmentsData);
      setMarks(marksData);
      setClassrooms(classroomsData);
      setTerms(termsData);

      const activeTerm = termsData.find((item) => item.isActive) || termsData[0] || null;
      if (activeTerm?.term) {
        setSelectedTerm(activeTerm.term);
      }

      const defaultClassrooms = classroomsData
        .filter((item) => {
          const grade = Number(item.grade);
          return (
            Number(item.year || item.academicYear) === Number(CURRENT_YEAR) &&
            ((grade >= 6 && grade <= 9) || (grade >= 10 && grade <= 11))
          );
        })
        .sort((a, b) => {
          const gradeDiff = Number(a.grade) - Number(b.grade);
          if (gradeDiff !== 0) return gradeDiff;
          return String(a.className).localeCompare(String(b.className));
        });

      if (defaultClassrooms.length > 0) {
        setSelectedClassId(defaultClassrooms[0].id);
        setSelectedYear(
          Number(defaultClassrooms[0].year || defaultClassrooms[0].academicYear || CURRENT_YEAR)
        );
      }
    } catch (err) {
      console.error("Failed to load class marks reports data:", err);
      setError(err.message || "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkExport() {
    try {
      setBulkLoading(true);
      setError("");

      const allReports = filteredClassrooms
        .map((classroom) => {
          try {
            return buildClassMarksReportData({
              students,
              enrollments,
              marks,
              classrooms,
              grade: classroom.grade,
              className: classroom.className,
              section: classroom.section,
              termName: selectedTerm,
              year: selectedYear,
            });
          } catch (err) {
            console.error(`Bulk report build failed for ${classroom.className}:`, err);
            return null;
          }
        })
        .filter(Boolean);

      if (allReports.length === 0) {
        throw new Error("No class reports available for bulk export.");
      }

      await exportAllClassesReportsZip(allReports, {
        includePdf: true,
        includeExcel: true,
      });
    } catch (err) {
      console.error("Bulk export failed:", err);
      setError(err.message || "Bulk export failed.");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Class Marks Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Phase 1: Grades 6–9 and 10–11 schedule + analysis
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Year"
                    onChange={(e) => {
                      setSelectedYear(Number(e.target.value));
                      setSelectedClassId("");
                    }}
                  >
                    {availableYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={selectedClassId}
                    label="Class"
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    {filteredClassrooms.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.className}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Term</InputLabel>
                  <Select
                    value={selectedTerm}
                    label="Term"
                    onChange={(e) => setSelectedTerm(e.target.value)}
                  >
                    {terms.map((item) => (
                      <MenuItem key={item.id} value={item.term}>
                        {item.term}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ mt: 2, flexWrap: "wrap" }}
            >
              {selectedClassroom && (
                <Alert severity="info" sx={{ flex: 1, minWidth: 260 }}>
                  Grade {selectedClassroom.grade} | Class {selectedClassroom.className} | Term {selectedTerm}
                </Alert>
              )}

              <Button variant="outlined" onClick={loadBaseData} disabled={loading || bulkLoading}>
                Reload Data
              </Button>

              <Button
                variant="contained"
                onClick={() => {
                  if (reportData) exportClassMarksPdf(reportData);
                }}
                disabled={!reportData || loading || bulkLoading}
              >
                Download PDF
              </Button>

              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  if (reportData) exportClassMarksExcel(reportData);
                }}
                disabled={!reportData || loading || bulkLoading}
              >
                Download Excel
              </Button>

              <Button
                variant="contained"
                color="secondary"
                onClick={handleBulkExport}
                disabled={filteredClassrooms.length === 0 || loading || bulkLoading}
              >
                {bulkLoading ? "Preparing ZIP..." : "Export All Classes ZIP"}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!!error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && selectedClassroom && !reportData && (
          <Alert severity="warning">
            Unable to build report preview for this class.
          </Alert>
        )}

        {!loading && !error && reportData && (
          <>
            <SchedulePreview reportData={reportData} />
            <Divider />
            <AnalysisPreview reportData={reportData} />
          </>
        )}
      </Stack>
    </Box>
  );
}
