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
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * ============================================================================
 * PRODUCTION-GRADE MARKS ENTRY
 * ============================================================================
 * Goals:
 * - Robust against legacy and mixed enrollment formats
 * - Works with:
 *   - className: "B"
 *   - className: "6B"
 *   - section: "B"
 * - Subject resolution uses subjectId first, subjectName fallback
 * - Supports admin mode + teacher assignment mode
 * - Supports active term loading
 * - Supports save / reload
 * - Supports absent / medical absent
 * - Safe against old docs that have inconsistent fields
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Helpers: safe string / number normalization                                 */
/* -------------------------------------------------------------------------- */

const safeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const upper = (value) => safeString(value).toUpperCase();

const lower = (value) => safeString(value).toLowerCase();

const onlyDigits = (value) => {
  const match = safeString(value).match(/\d+/g);
  return match ? match.join("") : "";
};

const onlyLetters = (value) => {
  const match = safeString(value).toUpperCase().match(/[A-Z]+/g);
  return match ? match.join("") : "";
};

const compact = (value) => safeString(value).replace(/\s+/g, "");

const normalizeAcademicYear = (value) => {
  const year = onlyDigits(value);
  return year || "";
};

const normalizeGrade = (value) => {
  const digits = onlyDigits(value);
  return digits ? String(parseInt(digits, 10)) : "";
};

/**
 * Extract section from:
 * - "A"
 * - "6A"
 * - "Grade 6 A"
 * - section field itself
 */
const normalizeSection = (value) => {
  const letters = onlyLetters(value);
  return letters || "";
};

/**
 * Build normalized class object from grade + raw className + raw section.
 * Supports legacy shapes:
 * - grade=6, className="B"
 * - grade=6, className="6B"
 * - grade=6, className="Grade 6 B"
 * - grade=6, section="B"
 */
const normalizeClassInfo = ({ grade, className, section }) => {
  const normalizedGrade = normalizeGrade(grade);

  const rawClass = upper(className);
  const rawSection = upper(section);

  let extractedSection = normalizeSection(rawSection);

  if (!extractedSection) {
    const classLetters = normalizeSection(rawClass);
    if (classLetters) extractedSection = classLetters;
  }

  const fullClass =
    normalizedGrade && extractedSection
      ? `${normalizedGrade}${extractedSection}`
      : "";

  return {
    grade: normalizedGrade,
    section: extractedSection,
    fullClass,
  };
};

/**
 * For UI selected class values like:
 * - "6A"
 * - "11B"
 * - "A" (legacy accidental)
 */
const normalizeSelectedClass = (selectedClass, selectedGrade = "") => {
  const raw = upper(selectedClass);
  const derivedGrade = normalizeGrade(raw) || normalizeGrade(selectedGrade);
  const derivedSection = normalizeSection(raw);
  const fullClass =
    derivedGrade && derivedSection ? `${derivedGrade}${derivedSection}` : "";

  return {
    grade: derivedGrade,
    section: derivedSection,
    fullClass,
  };
};

const normalizeName = (value) => compact(lower(value));

const subjectNameEquals = (a, b) => normalizeName(a) === normalizeName(b);

const buildSubjectIdentityKey = (subjectId, subjectName) => {
  const sid = safeString(subjectId);
  if (sid) return `id:${sid}`;
  return `name:${normalizeName(subjectName)}`;
};

const isActiveLike = (value) => {
  const v = lower(value);
  if (!v) return true;
  return ["active", "enabled", "current", "1", "true", "yes"].includes(v);
};

const roleLooksAdmin = (role) => {
  const r = lower(role);
  return ["admin", "superadmin", "principal", "administrator"].includes(r);
};

const roleLooksTeacher = (role) => {
  const r = lower(role);
  return ["teacher", "staff", "subjectteacher", "classteacher"].includes(r);
};

const toNumberOrBlank = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
};

