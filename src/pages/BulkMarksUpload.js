import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SchoolIcon from "@mui/icons-material/School";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PreviewIcon from "@mui/icons-material/Preview";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import {
  MobileListRow,
  PageContainer,
  ResponsiveTableWrapper,
  StatCard,
  StatusChip,
} from "../components/ui";

const TEMPLATE_HEADERS = [
  "studentId",
  "indexNo",
  "studentName",
  "marks",
  "absent",
  "subjectId",
  "subjectName",
  "className",
  "term",
  "academicYear",
];

function normalizeText(value) {
  return String(value ?? "").trim();
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
    student?.indexNo ||
      student?.indexNumber ||
      student?.admissionNo ||
      student?.admissionNumber ||
      student?.admNo ||
      ""
  );
}

function getEnrollmentGrade(enrollment) {
  return parseGrade(enrollment?.grade || enrollment?.className);
}

function getEnrollmentSection(enrollment) {
  return normalizeSection(enrollment?.section || enrollment?.className || "");
}

function getEnrollmentClassName(enrollment) {
  const rawClass = normalizeText(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClass)) return rawClass.toUpperCase();

  return buildFullClassName(
    getEnrollmentGrade(enrollment),
    getEnrollmentSection(enrollment)
  );
}

function getEnrollmentSubjectName(enrollment) {
  return normalizeText(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentSubjectId(enrollment) {
  return normalizeText(enrollment?.subjectId || "");
}

function getEnrollmentAcademicYear(enrollment) {
  return String(enrollment?.academicYear || enrollment?.year || "");
}

function isActiveStatus(value) {
  return normalizeLower(value || "active") === "active";
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueNumberSortedDesc(values) {
  return [...new Set(values.filter((v) => Number.isFinite(Number(v))).map(Number))].sort(
    (a, b) => b - a
  );
}

function groupByClassAndSubject(enrollments) {
  const map = new Map();

  for (const enrollment of enrollments) {
    const className = getEnrollmentClassName(enrollment);
    const subjectName = getEnrollmentSubjectName(enrollment);
    const subjectId = getEnrollmentSubjectId(enrollment);
    const year = getEnrollmentAcademicYear(enrollment);

    if (!className || !subjectName) continue;

    const key = `${className}__${subjectName}__${year}`;
    if (!map.has(key)) {
      map.set(key, {
        className,
        subjectName,
        subjectId,
        academicYear: year,
        count: 0,
      });
    }

    map.get(key).count += 1;
  }

  return Array.from(map.values()).sort((a, b) => {
    const classDiff = a.className.localeCompare(b.className);
    if (classDiff !== 0) return classDiff;
    return a.subjectName.localeCompare(b.subjectName);
  });
}

function autoSizeColumns(rows) {
  return TEMPLATE_HEADERS.map((header) => {
    const maxRowLength = rows.reduce((max, row) => {
      const value = row[header] == null ? "" : String(row[header]);
      return Math.max(max, value.length);
    }, header.length);

    const width = Math.min(Math.max(maxRowLength + 2, 12), 32);

    return {
      wch: width,
      hidden: ["studentId", "subjectId", "subjectName", "className", "term", "academicYear"].includes(
        header
      ),
    };
  });
}

function buildTemplateFileName({ className, subjectName, term, academicYear }) {
  const clean = (value) =>
    normalizeText(value)
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return `${clean(className)} - ${clean(subjectName)} - ${clean(term)} - ${clean(
    academicYear
  )}.xlsx`;
}

function buildTemplateRows({
  selectedEnrollments,
  studentsById,
  className,
  subjectId,
  subjectName,
  term,
  academicYear,
}) {
  const seenStudentIds = new Set();

  return selectedEnrollments
    .map((enrollment) => {
      const studentId = normalizeText(enrollment.studentId);
      if (!studentId || seenStudentIds.has(studentId)) return null;

      seenStudentIds.add(studentId);

      const student = studentsById.get(studentId) || null;

      return {
        studentId,
        indexNo: getStudentIndexNo(student),
        studentName:
          getStudentName(student) ||
          normalizeText(enrollment.studentName || "Unnamed Student"),
        marks: "",
        absent: "",
        subjectId,
        subjectName,
        className,
        term,
        academicYear,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const indexDiff = normalizeText(a.indexNo).localeCompare(normalizeText(b.indexNo), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (indexDiff !== 0) return indexDiff;

      return a.studentName.localeCompare(b.studentName);
    });
}

function createWorkbook({
  rows,
  className,
  subjectName,
  term,
  academicYear,
}) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: TEMPLATE_HEADERS,
  });

  worksheet["!cols"] = autoSizeColumns(rows);
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!autofilter"] = {
    ref: "A1:J1",
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "MarksTemplate");

  const infoRows = [
    ["Bulk Marks Upload Template"],
    [`Class: ${className}`],
    [`Subject: ${subjectName}`],
    [`Term: ${term}`],
    [`Academic Year: ${academicYear}`],
    [""],
    ["Instructions"],
    ["1. Enter marks in the 'marks' column only."],
    ["2. Enter TRUE in 'absent' only if the student was absent."],
    ["3. Leave marks empty for absent students."],
    ["4. Do not delete hidden columns. They are required for upload."],
  ];

  const infoSheet = XLSX.utils.aoa_to_sheet(infoRows);
  infoSheet["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Instructions");

  return workbook;
}

function parseBooleanLike(value) {
  const raw = normalizeLower(value);

  if (raw === "") return { valid: true, value: null };
  if (["true", "yes", "1"].includes(raw)) return { valid: true, value: true };
  if (["false", "no", "0"].includes(raw)) return { valid: true, value: false };

  if (typeof value === "boolean") {
    return { valid: true, value };
  }

  return { valid: false, value: null };
}

function parseMarksValue(value) {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { valid: false, value: null };
  }

  return { valid: true, value: num };
}

