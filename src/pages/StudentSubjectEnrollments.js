import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  Divider,
  Stack,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import PreviewIcon from "@mui/icons-material/Preview";
import SchoolIcon from "@mui/icons-material/School";
import {
  RELIGIONS,
  COMPULSORY_CORE_6_9,
  COMPULSORY_CORE_10_11,
  getBasketChoiceFields,
  getStudentName,
  getStudentAdmissionNo,
  getStudentGrade,
  getStudentSection,
  getStudentClassName,
  getStudentStream,
  getStudentALClassName,
  normalizeText,
  normalizeLower,
  normalizeLoose,
  isActiveStatus,
  isALGrade,
  AL_STREAM_OPTIONS,
  AL_STREAM_CODES,
  buildALClassName,
  buildALDisplayClassName,
  validateALChoices,
  buildALSubjectPayloadFromStudent,
  getALStreamShortName,
} from "../constants";

const BATCH_LIMIT = 400;

const SUBJECT_COLLECTION = "subjects";
const STUDENT_COLLECTION = "students";
const ENROLLMENT_COLLECTION = "studentSubjectEnrollments";

const initialFilters = {
  academicYear: String(new Date().getFullYear()),
  grade: "",
  section: "",
  stream: "",
  selectedStudentIds: [],
  onlyActiveStudents: true,
  replaceExistingForScope: false,
};

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

function isActiveLike(value) {
  if (!normalizeText(value)) return true;
  return normalizeLower(value) === "active";
}

function uniqueByKey(items = [], keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function subjectAppliesToGrade(subject, grade) {
  if (!grade) return false;

  const directGrade = parseGrade(subject?.grade);
  if (directGrade) return directGrade === grade;

  const grades = Array.isArray(subject?.grades)
    ? subject.grades.map(parseGrade).filter(Boolean)
    : [];
  if (grades.length) return grades.includes(grade);

  const minGrade = parseGrade(subject?.minGrade);
  const maxGrade = parseGrade(subject?.maxGrade);

  if (minGrade || maxGrade) {
    const min = minGrade || -Infinity;
    const max = maxGrade || Infinity;
    return grade >= min && grade <= max;
  }

  return true;
}

function getSubjectName(subject) {
  return normalizeText(subject?.name || subject?.subjectName || "");
}

function getSubjectCode(subject) {
  return normalizeText(subject?.code || subject?.subjectCode || "");
}

function getSubjectCategory(subject) {
  return normalizeText(subject?.category || subject?.subjectCategory || "");
}

function getSubjectNumber(subject) {
  return normalizeText(subject?.subjectNumber || "");
}

function canonicalEnrollmentId({ academicYear, studentId, subjectId }) {
  return `${normalizeAcademicYear(academicYear)}_${studentId}_${subjectId}`;
}

async function commitSetInChunks(payloads = []) {
  for (let i = 0; i < payloads.length; i += BATCH_LIMIT) {
    const chunk = payloads.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach(({ id, data }) => {
      batch.set(doc(db, ENROLLMENT_COLLECTION, id), data, { merge: true });
    });

    await batch.commit();
  }
}

async function commitDeleteInChunks(ids = []) {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((id) => {
      batch.delete(doc(db, ENROLLMENT_COLLECTION, id));
    });

    await batch.commit();
  }
}

function sortStudentsClientSide(list) {
  return [...list].sort((a, b) => {
    const gradeA = getStudentGrade(a);
    const gradeB = getStudentGrade(b);
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = getStudentSection(a);
    const sectionB = getStudentSection(b);
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const streamA = getStudentStream(a);
    const streamB = getStudentStream(b);
    if (streamA !== streamB) return streamA.localeCompare(streamB);

    const nameA = getStudentName(a).toLowerCase();
    const nameB = getStudentName(b).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return getStudentAdmissionNo(a).localeCompare(getStudentAdmissionNo(b));
  });
}

function sortEnrollments(list) {
  return [...list].sort((a, b) => {
    const gradeA = parseGrade(a.grade);
    const gradeB = parseGrade(b.grade);
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = normalizeSection(a.section || a.className);
    const sectionB = normalizeSection(b.section || b.className);
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const streamA = normalizeText(a.stream);
    const streamB = normalizeText(b.stream);
    if (streamA !== streamB) return streamA.localeCompare(streamB);

    const nameA = normalizeText(a.studentName).toLowerCase();
    const nameB = normalizeText(b.studentName).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return normalizeText(a.subjectName).localeCompare(normalizeText(b.subjectName));
  });
}