const sortByClassThenName = (rows) => {
  return [...rows].sort((a, b) => {
    const ga = Number(normalizeGrade(a.grade) || 0);
    const gb = Number(normalizeGrade(b.grade) || 0);
    if (ga !== gb) return ga - gb;

    const sa = normalizeSection(a.section || a.className);
    const sb = normalizeSection(b.section || b.className);
    if (sa !== sb) return sa.localeCompare(sb);

    return safeString(a.studentName).localeCompare(safeString(b.studentName));
  });
};

/* -------------------------------------------------------------------------- */
/* Enrollment matching helpers                                                 */
/* -------------------------------------------------------------------------- */

const matchesAcademicYear = (docYear, selectedYear) => {
  const a = normalizeAcademicYear(docYear);
  const b = normalizeAcademicYear(selectedYear);
  if (!b) return true;
  return a === b;
};

const matchesSelectedClass = (enrollment, selectedGrade, selectedClass) => {
  const docClass = normalizeClassInfo({
    grade: enrollment.grade,
    className: enrollment.className,
    section: enrollment.section,
  });

  const selected = normalizeSelectedClass(selectedClass, selectedGrade);

  if (!selected.grade) return true;

  if (docClass.grade !== selected.grade) return false;

  if (selected.section && docClass.section !== selected.section) return false;

  return true;
};

const enrollmentMatchesSubject = (enrollment, selectedSubject) => {
  if (!selectedSubject) return false;

  const selectedSubjectId = safeString(selectedSubject.subjectId);
  const selectedSubjectName = safeString(selectedSubject.subjectName);

  const enrollmentSubjectId = safeString(enrollment.subjectId);
  const enrollmentSubjectName = safeString(enrollment.subjectName);

  if (selectedSubjectId && enrollmentSubjectId) {
    return selectedSubjectId === enrollmentSubjectId;
  }

  if (selectedSubjectId && !enrollmentSubjectId) {
    return subjectNameEquals(enrollmentSubjectName, selectedSubjectName);
  }

  if (!selectedSubjectId && selectedSubjectName) {
    return subjectNameEquals(enrollmentSubjectName, selectedSubjectName);
  }

  return false;
};

const buildEnrollmentSubjectMap = (enrollments) => {
  const map = new Map();

  enrollments.forEach((enr) => {
    const key = buildSubjectIdentityKey(enr.subjectId, enr.subjectName);
    if (!map.has(key)) {
      map.set(key, {
        subjectId: safeString(enr.subjectId),
        subjectName: safeString(enr.subjectName),
      });
    } else {
      const existing = map.get(key);
      if (!existing.subjectId && enr.subjectId) {
        existing.subjectId = safeString(enr.subjectId);
      }
      if (!existing.subjectName && enr.subjectName) {
        existing.subjectName = safeString(enr.subjectName);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    safeString(a.subjectName).localeCompare(safeString(b.subjectName))
  );
};

/* -------------------------------------------------------------------------- */
/* Firestore fetch helpers                                                     */
/* -------------------------------------------------------------------------- */

const fetchCollectionDocs = async (collectionName, options = {}) => {
  try {
    const ref = collection(db, collectionName);
    const constraints = [];

    if (options.whereClauses?.length) {
      options.whereClauses.forEach((clause) => {
        constraints.push(where(clause.field, clause.op, clause.value));
      });
    }

    if (options.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || "asc"));
    }

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = constraints.length ? query(ref, ...constraints) : ref;
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error(`Failed to fetch collection ${collectionName}:`, error);
    return [];
  }
};

const fetchUserProfile = async (uid) => {
  if (!uid) return null;

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
  } catch (error) {
    console.error("Failed to read users doc:", error);
  }

  return null;
};

const fetchActiveTerms = async () => {
  let terms = [];

  // Try academicTerms first
  terms = await fetchCollectionDocs("academicTerms");
  if (!terms.length) {
    // fallback older naming
    terms = await fetchCollectionDocs("terms");
  }

  if (!terms.length) return [];

  const normalized = terms.map((t) => ({
    id: t.id,
    name: safeString(t.name || t.termName || t.title || t.label),
    termNumber: safeString(t.termNumber || t.termNo || t.number),
    academicYear: normalizeAcademicYear(t.academicYear || t.year),
    isActive: !!t.isActive || isActiveLike(t.status),
    raw: t,
  }));

  const active = normalized.filter((t) => t.isActive);
  if (active.length) return active;

  return normalized;
};

