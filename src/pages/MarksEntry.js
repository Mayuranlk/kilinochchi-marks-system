import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SchoolIcon from "@mui/icons-material/School";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * ============================================================================
 * MARKS ENTRY - SCHEMA ALIGNED REWRITE
 * ============================================================================
 * Real schema alignment:
 * - students:
 *   - grade
 *   - className = often "B", "D"
 *   - section = "B", "D"
 *
 * - studentSubjectEnrollments:
 *   - grade
 *   - className = often "6B"
 *   - section = "B"
 *   - subjectId
 *   - subjectName
 *
 * - marks (mixed legacy + newer docs):
 *   - old: subject, mark, term, year, grade, section
 *   - newer: subjectId, subjectName, academicYear, isAbsent, isMedicalAbsent
 *
 * - academicTerms:
 *   - term
 *   - year
 *   - isActive
 *
 * Goals:
 * - robust class matching for legacy + new enrollment shapes
 * - subject dropdown strictly driven from enrollments
 * - subject match: subjectId first, then subjectName / subject fallback
 * - marks load/save compatible with old and new marks schemas
 * - absent / medical absent support
 * - teacher assignments optional and safe when collection is empty
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Basic helpers                                                               */
/* -------------------------------------------------------------------------- */

const safeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const lower = (value) => safeString(value).toLowerCase();
const upper = (value) => safeString(value).toUpperCase();

const compactLower = (value) => safeString(value).replace(/\s+/g, "").toLowerCase();

const onlyDigits = (value) => {
  const match = safeString(value).match(/\d+/g);
  return match ? match.join("") : "";
};

const onlyLetters = (value) => {
  const match = upper(value).match(/[A-Z]+/g);
  return match ? match.join("") : "";
};

const normalizeAcademicYear = (value) => {
  const year = onlyDigits(value);
  return year ? String(parseInt(year, 10)) : "";
};

const normalizeGrade = (value) => {
  const digits = onlyDigits(value);
  return digits ? String(parseInt(digits, 10)) : "";
};

const normalizeSection = (value) => {
  const letters = onlyLetters(value);
  return letters || "";
};

const normalizeClassInfo = ({ grade, className, section }) => {
  const normalizedGrade = normalizeGrade(grade);
  const normalizedSection =
    normalizeSection(section) || normalizeSection(className);

  return {
    grade: normalizedGrade,
    section: normalizedSection,
    fullClass:
      normalizedGrade && normalizedSection
        ? `${normalizedGrade}${normalizedSection}`
        : "",
  };
};

const normalizeSelectedClass = (selectedClass, selectedGrade) => {
  const selectedGradeNormalized =
    normalizeGrade(selectedClass) || normalizeGrade(selectedGrade);
  const selectedSection = normalizeSection(selectedClass);

  return {
    grade: selectedGradeNormalized,
    section: selectedSection,
    fullClass:
      selectedGradeNormalized && selectedSection
        ? `${selectedGradeNormalized}${selectedSection}`
        : "",
  };
};

const normalizeSubjectName = (value) => compactLower(value);

const subjectNamesEqual = (a, b) =>
  normalizeSubjectName(a) === normalizeSubjectName(b);

const buildSubjectOptionKey = (subjectId, subjectName) => {
  const sid = safeString(subjectId);
  if (sid) return `id:${sid}`;
  return `name:${normalizeSubjectName(subjectName)}`;
};

const roleLooksAdmin = (role) => {
  const r = lower(role);
  return ["admin", "administrator", "superadmin", "principal"].includes(r);
};

const roleLooksTeacher = (role) => {
  const r = lower(role);
  return ["teacher", "staff", "subjectteacher", "classteacher"].includes(r);
};

const isTruthyActive = (value) => {
  const v = lower(value);
  if (!v) return true;
  return ["active", "enabled", "assigned", "current", "yes", "true", "1"].includes(v);
};

const sortByName = (rows) => {
  return [...rows].sort((a, b) =>
    safeString(a.studentName).localeCompare(safeString(b.studentName))
  );
};

