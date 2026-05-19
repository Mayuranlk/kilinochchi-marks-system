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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { auth, db } from "../firebase";
import {
  AL_SUBJECTS_BY_NAME,
  AL_SUBJECTS_BY_NUMBER,
  buildALClassName,
  buildALDisplayClassName,
  isALGrade,
} from "../constants";
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

const MAX_BATCH_WRITES = 450;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeLoose(value) {
  return normalizeLower(value).replace(/[^a-z0-9]/g, "");
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

function pickValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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

function getEnrollmentGrade(enrollment, student = {}) {
  return parseGrade(pickValue(enrollment?.grade, student?.grade, enrollment?.className));
}

function getEnrollmentSection(enrollment, student = {}) {
  return normalizeSection(
    pickValue(enrollment?.section, student?.section, student?.className, enrollment?.className, "")
  );
}

function getEnrollmentStream(enrollment, student = {}) {
  return normalizeText(pickValue(enrollment?.stream, student?.stream, ""));
}

function getEnrollmentClassName(enrollment, student = {}) {
  const grade = getEnrollmentGrade(enrollment, student);
  const section = getEnrollmentSection(enrollment, student);
  const stream = getEnrollmentStream(enrollment, student);

  if (isALGrade(grade) && stream && section) {
    return buildALDisplayClassName(grade, stream, section) || buildALClassName(grade, stream, section);
  }

  const explicitALClassName = normalizeText(
    pickValue(enrollment?.fullClassName, enrollment?.alClassName, "")
  );
  if (explicitALClassName) return explicitALClassName;

  const rawClass = normalizeText(enrollment?.className || "");
  if (/^\d+[A-Z]+$/i.test(rawClass)) return rawClass.toUpperCase();

  return buildFullClassName(grade, section || rawClass);
}

function getEnrollmentSubjectName(enrollment) {
  return normalizeText(enrollment?.subjectName || enrollment?.subject || "");
}

function getEnrollmentSubjectId(enrollment) {
  return normalizeText(enrollment?.subjectId || "");
}

function getEnrollmentSubjectNumber(enrollment) {
  return normalizeText(enrollment?.subjectNumber || "");
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

function parseTeacherSheetMarkValue(value) {
  const raw = normalizeText(value);
  if (!raw) return { valid: true, marks: null, absent: null };
  if (["ab", "absent", "a"].includes(normalizeLower(raw))) {
    return { valid: true, marks: null, absent: true };
  }

  const parsed = parseMarksValue(value);
  if (!parsed.valid) return { valid: false, marks: null, absent: null };
  return { valid: true, marks: parsed.value, absent: false };
}

function parsePercentageValue(value) {
  const raw = normalizeText(value);
  if (!raw) return { valid: true, value: null };

  const parsed = Number(raw.replace("%", ""));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return { valid: false, value: null };
  }

  return { valid: true, value: parsed };
}

function normalizeSubjectNumber(value) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, "");
}

function resolveALSubject(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const byNumber = AL_SUBJECTS_BY_NUMBER[normalizeSubjectNumber(raw)];
  if (byNumber) return byNumber;

  const byName = AL_SUBJECTS_BY_NAME[normalizeLower(raw)];
  if (byName) return byName;

  return null;
}

function getSubjectIdentityFromEnrollment(enrollment = {}) {
  return {
    subjectId: getEnrollmentSubjectId(enrollment),
    subjectName: getEnrollmentSubjectName(enrollment),
    subjectNumber: getEnrollmentSubjectNumber(enrollment),
  };
}

function resolveSubjectFromEnrollments(value, enrollments = []) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const rawNumber = normalizeSubjectNumber(raw);
  const rawLower = normalizeLower(raw);
  const rawSubjectId = rawNumber.startsWith("AL_") ? rawNumber : `AL_${rawNumber}`;

  const match = enrollments.find((enrollment) => {
    const subject = getSubjectIdentityFromEnrollment(enrollment);
    return (
      normalizeSubjectNumber(subject.subjectNumber) === rawNumber ||
      normalizeSubjectNumber(subject.subjectId) === rawNumber ||
      normalizeSubjectNumber(subject.subjectId) === rawSubjectId ||
      normalizeLower(subject.subjectName) === rawLower
    );
  });

  return match ? getSubjectIdentityFromEnrollment(match) : null;
}