function getCategoryLabel(value) {
  const labels = {
    religion: "Religion",
    aesthetic: "Aesthetic",
    basket_a: "Basket A",
    basket_b: "Basket B",
    basket_c: "Basket C",
    al_main: "A/L Main",
    general: "General",
    core: "Core",
  };
  return labels[value] || value || "—";
}

function buildStudentDisplay(student) {
  const grade = getStudentGrade(student);
  const section = getStudentSection(student);
  const stream = getStudentStream(student);
  const name = getStudentName(student);
  const admissionNo = getStudentAdmissionNo(student);

  if (isALGrade(grade)) {
    const displayClass =
      buildALDisplayClassName(grade, stream, section) ||
      buildALClassName(grade, stream, section) ||
      `${grade} ${section}`;
    return `${name}${admissionNo ? ` (${admissionNo})` : ""} - ${displayClass}`;
  }

  return `${name}${admissionNo ? ` (${admissionNo})` : ""} - Grade ${grade}${section ? ` ${section}` : ""}`;
}

function buildSubjectIndexes(subjects) {
  const activeSubjects = subjects.filter((subject) => isActiveLike(subject.status));

  const byId = new Map();
  const byNameLoose = new Map();
  const byCodeLower = new Map();
  const byNumber = new Map();
  const byCategory = new Map();

  activeSubjects.forEach((subject) => {
    byId.set(subject.id, subject);

    const nameLoose = normalizeLoose(getSubjectName(subject));
    if (nameLoose && !byNameLoose.has(nameLoose)) {
      byNameLoose.set(nameLoose, subject);
    }

    const codeLower = normalizeLower(getSubjectCode(subject));
    if (codeLower && !byCodeLower.has(codeLower)) {
      byCodeLower.set(codeLower, subject);
    }

    const subjectNumber = getSubjectNumber(subject);
    if (subjectNumber && !byNumber.has(subjectNumber)) {
      byNumber.set(subjectNumber, subject);
    }

    const category = getSubjectCategory(subject);
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category).push(subject);
  });

  return {
    activeSubjects,
    byId,
    byNameLoose,
    byCodeLower,
    byNumber,
    byCategory,
  };
}

function findSubjectByNameAndCategory(indexes, name, category, grade) {
  const candidates = (indexes.byCategory.get(category) || []).filter((subject) =>
    subjectAppliesToGrade(subject, grade)
  );

  const nameKey = normalizeLoose(name);

  const exact = candidates.find(
    (subject) => normalizeLoose(getSubjectName(subject)) === nameKey
  );
  if (exact) return exact;

  return null;
}

function findReligionSubject(indexes, religionName, grade) {
  const target = normalizeLoose(religionName);
  const candidates = (indexes.byCategory.get("religion") || []).filter((subject) =>
    subjectAppliesToGrade(subject, grade)
  );

  return (
    candidates.find(
      (subject) =>
        normalizeLoose(subject.religion || subject.religionGroup || getSubjectName(subject)) ===
        target
    ) || null
  );
}

function findAestheticSubject(indexes, aestheticName, grade) {
  return findSubjectByNameAndCategory(indexes, aestheticName, "aesthetic", grade);
}

function findBasketSubject(indexes, basketName, basketGroup, grade) {
  const categoryMap = {
    A: "basket_a",
    B: "basket_b",
    C: "basket_c",
  };
  return findSubjectByNameAndCategory(
    indexes,
    basketName,
    categoryMap[basketGroup] || "",
    grade
  );
}