const getMarkStatus = (markDoc) => {
  if (markDoc?.isMedicalAbsent) return "medical_absent";
  if (markDoc?.isAbsent) return "absent";

  const rawStatus = lower(markDoc?.attendanceStatus || markDoc?.status);
  if (rawStatus === "medical_absent") return "medical_absent";
  if (rawStatus === "absent") return "absent";

  return "present";
};

const getMarkValue = (markDoc) => {
  const raw = markDoc?.mark ?? markDoc?.marks ?? markDoc?.score ?? "";
  if (raw === "" || raw === null || raw === undefined) return "";
  const num = Number(raw);
  return Number.isFinite(num) ? num : "";
};

const getTermLabel = (term) =>
  safeString(term?.term || term?.name || term?.termName || term?.label || "");

const getTermYear = (term) =>
  normalizeAcademicYear(term?.year || term?.academicYear);

/* -------------------------------------------------------------------------- */
/* Matching helpers                                                            */
/* -------------------------------------------------------------------------- */

const matchesAcademicYear = (docYear, selectedYear) => {
  const a = normalizeAcademicYear(docYear);
  const b = normalizeAcademicYear(selectedYear);
  if (!b) return true;
  return a === b;
};

const matchesClassSelection = (row, selectedGrade, selectedClass) => {
  const rowClass = normalizeClassInfo({
    grade: row.grade,
    className: row.className,
    section: row.section,
  });

  const selected = normalizeSelectedClass(selectedClass, selectedGrade);

  if (!selected.grade) return true;
  if (rowClass.grade !== selected.grade) return false;
  if (selected.section && rowClass.section !== selected.section) return false;

  return true;
};

const enrollmentMatchesSelectedSubject = (enrollment, selectedSubject) => {
  if (!selectedSubject) return false;

  const enrollmentSubjectId = safeString(enrollment.subjectId);
  const enrollmentSubjectName = safeString(enrollment.subjectName);

  const selectedSubjectId = safeString(selectedSubject.subjectId);
  const selectedSubjectName = safeString(selectedSubject.subjectName);

  if (selectedSubjectId && enrollmentSubjectId) {
    return selectedSubjectId === enrollmentSubjectId;
  }

  return subjectNamesEqual(enrollmentSubjectName, selectedSubjectName);
};

const markMatchesTerm = (markDoc, activeTerm) => {
  const activeYear = getTermYear(activeTerm);
  const activeLabel = getTermLabel(activeTerm);

  const docYear = normalizeAcademicYear(markDoc.academicYear || markDoc.year);
  const docTerm = safeString(markDoc.term || markDoc.termName || markDoc.termLabel);

  const yearOk = !activeYear || docYear === activeYear;
  const termOk = !activeLabel || docTerm === activeLabel;

  return yearOk && termOk;
};

const markMatchesSubject = (markDoc, selectedSubject) => {
  const selectedSubjectId = safeString(selectedSubject?.subjectId);
  const selectedSubjectName = safeString(selectedSubject?.subjectName);

  const docSubjectId = safeString(markDoc?.subjectId);
  const docSubjectName = safeString(markDoc?.subjectName || markDoc?.subject);

  if (selectedSubjectId && docSubjectId) {
    return selectedSubjectId === docSubjectId;
  }

  return subjectNamesEqual(docSubjectName, selectedSubjectName);
};

/* -------------------------------------------------------------------------- */
/* Firestore helpers                                                           */
/* -------------------------------------------------------------------------- */

const fetchUserProfile = async (uid) => {
  if (!uid) return null;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
};

const fetchCollectionDocs = async (collectionName, whereClauses = []) => {
  try {
    const ref = collection(db, collectionName);

    if (!whereClauses.length) {
      const snap = await getDocs(ref);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    }

    const q = query(
      ref,
      ...whereClauses.map((clause) =>
        where(clause.field, clause.op, clause.value)
      )
    );

    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error(`Failed to fetch ${collectionName}:`, error);
    return [];
  }
};