function buildEnrollmentKey({
  studentId,
  subjectId,
  subjectName,
  className,
  academicYear,
}) {
  return [
    normalizeText(studentId),
    normalizeText(subjectId),
    normalizeLower(subjectName),
    normalizeText(className).toUpperCase(),
    String(academicYear || ""),
  ].join("__");
}

function validateUploadedRows({
  rows,
  studentsById,
  validEnrollmentKeys,
  selectedClass,
  selectedSubject,
  selectedSubjectId,
  selectedTerm,
  selectedYear,
}) {
  const validRows = [];
  const invalidRows = [];
  const seenStudentIds = new Set();

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;

    const studentId = normalizeText(rawRow.studentId);
    const indexNo = normalizeText(rawRow.indexNo);
    const studentName = normalizeText(rawRow.studentName);
    const marksRaw = rawRow.marks;
    const absentRaw = rawRow.absent;
    const subjectId = normalizeText(rawRow.subjectId);
    const subjectName = normalizeText(rawRow.subjectName);
    const className = normalizeText(rawRow.className).toUpperCase();
    const term = normalizeText(rawRow.term);
    const academicYear = String(rawRow.academicYear ?? "").trim();

    const reasons = [];

    if (!studentId) reasons.push("Missing studentId");

    const student = studentsById.get(studentId);
    if (studentId && !student) reasons.push("studentId does not exist");

    if (selectedSubjectId && subjectId !== selectedSubjectId) {
      reasons.push("subjectId does not match selected subject");
    }

    if (subjectName !== selectedSubject) {
      reasons.push("subjectName does not match selected subject");
    }

    if (className !== selectedClass.toUpperCase()) {
      reasons.push("className does not match selected class");
    }

    if (term !== selectedTerm) {
      reasons.push("term does not match selected term");
    }

    if (academicYear !== String(selectedYear)) {
      reasons.push("academicYear does not match selected year");
    }

    const marksResult = parseMarksValue(marksRaw);
    if (!marksResult.valid) {
      reasons.push("marks must be numeric or empty");
    }

    const absentResult = parseBooleanLike(absentRaw);
    if (!absentResult.valid) {
      reasons.push("absent must be TRUE/FALSE or empty");
    }

    if (seenStudentIds.has(studentId)) {
      reasons.push("duplicate studentId row in uploaded file");
    }

    const enrollmentKey = buildEnrollmentKey({
      studentId,
      subjectId,
      subjectName,
      className,
      academicYear,
    });

    if (studentId && !validEnrollmentKeys.has(enrollmentKey)) {
      reasons.push("student is not enrolled in this class/subject/year");
    }

    if (marksResult.value !== null && absentResult.value === true) {
      reasons.push("cannot have both marks and absent=TRUE");
    }

    if (!reasons.length) {
      seenStudentIds.add(studentId);

      validRows.push({
        rowNumber,
        studentId,
        indexNo,
        studentName,
        marks: marksResult.value,
        absent: absentResult.value,
        subjectId,
        subjectName,
        className,
        term,
        academicYear,
      });
    } else {
      invalidRows.push({
        rowNumber,
        studentId,
        indexNo,
        studentName,
        marks: marksRaw,
        absent: absentRaw,
        subjectName,
        reasons,
      });
    }
  });

  return {
    validRows,
    invalidRows,
  };
}