const fetchAllEnrollments = async () => {
  const raw = await fetchCollectionDocs("studentSubjectEnrollments");
  return raw.filter((doc) => {
    const status = lower(doc.status);
    return !status || status === "active" || status === "enrolled";
  });
};

const fetchTeacherAssignments = async (user, userProfile) => {
  if (!user) return [];

  const possibleCollections = [
    "teacherAssignments",
    "teacherSubjectAssignments",
    "subjectAssignments",
  ];

  const teacherKeys = [
    { key: "teacherId", value: user.uid },
    { key: "uid", value: user.uid },
    { key: "userId", value: user.uid },
    { key: "teacherEmail", value: safeString(user.email) },
    { key: "email", value: safeString(user.email) },
  ];

  if (userProfile?.teacherId) {
    teacherKeys.push({ key: "teacherId", value: safeString(userProfile.teacherId) });
  }

  const results = [];

  for (const collectionName of possibleCollections) {
    for (const tk of teacherKeys) {
      if (!tk.value) continue;

      const rows = await fetchCollectionDocs(collectionName, {
        whereClauses: [{ field: tk.key, op: "==", value: tk.value }],
      });

      rows.forEach((r) => results.push({ ...r, __collection: collectionName }));
    }
  }

  const dedup = new Map();
  results.forEach((item) => {
    const key = `${item.__collection}:${item.id}`;
    if (!dedup.has(key)) dedup.set(key, item);
  });

  return Array.from(dedup.values()).filter((row) => {
    const status = lower(row.status);
    return !status || status === "active" || status === "assigned";
  });
};

const fetchExistingMarks = async ({
  academicYear,
  termId,
  grade,
  section,
  subjectId,
  subjectName,
}) => {
  const rows = await fetchCollectionDocs("marks", {
    whereClauses: [
      { field: "academicYear", op: "==", value: normalizeAcademicYear(academicYear) },
      { field: "termId", op: "==", value: safeString(termId) },
      { field: "grade", op: "==", value: normalizeGrade(grade) },
      { field: "section", op: "==", value: normalizeSection(section) },
    ],
  });

  return rows.filter((row) => {
    const rowSubjectId = safeString(row.subjectId);
    const rowSubjectName = safeString(row.subjectName);

    if (subjectId && rowSubjectId) return rowSubjectId === subjectId;
    if (subjectId && !rowSubjectId) return subjectNameEquals(rowSubjectName, subjectName);
    return subjectNameEquals(rowSubjectName, subjectName);
  });
};

/* -------------------------------------------------------------------------- */
/* Main component                                                              */
/* -------------------------------------------------------------------------- */