function getTeacherSheetColumnIndex(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeLoose);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeLoose(header)));
}

function getTeacherSheetSubjectPairs(headers) {
  const pairs = [];

  headers.forEach((header, index) => {
    const loose = normalizeLoose(header);
    const isSubjectColumn =
      loose.includes("subject") && !loose.includes("stream") && !loose.includes("code");
    if (!isSubjectColumn) return;

    const marksIndex = headers.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index && normalizeLoose(candidate) === "marks"
    );

    if (marksIndex > index) {
      pairs.push({ subjectIndex: index, marksIndex });
    }
  });

  return pairs;
}

function isTeacherMarksSheet(headers = []) {
  const looseHeaders = headers.map(normalizeLoose);
  return (
    looseHeaders.includes("studentid") &&
    looseHeaders.some((header) => ["alclassname", "alclass"].includes(header)) &&
    getTeacherSheetSubjectPairs(headers).length > 0
  );
}

function getStudentLookupKeys(student = {}) {
  return [
    student.id,
    student.studentId,
    student.emisStudentId,
    student.emisId,
    student.externalStudentId,
    student.indexNo,
    student.indexNumber,
    student.admissionNo,
    student.admissionNumber,
    student.admNo,
  ]
    .map(normalizeText)
    .filter(Boolean);
}

function buildStudentLookup(students = []) {
  const lookup = new Map();
  students.forEach((student) => {
    getStudentLookupKeys(student).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, student);
    });
  });
  return lookup;
}

