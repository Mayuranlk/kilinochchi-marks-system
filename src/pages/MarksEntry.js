import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  ActionBar,
  EmptyState,
  MobileListRow,
  PageContainer,
  ResponsiveTableWrapper,
  SectionCard,
  StatCard,
  StatusChip,
} from "../components/ui";
import {
  normalizeText,
  isALGrade,
  buildALClassName,
  buildALDisplayClassName,
} from "../constants";

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const asNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseGrade = (value) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const normalizeSection = (value) => {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
};

const normalizeAcademicYear = (value) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  return match ? match[0] : raw;
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const safeNormalizedEquals = (left, right) => {
  if (!hasValue(left) || !hasValue(right)) return false;
  return normalize(left) === normalize(right);
};

const buildSubjectIdentity = (item = {}, fallback = {}) => ({
  subjectId: pick(item.subjectId, fallback.subjectId, ""),
  subjectName: pick(item.subjectName, item.subject, fallback.subjectName, fallback.subject, ""),
  subjectNumber: pick(item.subjectNumber, fallback.subjectNumber, ""),
});

const matchesSubjectIdentity = (item = {}, target = {}, fallback = {}) => {
  const itemSubject = buildSubjectIdentity(item, fallback);
  const targetSubject = buildSubjectIdentity(target);

  return (
    safeNormalizedEquals(itemSubject.subjectId, targetSubject.subjectId) ||
    safeNormalizedEquals(itemSubject.subjectName, targetSubject.subjectName) ||
    safeNormalizedEquals(itemSubject.subjectNumber, targetSubject.subjectNumber)
  );
};

const buildEnrollmentDedupKey = (item = {}, fallback = {}) => {
  const classContext = getClassContext(item, fallback);
  const subject = buildSubjectIdentity(item, fallback);
  const academicYear = normalizeAcademicYear(pick(item.academicYear, item.year, fallback.academicYear, fallback.year, ""));

  return [
    String(pick(item.studentId, fallback.studentId, "")).trim(),
    normalize(classContext.fullClassName || classContext.className || ""),
    normalize(subject.subjectId),
    normalize(subject.subjectName),
    normalize(subject.subjectNumber),
    normalize(academicYear),
  ].join("__");
};

const getClassIdentity = (item = {}) =>
  pick(item.alClassName, item.fullClassName, item.className, "");

const getResolvedStream = (item = {}, fallback = {}) =>
  normalizeText(pick(item.stream, fallback.stream, ""));

const getResolvedSection = (item = {}, fallback = {}) =>
  normalizeSection(pick(item.section, item.className, fallback.section, fallback.className, ""));

const getResolvedGrade = (item = {}, fallback = {}) =>
  parseGrade(pick(item.grade, fallback.grade, ""));