function findALSubject(indexes, subjectLike, grade, stream) {
  const candidates = (indexes.byCategory.get("al_main") || []).filter((subject) =>
    subjectAppliesToGrade(subject, grade)
  );

  if (subjectLike?.subjectNumber) {
    const byNumber = candidates.find(
      (subject) => getSubjectNumber(subject) === normalizeText(subjectLike.subjectNumber)
    );
    if (byNumber) return byNumber;
  }

  const nameKey = normalizeLoose(subjectLike?.subjectName || "");
  const streamName = normalizeText(stream);

  const streamMatched = candidates.find((subject) => {
    const subjectNameMatch = normalizeLoose(getSubjectName(subject)) === nameKey;
    if (!subjectNameMatch) return false;

    const primaryStream = normalizeText(subject.stream);
    const streams = Array.isArray(subject.streams)
      ? subject.streams.map(normalizeText).filter(Boolean)
      : [];
    const allowedStreams = uniqueByKey(
      [primaryStream, ...streams].filter(Boolean),
      (x) => x
    );

    if (!allowedStreams.length) return true;
    return allowedStreams.includes(streamName);
  });

  if (streamMatched) return streamMatched;

  return candidates.find(
    (subject) => normalizeLoose(getSubjectName(subject)) === nameKey
  ) || null;
}