const fetchActiveTerms = async () => {
  const academicTerms = await fetchCollectionDocs("academicTerms");
  const fallbackTerms = academicTerms.length
    ? []
    : await fetchCollectionDocs("terms");

  const source = academicTerms.length ? academicTerms : fallbackTerms;

  const normalized = source.map((row) => ({
    id: row.id,
    term: safeString(row.term || row.name || row.termName),
    year: normalizeAcademicYear(row.year || row.academicYear),
    isActive: !!row.isActive || isTruthyActive(row.status),
    raw: row,
  }));

  const active = normalized.filter((row) => row.isActive);
  return active.length ? active : normalized;
};

const fetchAllEnrollments = async () => {
  const rows = await fetchCollectionDocs("studentSubjectEnrollments");
  return rows.filter((row) => isTruthyActive(row.status));
};

const fetchTeacherAssignments = async (user, userProfile) => {
  if (!user) return [];

  const teacherValues = [
    safeString(user.uid),
    safeString(user.email),
    safeString(userProfile?.teacherId),
  ].filter(Boolean);

  const collectionsToTry = [
    "teacherAssignments",
    "assignments",
    "teacherSubjectAssignments",
    "subjectAssignments",
  ];

  const keyNames = [
    "teacherId",
    "teacherUid",
    "uid",
    "userId",
    "teacherEmail",
    "email",
  ];

  const found = [];

  for (const collectionName of collectionsToTry) {
    for (const key of keyNames) {
      for (const value of teacherValues) {
        const rows = await fetchCollectionDocs(collectionName, [
          { field: key, op: "==", value },
        ]);

        rows.forEach((row) => {
          found.push({ ...row, __collection: collectionName });
        });
      }
    }
  }

  const dedup = new Map();
  found.forEach((row) => {
    const key = `${row.__collection}:${row.id}`;
    if (!dedup.has(key) && isTruthyActive(row.status)) {
      dedup.set(key, row);
    }
  });

  return Array.from(dedup.values());
};