const getComparableALClassName = (item = {}, fallback = {}) => {
  const explicit = getClassIdentity(item);
  if (explicit) return explicit;

  const grade = getResolvedGrade(item, fallback);
  const section = getResolvedSection(item, fallback);
  const stream = getResolvedStream(item, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return "";
};

const getClassFallback = (item = {}, fallback = {}) => {
  const grade = getResolvedGrade(item, fallback);
  const section = getResolvedSection(item, fallback);
  const stream = getResolvedStream(item, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return pick(
    item.className,
    fallback.className,
    `${pick(item.grade, fallback.grade, "")}${pick(item.section, fallback.section, "")}`.trim()
  );
};

const getDisplayClassName = (item = {}, fallback = {}) => {
  const explicit = pick(item.alClassName, item.fullClassName, fallback.alClassName, fallback.fullClassName, "");
  if (explicit) {
    const grade = getResolvedGrade(item, fallback);
    const section = getResolvedSection(item, fallback);
    const stream = getResolvedStream(item, fallback);

    if (isALGrade(grade) && stream && section) {
      return buildALDisplayClassName(grade, stream, section) || explicit;
    }
    return explicit;
  }

  return getClassFallback(item, fallback);
};

const getClassContext = (item = {}, fallback = {}) => ({
  grade: getResolvedGrade(item, fallback),
  section: getResolvedSection(item, fallback),
  stream: getResolvedStream(item, fallback),
  fullClassName:
    getComparableALClassName(item, fallback) ||
    getClassIdentity(item) ||
    getClassFallback(item, fallback),
  className: pick(item.className, fallback.className, ""),
  alClassName: pick(item.alClassName, fallback.alClassName, ""),
});

const matchesClassContext = (item = {}, target = {}, fallback = {}) => {
  const itemGrade = getResolvedGrade(item, fallback);
  const itemSection = getResolvedSection(item, fallback);
  const itemStream = normalize(getResolvedStream(item, fallback));

  const targetGrade = parseGrade(target.grade);
  const targetSection = normalizeSection(target.section);
  const targetStream = normalize(target.stream);

  const itemIdentity = normalize(
    getComparableALClassName(item, fallback) ||
      getClassIdentity(item) ||
      getClassFallback(item, fallback)
  );

  const targetIdentity = normalize(
    pick(target.fullClassName, target.alClassName, target.className, "")
  );

  if (isALGrade(targetGrade)) {
    if (itemIdentity && targetIdentity && itemIdentity === targetIdentity) {
      return true;
    }

    if (itemGrade !== targetGrade || itemSection !== targetSection) {
      return false;
    }

    if (!targetStream) {
      return true;
    }

    if (itemStream) {
      return itemStream === targetStream;
    }

    return false;
  }

  if (itemIdentity && targetIdentity) {
    return itemIdentity === targetIdentity;
  }

  return itemGrade === targetGrade && itemSection === targetSection;
};

const buildTermKey = (term = {}) =>
  `${pick(term.term, term.termName, "")}__${pick(term.year, term.academicYear, "")}`;

const buildTermLabel = (term) => {
  const termName = pick(term.term, term.termName, term.name, "Term");
  const year = pick(term.year, term.academicYear, "");
  return year ? `${termName} - ${year}` : termName;
};

const isActiveTerm = (term) => {
  const raw = pick(term.isActive, term.active, term.status);
  if (typeof raw === "boolean") return raw;
  return normalize(raw) === "active" || normalize(raw) === "true";
};

const isSameTeacher = (item, user) => {
  const itemTeacherId = normalize(pick(item.teacherId, item.teacherUid, item.userId));
  const itemTeacherEmail = normalize(pick(item.teacherEmail, item.email));
  return (
    itemTeacherId === normalize(user.uid) ||
    itemTeacherEmail === normalize(user.email)
  );
};

const getStudentSortIndex = (row = {}) =>
  String(row.indexNo || row.admissionNo || "").trim();

const sortRowsInTeacherMarkSheetOrder = (rows = []) => {
  return [...rows].sort((a, b) => {
    const aIndex = getStudentSortIndex(a);
    const bIndex = getStudentSortIndex(b);

    if (aIndex && bIndex) {
      const byIndex = aIndex.localeCompare(bIndex, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byIndex !== 0) return byIndex;
    } else if (aIndex && !bIndex) {
      return -1;
    } else if (!aIndex && bIndex) {
      return 1;
    }

    return String(a.studentName || "").localeCompare(
      String(b.studentName || ""),
      undefined,
      { sensitivity: "base" }
    );
  });
};

const sectionCardSx = {
  borderRadius: 3,
  border: "1px solid #e8eaf6",
  boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
  backgroundColor: "white",
};

export default function MarksEntry() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { isAdmin } = useAuth();
  const location = useLocation();
  const markInputRefs = useRef({});
  const appliedNavigationSelectionRef = useRef("");

  const [bootLoading, setBootLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [teacherProfile, setTeacherProfile] = useState(null);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [marksDocs, setMarksDocs] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
  const [selectedTermKey, setSelectedTermKey] = useState("");
  const [searchText, setSearchText] = useState("");

  const [studentRows, setStudentRows] = useState([]);
  const [drafts, setDrafts] = useState({});

  const urlParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const navigationSelection = useMemo(
    () => ({
      className: pick(
        urlParams.get("className"),
        location.state?.className,
        ""
      ),
      fullClassName: pick(
        urlParams.get("fullClassName"),
        location.state?.fullClassName,
        ""
      ),
      stream: pick(
        urlParams.get("stream"),
        location.state?.stream,
        ""
      ),
      subjectName: pick(
        urlParams.get("subjectName"),
        location.state?.subjectName,
        ""
      ),
      subjectId: pick(
        urlParams.get("subjectId"),
        location.state?.subjectId,
        ""
      ),
      termKey: pick(
        urlParams.get("termKey"),
        location.state?.termKey,
        ""
      ),
    }),
    [urlParams, location.state]
  );

  const navigationSignature = useMemo(
    () => JSON.stringify(navigationSelection),
    [navigationSelection]
  );

  const activeTerm = useMemo(
    () => terms.find((t) => buildTermKey(t) === selectedTermKey) || null,
    [terms, selectedTermKey]
  );

  const classOptions = useMemo(() => {
    const map = new Map();

    teacherAssignments.forEach((assignment) => {
      const context = getClassContext(assignment);
      const classIdentity = context.fullClassName;
      if (!classIdentity) return;

      if (!map.has(classIdentity)) {
        map.set(classIdentity, {
          className: context.className,
          fullClassName: classIdentity,
          displayClassName: getDisplayClassName(assignment),
          grade: context.grade,
          section: context.section,
          stream: normalizeText(context.stream),
          alClassName: pick(assignment.alClassName, ""),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.fullClassName).localeCompare(String(b.fullClassName), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [teacherAssignments]);

  const selectedClassRow = useMemo(
    () =>
      classOptions.find(
        (option) => normalize(option.fullClassName) === normalize(selectedClass)
      ) || null,
    [classOptions, selectedClass]
  );

  const subjectOptions = useMemo(() => {
    const map = new Map();

    const targetClassContext = selectedClassRow
      ? {
          grade: selectedClassRow.grade,
          section: selectedClassRow.section,
          stream: selectedClassRow.stream,
          fullClassName: selectedClassRow.fullClassName,
          className: selectedClassRow.className,
          alClassName: selectedClassRow.alClassName,
        }
      : null;

    teacherAssignments
      .filter((assignment) => {
        if (!selectedClass) return true;

        if (targetClassContext) {
          if (matchesClassContext(assignment, targetClassContext)) {
            return true;
          }
        }

        const assignmentClass =
          getComparableALClassName(assignment) ||
          getClassIdentity(assignment) ||
          getClassFallback(assignment);

        return normalize(assignmentClass) === normalize(selectedClass);
      })
      .forEach((assignment) => {
        const subjectId = pick(assignment.subjectId, "");
        const subjectName = pick(assignment.subjectName, assignment.subject, "");
        const subjectNumber = pick(assignment.subjectNumber, "");
        const subjectKey = `${subjectId}__${subjectName}__${subjectNumber}`;

        if (!subjectName) return;

        if (!map.has(subjectKey)) {
          map.set(subjectKey, {
            key: subjectKey,
            subjectId,
            subjectName,
            subjectNumber,
            stream: pick(assignment.stream, ""),
            className: pick(assignment.className, ""),
            fullClassName:
              getComparableALClassName(assignment) ||
              getClassIdentity(assignment) ||
              getClassFallback(assignment),
          });
        }
      });

    return Array.from(map.values()).sort((a, b) =>
      String(a.subjectName).localeCompare(String(b.subjectName), undefined, {
        sensitivity: "base",
      })
    );
  }, [teacherAssignments, selectedClass, selectedClassRow]);

  const selectedSubject = useMemo(
    () => subjectOptions.find((subject) => subject.key === selectedSubjectKey) || null,
    [selectedSubjectKey, subjectOptions]
  );

  const filteredRows = useMemo(() => {
    const search = normalize(searchText);

    return studentRows.filter((row) => {
      return (
        !search ||
        normalize(row.studentName).includes(search) ||
        normalize(row.indexNo).includes(search) ||
        normalize(row.admissionNo).includes(search)
      );
    });
  }, [studentRows, searchText]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const saved = filteredRows.filter(
      (row) => row.existingDocId || row.isDirty === false
    ).length;
    const absent = filteredRows.filter((row) => Boolean(row.absent)).length;
    const draftCount = filteredRows.filter((row) => Boolean(row.isDirty)).length;

    return { total, saved, absent, draftCount };
  }, [filteredRows]);

  const focusRowInput = useCallback((rowKey) => {
    const input = markInputRefs.current[rowKey];
    if (input) {
      input.focus();
      try {
        input.select();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleMarkInputKeyDown = useCallback(
    (event, rowIndex) => {
      if (event.key !== "Enter") return;

      event.preventDefault();

      const nextRow = filteredRows[rowIndex + 1];
      if (nextRow) {
        focusRowInput(nextRow.key);
      }
    },
    [filteredRows, focusRowInput]
  );

  const setMarkInputRef = useCallback((rowKey, element) => {
    if (element) {
      markInputRefs.current[rowKey] = element;
    } else {
      delete markInputRefs.current[rowKey];
    }
  }, []);

  const loadBase = useCallback(async () => {
    try {
      setError("");
      setSuccess("");
      setBootLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User is not logged in.");

      const [usersSnap, teacherAssignmentsSnap, academicTermsSnap, marksSnap] =
        await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "teacherAssignments")),
          getDocs(
            query(collection(db, "academicTerms"), orderBy("year", "desc"))
          ).catch(() => getDocs(collection(db, "academicTerms"))),
          getDocs(collection(db, "marks")),
        ]);

      const allUsers = usersSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const profile =
        allUsers.find(
          (u) => normalize(pick(u.uid, u.userId)) === normalize(currentUser.uid)
        ) ||
        allUsers.find((u) => normalize(u.email) === normalize(currentUser.email)) || {
          id: currentUser.uid,
          uid: currentUser.uid,
          email: currentUser.email || "",
          fullName: currentUser.displayName || "Teacher",
          name: currentUser.displayName || "Teacher",
        };

      setTeacherProfile(profile);

      const allAssignments = teacherAssignmentsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const scopedAssignments = isAdmin
        ? allAssignments
        : allAssignments.filter((item) => isSameTeacher(item, currentUser));

      setTeacherAssignments(scopedAssignments);

      const allTerms = academicTermsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const sortedTerms = allTerms.sort((a, b) => {
        const yearDiff =
          Number(pick(b.year, b.academicYear, 0)) -
          Number(pick(a.year, a.academicYear, 0));
        if (yearDiff !== 0) return yearDiff;

        return String(pick(a.term, a.termName, "")).localeCompare(
          String(pick(b.term, b.termName, "")),
          undefined,
          { sensitivity: "base" }
        );
      });

      setTerms(sortedTerms);

      const defaultTerm = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;

      if (!selectedTermKey && defaultTerm) {
        setSelectedTermKey(buildTermKey(defaultTerm));
      }

      const allMarks = marksSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMarksDocs(allMarks);

      if (!selectedClass && scopedAssignments.length > 0) {
        const defaultClass =
          getComparableALClassName(scopedAssignments[0]) ||
          getClassIdentity(scopedAssignments[0]) ||
          getClassFallback(scopedAssignments[0]);
        setSelectedClass(defaultClass);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load marks entry page.");
    } finally {
      setBootLoading(false);
    }
  }, [isAdmin, selectedClass, selectedTermKey]);

  const loadStudents = useCallback(async () => {
    try {
      setLoadingRows(true);
      setError("");
      setSuccess("");

      if (!selectedClass || !selectedSubject || !activeTerm) {
        setStudentRows([]);
        setDrafts({});
        return;
      }

      const [enrollmentsSnap, studentSnap] = await Promise.all([
        getDocs(collection(db, "studentSubjectEnrollments")),
        getDocs(collection(db, "students")),
      ]);

      const allEnrollments = enrollmentsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const allStudents = studentSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const studentMap = new Map(
        allStudents.map((student) => [String(student.id), student])
      );

      const termName = pick(activeTerm.term, activeTerm.termName, "");
      const termYear = normalizeAcademicYear(pick(activeTerm.year, activeTerm.academicYear, ""));

      const targetClassContext = selectedClassRow
        ? {
            grade: selectedClassRow.grade,
            section: selectedClassRow.section,
            stream: selectedClassRow.stream,
            fullClassName: selectedClassRow.fullClassName,
            className: selectedClassRow.className,
            alClassName: selectedClassRow.alClassName,
          }
        : null;

      const relevantEnrollments = allEnrollments.filter((enrollment) => {
        const student = studentMap.get(String(pick(enrollment.studentId, ""))) || {};

        const enrollmentContext = {
          ...enrollment,
          stream: pick(enrollment.stream, student.stream, ""),
          fullClassName:
            pick(enrollment.fullClassName, enrollment.alClassName, "") ||
            getComparableALClassName(enrollment, student),
          alClassName:
            pick(enrollment.alClassName, "") ||
            getComparableALClassName(enrollment, student),
        };

        const sameClass = targetClassContext
          ? matchesClassContext(enrollmentContext, targetClassContext, student)
          : false;

        const sameSubject = matchesSubjectIdentity(enrollment, selectedSubject, student);

        const sameYear =
          !termYear ||
          normalizeAcademicYear(pick(enrollment.academicYear, enrollment.year, "")) ===
            normalize(termYear);

        const status = normalize(pick(enrollment.status, "active"));

        return sameClass && sameSubject && sameYear && (!status || status === "active");
      });

      const uniqueRelevantEnrollments = Array.from(
        relevantEnrollments.reduce((map, enrollment) => {
          const student = studentMap.get(String(pick(enrollment.studentId, ""))) || {};
          const dedupKey = buildEnrollmentDedupKey(enrollment, student);
          if (!dedupKey) return map;

          const existing = map.get(dedupKey);
          if (!existing) {
            map.set(dedupKey, enrollment);
            return map;
          }

          const existingScore =
            (hasValue(existing.subjectId) ? 4 : 0) +
            (hasValue(existing.subjectName) ? 2 : 0) +
            (hasValue(existing.subjectNumber) ? 1 : 0);
          const currentScore =
            (hasValue(enrollment.subjectId) ? 4 : 0) +
            (hasValue(enrollment.subjectName) ? 2 : 0) +
            (hasValue(enrollment.subjectNumber) ? 1 : 0);

          if (currentScore >= existingScore) {
            map.set(dedupKey, enrollment);
          }

          return map;
        }, new Map()).values()
      );

      const mappedRows = uniqueRelevantEnrollments.map((enrollment) => {
        const studentId = String(pick(enrollment.studentId, ""));
        const student = studentMap.get(studentId) || {};

        const mergedContext = {
          ...enrollment,
          grade: pick(enrollment.grade, student.grade, ""),
          section: pick(enrollment.section, student.section, ""),
          stream: pick(enrollment.stream, student.stream, ""),
          fullClassName:
            pick(enrollment.fullClassName, enrollment.alClassName, "") ||
            getComparableALClassName(enrollment, student) ||
            selectedClass,
          alClassName:
            pick(enrollment.alClassName, "") ||
            getComparableALClassName(enrollment, student) ||
            "",
          className: pick(enrollment.className, student.className, selectedClassRow?.className, ""),
        };

        const existingMark = marksDocs.find((mark) => {
          const sameStudent = String(pick(mark.studentId, "")) === studentId;

          const sameClass = targetClassContext
            ? matchesClassContext(
                {
                  ...mark,
                  stream: pick(mark.stream, mergedContext.stream, ""),
                  fullClassName:
                    pick(mark.fullClassName, mark.alClassName, "") ||
                    getComparableALClassName(mark, mergedContext),
                  alClassName:
                    pick(mark.alClassName, "") ||
                    getComparableALClassName(mark, mergedContext),
                },
                targetClassContext,
                mergedContext
              )
            : false;

          const sameSubject = matchesSubjectIdentity(mark, selectedSubject, mergedContext);

          const sameTerm =
            normalize(pick(mark.term, mark.termName, "")) ===
            normalize(termName);

          const sameYear =
            normalizeAcademicYear(pick(mark.academicYear, mark.year, "")) ===
            normalize(termYear);

          return sameStudent && sameClass && sameSubject && sameTerm && sameYear;
        });

        const studentName = pick(
          student.fullName,
          student.name,
          enrollment.studentName,
          "Student"
        );

        const indexNo = pick(student.indexNo, enrollment.indexNo, "");
        const admissionNo = pick(student.admissionNo, enrollment.admissionNo, "");
        const markValue = pick(
          existingMark?.mark,
          existingMark?.marks,
          existingMark?.score,
          ""
        );
        const absent = Boolean(
          pick(existingMark?.absent, existingMark?.isAbsent, false)
        );

        return {
          key: `${studentId}-${selectedSubject.subjectName}-${termName}-${termYear}`,
          enrollmentId: enrollment.id,
          studentId,
          studentName,
          indexNo,
          admissionNo,
          grade: pick(enrollment.grade, student.grade, ""),
          section: pick(enrollment.section, student.section, ""),
          className: pick(enrollment.className, student.className, selectedClassRow?.className, ""),
          fullClassName:
            pick(enrollment.fullClassName, enrollment.alClassName, "") ||
            getComparableALClassName(enrollment, student) ||
            selectedClass,
          stream: pick(enrollment.stream, student.stream, selectedClassRow?.stream, ""),
          subjectId: pick(enrollment.subjectId, selectedSubject.subjectId, ""),
          subjectName: pick(
            enrollment.subjectName,
            selectedSubject.subjectName,
            ""
          ),
          subjectNumber: pick(
            enrollment.subjectNumber,
            selectedSubject.subjectNumber,
            ""
          ),
          term: termName,
          academicYear: termYear,
          mark: absent ? "" : markValue ?? "",
          absent,
          existingDocId: existingMark?.id || "",
          isDirty: false,
        };
      });

      const rows = sortRowsInTeacherMarkSheetOrder(mappedRows);

      const nextDrafts = {};
      rows.forEach((row) => {
        nextDrafts[row.key] = {
          mark: row.mark,
          absent: row.absent,
        };
      });

      markInputRefs.current = {};
      setStudentRows(rows);
      setDrafts(nextDrafts);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load enrolled students.");
      setStudentRows([]);
      setDrafts({});
    } finally {
      setLoadingRows(false);
    }
  }, [activeTerm, marksDocs, selectedClass, selectedSubject, selectedClassRow]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    appliedNavigationSelectionRef.current = "";
    setSelectedSubjectKey("");
  }, [location.key, location.search]);

  useEffect(() => {
    if (bootLoading) return;

    const targetClass = navigationSelection.fullClassName || navigationSelection.className;
    if (!targetClass) return;

    const matchedClass = classOptions.find(
      (option) =>
        normalize(option.fullClassName) === normalize(targetClass) ||
        normalize(option.className) === normalize(targetClass)
    );

    if (matchedClass && selectedClass !== matchedClass.fullClassName) {
      setSelectedClass(matchedClass.fullClassName);
    }
  }, [
    bootLoading,
    navigationSelection.fullClassName,
    navigationSelection.className,
    classOptions,
    selectedClass,
  ]);

  useEffect(() => {
    if (bootLoading) return;
    if (!navigationSelection.termKey) return;

    const matchedTerm = terms.find(
      (term) => buildTermKey(term) === navigationSelection.termKey
    );

    if (matchedTerm) {
      const nextTermKey = buildTermKey(matchedTerm);
      if (selectedTermKey !== nextTermKey) {
        setSelectedTermKey(nextTermKey);
      }
    }
  }, [bootLoading, navigationSelection.termKey, terms, selectedTermKey]);

  useEffect(() => {
    if (bootLoading) return;
    if (!selectedClass) return;
    if (!subjectOptions.length) return;

    const hasNavigationSubject =
      Boolean(navigationSelection.subjectId) || Boolean(navigationSelection.subjectName);

    if (!hasNavigationSubject) return;

    const matchedSubject = subjectOptions.find((option) => {
      const subjectIdMatch =
        navigationSelection.subjectId &&
        normalize(option.subjectId) === normalize(navigationSelection.subjectId);

      const subjectNameMatch =
        navigationSelection.subjectName &&
        normalize(option.subjectName) === normalize(navigationSelection.subjectName);

      return subjectIdMatch || subjectNameMatch;
    });

    if (matchedSubject && selectedSubjectKey !== matchedSubject.key) {
      setSelectedSubjectKey(matchedSubject.key);
      appliedNavigationSelectionRef.current = navigationSignature;
    }
  }, [
    bootLoading,
    selectedClass,
    subjectOptions,
    navigationSelection,
    navigationSignature,
    selectedSubjectKey,
  ]);

  useEffect(() => {
    if (!selectedClass) return;
    if (!subjectOptions.length) return;

    const currentSubjectStillExists = subjectOptions.some(
      (option) => option.key === selectedSubjectKey
    );

    if (currentSubjectStillExists) return;

    const hasNavigationSubject =
      Boolean(navigationSelection.subjectId) || Boolean(navigationSelection.subjectName);

    const navigationApplied =
      appliedNavigationSelectionRef.current === navigationSignature;

    if (hasNavigationSubject && !navigationApplied) {
      return;
    }

    setSelectedSubjectKey(subjectOptions[0]?.key || "");
  }, [
    selectedClass,
    subjectOptions,
    selectedSubjectKey,
    navigationSelection,
    navigationSignature,
  ]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const setRowValue = (rowKey, updates) => {
    setDrafts((prev) => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        ...updates,
      },
    }));

    setStudentRows((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              ...updates,
              isDirty: true,
            }
          : row
      )
    );
  };

  const handleMarkChange = (rowKey, value) => {
    const safeValue = value === "" ? "" : value.replace(/[^\d.]/g, "");
    setRowValue(rowKey, {
      mark: safeValue,
      absent: safeValue !== "" ? false : drafts[rowKey]?.absent ?? false,
    });
  };

  const handleAbsentChange = (rowKey, checked) => {
    setRowValue(rowKey, {
      absent: checked,
      mark: checked ? "" : drafts[rowKey]?.mark ?? "",
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!selectedClass || !selectedSubject || !activeTerm) {
        throw new Error("Please select class, subject, and term.");
      }

      const dirtyRows = studentRows.filter((row) => row.isDirty);

      if (dirtyRows.length === 0) {
        setSuccess("No changes to save.");
        return;
      }

      const batch = writeBatch(db);
      const currentUser = auth.currentUser;
      const teacherName = pick(
        teacherProfile?.fullName,
        teacherProfile?.name,
        currentUser?.displayName,
        "Teacher"
      );

      for (const row of dirtyRows) {
        const markValue = asNumber(row.mark);
        const absent = Boolean(row.absent);

        if (!absent && row.mark !== "" && markValue === null) {
          throw new Error(`Invalid mark entered for ${row.studentName}.`);
        }

        const payload = {
          studentId: row.studentId,
          studentName: row.studentName,
          admissionNo: row.admissionNo || "",
          indexNo: row.indexNo || "",
          className: row.className || selectedClassRow?.className || "",
          fullClassName: row.fullClassName || selectedClass,
          alClassName: row.stream ? row.fullClassName || selectedClass : "",
          grade: row.grade || "",
          section: row.section || "",
          stream: row.stream || "",
          subjectId: row.subjectId || "",
          subjectName: row.subjectName,
          subject: row.subjectName,
          subjectNumber: row.subjectNumber || "",
          term: row.term,
          termName: row.term,
          academicYear: row.academicYear,
          year: row.academicYear,
          mark: absent ? null : markValue,
          marks: absent ? null : markValue,
          score: absent ? null : markValue,
          absent,
          isAbsent: absent,
          teacherId: currentUser?.uid || "",
          teacherName,
          updatedAt: serverTimestamp(),
        };

        if (row.existingDocId) {
          batch.set(doc(db, "marks", row.existingDocId), payload, { merge: true });
        } else {
          const newRef = doc(collection(db, "marks"));
          batch.set(newRef, {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      setSuccess("Marks saved successfully.");
      await loadBase();
      await loadStudents();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save marks.");
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = studentRows.filter((row) => row.isDirty).length;
  const saveProgress =
    studentRows.length > 0
      ? Math.round(((studentRows.length - dirtyCount) / studentRows.length) * 100)
      : 0;

  if (bootLoading) {
    return (
      <PageContainer
        title="Marks Entry"
        subtitle="Loading marks entry workspace..."
      >
        <SectionCard>
          <Stack alignItems="center" spacing={2} py={6}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading marks entry...
            </Typography>
          </Stack>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Marks Entry"
      subtitle="Mobile-friendly subject-wise mark entry for enrolled students."
      actions={
        <Button
          variant="outlined"
          startIcon={loadingRows ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
          onClick={() => {
            loadBase();
            loadStudents();
          }}
        >
          Refresh
        </Button>
      }
    >
      <Stack spacing={2.25}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Paper sx={{ ...sectionCardSx, p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
                  Select Mark Entry Context
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose class, subject, and term before entering marks.
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="marks-entry-class-label">Class</InputLabel>
                <Select
                  labelId="marks-entry-class-label"
                  label="Class"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  {classOptions.map((option) => (
                    <MenuItem key={option.fullClassName} value={option.fullClassName}>
                      {option.displayClassName || option.fullClassName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="marks-entry-subject-label">Subject</InputLabel>
                <Select
                  labelId="marks-entry-subject-label"
                  label="Subject"
                  value={selectedSubjectKey}
                  onChange={(e) => setSelectedSubjectKey(e.target.value)}
                >
                  {subjectOptions.map((option) => (
                    <MenuItem key={option.key} value={option.key}>
                      {option.subjectName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="marks-entry-term-label">Academic Term</InputLabel>
                <Select
                  labelId="marks-entry-term-label"
                  label="Academic Term"
                  value={selectedTermKey}
                  onChange={(e) => setSelectedTermKey(e.target.value)}
                >
                  {terms.map((term) => {
                    const key = buildTermKey(term);
                    return (
                      <MenuItem key={term.id} value={key}>
                        {buildTermLabel(term)}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="Search student"
                placeholder="Name, index no, admission no"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <SearchRoundedIcon
                      fontSize="small"
                      style={{ marginRight: 8, opacity: 0.7 }}
                    />
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Students"
              value={stats.total}
              icon={<GroupRoundedIcon />}
              color="primary"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Saved Rows"
              value={stats.saved}
              icon={<CheckCircleRoundedIcon />}
              color="success"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Draft Changes"
              value={stats.draftCount}
              icon={<EditNoteRoundedIcon />}
              color="warning"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              title="Absent"
              value={stats.absent}
              icon={<ClassRoundedIcon />}
              color="error"
            />
          </Grid>
        </Grid>

        <Paper sx={{ ...sectionCardSx, p: 2.25 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
                  Mark Entry Sheet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedClass && selectedSubject && activeTerm
                    ? `${selectedClassRow?.displayClassName || selectedClass} - ${selectedSubject.subjectName} - ${buildTermLabel(activeTerm)}`
                    : "Select class, subject, and term to begin."}
                </Typography>
              </Box>

              {selectedClass && selectedSubject && activeTerm ? (
                <StatusChip
                  status={dirtyCount > 0 ? "draft" : "saved"}
                  label={dirtyCount > 0 ? `${dirtyCount} unsaved` : "All saved"}
                />
              ) : null}
            </Stack>

            {(loadingRows || saving) && (
              <Box>
                <LinearProgress />
              </Box>
            )}

            {selectedClass && selectedSubject && activeTerm ? (
              <>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={<SchoolRoundedIcon />}
                      label={selectedClassRow?.displayClassName || selectedClass}
                      color="primary"
                      variant="outlined"
                    />
                    {selectedClassRow?.stream ? (
                      <Chip
                        icon={<ClassRoundedIcon />}
                        label={selectedClassRow.stream}
                        color="secondary"
                        variant="outlined"
                      />
                    ) : null}
                    <Chip
                      icon={<AutoStoriesRoundedIcon />}
                      label={selectedSubject.subjectName}
                      variant="outlined"
                    />
                    {selectedSubject.subjectNumber ? (
                      <Chip
                        label={`No. ${selectedSubject.subjectNumber}`}
                        variant="outlined"
                      />
                    ) : null}
                    <Chip
                      icon={<TimelineRoundedIcon />}
                      label={buildTermLabel(activeTerm)}
                      variant="outlined"
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Save progress: {saveProgress}%
                  </Typography>
                </Stack>

                {filteredRows.length === 0 ? (
                  <EmptyState
                    title="No enrolled students found"
                    description="No active student subject enrollments matched the current class, subject, and academic year."
                  />
                ) : isMobile ? (
                  <Stack spacing={1.25}>
                    {filteredRows.map((row, index) => (
                      <MobileListRow
                        key={row.key}
                        title={`${index + 1}. ${row.studentName}`}
                        subtitle={[
                          row.indexNo ? `Index: ${row.indexNo}` : null,
                          row.admissionNo ? `Admission: ${row.admissionNo}` : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                        right={
                          row.isDirty ? (
                            <StatusChip status="draft" />
                          ) : row.existingDocId ? (
                            <StatusChip status="saved" />
                          ) : (
                            <StatusChip status="pending" label="New" />
                          )
                        }
                        footer={
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {row.subjectNumber ? (
                                <Chip size="small" variant="outlined" label={`No. ${row.subjectNumber}`} />
                              ) : null}
                              {row.stream ? (
                                <Chip size="small" variant="outlined" label={row.stream} />
                              ) : null}
                            </Stack>

                            <Grid container spacing={1.25}>
                              <Grid item xs={7}>
                                <TextField
                                  label="Mark"
                                  value={drafts[row.key]?.mark ?? row.mark ?? ""}
                                  onChange={(e) => handleMarkChange(row.key, e.target.value)}
                                  onKeyDown={(e) => handleMarkInputKeyDown(e, index)}
                                  disabled={drafts[row.key]?.absent ?? row.absent}
                                  inputProps={{
                                    inputMode: "decimal",
                                  }}
                                  inputRef={(element) => setMarkInputRef(row.key, element)}
                                />
                              </Grid>
                              <Grid item xs={5}>
                                <Box
                                  sx={{
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 2,
                                    px: 1,
                                  }}
                                >
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={Boolean(drafts[row.key]?.absent ?? row.absent)}
                                        onChange={(e) =>
                                          handleAbsentChange(row.key, e.target.checked)
                                        }
                                      />
                                    }
                                    label="Absent"
                                    sx={{ mr: 0 }}
                                  />
                                </Box>
                              </Grid>
                            </Grid>
                          </Stack>
                        }
                      />
                    ))}
                  </Stack>
                ) : (
                  <ResponsiveTableWrapper minWidth={1080}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell width={80}>No</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell width={140}>Index No</TableCell>
                          <TableCell width={160}>Admission No</TableCell>
                          <TableCell width={110}>Subject No</TableCell>
                          <TableCell width={140}>Stream</TableCell>
                          <TableCell width={160}>Mark</TableCell>
                          <TableCell width={120}>Absent</TableCell>
                          <TableCell width={140}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredRows.map((row, index) => (
                          <TableRow key={row.key} hover>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {row.studentName}
                              </Typography>
                            </TableCell>
                            <TableCell>{row.indexNo || "-"}</TableCell>
                            <TableCell>{row.admissionNo || "-"}</TableCell>
                            <TableCell>{row.subjectNumber || "-"}</TableCell>
                            <TableCell>{row.stream || "-"}</TableCell>
                            <TableCell>
                              <TextField
                                value={drafts[row.key]?.mark ?? row.mark ?? ""}
                                onChange={(e) => handleMarkChange(row.key, e.target.value)}
                                onKeyDown={(e) => handleMarkInputKeyDown(e, index)}
                                disabled={drafts[row.key]?.absent ?? row.absent}
                                inputProps={{
                                  inputMode: "decimal",
                                }}
                                inputRef={(element) => setMarkInputRef(row.key, element)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                checked={Boolean(drafts[row.key]?.absent ?? row.absent)}
                                onChange={(e) =>
                                  handleAbsentChange(row.key, e.target.checked)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {row.isDirty ? (
                                <StatusChip status="draft" />
                              ) : row.existingDocId ? (
                                <StatusChip status="saved" />
                              ) : (
                                <StatusChip status="pending" label="New" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableWrapper>
                )}

                <ActionBar sticky>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusChip status="active" label={`${filteredRows.length} rows`} />
                    <StatusChip
                      status={dirtyCount > 0 ? "draft" : "saved"}
                      label={`${dirtyCount} unsaved`}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={() => loadStudents()}
                      disabled={loadingRows || saving}
                      startIcon={<RefreshRoundedIcon />}
                    >
                      Reload
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSave}
                      disabled={saving || loadingRows || dirtyCount === 0}
                      startIcon={
                        saving ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <SaveRoundedIcon />
                        )
                      }
                    >
                      Save Marks
                    </Button>
                  </Stack>
                </ActionBar>
              </>
            ) : (
              <EmptyState
                title="Select filters to start"
                description="Choose class, subject, and academic term to load enrolled students for mark entry."
              />
            )}
          </Stack>
        </Paper>
      </Stack>
    </PageContainer>
  );
}