const MarksEntry = () => {
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

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");

  const [studentRows, setStudentRows] = useState([]);

  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const activeTerm = useMemo(
    () => terms.find((t) => t.id === activeTermId) || null,
    [terms, activeTermId]
  );

  const selectedSubject = useMemo(() => {
    if (!selectedSubjectKey) return null;
    return (
      subjectOptions.find(
        (s) => buildSubjectIdentityKey(s.subjectId, s.subjectName) === selectedSubjectKey
      ) || null
    );
  }, [selectedSubjectKey, subjectOptions]);

  const showSnack = useCallback((severity, message) => {
    setSnack({ open: true, severity, message });
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Load initial page data                                                   */
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

      const [loadedTerms, enrollments, assignments] = await Promise.all([
        fetchActiveTerms(),
        fetchAllEnrollments(),
        fetchTeacherAssignments(currentUser, profile),
      ]);

      setTerms(loadedTerms);

      const active = loadedTerms.find((t) => t.isActive) || loadedTerms[0] || null;
      if (active) {
        setActiveTermId(active.id);
        if (active.academicYear) {
          setAcademicYear(active.academicYear);
        }
      }

      setAllEnrollments(enrollments);
      setTeacherAssignments(assignments);

      const availableGrades = Array.from(
        new Set(
          enrollments
            .map((e) => normalizeGrade(e.grade))
            .filter(Boolean)
            .sort((a, b) => Number(a) - Number(b))
        )
      );

      setGradeOptions(availableGrades);

      if (availableGrades.length) {
        setSelectedGrade((prev) => prev || availableGrades[0]);
      }
    } catch (error) {
      console.error("Failed to load MarksEntry initial data:", error);
      showSnack("error", "Failed to load marks entry data.");
    } finally {
      setInitialLoading(false);
    }
  }, [currentUser, showSnack]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /* ------------------------------------------------------------------------ */
  /* Build class options whenever grade / year changes                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const filtered = allEnrollments.filter(
      (e) =>
        matchesAcademicYear(e.academicYear, academicYear) &&
        normalizeGrade(e.grade) === normalizeGrade(selectedGrade)
    );

    const classMap = new Map();

    filtered.forEach((e) => {
      const cls = normalizeClassInfo({
        grade: e.grade,
        className: e.className,
        section: e.section,
      });

      if (!cls.grade || !cls.section || !cls.fullClass) return;

      if (!classMap.has(cls.fullClass)) {
        classMap.set(cls.fullClass, {
          value: cls.fullClass,
          label: cls.fullClass,
          grade: cls.grade,
          section: cls.section,
        });
      }
    });

    const classes = Array.from(classMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true })
    );

    setClassOptions(classes);

    if (!classes.find((c) => c.value === selectedClass)) {
      setSelectedClass(classes[0]?.value || "");
    }
  }, [allEnrollments, academicYear, selectedGrade, selectedClass]);

  /* ------------------------------------------------------------------------ */
  /* Build subject dropdown from normalized enrollments + teacher scope       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedGrade || !selectedClass) {
      setSubjectOptions([]);
      setSelectedSubjectKey("");
      return;
    }

    const baseEnrollments = allEnrollments.filter(
      (e) =>
        matchesAcademicYear(e.academicYear, academicYear) &&
        matchesSelectedClass(e, selectedGrade, selectedClass)
    );

    let scopedEnrollments = baseEnrollments;

    // Teacher mode: restrict subjects using assignments when assignments exist
    if (!isAdmin && teacherAssignments.length) {
      scopedEnrollments = baseEnrollments.filter((enrollment) => {
        return teacherAssignments.some((assignment) => {
          const assignmentGrade = normalizeGrade(
            assignment.grade || assignment.gradeName || assignment.classGrade
          );

          const assignmentClass = normalizeClassInfo({
            grade:
              assignment.grade || assignment.gradeName || assignment.classGrade,
            className: assignment.className || assignment.class || assignment.section,
            section: assignment.section,
          });

          const selectedCls = normalizeSelectedClass(selectedClass, selectedGrade);

          const gradeOk = !assignmentGrade || assignmentGrade === selectedCls.grade;

          const classOk =
            !assignmentClass.section || assignmentClass.section === selectedCls.section;

          if (!gradeOk || !classOk) return false;

          const assignmentSubjectId = safeString(assignment.subjectId);
          const assignmentSubjectName = safeString(
            assignment.subjectName || assignment.subject
          );

          const enrollmentSubjectId = safeString(enrollment.subjectId);
          const enrollmentSubjectName = safeString(enrollment.subjectName);

          if (assignmentSubjectId && enrollmentSubjectId) {
            return assignmentSubjectId === enrollmentSubjectId;
          }

          return subjectNameEquals(assignmentSubjectName, enrollmentSubjectName);
        });
      });
    }

    const subjects = buildEnrollmentSubjectMap(scopedEnrollments);
    setSubjectOptions(subjects);

    const existingStillValid = subjects.find(
      (s) => buildSubjectIdentityKey(s.subjectId, s.subjectName) === selectedSubjectKey
    );

    if (!existingStillValid) {
      setSelectedSubjectKey(
        subjects.length
          ? buildSubjectIdentityKey(subjects[0].subjectId, subjects[0].subjectName)
          : ""
      );
    }
  }, [
    allEnrollments,
    academicYear,
    selectedGrade,
    selectedClass,
    isAdmin,
    teacherAssignments,
    selectedSubjectKey,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Load students for selected subject + reload marks                        */
  /* ------------------------------------------------------------------------ */

  const loadStudentRows = useCallback(async () => {
    if (!selectedGrade || !selectedClass || !selectedSubject || !activeTermId) {
      setStudentRows([]);
      return;
    }

    setPageLoading(true);

    try {
      const selectedCls = normalizeSelectedClass(selectedClass, selectedGrade);

      const relevantEnrollments = allEnrollments.filter((enr) => {
        return (
          matchesAcademicYear(enr.academicYear, academicYear) &&
          matchesSelectedClass(enr, selectedGrade, selectedClass) &&
          enrollmentMatchesSubject(enr, selectedSubject)
        );
      });

      const uniqueStudentsMap = new Map();

      relevantEnrollments.forEach((enr) => {
        const sid = safeString(enr.studentId);
        if (!sid) return;

        if (!uniqueStudentsMap.has(sid)) {
          uniqueStudentsMap.set(sid, {
            studentId: sid,
            studentName: safeString(enr.studentName),
            admissionNo: safeString(enr.admissionNo),
            grade: normalizeGrade(enr.grade),
            className: safeString(enr.className),
            section:
              normalizeSection(enr.section) ||
              normalizeSection(enr.className) ||
              selectedCls.section,
            status: "present",
            marks: "",
            remarks: "",
            existingMarkDocId: null,
          });
        }
      });

      const existingMarks = await fetchExistingMarks({
        academicYear,
        termId: activeTermId,
        grade: selectedCls.grade,
        section: selectedCls.section,
        subjectId: selectedSubject.subjectId,
        subjectName: selectedSubject.subjectName,
      });

      existingMarks.forEach((mark) => {
        const studentId = safeString(mark.studentId);
        if (!studentId) return;

        const existing = uniqueStudentsMap.get(studentId);
        if (!existing) return;

        existing.status = lower(mark.attendanceStatus || mark.status || "present");
        existing.marks = toNumberOrBlank(mark.marks ?? mark.score ?? "");
        existing.remarks = safeString(mark.remarks);
        existing.existingMarkDocId = mark.id;
      });

      const rows = sortByClassThenName(Array.from(uniqueStudentsMap.values()));
      setStudentRows(rows);
    } catch (error) {
      console.error("Failed to load student rows:", error);
      showSnack("error", "Failed to load students for the selected subject.");
      setStudentRows([]);
    } finally {
      setPageLoading(false);
    }
  }, [
    selectedGrade,
    selectedClass,
    selectedSubject,
    activeTermId,
    allEnrollments,
    academicYear,
    showSnack,
  ]);

  useEffect(() => {
    loadStudentRows();
  }, [loadStudentRows]);

  /* ------------------------------------------------------------------------ */
  /* Update row fields                                                        */
  /* ------------------------------------------------------------------------ */

  const handleStatusChange = (studentId, newStatus) => {
    setStudentRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;

        const normalizedStatus = lower(newStatus || "present");
        return {
          ...row,
          status: normalizedStatus,
          marks:
            normalizedStatus === "absent" || normalizedStatus === "medical_absent"
              ? ""
              : row.marks,
        };
      })
    );
  };

  const handleMarksChange = (studentId, value) => {
    setStudentRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? {
              ...row,
              marks: value === "" ? "" : value,
            }
          : row
      )
    );
  };

  const handleRemarksChange = (studentId, value) => {
    setStudentRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? {
              ...row,
              remarks: value,
            }
          : row
      )
    );
  };

  /* ------------------------------------------------------------------------ */
  /* Save                                                                      */
  /* ------------------------------------------------------------------------ */

  const handleSave = async () => {
    if (!selectedGrade || !selectedClass || !selectedSubject || !activeTermId) {
      showSnack("warning", "Please select grade, class, subject, and active term.");
      return;
    }

    if (!studentRows.length) {
      showSnack("warning", "No students found to save marks.");
      return;
    }

    setSaving(true);

    try {
      const selectedCls = normalizeSelectedClass(selectedClass, selectedGrade);
      const batch = writeBatch(db);

      const validRows = studentRows.filter((row) => {
        const status = lower(row.status || "present");
        if (status === "absent" || status === "medical_absent") return true;
        return row.marks !== "" && row.marks !== null && row.marks !== undefined;
      });

      validRows.forEach((row) => {
        const subjectKey = safeString(selectedSubject.subjectId)
          ? safeString(selectedSubject.subjectId)
          : normalizeName(selectedSubject.subjectName);

        const docId = [
          normalizeAcademicYear(academicYear),
          activeTermId,
          selectedCls.grade,
          selectedCls.section,
          subjectKey,
          row.studentId,
        ]
          .filter(Boolean)
          .join("_");

        const markRef = doc(db, "marks", docId);

        const attendanceStatus = lower(row.status || "present");
        const isAbsent =
          attendanceStatus === "absent" || attendanceStatus === "medical_absent";

        batch.set(
          markRef,
          {
            studentId: safeString(row.studentId),
            studentName: safeString(row.studentName),
            admissionNo: safeString(row.admissionNo),

            academicYear: normalizeAcademicYear(academicYear),

            termId: safeString(activeTermId),
            termName: safeString(activeTerm?.name || activeTerm?.termNumber || ""),

            grade: selectedCls.grade,
            className: selectedClass,
            section: selectedCls.section,

            subjectId: safeString(selectedSubject.subjectId),
            subjectName: safeString(selectedSubject.subjectName),

            attendanceStatus,
            status: attendanceStatus, // keep legacy-compatible
            marks: isAbsent ? null : Number(row.marks),
            score: isAbsent ? null : Number(row.marks), // legacy-compatible
            remarks: safeString(row.remarks),

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
  /* UI derived state                                                          */
  /* ------------------------------------------------------------------------ */

  const pageModeLabel = useMemo(() => {
    if (isAdmin) return "Admin Mode";
    if (isTeacher) return "Teacher Mode";
    return "User Mode";
  }, [isAdmin, isTeacher]);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
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
          <Typography variant="body1">Loading marks entry...</Typography>
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
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={2}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SchoolIcon color="primary" />
                  <Typography variant="h5" fontWeight={700}>
                    Marks Entry
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Enrollment-driven subject loading with legacy-safe class matching
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  icon={<AssignmentTurnedInIcon />}
                  label={pageModeLabel}
                  color={isAdmin ? "secondary" : "primary"}
                  variant="outlined"
                />
                {activeTerm ? (
                  <Chip
                    label={`Active Term: ${activeTerm.name || activeTerm.termNumber || activeTerm.id}`}
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Chip label="No Active Term" color="warning" variant="outlined" />
                )}
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
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  fullWidth
                  size="small"
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
                        {term.name || term.termNumber || term.id}
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
                    {classOptions.map((cls) => (
                      <MenuItem key={cls.value} value={cls.value}>
                        {cls.label}
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
                      const key = buildSubjectIdentityKey(
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
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={1}
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
                      <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Marks</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>
                        Remarks
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {studentRows.map((row, index) => {
                      const status = lower(row.status || "present");
                      const marksDisabled =
                        status === "absent" || status === "medical_absent";

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
                                value={status}
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
                                  ? "Marks disabled for absent / medical absent"
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
                                  inputProps={{
                                    min: 0,
                                    step: "any",
                                  }}
                                />
                              </span>
                            </Tooltip>
                          </TableCell>

                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              value={row.remarks}
                              onChange={(e) =>
                                handleRemarksChange(row.studentId, e.target.value)
                              }
                              placeholder="Optional remarks"
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
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MarksEntry;