export default function BulkMarksUpload() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [allStudents, setAllStudents] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [allTerms, setAllTerms] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());

  const [uploadedFileName, setUploadedFileName] = useState("");
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [rawUploadedRows, setRawUploadedRows] = useState([]);
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  async function loadBaseData() {
    setLoading(true);
    setError("");

    try {
      const [studentSnap, enrollmentSnap, termSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "academicTerms")),
      ]);

      const students = studentSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((student) => isActiveStatus(student?.status || "active"));

      const enrollments = enrollmentSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((enrollment) => isActiveStatus(enrollment?.status || "active"));

      const terms = termSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setAllStudents(students);
      setAllEnrollments(enrollments);
      setAllTerms(terms);

      const activeTerm = terms.find((term) => term.isActive === true);
      if (activeTerm) {
        setSelectedTerm(normalizeText(activeTerm.term) || "Term 1");
        setSelectedYear(String(activeTerm.year || getCurrentYear()));
      }
    } catch (err) {
      console.error("BulkMarksUpload load error:", err);
      setError("Failed to load students, enrollments, or terms.");
    } finally {
      setLoading(false);
    }
  }

  const studentsById = useMemo(() => {
    return new Map(allStudents.map((student) => [normalizeText(student.id), student]));
  }, [allStudents]);

  const availableYears = useMemo(() => {
    const yearsFromTerms = allTerms.map((term) => Number(term.year));
    const yearsFromEnrollments = allEnrollments.map((enrollment) =>
      Number(getEnrollmentAcademicYear(enrollment))
    );

    const values = uniqueNumberSortedDesc([
      Number(getCurrentYear()),
      ...yearsFromTerms,
      ...yearsFromEnrollments,
    ]);

    return values.length ? values : [Number(getCurrentYear())];
  }, [allTerms, allEnrollments]);

  const availableClasses = useMemo(() => {
    const filtered = allEnrollments.filter(
      (enrollment) =>
        !selectedYear ||
        !getEnrollmentAcademicYear(enrollment) ||
        getEnrollmentAcademicYear(enrollment) === String(selectedYear)
    );

    return uniqueSorted(filtered.map((enrollment) => getEnrollmentClassName(enrollment)));
  }, [allEnrollments, selectedYear]);

  const availableSubjects = useMemo(() => {
    const filtered = allEnrollments.filter((enrollment) => {
      const sameYear =
        !selectedYear ||
        !getEnrollmentAcademicYear(enrollment) ||
        getEnrollmentAcademicYear(enrollment) === String(selectedYear);

      const sameClass =
        !selectedClass || getEnrollmentClassName(enrollment) === selectedClass;

      return sameYear && sameClass;
    });

    return uniqueSorted(filtered.map((enrollment) => getEnrollmentSubjectName(enrollment)));
  }, [allEnrollments, selectedYear, selectedClass]);

  const selectedEnrollments = useMemo(() => {
    return allEnrollments.filter((enrollment) => {
      const sameYear =
        !selectedYear ||
        !getEnrollmentAcademicYear(enrollment) ||
        getEnrollmentAcademicYear(enrollment) === String(selectedYear);

      const sameClass =
        !selectedClass || getEnrollmentClassName(enrollment) === selectedClass;

      const sameSubject =
        !selectedSubject || getEnrollmentSubjectName(enrollment) === selectedSubject;

      return sameYear && sameClass && sameSubject;
    });
  }, [allEnrollments, selectedYear, selectedClass, selectedSubject]);

  const selectedSubjectId = useMemo(() => {
    const found = selectedEnrollments.find((enrollment) => getEnrollmentSubjectId(enrollment));
    return found ? getEnrollmentSubjectId(found) : "";
  }, [selectedEnrollments]);

  const validEnrollmentKeys = useMemo(() => {
    const keys = new Set();

    selectedEnrollments.forEach((enrollment) => {
      keys.add(
        buildEnrollmentKey({
          studentId: enrollment.studentId,
          subjectId: getEnrollmentSubjectId(enrollment),
          subjectName: getEnrollmentSubjectName(enrollment),
          className: getEnrollmentClassName(enrollment),
          academicYear: getEnrollmentAcademicYear(enrollment),
        })
      );
    });

    return keys;
  }, [selectedEnrollments]);

  const previewRows = useMemo(() => {
    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedYear) return [];

    return buildTemplateRows({
      selectedEnrollments,
      studentsById,
      className: selectedClass,
      subjectId: selectedSubjectId,
      subjectName: selectedSubject,
      term: selectedTerm,
      academicYear: String(selectedYear),
    });
  }, [
    selectedEnrollments,
    studentsById,
    selectedClass,
    selectedSubjectId,
    selectedSubject,
    selectedTerm,
    selectedYear,
  ]);

  const summaryOptions = useMemo(() => {
    return groupByClassAndSubject(allEnrollments).filter((item) => {
      if (selectedYear && item.academicYear && item.academicYear !== String(selectedYear)) {
        return false;
      }
      return true;
    });
  }, [allEnrollments, selectedYear]);

  useEffect(() => {
    if (selectedClass && !availableClasses.includes(selectedClass)) {
      setSelectedClass("");
    }
  }, [availableClasses, selectedClass]);

  useEffect(() => {
    if (selectedSubject && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject("");
    }
  }, [availableSubjects, selectedSubject]);

  useEffect(() => {
    setUploadedFileName("");
    setValidRows([]);
    setInvalidRows([]);
    setRawUploadedRows([]);
  }, [selectedClass, selectedSubject, selectedTerm, selectedYear]);

  async function handleDownloadTemplate() {
    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedYear) return;

    if (!previewRows.length) {
      setError("No enrolled students found for the selected class, subject, and year.");
      return;
    }

    setDownloading(true);
    setError("");

    try {
      const workbook = createWorkbook({
        rows: previewRows,
        className: selectedClass,
        subjectName: selectedSubject,
        term: selectedTerm,
        academicYear: String(selectedYear),
      });

      const fileName = buildTemplateFileName({
        className: selectedClass,
        subjectName: selectedSubject,
        term: selectedTerm,
        academicYear: String(selectedYear),
      });

      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error("Template download error:", err);
      setError("Failed to generate Excel template.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedYear) {
      setError("Select academic year, class, subject, and term before uploading.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadedFileName(file.name);
    setValidRows([]);
    setInvalidRows([]);
    setRawUploadedRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        throw new Error("No worksheet found in uploaded file.");
      }

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("Uploaded sheet is empty.");
      }

      const missingHeaders = TEMPLATE_HEADERS.filter((header) => !(header in rows[0]));
      if (missingHeaders.length) {
        throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
      }

      setRawUploadedRows(rows);

      const result = validateUploadedRows({
        rows,
        studentsById,
        validEnrollmentKeys,
        selectedClass,
        selectedSubject,
        selectedSubjectId,
        selectedTerm,
        selectedYear,
      });

      setValidRows(result.validRows);
      setInvalidRows(result.invalidRows);
    } catch (err) {
      console.error("Upload validation error:", err);
      setError(err.message || "Failed to read and validate uploaded Excel file.");
    } finally {
      setUploading(false);
    }
  }

  const canDownload =
    selectedClass &&
    selectedSubject &&
    selectedTerm &&
    selectedYear &&
    previewRows.length > 0 &&
    !downloading;

  const quickStats = [
    { title: "Template Rows", value: previewRows.length, color: "primary", status: "active" },
    { title: "Uploaded Rows", value: validRows.length + invalidRows.length, color: "saved", status: "saved" },
    { title: "Valid Rows", value: validRows.length, color: "success", status: "completed" },
    { title: "Invalid Rows", value: invalidRows.length, color: "error", status: "pending" },
  ];

  return (
    <PageContainer
      title="Bulk Marks Upload"
      subtitle="Download a marks template, upload the completed Excel file, and preview valid and invalid rows before saving."
      maxWidth="xl"
    >
      <Stack spacing={3}>
        <Alert severity="info">
          This uses <strong>studentSubjectEnrollments</strong> as the source of truth.
          Only enrolled students for the selected class, subject, and academic year are valid.
        </Alert>

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {isMobile ? (
          <Paper sx={{ p: 1.5, borderRadius: 3, border: "1px solid #e8eaf6" }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1a237e" }}>
                Quick Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {quickStats.map((item) => (
                  <StatusChip key={item.title} status={item.status} label={`${item.title}: ${item.value}`} />
                ))}
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}>
              <StatCard title="Template Rows" value={previewRows.length} icon={<SchoolIcon />} color="primary" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Uploaded Rows" value={validRows.length + invalidRows.length} icon={<PreviewIcon />} color="secondary" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Valid Rows" value={validRows.length} icon={<CheckCircleIcon />} color="success" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Invalid Rows" value={invalidRows.length} icon={<ErrorOutlineIcon />} color="error" />
            </Grid>
          </Grid>
        )}

        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            border: "1px solid #e8eaf6",
            boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
            position: { xs: "sticky", md: "static" },
            top: { xs: 76, md: "auto" },
            zIndex: { xs: 2, md: "auto" },
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
              Upload Context
            </Typography>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Academic Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Academic Year"
                    onChange={(e) => setSelectedYear(String(e.target.value))}
                    disabled={loading}
                  >
                    {availableYears.map((year) => (
                      <MenuItem key={year} value={String(year)}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={selectedClass}
                    label="Class"
                    onChange={(e) => setSelectedClass(e.target.value)}
                    disabled={loading}
                  >
                    <MenuItem value="">Select class...</MenuItem>
                    {availableClasses.map((className) => (
                      <MenuItem key={className} value={className}>
                        {className}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Subject</InputLabel>
                  <Select
                    value={selectedSubject}
                    label="Subject"
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    disabled={loading || !selectedClass}
                  >
                    <MenuItem value="">Select subject...</MenuItem>
                    {availableSubjects.map((subject) => (
                      <MenuItem key={subject} value={subject}>
                        {subject}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Term</InputLabel>
                  <Select
                    value={selectedTerm}
                    label="Term"
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    disabled={loading}
                  >
                    {["Term 1", "Term 2", "Term 3"].map((term) => (
                      <MenuItem key={term} value={term}>
                        {term}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Button
                  variant="contained"
                  startIcon={
                    downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />
                  }
                  onClick={handleDownloadTemplate}
                  disabled={!canDownload}
                  sx={{
                    bgcolor: "#1a237e",
                    fontWeight: 700,
                    borderRadius: 2,
                  }}
                  fullWidth={isMobile}
                >
                  {downloading ? "Generating..." : "Download Excel Template"}
                </Button>
              </Grid>

              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={
                    uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />
                  }
                  disabled={
                    loading ||
                    uploading ||
                    !selectedClass ||
                    !selectedSubject ||
                    !selectedTerm ||
                    !selectedYear
                  }
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                  fullWidth={isMobile}
                >
                  {uploading ? "Reading File..." : "Upload Completed Excel"}
                  <input
                    hidden
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                </Button>
              </Grid>
            </Grid>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              Current Selection
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Year: ${selectedYear || "-"}`} />
              <Chip label={`Class: ${selectedClass || "-"}`} />
              <Chip label={`Subject: ${selectedSubject || "-"}`} />
              <Chip label={`Term: ${selectedTerm || "-"}`} />
              <Chip color="primary" label={`Template Rows: ${previewRows.length}`} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Template columns:{" "}
              <strong>
                studentId, indexNo, studentName, marks, absent, subjectId, subjectName,
                className, term, academicYear
              </strong>
            </Typography>
          </Stack>
        </Paper>

        {uploadedFileName ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>
                Upload Summary
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={1}>
                <Chip label={`File: ${uploadedFileName}`} />
                <Chip label={`Rows Read: ${rawUploadedRows.length}`} />
                <Chip
                  color="success"
                  icon={<CheckCircleIcon />}
                  label={`Valid Rows: ${validRows.length}`}
                />
                <Chip
                  color="error"
                  icon={<ErrorOutlineIcon />}
                  label={`Invalid Rows: ${invalidRows.length}`}
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                Only valid rows will be allowed for the next save step.
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        {(validRows.length > 0 || invalidRows.length > 0) && (
          <>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant={showInvalidOnly ? "outlined" : "contained"}
                onClick={() => setShowInvalidOnly(false)}
                sx={{ borderRadius: 2 }}
                fullWidth={isMobile}
              >
                Show Valid Rows
              </Button>
              <Button
                variant={showInvalidOnly ? "contained" : "outlined"}
                color="error"
                onClick={() => setShowInvalidOnly(true)}
                sx={{ borderRadius: 2 }}
                fullWidth={isMobile}
              >
                Show Invalid Rows
              </Button>
            </Box>

            {!showInvalidOnly && (
              <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "auto" }}>
                <Box sx={{ p: 2, pb: 0 }}>
                  <Typography variant="h6" fontWeight={700}>
                    Valid Rows Preview
                  </Typography>
                </Box>

                <ResponsiveTableWrapper>
                  <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f5f7ff" }}>
                      <TableCell><strong>Row</strong></TableCell>
                      <TableCell><strong>Index No</strong></TableCell>
                      <TableCell><strong>Student</strong></TableCell>
                      <TableCell><strong>Marks</strong></TableCell>
                      <TableCell><strong>Absent</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {validRows.length ? (
                      validRows.map((row) => (
                        <TableRow key={`${row.studentId}-${row.rowNumber}`}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.indexNo || "—"}</TableCell>
                          <TableCell>{row.studentName || "—"}</TableCell>
                          <TableCell>{row.marks ?? "—"}</TableCell>
                          <TableCell>{row.absent === true ? "TRUE" : row.absent === false ? "FALSE" : "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No valid rows found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </ResponsiveTableWrapper>
              </Paper>
            )}

            {showInvalidOnly && (
              <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "auto" }}>
                <Box sx={{ p: 2, pb: 0 }}>
                  <Typography variant="h6" fontWeight={700}>
                    Invalid Rows Preview
                  </Typography>
                </Box>

                <ResponsiveTableWrapper>
                  <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#fff4f4" }}>
                      <TableCell><strong>Row</strong></TableCell>
                      <TableCell><strong>Index No</strong></TableCell>
                      <TableCell><strong>Student</strong></TableCell>
                      <TableCell><strong>Marks</strong></TableCell>
                      <TableCell><strong>Absent</strong></TableCell>
                      <TableCell><strong>Reason</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invalidRows.length ? (
                      invalidRows.map((row) => (
                        <TableRow key={`${row.studentId || "invalid"}-${row.rowNumber}`}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.indexNo || "—"}</TableCell>
                          <TableCell>{row.studentName || "—"}</TableCell>
                          <TableCell>{normalizeText(row.marks) || "—"}</TableCell>
                          <TableCell>{normalizeText(row.absent) || "—"}</TableCell>
                          <TableCell>
                            {row.reasons.join(", ")}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No invalid rows found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </ResponsiveTableWrapper>
              </Paper>
            )}
          </>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h6" fontWeight={700}>
              Validation Rules
            </Typography>
            <Typography variant="body2" color="text.secondary">
              1. <strong>studentId</strong> must exist in the students collection.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              2. <strong>subjectId</strong> and <strong>subjectName</strong> must match the selected subject.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. <strong>className</strong>, <strong>term</strong>, and <strong>academicYear</strong> must match the current selection.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4. <strong>marks</strong> must be numeric or empty.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              5. <strong>absent</strong> must be TRUE/FALSE or empty.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              6. Duplicate student rows are rejected.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              7. A row is invalid if the student is not enrolled in the selected class and subject.
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              Quick Enrollment Summary
            </Typography>

            {loading ? (
              <Box textAlign="center" py={3}>
                <CircularProgress />
              </Box>
            ) : summaryOptions.length === 0 ? (
              <Alert severity="info">No active enrollments found.</Alert>
            ) : isMobile ? (
              <Stack spacing={1.25}>
                {summaryOptions.slice(0, 12).map((item) => (
                  <MobileListRow
                    key={`${item.className}-${item.subjectName}-${item.academicYear}`}
                    compact
                    title={`${item.className} - ${item.subjectName}`}
                    subtitle={`Academic Year: ${item.academicYear || "-"}`}
                    right={
                      <StatusChip
                        status="active"
                        label={`${item.count} students`}
                      />
                    }
                    meta={[
                      <Chip
                        key="class"
                        size="small"
                        variant="outlined"
                        label={item.className}
                      />,
                      <Chip
                        key="subject"
                        size="small"
                        variant="outlined"
                        label={item.subjectName}
                      />,
                    ]}
                  />
                ))}
              </Stack>
            ) : (
              <Grid container spacing={1.5}>
                {summaryOptions.slice(0, 12).map((item) => (
                  <Grid item xs={12} md={6} lg={4} key={`${item.className}-${item.subjectName}-${item.academicYear}`}>
                    <Card variant="outlined" sx={{ height: "100%" }}>
                      <CardContent>
                        <Stack spacing={1}>
                          <Typography fontWeight={700}>
                            {item.className} - {item.subjectName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Academic Year: {item.academicYear || "-"}
                          </Typography>
                          <Chip
                            size="small"
                            color="primary"
                            label={`${item.count} enrolled students`}
                            sx={{ width: "fit-content" }}
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        </Paper>
      </Stack>
    </PageContainer>
  );
}