const fetchExistingMarksForClass = async ({ grade, section }) => {
  if (!grade || !section) return [];

  const rows = await fetchCollectionDocs("marks", [
    { field: "grade", op: "==", value: Number(grade) },
    { field: "section", op: "==", value: section },
  ]);

  return rows;
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function MarksEntry() {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  const [terms, setTerms] = useState([]);
  const [activeTermId, setActiveTermId] = useState("");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));

  const [allEnrollments, setAllEnrollments] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState([]);

  const [gradeOptions, setGradeOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");

  const [studentRows, setStudentRows] = useState([]);

  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const showSnack = useCallback((severity, message) => {
    setSnack({
      open: true,
      severity,
      message,
    });
  }, []);

  const activeTerm = useMemo(
    () => terms.find((row) => row.id === activeTermId) || null,
    [terms, activeTermId]
  );

  const selectedSubject = useMemo(() => {
    if (!selectedSubjectKey) return null;
    return (
      subjectOptions.find(
        (row) =>
          buildSubjectOptionKey(row.subjectId, row.subjectName) === selectedSubjectKey
      ) || null
    );
  }, [selectedSubjectKey, subjectOptions]);

  /* ------------------------------------------------------------------------ */
  /* Initial load                                                             */
  /* ------------------------------------------------------------------------ */

  const loadInitialData = useCallback(async () => {
    setInitialLoading(true);

    try {
      const profile = await fetchUserProfile(currentUser?.uid);
      setUserProfile(profile);

      const role = safeString(profile?.role || profile?.userRole);
      const adminMode = roleLooksAdmin(role);
      const teacherMode = roleLooksTeacher(role) || !adminMode;

      setIsAdmin(adminMode);
      setIsTeacher(teacherMode);

      const [loadedTerms, loadedEnrollments, loadedAssignments] = await Promise.all([
        fetchActiveTerms(),
        fetchAllEnrollments(),
        fetchTeacherAssignments(currentUser, profile),
      ]);

      setTerms(loadedTerms);
      setAllEnrollments(loadedEnrollments);
      setTeacherAssignments(loadedAssignments);

      const active = loadedTerms.find((row) => row.isActive) || loadedTerms[0] || null;
      if (active) {
        setActiveTermId(active.id);
        if (active.year) {
          setAcademicYear(active.year);
        }
      }

      const grades = Array.from(
        new Set(
          loadedEnrollments
            .map((row) => normalizeGrade(row.grade))
            .filter(Boolean)
            .sort((a, b) => Number(a) - Number(b))
        )
      );

      setGradeOptions(grades);
      if (grades.length) {
        setSelectedGrade((prev) => prev || grades[0]);
      }
    } catch (error) {
      console.error("Failed to load marks entry page:", error);
      showSnack("error", "Failed to load marks entry data.");
    } finally {
      setInitialLoading(false);
    }
  }, [currentUser, showSnack]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /* ------------------------------------------------------------------------ */
  /* Class options                                                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const relevant = allEnrollments.filter(
      (row) =>
        matchesAcademicYear(row.academicYear, academicYear) &&
        normalizeGrade(row.grade) === normalizeGrade(selectedGrade)
    );

    const map = new Map();

    relevant.forEach((row) => {
      const classInfo = normalizeClassInfo({
        grade: row.grade,
        className: row.className,
        section: row.section,
      });

      if (!classInfo.grade || !classInfo.section || !classInfo.fullClass) return;

      if (!map.has(classInfo.fullClass)) {
        map.set(classInfo.fullClass, {
          value: classInfo.fullClass,
          label: classInfo.fullClass,
          grade: classInfo.grade,
          section: classInfo.section,
        });
      }
    });

    const classes = Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true })
    );

    setClassOptions(classes);

    if (!classes.find((row) => row.value === selectedClass)) {
      setSelectedClass(classes[0]?.value || "");
    }
  }, [allEnrollments, academicYear, selectedGrade, selectedClass]);

  /* ------------------------------------------------------------------------ */
  /* Subject dropdown                                                         */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedGrade || !selectedClass) {
      setSubjectOptions([]);
      setSelectedSubjectKey("");
      return;
    }

    const selectedClassInfo = normalizeSelectedClass(selectedClass, selectedGrade);

    const baseEnrollments = allEnrollments.filter(
      (row) =>
        matchesAcademicYear(row.academicYear, academicYear) &&
        matchesClassSelection(row, selectedGrade, selectedClass)
    );

    let scopedEnrollments = baseEnrollments;

    if (!isAdmin && teacherAssignments.length) {
      scopedEnrollments = baseEnrollments.filter((enrollment) => {
        return teacherAssignments.some((assignment) => {
          const assignmentGrade = normalizeGrade(
            assignment.grade || assignment.classGrade || assignment.gradeName
          );

          const assignmentSection = normalizeSection(
            assignment.section || assignment.className || assignment.class
          );

          const gradeOk =
            !assignmentGrade || assignmentGrade === selectedClassInfo.grade;

          const sectionOk =
            !assignmentSection || assignmentSection === selectedClassInfo.section;

          if (!gradeOk || !sectionOk) return false;

          const assignmentSubjectId = safeString(assignment.subjectId);
          const assignmentSubjectName = safeString(
            assignment.subjectName || assignment.subject
          );

          const enrollmentSubjectId = safeString(enrollment.subjectId);
          const enrollmentSubjectName = safeString(enrollment.subjectName);

          if (assignmentSubjectId && enrollmentSubjectId) {
            return assignmentSubjectId === enrollmentSubjectId;
          }

          return subjectNamesEqual(assignmentSubjectName, enrollmentSubjectName);
        });
      });
    }

    const map = new Map();

    scopedEnrollments.forEach((row) => {
      const subjectId = safeString(row.subjectId);
      const subjectName = safeString(row.subjectName);
      const key = buildSubjectOptionKey(subjectId, subjectName);

      if (!subjectName && !subjectId) return;

      if (!map.has(key)) {
        map.set(key, {
          subjectId,
          subjectName,
        });
      }
    });

    const subjects = Array.from(map.values()).sort((a, b) =>
      safeString(a.subjectName).localeCompare(safeString(b.subjectName))
    );

    setSubjectOptions(subjects);

    const stillValid = subjects.find(
      (row) =>
        buildSubjectOptionKey(row.subjectId, row.subjectName) === selectedSubjectKey
    );

    if (!stillValid) {
      setSelectedSubjectKey(
        subjects.length
          ? buildSubjectOptionKey(subjects[0].subjectId, subjects[0].subjectName)
          : ""
      );
    }
  }, [
    allEnrollments,
    academicYear,
    selectedGrade,
    selectedClass,
    selectedSubjectKey,
    teacherAssignments,
    isAdmin,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Load rows                                                                */
  /* ------------------------------------------------------------------------ */

  const loadStudentRows = useCallback(async () => {
    if (!selectedGrade || !selectedClass || !selectedSubject || !activeTerm) {
      setStudentRows([]);
      return;
    }

    setPageLoading(true);

    try {
      const selectedClassInfo = normalizeSelectedClass(selectedClass, selectedGrade);

      const enrollmentRows = allEnrollments.filter(
        (row) =>
          matchesAcademicYear(row.academicYear, academicYear) &&
          matchesClassSelection(row, selectedGrade, selectedClass) &&
          enrollmentMatchesSelectedSubject(row, selectedSubject)
      );

      const map = new Map();

      enrollmentRows.forEach((row) => {
        const studentId = safeString(row.studentId);
        if (!studentId) return;

        if (!map.has(studentId)) {
          map.set(studentId, {
            studentId,
            studentName: safeString(row.studentName),
            admissionNo: safeString(row.admissionNo),
            grade: normalizeGrade(row.grade),
            className: safeString(row.className),
            section:
              normalizeSection(row.section) ||
              normalizeSection(row.className) ||
              selectedClassInfo.section,
            status: "present",
            marks: "",
            remarks: "",
            existingMarkDocId: null,
          });
        }
      });

      const existingMarks = await fetchExistingMarksForClass({
        grade: selectedClassInfo.grade,
        section: selectedClassInfo.section,
      });

      existingMarks
        .filter(
          (markDoc) =>
            markMatchesTerm(markDoc, activeTerm) &&
            markMatchesSubject(markDoc, selectedSubject)
        )
        .forEach((markDoc) => {
          const studentId = safeString(markDoc.studentId);
          if (!studentId) return;

          const row = map.get(studentId);
          if (!row) return;

          row.status = getMarkStatus(markDoc);
          row.marks = getMarkValue(markDoc);
          row.remarks = safeString(markDoc.remarks || markDoc.absentReason);
          row.existingMarkDocId = markDoc.id;
        });

      setStudentRows(sortByName(Array.from(map.values())));
    } catch (error) {
      console.error("Failed to load student marks rows:", error);
      setStudentRows([]);
      showSnack("error", "Failed to load students for the selected subject.");
    } finally {
      setPageLoading(false);
    }
  }, [
    selectedGrade,
    selectedClass,
    selectedSubject,
    activeTerm,
    allEnrollments,
    academicYear,
    showSnack,
  ]);

  useEffect(() => {
    loadStudentRows();
  }, [loadStudentRows]);

  /* ------------------------------------------------------------------------ */
  /* Row updates                                                              */
  /* ------------------------------------------------------------------------ */

  const handleStatusChange = (studentId, nextStatus) => {
    setStudentRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;

        const status = lower(nextStatus || "present");
        return {
          ...row,
          status,
          marks: status === "present" ? row.marks : "",
        };
      })
    );
  };

  const handleMarksChange = (studentId, nextMarks) => {
    setStudentRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? {
              ...row,
              marks: nextMarks === "" ? "" : nextMarks,
            }
          : row
      )
    );
  };

  const handleRemarksChange = (studentId, nextRemarks) => {
    setStudentRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? {
              ...row,
              remarks: nextRemarks,
            }
          : row
      )
    );
  };

  /* ------------------------------------------------------------------------ */
  /* Save                                                                     */
  /* ------------------------------------------------------------------------ */

  const handleSave = async () => {
    if (!selectedGrade || !selectedClass || !selectedSubject || !activeTerm) {
      showSnack("warning", "Please select grade, class, subject, and term.");
      return;
    }

    if (!studentRows.length) {
      showSnack("warning", "No students found for the selected subject.");
      return;
    }

    setSaving(true);

    try {
      const batch = writeBatch(db);
      const selectedClassInfo = normalizeSelectedClass(selectedClass, selectedGrade);
      const termLabel = getTermLabel(activeTerm);
      const termYear = getTermYear(activeTerm) || normalizeAcademicYear(academicYear);

      const rowsToSave = studentRows.filter((row) => {
        if (row.status === "absent" || row.status === "medical_absent") return true;
        return row.marks !== "" && row.marks !== null && row.marks !== undefined;
      });

      rowsToSave.forEach((row) => {
        const subjectId = safeString(selectedSubject.subjectId);
        const subjectName = safeString(selectedSubject.subjectName);
        const subjectKey = subjectId || subjectName;
        const docId = `${row.studentId}_${subjectKey}_${termLabel}_${termYear}`;

        const markRef = doc(db, "marks", docId);

        const isAbsent = row.status === "absent";
        const isMedicalAbsent = row.status === "medical_absent";
        const numericMark =
          isAbsent || isMedicalAbsent || row.marks === ""
            ? null
            : Number(row.marks);

        batch.set(
          markRef,
          {
            studentId: safeString(row.studentId),
            studentName: safeString(row.studentName),
            admissionNo: safeString(row.admissionNo),

            grade: Number(selectedClassInfo.grade),
            className: selectedClassInfo.section,
            section: selectedClassInfo.section,

            term: termLabel,
            termId: safeString(activeTerm.id),
            termName: termLabel,

            year: Number(termYear),
            academicYear: termYear,

            subject: subjectName,
            subjectName,
            subjectId,
            subjectCode: safeString(selectedSubject.subjectCode),

            mark: numericMark,
            marks: numericMark,
            score: numericMark,

            isAbsent,
            isMedicalAbsent,
            absentReason: safeString(row.remarks),
            remarks: safeString(row.remarks),

            attendanceStatus: row.status,
            status: row.status,

            approvalStatus: "approved",

            updatedById: safeString(currentUser?.uid),
            updatedBy:
              safeString(userProfile?.name) ||
              safeString(currentUser?.displayName) ||
              safeString(currentUser?.email),
            teacherId: safeString(currentUser?.uid),
            teacherEmail: safeString(currentUser?.email),

            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      showSnack("success", "Marks saved successfully.");
      await loadStudentRows();
    } catch (error) {
      console.error("Failed to save marks:", error);
      showSnack("error", "Failed to save marks.");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Derived                                                                  */
  /* ------------------------------------------------------------------------ */

  const pageModeLabel = useMemo(() => {
    if (isAdmin) return "Admin Mode";
    if (isTeacher) return "Teacher Mode";
    return "User Mode";
  }, [isAdmin, isTeacher]);

  const activeTermLabel = useMemo(() => {
    if (!activeTerm) return "No Active Term";
    const termText = getTermLabel(activeTerm);
    const yearText = getTermYear(activeTerm);
    return yearText ? `${termText} - ${yearText}` : termText || activeTerm.id;
  }, [activeTerm]);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  if (initialLoading) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography>Loading marks entry...</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Card elevation={2}>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SchoolIcon color="primary" />
                  <Typography variant="h5" fontWeight={700}>
                    Marks Entry
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Enrollment-driven marks entry with legacy-safe schema handling
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  icon={<AssignmentTurnedInIcon />}
                  label={pageModeLabel}
                  color={isAdmin ? "secondary" : "primary"}
                  variant="outlined"
                />
                <Chip
                  label={activeTermLabel}
                  color={activeTerm ? "success" : "warning"}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card elevation={2}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  label="Academic Year"
                  size="small"
                  fullWidth
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Term</InputLabel>
                  <Select
                    label="Term"
                    value={activeTermId}
                    onChange={(e) => setActiveTermId(e.target.value)}
                  >
                    {terms.map((term) => (
                      <MenuItem key={term.id} value={term.id}>
                        {getTermLabel(term)}
                        {getTermYear(term) ? ` - ${getTermYear(term)}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Grade</InputLabel>
                  <Select
                    label="Grade"
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                  >
                    {gradeOptions.map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        Grade {grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Class</InputLabel>
                  <Select
                    label="Class"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    {classOptions.map((classRow) => (
                      <MenuItem key={classRow.value} value={classRow.value}>
                        {classRow.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={12} md={3.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Subject</InputLabel>
                  <Select
                    label="Subject"
                    value={selectedSubjectKey}
                    onChange={(e) => setSelectedSubjectKey(e.target.value)}
                  >
                    {subjectOptions.map((subject) => {
                      const key = buildSubjectOptionKey(
                        subject.subjectId,
                        subject.subjectName
                      );

                      return (
                        <MenuItem key={key} value={key}>
                          {subject.subjectName}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 2.5 }}
            >
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadStudentRows}
                disabled={pageLoading}
              >
                Reload
              </Button>

              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving || pageLoading || !studentRows.length}
              >
                {saving ? "Saving..." : "Save Marks"}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card elevation={2}>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Student Marks
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Only enrolled students for the selected class and subject are shown
                </Typography>
              </Box>

              <Chip
                label={`${studentRows.length} Student${studentRows.length === 1 ? "" : "s"}`}
                color="primary"
                variant="outlined"
              />
            </Stack>

            {pageLoading ? (
              <Box
                sx={{
                  minHeight: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stack spacing={2} alignItems="center">
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    Loading students...
                  </Typography>
                </Stack>
              </Box>
            ) : !selectedSubject ? (
              <Alert severity="info">
                Select grade, class, and subject to load students.
              </Alert>
            ) : !studentRows.length ? (
              <Alert severity="warning">
                No enrolled students found for the selected class and subject.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>No</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Student Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Admission No</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>
                        Attendance
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>
                        Marks
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>
                        Remarks
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {studentRows.map((row, index) => {
                      const marksDisabled =
                        row.status === "absent" || row.status === "medical_absent";

                      return (
                        <TableRow key={row.studentId} hover>
                          <TableCell>{index + 1}</TableCell>

                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {row.studentName || "-"}
                            </Typography>
                          </TableCell>

                          <TableCell>{row.admissionNo || "-"}</TableCell>

                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={row.status}
                                onChange={(e) =>
                                  handleStatusChange(row.studentId, e.target.value)
                                }
                              >
                                <MenuItem value="present">Present</MenuItem>
                                <MenuItem value="absent">Absent</MenuItem>
                                <MenuItem value="medical_absent">
                                  Medical Absent
                                </MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>

                          <TableCell>
                            <Tooltip
                              title={
                                marksDisabled
                                  ? "Marks are disabled for absent or medical absent"
                                  : ""
                              }
                            >
                              <span>
                                <TextField
                                  type="number"
                                  size="small"
                                  fullWidth
                                  value={row.marks}
                                  onChange={(e) =>
                                    handleMarksChange(row.studentId, e.target.value)
                                  }
                                  disabled={marksDisabled}
                                  inputProps={{ min: 0, step: "any" }}
                                />
                              </span>
                            </Tooltip>
                          </TableCell>

                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder="Optional remarks"
                              value={row.remarks}
                              onChange={(e) =>
                                handleRemarksChange(row.studentId, e.target.value)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}