function buildEnrollmentRecord({
  academicYear,
  student,
  subject,
  subjectCategory,
  stream = "",
  generatedBy = "system",
}) {
  const grade = getStudentGrade(student);
  const section = getStudentSection(student);
  const studentName = getStudentName(student);
  const admissionNo = getStudentAdmissionNo(student);
  const className = getStudentClassName(student);
  const medium = normalizeText(student?.medium || "");
  const religionKey = normalizeText(student?.religion || "");
  const basketGroup = normalizeText(subject?.basketGroup || "");
  const subjectName = getSubjectName(subject);
  const subjectCode = getSubjectCode(subject);
  const subjectNumber = getSubjectNumber(subject);
  const streamValue = normalizeText(stream || getStudentStream(student));
  const streamCode = AL_STREAM_CODES[streamValue] || "";
  const alClassName = isALGrade(grade)
    ? getStudentALClassName(student) || buildALClassName(grade, streamValue, section)
    : "";

  const id = canonicalEnrollmentId({
    academicYear,
    studentId: student.id,
    subjectId: subject.id,
  });

  return {
    id,
    data: {
      studentId: student.id,
      studentName,
      admissionNo,

      grade,
      section,
      className,

      academicYear: normalizeAcademicYear(academicYear),

      subjectCategory: normalizeText(subjectCategory || getSubjectCategory(subject)),
      subjectId: subject.id,
      subjectName,
      subjectCode,
      subjectNumber,

      medium,
      stream: streamValue,
      streamCode,
      alClassName,

      religionKey,
      basketGroup,

      generatedBy,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function buildStudentEnrollmentPlan(student, indexes, academicYear) {
  const grade = getStudentGrade(student);
  const religion = normalizeText(student?.religion);
  const aesthetic = normalizeText(student?.aesthetic || student?.aestheticChoice);
  const basketChoices = getBasketChoiceFields(student);
  const stream = getStudentStream(student);

  const planned = [];
  const warnings = [];

  const addSubjectRecord = (subject, category) => {
    if (!subject) return;
    planned.push(
      buildEnrollmentRecord({
        academicYear,
        student,
        subject,
        subjectCategory: category,
        stream,
      })
    );
  };

  if (grade >= 6 && grade <= 9) {
    COMPULSORY_CORE_6_9.forEach((coreName) => {
      const subject = findSubjectByNameAndCategory(indexes, coreName, "core", grade);
      if (!subject) {
        warnings.push(`${getStudentName(student)}: core subject missing -> ${coreName}`);
        return;
      }
      addSubjectRecord(subject, "core");
    });

    if (religion) {
      const religionSubject = findReligionSubject(indexes, religion, grade);
      if (religionSubject) {
        addSubjectRecord(religionSubject, "religion");
      } else {
        warnings.push(`${getStudentName(student)}: religion subject missing -> ${religion}`);
      }
    }

    if (aesthetic) {
      const aestheticSubject = findAestheticSubject(indexes, aesthetic, grade);
      if (aestheticSubject) {
        addSubjectRecord(aestheticSubject, "aesthetic");
      } else {
        warnings.push(`${getStudentName(student)}: aesthetic subject missing -> ${aesthetic}`);
      }
    }
  } else if (grade >= 10 && grade <= 11) {
    COMPULSORY_CORE_10_11.forEach((coreName) => {
      const subject = findSubjectByNameAndCategory(indexes, coreName, "core", grade);
      if (!subject) {
        warnings.push(`${getStudentName(student)}: core subject missing -> ${coreName}`);
        return;
      }
      addSubjectRecord(subject, "core");
    });

    if (religion) {
      const religionSubject = findReligionSubject(indexes, religion, grade);
      if (religionSubject) {
        addSubjectRecord(religionSubject, "religion");
      } else {
        warnings.push(`${getStudentName(student)}: religion subject missing -> ${religion}`);
      }
    }

    if (basketChoices.A) {
      const basketA = findBasketSubject(indexes, basketChoices.A, "A", grade);
      if (basketA) {
        addSubjectRecord(basketA, "basket_a");
      } else {
        warnings.push(`${getStudentName(student)}: basket A subject missing -> ${basketChoices.A}`);
      }
    }

    if (basketChoices.B) {
      const basketB = findBasketSubject(indexes, basketChoices.B, "B", grade);
      if (basketB) {
        addSubjectRecord(basketB, "basket_b");
      } else {
        warnings.push(`${getStudentName(student)}: basket B subject missing -> ${basketChoices.B}`);
      }
    }

    if (basketChoices.C) {
      const basketC = findBasketSubject(indexes, basketChoices.C, "C", grade);
      if (basketC) {
        addSubjectRecord(basketC, "basket_c");
      } else {
        warnings.push(`${getStudentName(student)}: basket C subject missing -> ${basketChoices.C}`);
      }
    }
  } else if (isALGrade(grade)) {
    const validation = validateALChoices({
      grade,
      stream,
      choiceNumbers: student?.alSubjectChoiceNumbers || [],
      choiceNames: student?.alSubjectChoices || [],
    });

    if (!stream) {
      warnings.push(`${getStudentName(student)}: A/L stream missing`);
      return { planned: [], warnings };
    }

    if (!validation.valid) {
      warnings.push(`${getStudentName(student)}: ${validation.reason}`);
      return { planned: [], warnings };
    }

    const payload = buildALSubjectPayloadFromStudent(student);
    if (!payload.valid) {
      warnings.push(`${getStudentName(student)}: ${payload.reason}`);
      return { planned: [], warnings };
    }

    payload.mainSubjects.forEach((subjectLike) => {
      const subject = findALSubject(indexes, subjectLike, grade, stream);
      if (subject) {
        addSubjectRecord(subject, "al_main");
      } else {
        warnings.push(
          `${getStudentName(student)}: A/L subject missing -> ${subjectLike.subjectName || subjectLike.subjectNumber}`
        );
      }
    });

    payload.generalSubjects.forEach((subjectLike) => {
      const subject = findALSubject(indexes, subjectLike, grade, stream);
      if (subject) {
        addSubjectRecord(subject, "general");
      } else {
        warnings.push(
          `${getStudentName(student)}: general subject missing -> ${subjectLike.subjectName || subjectLike.subjectNumber}`
        );
      }
    });
  }

  return {
    planned: uniqueByKey(planned, (item) => item.id),
    warnings,
  };
}

function buildScopeLabel(filters) {
  const parts = [normalizeAcademicYear(filters.academicYear)];

  if (filters.grade) parts.push(`Grade ${filters.grade}`);
  if (filters.section) parts.push(`Section ${filters.section}`);
  if (filters.stream) parts.push(filters.stream);

  return parts.join(" • ");
}

export default function GenerateSubjectEnrollments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState(initialFilters);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewWarnings, setPreviewWarnings] = useState([]);

  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const indexes = useMemo(() => buildSubjectIndexes(subjects), [subjects]);

  const gradeOptions = useMemo(() => {
    return [...new Set(students.map((s) => getStudentGrade(s)).filter(Boolean))].sort(
      (a, b) => a - b
    );
  }, [students]);

  const sectionOptions = useMemo(() => {
    const source = filters.grade
      ? students.filter((s) => String(getStudentGrade(s)) === String(filters.grade))
      : students;

    return [...new Set(source.map((s) => getStudentSection(s)).filter(Boolean))].sort();
  }, [students, filters.grade]);

  const streamOptions = useMemo(() => {
    const source = students.filter((student) => isALGrade(getStudentGrade(student)));
    const fromData = [...new Set(source.map((s) => getStudentStream(s)).filter(Boolean))];
    return uniqueByKey([...AL_STREAM_OPTIONS, ...fromData], (x) => x);
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const grade = getStudentGrade(student);
      const section = getStudentSection(student);
      const stream = getStudentStream(student);

      if (filters.onlyActiveStudents && !isActiveStatus(student?.status || "Active")) {
        return false;
      }

      if (filters.grade && String(grade) !== String(filters.grade)) {
        return false;
      }

      if (filters.section && normalizeSection(filters.section) !== section) {
        return false;
      }

      if (filters.stream && normalizeText(filters.stream) !== stream) {
        return false;
      }

      if (
        Array.isArray(filters.selectedStudentIds) &&
        filters.selectedStudentIds.length > 0 &&
        !filters.selectedStudentIds.includes(student.id)
      ) {
        return false;
      }

      return true;
    });
  }, [students, filters]);

  const existingEnrollmentIdsInScope = useMemo(() => {
    const academicYear = normalizeAcademicYear(filters.academicYear);
    const studentIdSet = new Set(filteredStudents.map((s) => s.id));

    return enrollments
      .filter(
        (item) =>
          normalizeAcademicYear(item.academicYear) === academicYear &&
          studentIdSet.has(item.studentId)
      )
      .map((item) => item.id);
  }, [enrollments, filteredStudents, filters.academicYear]);

  const previewSummary = useMemo(() => {
    const counts = {
      students: filteredStudents.length,
      previewEnrollments: previewRows.length,
      warnings: previewWarnings.length,
      existingInScope: existingEnrollmentIdsInScope.length,
    };
    return counts;
  }, [filteredStudents, previewRows, previewWarnings, existingEnrollmentIdsInScope]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, section: "", stream: "" }));
  }, [filters.grade]);

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      const [studentSnap, subjectSnap, enrollmentSnap] = await Promise.all([
        getDocs(collection(db, STUDENT_COLLECTION)),
        getDocs(collection(db, SUBJECT_COLLECTION)),
        getDocs(collection(db, ENROLLMENT_COLLECTION)),
      ]);

      const loadedStudents = studentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedSubjects = subjectSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedEnrollments = enrollmentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setStudents(sortStudentsClientSide(loadedStudents));
      setSubjects(loadedSubjects);
      setEnrollments(sortEnrollments(loadedEnrollments));
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilters(field, value) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function buildPreview() {
    setError("");
    setSuccess("");

    const allRows = [];
    const warnings = [];

    filteredStudents.forEach((student) => {
      const result = buildStudentEnrollmentPlan(
        student,
        indexes,
        normalizeAcademicYear(filters.academicYear)
      );

      allRows.push(...result.planned);
      warnings.push(...result.warnings);
    });

    const dedupedRows = uniqueByKey(allRows, (item) => item.id);

    setPreviewRows(dedupedRows);
    setPreviewWarnings(warnings);
    setPreviewOpen(true);
  }

  async function handleGenerate() {
    if (!filters.academicYear) {
      setError("Academic year is required.");
      return;
    }

    if (filteredStudents.length === 0) {
      setError("No students found for the selected scope.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const allRows = [];
      const warnings = [];

      filteredStudents.forEach((student) => {
        const result = buildStudentEnrollmentPlan(
          student,
          indexes,
          normalizeAcademicYear(filters.academicYear)
        );

        allRows.push(...result.planned);
        warnings.push(...result.warnings);
      });

      const rowsToWrite = uniqueByKey(allRows, (item) => item.id);

      if (rowsToWrite.length === 0) {
        throw new Error("No enrollments could be generated for this scope.");
      }

      if (filters.replaceExistingForScope && existingEnrollmentIdsInScope.length > 0) {
        await commitDeleteInChunks(existingEnrollmentIdsInScope);
      }

      await commitSetInChunks(
        rowsToWrite.map((row) => ({
          id: row.id,
          data: {
            ...row.data,
            createdAt:
              enrollments.find((e) => e.id === row.id)?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }))
      );

      setPreviewRows(rowsToWrite);
      setPreviewWarnings(warnings);

      const message = filters.replaceExistingForScope
        ? `Generated ${rowsToWrite.length} enrollments after replacing ${existingEnrollmentIdsInScope.length} existing enrollments in scope.`
        : `Generated ${rowsToWrite.length} enrollments successfully.`;

      setSuccess(message);
      await fetchData();
    } catch (err) {
      setError("Generation failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteScope() {
    if (existingEnrollmentIdsInScope.length === 0) {
      setError("No enrollments found for the selected scope.");
      return;
    }

    const ok = window.confirm(
      `Delete ${existingEnrollmentIdsInScope.length} enrollments for ${buildScopeLabel(filters)}?`
    );
    if (!ok) return;

    setBulkDeleting(true);
    setError("");
    setSuccess("");

    try {
      await commitDeleteInChunks(existingEnrollmentIdsInScope);
      setSuccess(
        `Deleted ${existingEnrollmentIdsInScope.length} enrollments for ${buildScopeLabel(filters)}.`
      );
      await fetchData();
    } catch (err) {
      setError("Delete failed: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  const scopedStudentLabel = useMemo(() => {
    if (!filteredStudents.length) return "No students in scope";

    const alCount = filteredStudents.filter((s) => isALGrade(getStudentGrade(s))).length;
    return `${filteredStudents.length} student${filteredStudents.length !== 1 ? "s" : ""} in scope • ${alCount} A/L`;
  }, [filteredStudents]);

  return (
    <Box>
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
          border: "1px solid #e8eaf6",
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1.5}
        >
          <Box>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              fontWeight={800}
              color="#1a237e"
            >
              Generate Subject Enrollments
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Automatically generate enrollments from student data for lower grades, O/L, and A/L streams.
            </Typography>
            <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
              <Chip
                label={`Students Loaded: ${students.length}`}
                size="small"
                color="success"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Subjects Loaded: ${subjects.length}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Enrollments Loaded: ${enrollments.length}`}
                size="small"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>

            <Button
              variant="outlined"
              color="warning"
              startIcon={<PreviewIcon />}
              onClick={buildPreview}
              disabled={loading}
            >
              Preview
            </Button>

            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleGenerate}
              disabled={saving || loading}
              sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
            >
              {saving ? <CircularProgress size={18} color="inherit" /> : "Generate"}
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={handleDeleteScope}
              disabled={bulkDeleting || loading || existingEnrollmentIdsInScope.length === 0}
            >
              {bulkDeleting ? <CircularProgress size={18} color="inherit" /> : "Delete Scope"}
            </Button>
          </Stack>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid #e8eaf6",
              boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
            }}
          >
            <Typography variant="subtitle1" fontWeight={800} color="#1a237e" mb={2}>
              Generation Scope
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Academic Year"
                  value={filters.academicYear}
                  onChange={(e) => updateFilters("academicYear", e.target.value)}
                  placeholder="2026"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Grade</InputLabel>
                  <Select
                    value={filters.grade}
                    label="Grade"
                    onChange={(e) => updateFilters("grade", e.target.value)}
                  >
                    <MenuItem value="">All Grades</MenuItem>
                    {gradeOptions.map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        Grade {grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={filters.section}
                    label="Section"
                    onChange={(e) => updateFilters("section", e.target.value)}
                  >
                    <MenuItem value="">All Sections</MenuItem>
                    {sectionOptions.map((section) => (
                      <MenuItem key={section} value={section}>
                        {section}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={!(String(filters.grade) === "12" || String(filters.grade) === "13")}>
                  <InputLabel>A/L Stream</InputLabel>
                  <Select
                    value={filters.stream}
                    label="A/L Stream"
                    onChange={(e) => updateFilters("stream", e.target.value)}
                  >
                    <MenuItem value="">All Streams</MenuItem>
                    {streamOptions.map((stream) => (
                      <MenuItem key={stream} value={stream}>
                        {stream}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.onlyActiveStudents}
                        onChange={(e) => updateFilters("onlyActiveStudents", e.target.checked)}
                      />
                    }
                    label="Only active students"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.replaceExistingForScope}
                        onChange={(e) =>
                          updateFilters("replaceExistingForScope", e.target.checked)
                        }
                      />
                    }
                    label="Replace existing enrollments in scope"
                  />
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Card
              sx={{
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <SchoolIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Scope Summary
                  </Typography>
                </Stack>
                <Typography variant="body2" fontWeight={700}>
                  {scopedStudentLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  {buildScopeLabel(filters)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Existing enrollments in scope: {existingEnrollmentIdsInScope.length}
                </Typography>
              </CardContent>
            </Card>

            <Card
              sx={{
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>
                  A/L Notes
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  - Uses stream + student A/L choices
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  - Generates main subjects as category `al_main`
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  - Generates General English as category `general` if defined
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  - Saves `subjectNumber`, `streamCode`, and `alClassName`
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Paper
        sx={{
          p: 2,
          borderRadius: 3,
          border: "1px solid #e8eaf6",
          boxShadow: "0 2px 8px rgba(26,35,126,0.06)",
        }}
      >
        <Typography variant="subtitle1" fontWeight={800} color="#1a237e" mb={2}>
          Students in Current Scope
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : filteredStudents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No students found for the selected scope.
          </Typography>
        ) : isMobile ? (
          <Stack spacing={1.2}>
            {filteredStudents.map((student) => {
              const grade = getStudentGrade(student);
              const section = getStudentSection(student);
              const stream = getStudentStream(student);

              return (
                <Card key={student.id} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {getStudentName(student)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {getStudentAdmissionNo(student) || "No Adm#"}
                    </Typography>
                    <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
                      <Chip label={`G${grade}-${section || "—"}`} size="small" color="primary" />
                      {isALGrade(grade) && stream ? (
                        <Chip
                          label={getALStreamShortName(stream) || stream}
                          size="small"
                          color="secondary"
                        />
                      ) : null}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        ) : (
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1a237e" }}>
              <TableRow>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Student</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Adm No</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Grade</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Section</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Stream</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.map((student, idx) => (
                <TableRow key={student.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{getStudentName(student)}</TableCell>
                  <TableCell>{getStudentAdmissionNo(student) || "—"}</TableCell>
                  <TableCell>{getStudentGrade(student) || "—"}</TableCell>
                  <TableCell>{getStudentSection(student) || "—"}</TableCell>
                  <TableCell>{getStudentStream(student) || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={normalizeText(student.status || "Active").toUpperCase()}
                      color={isActiveStatus(student.status || "Active") ? "success" : "default"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fullWidth
        maxWidth="lg"
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          Enrollment Preview
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip label={`Students: ${previewSummary.students}`} color="primary" size="small" />
              <Chip
                label={`Preview Enrollments: ${previewSummary.previewEnrollments}`}
                color="success"
                size="small"
              />
              <Chip
                label={`Warnings: ${previewSummary.warnings}`}
                color={previewSummary.warnings > 0 ? "warning" : "default"}
                size="small"
              />
              <Chip
                label={`Existing in Scope: ${previewSummary.existingInScope}`}
                size="small"
              />
            </Box>

            {previewWarnings.length > 0 && (
              <Alert severity="warning">
                <Typography variant="body2" fontWeight={700} mb={1}>
                  Missing or invalid data found:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {previewWarnings.slice(0, 20).map((warning, idx) => (
                    <li key={`${warning}-${idx}`}>
                      <Typography variant="caption">{warning}</Typography>
                    </li>
                  ))}
                </Box>
                {previewWarnings.length > 20 && (
                  <Typography variant="caption" display="block" mt={1}>
                    + {previewWarnings.length - 20} more warning(s)
                  </Typography>
                )}
              </Alert>
            )}

            {previewRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No preview rows generated.
              </Typography>
            ) : isMobile ? (
              <Stack spacing={1.2}>
                {previewRows.map((row) => (
                  <Card key={row.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {row.data.studentName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.data.subjectName}
                      </Typography>
                      <Box display="flex" gap={0.8} mt={1} flexWrap="wrap">
                        <Chip label={getCategoryLabel(row.data.subjectCategory)} size="small" />
                        <Chip label={`G${row.data.grade}-${row.data.section}`} size="small" color="primary" />
                        {row.data.stream ? (
                          <Chip label={row.data.stream} size="small" color="secondary" />
                        ) : null}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#1a237e" }}>
                    <TableRow>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Adm No</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Grade/Sec</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Stream</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Subject No.</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Subject</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 700 }}>Year</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.data.studentName}</TableCell>
                        <TableCell>{row.data.admissionNo || "—"}</TableCell>
                        <TableCell>{`G${row.data.grade}-${row.data.section}`}</TableCell>
                        <TableCell>{row.data.stream || "—"}</TableCell>
                        <TableCell>{getCategoryLabel(row.data.subjectCategory)}</TableCell>
                        <TableCell>{row.data.subjectNumber || "—"}</TableCell>
                        <TableCell>{row.data.subjectName}</TableCell>
                        <TableCell>{row.data.academicYear}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}