function subjectsMatch(left = {}, right = {}) {
  return (
    (normalizeText(left.subjectId) &&
      normalizeText(left.subjectId) === normalizeText(right.subjectId)) ||
    (normalizeSubjectNumber(left.subjectNumber) &&
      normalizeSubjectNumber(left.subjectNumber) === normalizeSubjectNumber(right.subjectNumber)) ||
    (normalizeLower(left.subjectName) &&
      normalizeLower(left.subjectName) === normalizeLower(right.subjectName))
  );
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

function validateTeacherMarksSheetRows({
  rows,
  studentsByUploadId,
  selectedEnrollments,
  selectedClass,
  selectedTerm,
  selectedYear,
}) {
  const validRows = [];
  const invalidRows = [];
  const seenKeys = new Set();
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);
  const subjectPairs = getTeacherSheetSubjectPairs(headers);

  const studentIdIndex = getTeacherSheetColumnIndex(headers, ["StudentID", "Student ID"]);
  const admissionNoIndex = getTeacherSheetColumnIndex(headers, ["Admission No", "AdmissionNo"]);
  const nameIndex = getTeacherSheetColumnIndex(headers, ["Name", "Student Name"]);
  const gradeIndex = getTeacherSheetColumnIndex(headers, ["Grade"]);
  const sectionIndex = getTeacherSheetColumnIndex(headers, ["Section"]);
  const streamIndex = getTeacherSheetColumnIndex(headers, ["Stream"]);
  const attendanceIndex = getTeacherSheetColumnIndex(headers, [
    "Attendance",
    "Attendance %",
    "Attendance Percent",
    "Attendance Percentage",
  ]);
  const alClassNameIndex = getTeacherSheetColumnIndex(headers, [
    "A/L Class Name",
    "AL Class Name",
    "A/L Class",
  ]);

  const enrollmentsByStudentId = selectedEnrollments.reduce((map, enrollment) => {
    const studentId = normalizeText(enrollment.studentId);
    if (!studentId) return map;
    if (!map.has(studentId)) map.set(studentId, []);
    map.get(studentId).push(enrollment);
    return map;
  }, new Map());

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const hasAnyValue = row.some((cell) => normalizeText(cell));
    if (!hasAnyValue) return;

    const uploadedStudentId = normalizeText(row[studentIdIndex]);
    const student = studentsByUploadId.get(uploadedStudentId) || null;
    const studentId = normalizeText(student?.id || uploadedStudentId);
    const studentName = normalizeText(
      pickValue(student?.name, student?.fullName, row[nameIndex], "Unnamed Student")
    );
    const indexNo = normalizeText(
      pickValue(student?.indexNo, student?.indexNumber, row[admissionNoIndex], "")
    );
    const admissionNo = normalizeText(
      pickValue(student?.admissionNo, student?.admissionNumber, row[admissionNoIndex], "")
    );
    const grade = parseGrade(pickValue(row[gradeIndex], student?.grade, ""));
    const section = normalizeSection(pickValue(row[sectionIndex], student?.section, ""));
    const stream = normalizeText(pickValue(row[streamIndex], student?.stream, ""));
    const attendanceResult = parsePercentageValue(attendanceIndex >= 0 ? row[attendanceIndex] : "");
    const sheetClassName = normalizeText(row[alClassNameIndex]);

    subjectPairs.forEach(({ subjectIndex, marksIndex }) => {
      const rawSubject = normalizeText(row[subjectIndex]);
      const rawMarks = row[marksIndex];
      const hasMarks = normalizeText(rawMarks) !== "";

      if (!rawSubject && !hasMarks) return;
      if (!hasMarks) return;

      const reasons = [];
      if (!uploadedStudentId) reasons.push("Missing StudentID");
      if (uploadedStudentId && !student) reasons.push("StudentID does not exist");

      if (sheetClassName && normalizeLower(sheetClassName) !== normalizeLower(selectedClass)) {
        reasons.push("A/L Class Name does not match selected class");
      }

      const enrolledSubject = resolveSubjectFromEnrollments(
        rawSubject,
        student ? enrollmentsByStudentId.get(student.id) || [] : selectedEnrollments
      );
      const catalogSubject = resolveALSubject(rawSubject);
      const subject = enrolledSubject || catalogSubject;
      if (!subject) {
        reasons.push(`Unknown A/L subject: ${rawSubject || "(blank)"}`);
      }

      const marksResult = parseTeacherSheetMarkValue(rawMarks);
      if (!marksResult.valid) {
        reasons.push("Marks must be numeric, AB, or empty");
      }
      if (!attendanceResult.valid) {
        reasons.push("Attendance percentage must be between 0 and 100");
      }

      const matchingEnrollment =
        subject && student
          ? (enrollmentsByStudentId.get(student.id) || []).find((enrollment) =>
              subjectsMatch(
                getSubjectIdentityFromEnrollment(enrollment),
                {
                  subjectName: subject.subjectName,
                  subjectNumber: subject.subjectNumber,
                  subjectId: subject.subjectId || subject.subjectCode,
                }
              )
            )
          : null;

      if (student && subject && !matchingEnrollment) {
        reasons.push("student is not enrolled in this subject for the selected class/year");
      }

      const dedupeKey = `${studentId}__${subject?.subjectNumber || rawSubject}`;
      if (seenKeys.has(dedupeKey)) {
        reasons.push("duplicate student/subject mark in uploaded file");
      }

      const rowData = {
        rowNumber,
        studentId,
        uploadedStudentId,
        indexNo,
        admissionNo,
        studentName,
        marks: marksResult.marks,
        absent: marksResult.absent,
        subjectId: normalizeText(matchingEnrollment?.subjectId || subject?.subjectId || subject?.subjectCode || ""),
        subjectName: normalizeText(matchingEnrollment?.subjectName || subject?.subjectName || rawSubject),
        subjectNumber: normalizeText(matchingEnrollment?.subjectNumber || subject?.subjectNumber || ""),
        className: selectedClass,
        fullClassName: selectedClass,
        alClassName: selectedClass,
        grade: grade || parseGrade(matchingEnrollment?.grade),
        section: section || getEnrollmentSection(matchingEnrollment),
        stream: stream || getEnrollmentStream(matchingEnrollment),
        attendancePercentage: attendanceResult.value,
        term: selectedTerm,
        academicYear: String(selectedYear),
        sourceFormat: "teacherSheet",
      };

      if (!reasons.length) {
        seenKeys.add(dedupeKey);
        validRows.push(rowData);
      } else {
        invalidRows.push({
          ...rowData,
          marks: rawMarks,
          subjectName: subject?.subjectName || rawSubject,
          reasons,
        });
      }
    });
  });

  return { validRows, invalidRows };
}

export default function BulkMarksUpload() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingMarks, setDeletingMarks] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
  const [uploadedFormat, setUploadedFormat] = useState("");

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

  const studentsByUploadId = useMemo(() => {
    return buildStudentLookup(allStudents);
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

  const availableTerms = useMemo(() => {
    const filtered = allTerms
      .filter((term) => !selectedYear || String(term.year || term.academicYear || "") === String(selectedYear))
      .map((term) => normalizeText(term.term || term.termName || term.name))
      .filter(Boolean);

    const uniqueTerms = uniqueSorted(filtered);

    if (selectedTerm && !uniqueTerms.includes(selectedTerm)) {
      return [selectedTerm, ...uniqueTerms];
    }

    return uniqueTerms;
  }, [allTerms, selectedYear, selectedTerm]);

  const availableClasses = useMemo(() => {
    const filtered = allEnrollments.filter(
      (enrollment) =>
        !selectedYear ||
        !getEnrollmentAcademicYear(enrollment) ||
        getEnrollmentAcademicYear(enrollment) === String(selectedYear)
    );

    return uniqueSorted(
      filtered.map((enrollment) =>
        getEnrollmentClassName(enrollment, studentsById.get(normalizeText(enrollment.studentId)))
      )
    );
  }, [allEnrollments, selectedYear, studentsById]);

  const availableSubjects = useMemo(() => {
    const filtered = allEnrollments.filter((enrollment) => {
      const sameYear =
        !selectedYear ||
        !getEnrollmentAcademicYear(enrollment) ||
        getEnrollmentAcademicYear(enrollment) === String(selectedYear);

      const sameClass =
        !selectedClass ||
        getEnrollmentClassName(enrollment, studentsById.get(normalizeText(enrollment.studentId))) ===
          selectedClass;

      return sameYear && sameClass;
    });

    return uniqueSorted(filtered.map((enrollment) => getEnrollmentSubjectName(enrollment)));
  }, [allEnrollments, selectedYear, selectedClass, studentsById]);

  const selectedEnrollments = useMemo(() => {
    return allEnrollments.filter((enrollment) => {
      const sameYear =
        !selectedYear ||
        !getEnrollmentAcademicYear(enrollment) ||
        getEnrollmentAcademicYear(enrollment) === String(selectedYear);

      const sameClass =
        !selectedClass ||
        getEnrollmentClassName(enrollment, studentsById.get(normalizeText(enrollment.studentId))) ===
          selectedClass;

      const sameSubject =
        !selectedSubject || getEnrollmentSubjectName(enrollment) === selectedSubject;

      return sameYear && sameClass && sameSubject;
    });
  }, [allEnrollments, selectedYear, selectedClass, selectedSubject, studentsById]);

  const selectedSubjectId = useMemo(() => {
    const found = selectedEnrollments.find((enrollment) => getEnrollmentSubjectId(enrollment));
    return found ? getEnrollmentSubjectId(found) : "";
  }, [selectedEnrollments]);

  const selectedSubjectNumber = useMemo(() => {
    const found = selectedEnrollments.find((enrollment) => getEnrollmentSubjectNumber(enrollment));
    return found ? getEnrollmentSubjectNumber(found) : "";
  }, [selectedEnrollments]);

  const validEnrollmentKeys = useMemo(() => {
    const keys = new Set();

    selectedEnrollments.forEach((enrollment) => {
      keys.add(
        buildEnrollmentKey({
          studentId: enrollment.studentId,
          subjectId: getEnrollmentSubjectId(enrollment),
          subjectName: getEnrollmentSubjectName(enrollment),
          className: getEnrollmentClassName(
            enrollment,
            studentsById.get(normalizeText(enrollment.studentId))
          ),
          academicYear: getEnrollmentAcademicYear(enrollment),
        })
      );
    });

    return keys;
  }, [selectedEnrollments, studentsById]);

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
    setUploadedFormat("");
    setSuccess("");
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

    if (!selectedClass || !selectedTerm || !selectedYear) {
      setError("Select academic year, class, and term before uploading.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadedFileName(file.name);
    setValidRows([]);
    setInvalidRows([]);
    setRawUploadedRows([]);
    setUploadedFormat("");
    setSuccess("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        throw new Error("No worksheet found in uploaded file.");
      }

      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      const headers = sheetRows[0] || [];

      if (isTeacherMarksSheet(headers)) {
        const result = validateTeacherMarksSheetRows({
          rows: sheetRows,
          studentsByUploadId,
          selectedEnrollments,
          selectedClass,
          selectedTerm,
          selectedYear,
        });

        setUploadedFormat("teacherSheet");
        setRawUploadedRows(sheetRows.slice(1).filter((row) => row.some((cell) => normalizeText(cell))));
        setValidRows(result.validRows);
        setInvalidRows(result.invalidRows);
        return;
      }

      if (!selectedSubject) {
        throw new Error("Select a subject before uploading the standard template.");
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
      setUploadedFormat("standardTemplate");

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

  async function handleSaveValidRows() {
    if (!validRows.length) {
      setError("No valid rows to save.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const marksSnap = await getDocs(collection(db, "marks"));
      const existingMarks = marksSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      const currentUser = auth.currentUser;
      const teacherName = currentUser?.displayName || currentUser?.email || "Bulk Upload";

      for (let i = 0; i < validRows.length; i += MAX_BATCH_WRITES) {
        const batch = writeBatch(db);
        const chunk = validRows.slice(i, i + MAX_BATCH_WRITES);

        chunk.forEach((row) => {
          const existing = existingMarks.find((markDoc) => {
            const sameStudent = normalizeText(markDoc.studentId) === normalizeText(row.studentId);
            const sameClass =
              normalizeLower(
                markDoc.alClassName || markDoc.fullClassName || markDoc.className
              ) === normalizeLower(row.fullClassName || row.className);
            const sameTerm =
              normalizeLower(markDoc.termName || markDoc.term) === normalizeLower(row.term);
            const sameYear =
              String(markDoc.academicYear || markDoc.year || "") ===
              String(row.academicYear);
            const sameAssessment = !normalizeText(markDoc.practiceExamId || markDoc.assessmentId);
            const sameSubject = subjectsMatch(
              {
                subjectId: markDoc.subjectId,
                subjectName: markDoc.subjectName || markDoc.subject,
                subjectNumber: markDoc.subjectNumber,
              },
              {
                subjectId: row.subjectId,
                subjectName: row.subjectName,
                subjectNumber: row.subjectNumber,
              }
            );

            return sameStudent && sameClass && sameSubject && sameTerm && sameYear && sameAssessment;
          });

          const markValue = row.absent ? null : row.marks;
          const payload = {
            studentId: row.studentId,
            studentName: row.studentName,
            admissionNo: row.admissionNo || "",
            indexNo: row.indexNo || "",
            className: row.className || "",
            fullClassName: row.fullClassName || row.className || "",
            alClassName: row.alClassName || "",
            grade: row.grade || "",
            section: row.section || "",
            stream: row.stream || "",
            attendancePercentage: row.attendancePercentage ?? null,
            subjectId: row.subjectId || "",
            subjectName: row.subjectName,
            subject: row.subjectName,
            subjectNumber: row.subjectNumber || "",
            term: row.term,
            termName: row.term,
            academicYear: row.academicYear,
            year: row.academicYear,
            assessmentType: "term",
            assessmentId: "",
            assessmentName: "",
            practiceExamId: "",
            practiceExamName: "",
            mark: markValue,
            marks: markValue,
            score: markValue,
            absent: Boolean(row.absent),
            isAbsent: Boolean(row.absent),
            teacherId: currentUser?.uid || "",
            teacherName,
            uploadSource: uploadedFormat || "bulkUpload",
            updatedAt: serverTimestamp(),
          };

          if (existing?.id) {
            batch.set(doc(db, "marks", existing.id), payload, { merge: true });
          } else {
            batch.set(doc(collection(db, "marks")), {
              ...payload,
              createdAt: serverTimestamp(),
            });
          }
        });

        await batch.commit();
      }

      setSuccess(`Saved ${validRows.length} mark row${validRows.length === 1 ? "" : "s"} successfully.`);
      setValidRows([]);
      setInvalidRows([]);
      setRawUploadedRows([]);
      setUploadedFileName("");
      setUploadedFormat("");
    } catch (err) {
      console.error("Bulk save error:", err);
      setError(err.message || "Failed to save uploaded marks.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelectedSubjectMarks() {
    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedYear) {
      setError("Select year, class, subject, and term before deleting marks.");
      return;
    }

    const confirmed = window.confirm(
      `Delete all saved marks for ${selectedSubject} in ${selectedClass}, ${selectedTerm}, ${selectedYear}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingMarks(true);
    setError("");
    setSuccess("");

    try {
      const marksSnap = await getDocs(collection(db, "marks"));
      const matchingDocs = marksSnap.docs.filter((docSnap) => {
        const markDoc = docSnap.data();
        const markClass = markDoc.alClassName || markDoc.fullClassName || markDoc.className || "";
        const markTerm = markDoc.termName || markDoc.term || "";
        const markYear = String(markDoc.academicYear || markDoc.year || "");
        const sameClass = normalizeLower(markClass) === normalizeLower(selectedClass);
        const sameTerm = normalizeLower(markTerm) === normalizeLower(selectedTerm);
        const sameYear = markYear === String(selectedYear);
        const sameAssessment = !normalizeText(markDoc.practiceExamId || markDoc.assessmentId);
        const sameSubject = subjectsMatch(
          {
            subjectId: markDoc.subjectId,
            subjectName: markDoc.subjectName || markDoc.subject,
            subjectNumber: markDoc.subjectNumber,
          },
          {
            subjectId: selectedSubjectId,
            subjectName: selectedSubject,
            subjectNumber: selectedSubjectNumber,
          }
        );

        return sameClass && sameTerm && sameYear && sameAssessment && sameSubject;
      });

      for (let i = 0; i < matchingDocs.length; i += MAX_BATCH_WRITES) {
        const batch = writeBatch(db);
        matchingDocs.slice(i, i + MAX_BATCH_WRITES).forEach((docSnap) => {
          batch.delete(doc(db, "marks", docSnap.id));
        });
        await batch.commit();
      }

      setSuccess(
        `Deleted ${matchingDocs.length} saved mark row${matchingDocs.length === 1 ? "" : "s"} for ${selectedSubject}. You can re-upload now.`
      );
      setValidRows([]);
      setInvalidRows([]);
      setRawUploadedRows([]);
      setUploadedFileName("");
      setUploadedFormat("");
    } catch (err) {
      console.error("Bulk delete marks error:", err);
      setError(err.message || "Failed to delete selected marks.");
    } finally {
      setDeletingMarks(false);
    }
  }

  const canDownload =
    selectedClass &&
    selectedSubject &&
    selectedTerm &&
    selectedYear &&
    previewRows.length > 0 &&
    !downloading;

  const canDeleteSelectedMarks =
    selectedClass &&
    selectedSubject &&
    selectedTerm &&
    selectedYear &&
    !loading &&
    !uploading &&
    !saving &&
    !deletingMarks;

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

        {success && (
          <Alert severity="success" onClose={() => setSuccess("")}>
            {success}
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
                    {availableTerms.map((term) => (
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
                    saving ||
                    !selectedClass ||
                    !selectedTerm ||
                    !selectedYear
                  }
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                  fullWidth={isMobile}
                >
                  {uploading ? "Reading File..." : "Upload Completed Excel / Teacher Sheet"}
                  <input
                    hidden
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                </Button>
              </Grid>

              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={
                    deletingMarks ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon />
                  }
                  onClick={handleDeleteSelectedSubjectMarks}
                  disabled={!canDeleteSelectedMarks}
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                  fullWidth={isMobile}
                >
                  {deletingMarks ? "Deleting..." : "Delete Selected Subject Marks"}
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
              <Chip label={`Subject: ${selectedSubject || "Auto from teacher sheet"}`} />
              <Chip label={`Term: ${selectedTerm || "-"}`} />
              <Chip color="primary" label={`Template Rows: ${previewRows.length}`} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Standard template columns:{" "}
              <strong>
                studentId, indexNo, studentName, marks, absent, subjectId, subjectName,
                className, term, academicYear
              </strong>
              . Teacher A/L sheets are also supported when they include StudentID,
              A/L Class Name, subject columns, and Marks columns.
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
                <Chip label={`Format: ${uploadedFormat === "teacherSheet" ? "Teacher A/L sheet" : "Standard template"}`} />
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
                Only valid rows will be saved. Teacher sheets can contain multiple subjects
                in one file.
              </Typography>

              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
                onClick={handleSaveValidRows}
                disabled={saving || uploading || validRows.length === 0}
                sx={{ bgcolor: "#1a237e", borderRadius: 2, fontWeight: 700, width: "fit-content" }}
              >
                {saving ? "Saving..." : `Save ${validRows.length} Valid Row${validRows.length === 1 ? "" : "s"}`}
              </Button>
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
