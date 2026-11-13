import { academicDisplay, academicSearch } from "../utils/academicDisplay";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
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
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useSbaTermGate } from "../utils/useSbaTermGate";
import { useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  getCollectionRows,
  invalidateCollectionRows,
} from "../services/firestoreReadCache";
import {
  loadSbaRosterData,
  loadSbaTeacherAssignments,
} from "../services/sbaService";
import { loadMarksForStudents } from "../services/marksEntryDataService";
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
import {
  getAcademicMedium,
  matchesAcademicMedium,
} from "../utils/academicMediumUtils";
import {
  DEFAULT_MARKS_ENTRY_SETTINGS,
  getTeacherMarksEntryLockReason,
  isTeacherMarksEntryLocked,
  normalizeMarksEntrySettings,
} from "../utils/marksEntryAccess";
import { buildCanonicalMarkFields } from "../utils/firestoreCanonical";

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
  const canonicalSubjectKey =
    hasValue(subject.subjectNumber)
      ? `number:${normalize(subject.subjectNumber)}`
      : hasValue(subject.subjectName)
        ? `name:${normalize(subject.subjectName).replace(/[\s._\-/&()]+/g, "")}`
        : `id:${normalize(subject.subjectId)}`;

  return [
    String(pick(item.studentId, fallback.studentId, "")).trim(),
    normalize(classContext.fullClassName || classContext.className || ""),
    canonicalSubjectKey,
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

const LEGACY_PRACTICE_ASSESSMENT_PREFIX = "__LEGACY_PRACTICE_TERM__:";

const getLegacyPracticeTermInfo = (term = {}) => {
  const termName = normalizeText(pick(term.term, term.termName, term.name, ""));
  const match = termName.match(/^(Term\s+\d+)\s+(.+)$/i);
  if (!match) return null;

  const suffix = normalizeText(match[2]);
  if (!/practice|exam|unit|test/i.test(suffix)) return null;

  return {
    baseTerm: normalizeText(match[1]).replace(/\s+/g, " "),
    label: termName,
    legacyTermName: termName,
    year: Number(pick(term.year, term.academicYear, 0)),
  };
};

const buildLegacyPracticeAssessmentId = (termName) =>
  `${LEGACY_PRACTICE_ASSESSMENT_PREFIX}${encodeURIComponent(normalizeText(termName))}`;

const getLegacyPracticeTermNameFromAssessmentId = (assessmentId = "") => {
  if (!String(assessmentId).startsWith(LEGACY_PRACTICE_ASSESSMENT_PREFIX)) return "";
  return decodeURIComponent(String(assessmentId).slice(LEGACY_PRACTICE_ASSESSMENT_PREFIX.length));
};

const isActiveTerm = (term) => {
  const raw = pick(term.isActive, term.active, term.status);
  if (typeof raw === "boolean") return raw;
  return normalize(raw) === "active" || normalize(raw) === "true";
};

const getStudentSortIndex = (row = {}) =>
  String(row.indexNo || row.admissionNo || "").trim();

const getStudentEntryLabel = (row = {}, fallbackIndex = 0) => {
  const indexNo = String(row.indexNo || "").trim();
  const admissionNo = String(row.admissionNo || "").trim();
  if (indexNo) return indexNo;
  if (admissionNo) return admissionNo;
  return `Row ${fallbackIndex + 1}`;
};

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
  border: "1px solid",
  borderColor: "divider",
  boxShadow: 1,
  backgroundColor: "background.paper",
};

const mobileStickyOffset = 76;

export default function MarksEntry() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { isAdmin, profile: authProfile } = useAuth();
  const location = useLocation();
  const markInputRefs = useRef({});
  const retainedSaveRows = useRef(new Map());
  const appliedNavigationSelectionRef = useRef("");

  const [bootLoading, setBootLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingMarkId, setDeletingMarkId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [teacherProfile, setTeacherProfile] = useState(null);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [practiceExams, setPracticeExams] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [adminStudents, setAdminStudents] = useState([]);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [adminStudentMarks, setAdminStudentMarks] = useState([]);
  const [adminStudentMarksLoading, setAdminStudentMarksLoading] = useState(false);
  const [scopeRefreshVersion, setScopeRefreshVersion] = useState(0);
  const lastScopeRefreshVersion = useRef(0);
  const [entrySettings, setEntrySettings] = useState(DEFAULT_MARKS_ENTRY_SETTINGS);
  const [entrySettingsLoading, setEntrySettingsLoading] = useState(!isAdmin);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
  const [selectedTermKey, setSelectedTermKey] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("__TERM__");
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
      medium: pick(
        urlParams.get("medium"),
        location.state?.medium,
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

  const termOptions = useMemo(() => {
    const baseTermKeys = new Set(
      terms
        .filter((term) => !getLegacyPracticeTermInfo(term))
        .map((term) => `${normalizeText(pick(term.term, term.termName, ""))}__${Number(pick(term.year, term.academicYear, 0))}`)
    );

    return terms.filter((term) => {
      const legacyInfo = getLegacyPracticeTermInfo(term);
      if (!legacyInfo) return true;
      return !baseTermKeys.has(`${legacyInfo.baseTerm}__${legacyInfo.year}`);
    });
  }, [terms]);

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
        const medium = getAcademicMedium(assignment);
        const subjectKey = `${subjectId}__${subjectName}__${subjectNumber}__${medium}`;

        if (!subjectName) return;

        if (!map.has(subjectKey)) {
          map.set(subjectKey, {
            key: subjectKey,
            subjectId,
            subjectName,
            subjectNumber,
            medium,
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

  const assessmentOptions = useMemo(() => {
    if (!activeTerm || !selectedSubject || !selectedClassRow) {
      return [{ id: "__TERM__", name: "Main Term Exam" }];
    }

    const termName = pick(activeTerm.term, activeTerm.termName, "");
    const termYear = Number(pick(activeTerm.year, activeTerm.academicYear, 0));
    const classGrade = Number(selectedClassRow.grade);
    const subjectName = normalize(selectedSubject.subjectName);

    const legacyPracticeTerms = terms
      .map((term) => getLegacyPracticeTermInfo(term))
      .filter(
        (term) =>
          term &&
          normalize(term.baseTerm) === normalize(termName) &&
          Number(term.year || 0) === termYear
      )
      .map((term) => ({
        id: buildLegacyPracticeAssessmentId(term.legacyTermName),
        name: term.label,
        legacyTermName: term.legacyTermName,
      }));

    const matchingPracticeExams = practiceExams
      .filter((exam) => {
        const sameTerm = normalize(pick(exam.term, exam.termName, "")) === normalize(termName);
        const sameYear = Number(pick(exam.year, exam.academicYear, 0)) === termYear;
        const sameGrade = Number(exam.grade || 0) === classGrade;
        const sameSubject = normalize(exam.subjectName) === subjectName;
        return sameTerm && sameYear && sameGrade && sameSubject;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

    return [
      { id: "__TERM__", name: "Main Term Exam" },
      ...legacyPracticeTerms,
      ...matchingPracticeExams.map((exam) => ({
        id: exam.id,
        name: exam.name,
        exam,
      })),
    ];
  }, [activeTerm, selectedSubject, selectedClassRow, practiceExams, terms]);

  const selectedAssessment = useMemo(
    () => assessmentOptions.find((option) => option.id === selectedAssessmentId) || assessmentOptions[0],
    [assessmentOptions, selectedAssessmentId]
  );

  const filteredRows = useMemo(() => {
    const search = normalize(searchText);

    return studentRows.filter((row) => {
      return (
        !search ||
        academicSearch(normalize(row.studentName), search) ||
        academicSearch(normalize(row.indexNo), search) ||
        academicSearch(normalize(row.admissionNo), search)
      );
    });
  }, [studentRows, searchText]);

  const getAdminStudentLabel = useCallback((student) => {
    if (!student) return "";
    const name = pick(student.name, student.fullName, "Unnamed student");
    const admissionNo = pick(student.admissionNo, "");
    const emisStudentId = pick(
      student.emisStudentId,
      student.emisId,
      student.externalStudentId,
      ""
    );
    const className = pick(student.fullClassName, student.className, "");
    const details = [admissionNo && `Admission ${admissionNo}`, emisStudentId && `EMIS ${emisStudentId}`, className]
      .filter(Boolean)
      .join(" | ");
    return details ? `${name} - ${details}` : name;
  }, []);

  const deleteStudentMarks = useMemo(() => {
    if (!deleteStudent) return [];

    const studentId = String(deleteStudent.id || "");
    const admissionNo = normalize(deleteStudent.admissionNo);
    const emisStudentId = normalize(
      pick(deleteStudent.emisStudentId, deleteStudent.emisId, deleteStudent.externalStudentId, "")
    );

    return adminStudentMarks
      .filter((mark) => {
        const markStudentId = String(pick(mark.studentId, ""));
        if (markStudentId) return markStudentId === studentId;

        const markAdmissionNo = normalize(mark.admissionNo);
        const markEmisStudentId = normalize(
          pick(mark.emisStudentId, mark.emisId, mark.externalStudentId, "")
        );
        return (
          (admissionNo && markAdmissionNo === admissionNo) ||
          (emisStudentId && markEmisStudentId === emisStudentId)
        );
      })
      .sort((a, b) => {
        const yearDiff = Number(pick(b.year, b.academicYear, 0)) - Number(pick(a.year, a.academicYear, 0));
        if (yearDiff !== 0) return yearDiff;
        return String(pick(a.subjectName, a.subject, "")).localeCompare(
          String(pick(b.subjectName, b.subject, "")),
          undefined,
          { sensitivity: "base" }
        );
      });
  }, [adminStudentMarks, deleteStudent]);

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

  const loadBase = useCallback(async (forceRefresh = false) => {
    try {
      setError("");
      setSuccess("");
      setBootLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User is not logged in.");

      if (forceRefresh) {
        setScopeRefreshVersion((version) => version + 1);
      }

      const [allAssignments, allTerms, loadedPracticeExams, students] =
        await Promise.all([
          isAdmin
            ? getCollectionRows(db, "teacherAssignments", { forceRefresh })
            : loadSbaTeacherAssignments(currentUser, { forceRefresh }),
          getCollectionRows(db, "academicTerms", { forceRefresh }),
          getCollectionRows(db, "practiceExams", { forceRefresh }).catch(() => []),
          isAdmin
            ? getCollectionRows(db, "students", { forceRefresh })
            : Promise.resolve([]),
        ]);

      const profile = authProfile || {
          id: currentUser.uid,
          uid: currentUser.uid,
          email: currentUser.email || "",
          fullName: currentUser.displayName || "Teacher",
          name: currentUser.displayName || "Teacher",
        };

      setTeacherProfile(profile);
      setTeacherAssignments(allAssignments);

      const sortedTerms = [...allTerms].sort((a, b) => {
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
      setPracticeExams(loadedPracticeExams);
      setAllStudents([]);
      setAllEnrollments([]);

      const activeTermDoc = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;
      const activeLegacyInfo = getLegacyPracticeTermInfo(activeTermDoc);
      const defaultTerm =
        activeLegacyInfo
          ? sortedTerms.find(
              (term) =>
                !getLegacyPracticeTermInfo(term) &&
                normalize(pick(term.term, term.termName, "")) === normalize(activeLegacyInfo.baseTerm) &&
                Number(pick(term.year, term.academicYear, 0)) === activeLegacyInfo.year
            ) || activeTermDoc
          : activeTermDoc;

      if (defaultTerm) {
        setSelectedTermKey((previous) => previous || buildTermKey(defaultTerm));
      }

      setAdminStudents(
        isAdmin
          ? [...students].sort((a, b) =>
              String(pick(a.name, a.fullName, "")).localeCompare(
                String(pick(b.name, b.fullName, "")),
                undefined,
                { sensitivity: "base" }
              )
            )
          : []
      );

      if (allAssignments.length > 0) {
        const defaultClass =
          getComparableALClassName(allAssignments[0]) ||
          getClassIdentity(allAssignments[0]) ||
          getClassFallback(allAssignments[0]);
        setSelectedClass((previous) => previous || defaultClass);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load marks entry page.");
    } finally {
      setBootLoading(false);
    }
  }, [authProfile, isAdmin]);

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

      const termName = pick(activeTerm.term, activeTerm.termName, "");
      const termYear = normalizeAcademicYear(pick(activeTerm.year, activeTerm.academicYear, ""));
      const forceRefresh = scopeRefreshVersion !== lastScopeRefreshVersion.current;
      lastScopeRefreshVersion.current = scopeRefreshVersion;
      const scopeAssignment = {
        ...selectedClassRow,
        ...selectedSubject,
        subjectId: selectedSubject.subjectId,
        subjectName: selectedSubject.subjectName,
        medium: selectedSubject.medium,
        fullClassName: selectedClassRow?.fullClassName || selectedClass,
      };
      const {
        students: scopedStudents,
        enrollments: scopedEnrollments,
      } = await loadSbaRosterData(
        [selectedSubject.subjectId],
        activeTerm,
        scopeAssignment,
        { forceRefresh }
      );
      const scopedMarks = await loadMarksForStudents(
        scopedStudents.map((student) => student.id),
        { academicYear: termYear, subjectId: selectedSubject.subjectId },
        { forceRefresh }
      );
      setAllStudents(scopedStudents);
      setAllEnrollments(scopedEnrollments);

      const studentMap = new Map(
        scopedStudents.map((student) => [String(student.id), student])
      );
      const selectedLegacyTermName = getLegacyPracticeTermNameFromAssessmentId(selectedAssessmentId);
      const selectedPracticeExamId =
        selectedAssessmentId === "__TERM__" || selectedLegacyTermName ? "" : selectedAssessmentId;
      const selectedAssessmentName = normalizeText(
        selectedAssessmentId === "__TERM__" ? "" : selectedAssessment?.name || ""
      );
      const selectedAssessmentTermNames = [
        selectedLegacyTermName,
        selectedAssessmentName,
        selectedAssessmentName ? `${termName} ${selectedAssessmentName}` : "",
      ]
        .map((value) => normalize(value))
        .filter(Boolean);

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

      const relevantEnrollments = scopedEnrollments.filter((enrollment) => {
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
        const sameMedium = matchesAcademicMedium(
          enrollment,
          selectedSubject.medium,
          student
        );

        const sameYear =
          !termYear ||
          normalizeAcademicYear(pick(enrollment.academicYear, enrollment.year, "")) ===
            normalize(termYear);

        const status = normalize(pick(enrollment.status, "active"));

        return sameClass && sameSubject && sameMedium && sameYear && (!status || status === "active");
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

        const existingMark = scopedMarks.find((mark) => {
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

          const markTerm = normalize(pick(mark.term, mark.termName, ""));

          const sameYear =
            normalizeAcademicYear(pick(mark.academicYear, mark.year, "")) ===
            normalize(termYear);
          const markPracticeExamId = pick(mark.practiceExamId, mark.assessmentId, "");
          const markAssessmentName = normalize(pick(mark.practiceExamName, mark.assessmentName, ""));
          const sameAssessment = (() => {
            if (selectedAssessmentId === "__TERM__") {
              return markTerm === normalize(termName) && !markPracticeExamId;
            }

            if (selectedLegacyTermName) {
              return (
                selectedAssessmentTermNames.includes(markTerm) ||
                selectedAssessmentTermNames.includes(markAssessmentName)
              );
            }

            return (
              markPracticeExamId === selectedPracticeExamId ||
              (markTerm === normalize(termName) && markAssessmentName === normalize(selectedAssessmentName)) ||
              (!markPracticeExamId && selectedAssessmentTermNames.includes(markTerm))
            );
          })();

          return sameStudent && sameClass && sameSubject && sameYear && sameAssessment;
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
          key: `${studentId}-${selectedSubject.subjectName}-${termName}-${termYear}-${selectedAssessmentId}`,
          enrollmentId: enrollment.id,
          studentId,
          studentName,
          indexNo,
          admissionNo,
          medium: getAcademicMedium(enrollment, student),
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
          term: selectedLegacyTermName || termName,
          baseTerm: termName,
          academicYear: termYear,
          assessmentId:
            selectedAssessmentId === "__TERM__" || selectedLegacyTermName ? "" : selectedAssessmentId,
          assessmentName:
            selectedAssessmentId === "__TERM__" ? "" : selectedAssessment?.name || "",
          mark: absent ? "" : markValue ?? "",
          absent,
          existingDocId: existingMark?.id || "",
          isDirty: false,
        };
      });

      const rows = sortRowsInTeacherMarkSheetOrder(mappedRows).map((row) => {
        const retained = retainedSaveRows.current.get(row.key);
        return retained ? { ...row, mark: retained.mark, absent: retained.absent, isDirty: true } : row;
      });
      retainedSaveRows.current.clear();

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
  }, [activeTerm, scopeRefreshVersion, selectedClass, selectedSubject, selectedClassRow, selectedAssessmentId, selectedAssessment]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (isAdmin) {
      setEntrySettingsLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "systemSettings", "marksEntry"),
      (snapshot) => {
        setEntrySettings(
          snapshot.exists()
            ? normalizeMarksEntrySettings(snapshot.data())
            : DEFAULT_MARKS_ENTRY_SETTINGS
        );
        setEntrySettingsLoading(false);
      },
      (settingsError) => {
        console.error("Marks entry access load error:", settingsError);
        setEntrySettings({
          teacherEntryEnabled: false,
          teacherEntryDeadline: "",
        });
        setEntrySettingsLoading(false);
      }
    );

    return unsubscribe;
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    setAdminStudentMarks([]);

    if (!isAdmin || !deleteStudent?.id) {
      setAdminStudentMarksLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setAdminStudentMarksLoading(true);
    loadMarksForStudents([deleteStudent.id])
      .then((rows) => {
        if (!cancelled) setAdminStudentMarks(rows);
      })
      .catch((loadError) => {
        if (!cancelled) {
          console.error(loadError);
          setError(loadError.message || "Could not load this student's marks.");
        }
      })
      .finally(() => {
        if (!cancelled) setAdminStudentMarksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deleteStudent?.id, isAdmin]);

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
      const legacyInfo = getLegacyPracticeTermInfo(matchedTerm);
      const baseTerm = legacyInfo
        ? terms.find(
            (term) =>
              !getLegacyPracticeTermInfo(term) &&
              normalize(pick(term.term, term.termName, "")) === normalize(legacyInfo.baseTerm) &&
              Number(pick(term.year, term.academicYear, 0)) === legacyInfo.year
          )
        : null;
      const nextTermKey = buildTermKey(baseTerm || matchedTerm);
      if (selectedTermKey !== nextTermKey) {
        setSelectedTermKey(nextTermKey);
      }
      if (legacyInfo && selectedAssessmentId === "__TERM__") {
        setSelectedAssessmentId(buildLegacyPracticeAssessmentId(legacyInfo.legacyTermName));
      }
    }
  }, [bootLoading, navigationSelection.termKey, terms, selectedTermKey, selectedAssessmentId]);

  useEffect(() => {
    if (!assessmentOptions.some((option) => option.id === selectedAssessmentId)) {
      setSelectedAssessmentId("__TERM__");
    }
  }, [assessmentOptions, selectedAssessmentId]);

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

      const mediumMatch =
        !navigationSelection.medium ||
        normalize(option.medium) === normalize(navigationSelection.medium);

      return (subjectIdMatch || subjectNameMatch) && mediumMatch;
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
    if (teacherEntryLocked) return;
    const safeValue = value === "" ? "" : value.replace(/[^\d.]/g, "");
    setRowValue(rowKey, {
      mark: safeValue,
      absent: safeValue !== "" ? false : drafts[rowKey]?.absent ?? false,
    });
  };

  const handleAbsentChange = (rowKey, checked) => {
    if (teacherEntryLocked) return;
    setRowValue(rowKey, {
      absent: checked,
      mark: checked ? "" : drafts[rowKey]?.mark ?? "",
    });
  };

  const handleAdminDeleteMark = async (mark) => {
    if (!isAdmin || !deleteStudent || !mark?.id || deletingMarkId) return;

    const studentLabel = getAdminStudentLabel(deleteStudent);
    const subjectName = pick(mark.subjectName, mark.subject, "selected subject");
    const termName = pick(mark.term, mark.termName, "selected term");
    const confirmed = window.confirm(
      academicDisplay(`Delete the ${subjectName} mark (${termName}) for ${studentLabel}? This cannot be undone.`)
    );
    if (!confirmed) return;

    try {
      setDeletingMarkId(mark.id);
      setError("");
      setSuccess("");

      await deleteDoc(doc(db, "marks", mark.id));

      setAdminStudentMarks((previous) => previous.filter((item) => item.id !== mark.id));
      invalidateCollectionRows("marks");
      const loadedRow = studentRows.find((item) => item.existingDocId === mark.id);
      if (loadedRow) {
        setDrafts((prev) => ({
          ...prev,
          [loadedRow.key]: { mark: "", absent: false },
        }));
      }
      setStudentRows((prev) =>
        prev.map((item) =>
          item.existingDocId === mark.id
            ? {
                ...item,
                mark: "",
                absent: false,
                existingDocId: "",
                isDirty: false,
              }
            : item
        )
      );
      setSuccess(`${subjectName} mark deleted for ${studentLabel}.`);
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.message || "Failed to delete the selected mark.");
    } finally {
      setDeletingMarkId("");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (teacherEntryLocked) {
        throw new Error(teacherEntryLockReason || "Marks entry is locked by the administrator.");
      }

      if (!selectedClass || !selectedSubject || !activeTerm) {
        throw new Error("Please select class, subject, and term.");
      }

      const dirtyRows = studentRows.filter((row) => row.isDirty);

      if (dirtyRows.length === 0) {
        setSuccess("No changes to save.");
        return;
      }

      await sbaGate.verifyBeforeSave(studentRows);
      const batches = [];
      let batch;
      let group;
      const savedMarks = [];
      const currentUser = auth.currentUser;
      const teacherName = pick(
        teacherProfile?.fullName,
        teacherProfile?.name,
        currentUser?.displayName,
        "Teacher"
      );

      for (const row of dirtyRows) {
        if (!group || group.marks.length === 8) {
          batch = writeBatch(db); group = { batch, marks: [] }; batches.push(group);
        }
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
          medium: row.medium || selectedSubject.medium || "",
          teachingMedium: selectedSubject.medium || "",
          subjectId: row.subjectId || "",
          subjectName: row.subjectName,
          subject: row.subjectName,
          subjectNumber: row.subjectNumber || "",
          term: row.term,
          termName: row.term,
          academicTermId: activeTerm.id,
          academicYear: row.academicYear,
          year: row.academicYear,
          assessmentType: row.assessmentId ? "practice" : "term",
          assessmentId: row.assessmentId || "",
          assessmentName: row.assessmentName || "",
          practiceExamId: row.assessmentId || "",
          practiceExamName: row.assessmentName || "",
          mark: absent ? null : markValue,
          marks: absent ? null : markValue,
          score: absent ? null : markValue,
          absent,
          isAbsent: absent,
          teacherId: currentUser?.uid || "",
          teacherName,
          updatedAt: serverTimestamp(),
        };
        Object.assign(payload, buildCanonicalMarkFields(payload));

        if (row.existingDocId) {
          batch.set(doc(db, "marks", row.existingDocId), payload, { merge: true });
          group.marks.push({ id: row.existingDocId, ...payload });
        } else {
          const newRef = doc(collection(db, "marks"));
          batch.set(newRef, {
            ...payload,
            createdAt: serverTimestamp(),
          });
          group.marks.push({ id: newRef.id, ...payload });
        }
      }

      let saveFailure;
      for (const item of batches) {
        try { await item.batch.commit(); savedMarks.push(...item.marks); }
        catch (failure) { saveFailure = failure; break; }
      }
      const savedByStudent = new Map(savedMarks.map((mark) => [String(mark.studentId), mark]));
      if (saveFailure) retainedSaveRows.current = new Map(studentRows.filter((row) => row.isDirty && !savedByStudent.has(String(row.studentId))).map((row) => [row.key, row]));
      invalidateCollectionRows("marks");
      setStudentRows((previous) =>
        previous.map((row) => {
          const saved = savedByStudent.get(String(row.studentId));
          return saved ? { ...row, existingDocId: saved.id, isDirty: false } : row;
        })
      );
      if (saveFailure) throw new Error(`${savedMarks.length} marks saved; remaining edits are retained. ${saveFailure.message}`);
      setSuccess("Marks saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save marks.");
    } finally {
      setSaving(false);
    }
  };

  const sbaGate = useSbaTermGate({ isAdmin, settings: entrySettings, term: activeTerm,
    classContext: selectedClassRow, subject: selectedSubject, assessmentId: selectedAssessmentId,
    students: allStudents, enrollments: allEnrollments });
  const teacherEntryLocked = !isAdmin && (entrySettingsLoading || isTeacherMarksEntryLocked(entrySettings) || sbaGate.locked);
  const teacherEntryLockReason = entrySettingsLoading ? "Checking marks entry access..." :
    getTeacherMarksEntryLockReason(entrySettings) || sbaGate.reason;

  const dirtyCount = studentRows.filter((row) => row.isDirty).length;
  const saveProgress =
    studentRows.length > 0
      ? Math.round(((studentRows.length - dirtyCount) / studentRows.length) * 100)
      : 0;
  const contextReady = Boolean(selectedClass && selectedSubject && activeTerm);

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
            loadBase(true);
          }}
        >
          Refresh
        </Button>
      }
    >
      <Stack spacing={2.25}>
        {error ? <Alert severity="error">{academicDisplay(error)}</Alert> : null}
        {success ? <Alert severity="success">{academicDisplay(success)}</Alert> : null}
        {!isAdmin && teacherEntryLocked ? (
          <Alert severity="warning" icon={<LockRoundedIcon />}>
            <strong>Marks Entry Disabled.</strong> {teacherEntryLockReason} You can still view saved marks and use the other teacher dashboard features.
            {sbaGate.locked && <Button href="/teacher/sba-marks" sx={{ ml: 1 }}>Enter SBA marks</Button>}
          </Alert>
        ) : null}

        {isAdmin ? (
          <Paper sx={{ ...sectionCardSx, p: 2 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "error.main" }}>
                  Delete Student Marks
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Search by student name, admission number, or EMIS student ID. Only administrators can use this tool.
                </Typography>
              </Box>

              <Autocomplete
                options={adminStudents}
                value={deleteStudent}
                onChange={(_, value) => setDeleteStudent(value)}
                getOptionLabel={(...args) => academicDisplay((getAdminStudentLabel)(...args))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Type or select a student"
                    placeholder="Student name, admission number, or EMIS ID"
                    size="small"
                  />
                )}
              />

              {deleteStudent ? (
                adminStudentMarksLoading ? (
                  <Box textAlign="center" py={2}><CircularProgress size={24} /></Box>
                ) : deleteStudentMarks.length > 0 ? (
                  <ResponsiveTableWrapper minWidth={820}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Year</TableCell>
                          <TableCell>Term / Assessment</TableCell>
                          <TableCell>Class</TableCell>
                          <TableCell>Subject</TableCell>
                          <TableCell>Mark</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {deleteStudentMarks.map((mark) => (
                          <TableRow key={mark.id} hover>
                            <TableCell>{pick(mark.year, mark.academicYear, "-")}</TableCell>
                            <TableCell>
                              {academicDisplay([
                                pick(mark.term, mark.termName, ""),
                                pick(mark.assessmentName, ""),
                              ].filter(Boolean).join(" - ") || "-")}
                            </TableCell>
                            <TableCell>{academicDisplay(pick(mark.fullClassName, mark.className, "-"))}</TableCell>
                            <TableCell>{academicDisplay(pick(mark.subjectName, mark.subject, "-"))}</TableCell>
                            <TableCell>{mark.absent ? "Absent" : pick(mark.mark, "-")}</TableCell>
                            <TableCell align="right">
                              <Button
                                color="error"
                                variant="outlined"
                                size="small"
                                startIcon={
                                  deletingMarkId === mark.id ? (
                                    <CircularProgress size={15} color="inherit" />
                                  ) : (
                                    <DeleteOutlineRoundedIcon />
                                  )
                                }
                                disabled={Boolean(deletingMarkId)}
                                onClick={() => handleAdminDeleteMark(mark)}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableWrapper>
                ) : (
                  <Alert severity="info">No saved marks were found for this student.</Alert>
                )
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        <Paper
          sx={{
            ...sectionCardSx,
            p: 2,
            position: { xs: "sticky", md: "static" },
            top: { xs: mobileStickyOffset, md: "auto" },
            zIndex: { xs: 2, md: "auto" },
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "primary.main" }}>
                  Select Mark Entry Context
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose class, subject, and term before entering marks.
                </Typography>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
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
                      {academicDisplay(option.displayClassName || option.fullClassName)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
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
                      {academicDisplay(option.subjectName)}
                      {academicDisplay(option.medium ? ` - ${option.medium} Medium` : "")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="marks-entry-term-label">Academic Term</InputLabel>
                <Select
                  labelId="marks-entry-term-label"
                  label="Academic Term"
                  value={selectedTermKey}
                  onChange={(e) => setSelectedTermKey(e.target.value)}
                >
                  {termOptions.map((term) => {
                    const key = buildTermKey(term);
                    return (
                      <MenuItem key={term.id} value={key}>
                        {academicDisplay(buildTermLabel(term))}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="marks-entry-assessment-label">Exam</InputLabel>
                <Select
                  labelId="marks-entry-assessment-label"
                  label="Exam"
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                >
                  {assessmentOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {academicDisplay(option.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <TextField
                label="Search index"
                placeholder="Index, admission, or name"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Paper>

        {isMobile ? (
          <Paper sx={{ ...sectionCardSx, p: 1.5 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main" }}>
                Quick Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusChip status="active" label={academicDisplay(`${stats.total} students`)} />
                <StatusChip status="saved" label={academicDisplay(`${stats.saved} saved`)} />
                <StatusChip status="draft" label={academicDisplay(`${stats.draftCount} unsaved`)} />
                <StatusChip status="pending" label={academicDisplay(`${stats.absent} absent`)} />
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Students"
                value={stats.total}
                icon={<GroupRoundedIcon />}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Saved Rows"
                value={stats.saved}
                icon={<CheckCircleRoundedIcon />}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Draft Changes"
                value={stats.draftCount}
                icon={<EditNoteRoundedIcon />}
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Absent"
                value={stats.absent}
                icon={<ClassRoundedIcon />}
                color="error"
              />
            </Grid>
          </Grid>
        )}

        <Paper sx={{ ...sectionCardSx, p: 2.25 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "primary.main" }}>
                  Mark Entry Sheet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {academicDisplay(selectedClass && selectedSubject && activeTerm
                    ? `${selectedClassRow?.displayClassName || selectedClass} - ${selectedSubject.subjectName}${selectedSubject.medium ? ` - ${selectedSubject.medium} Medium` : ""} - ${buildTermLabel(activeTerm)}`
                    : "Select class, subject, and term to begin.")}
                </Typography>
              </Box>

              {selectedClass && selectedSubject && activeTerm ? (
                <StatusChip
                  status={dirtyCount > 0 ? "draft" : "saved"}
                  label={academicDisplay(dirtyCount > 0 ? `${dirtyCount} unsaved` : "All saved")}
                />
              ) : null}
            </Stack>

            {(loadingRows || saving) && (
              <Box>
                <LinearProgress />
              </Box>
            )}

            {contextReady ? (
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
                      label={academicDisplay(selectedClassRow?.displayClassName || selectedClass)}
                      color="primary"
                      variant="outlined"
                    />
                    {selectedClassRow?.stream ? (
                      <Chip
                        icon={<ClassRoundedIcon />}
                        label={academicDisplay(selectedClassRow.stream)}
                        color="secondary"
                        variant="outlined"
                      />
                    ) : null}
                    <Chip
                      icon={<AutoStoriesRoundedIcon />}
                      label={academicDisplay(`${selectedSubject.subjectName}${selectedSubject.medium ? ` - ${selectedSubject.medium} Medium` : ""}`)}
                      variant="outlined"
                    />
                    {selectedSubject.subjectNumber ? (
                      <Chip
                        label={academicDisplay(`No. ${selectedSubject.subjectNumber}`)}
                        variant="outlined"
                      />
                    ) : null}
                    <Chip
                      icon={<TimelineRoundedIcon />}
                      label={academicDisplay(buildTermLabel(activeTerm))}
                      variant="outlined"
                    />
                  </Stack>

                  <Stack
                    direction={{ xs: "row", md: "column" }}
                    spacing={0.5}
                    alignItems={{ xs: "center", md: "flex-end" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Save progress: {saveProgress}%
                    </Typography>
                    {isMobile ? (
                      <Typography variant="caption" color="text.secondary">
                        {dirtyCount > 0 ? "Use the bottom bar to save changes" : "All changes saved"}
                      </Typography>
                    ) : null}
                  </Stack>
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
                        compact
                        title={academicDisplay(`${index + 1}. Index ${getStudentEntryLabel(row, index)}`)}
                        subtitle={academicDisplay(row.indexNo && row.admissionNo ? `Admission ${row.admissionNo}` : "")}
                        right={
                          row.isDirty ? (
                            <StatusChip status="draft" />
                          ) : row.existingDocId ? (
                            <StatusChip status="saved" />
                          ) : (
                            <StatusChip status="pending" label="New" />
                          )
                        }
                        meta={
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {row.subjectNumber ? (
                              <Chip size="small" variant="outlined" label={academicDisplay(`No. ${row.subjectNumber}`)} />
                            ) : null}
                            {row.stream ? (
                              <Chip size="small" variant="outlined" label={academicDisplay(row.stream)} />
                            ) : null}
                            {Boolean(drafts[row.key]?.absent ?? row.absent) ? (
                              <Chip size="small" color="error" variant="outlined" label="Absent" />
                            ) : null}
                          </Stack>
                        }
                        footer={
                          <Grid container spacing={1}>
                            <Grid size={{ xs: 7 }}>
                              <TextField
                                label="Mark"
                                value={drafts[row.key]?.mark ?? row.mark ?? ""}
                                onChange={(e) => handleMarkChange(row.key, e.target.value)}
                                onKeyDown={(e) => handleMarkInputKeyDown(e, index)}
                                disabled={teacherEntryLocked || (drafts[row.key]?.absent ?? row.absent)}
                                inputProps={{
                                  inputMode: "decimal",
                                }}
                                inputRef={(element) => setMarkInputRef(row.key, element)}
                                size="small"
                                fullWidth
                              />
                            </Grid>
                            <Grid size={{ xs: 5 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: 40,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 1.5,
                                  bgcolor: "action.hover",
                                }}
                              >
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={Boolean(drafts[row.key]?.absent ?? row.absent)}
                                      onChange={(e) =>
                                        handleAbsentChange(row.key, e.target.checked)
                                      }
                                      disabled={teacherEntryLocked}
                                      size="small"
                                    />
                                  }
                                  label="Absent"
                                  sx={{
                                    m: 0,
                                    "& .MuiFormControlLabel-label": {
                                      fontSize: 13,
                                      fontWeight: 700,
                                    },
                                  }}
                                />
                              </Box>
                            </Grid>
                          </Grid>
                        }
                      />
                    ))}
                  </Stack>
                ) : (
                  <ResponsiveTableWrapper minWidth={720}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell width={72}>No</TableCell>
                          <TableCell width={180}>Index No</TableCell>
                          <TableCell width={120}>Subject No</TableCell>
                          <TableCell width={120}>Stream</TableCell>
                          <TableCell width={150}>Mark</TableCell>
                          <TableCell width={96}>Absent</TableCell>
                          <TableCell width={120}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredRows.map((row, index) => (
                          <TableRow key={row.key} hover>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {academicDisplay(getStudentEntryLabel(row, index))}
                              </Typography>
                            </TableCell>
                            <TableCell>{academicDisplay(row.subjectNumber || "-")}</TableCell>
                            <TableCell>{row.stream || "-"}</TableCell>
                            <TableCell>
                              <TextField
                                value={drafts[row.key]?.mark ?? row.mark ?? ""}
                                onChange={(e) => handleMarkChange(row.key, e.target.value)}
                                onKeyDown={(e) => handleMarkInputKeyDown(e, index)}
                                disabled={teacherEntryLocked || (drafts[row.key]?.absent ?? row.absent)}
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
                                disabled={teacherEntryLocked}
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

                {isMobile ? <Box sx={{ height: 96 }} /> : null}

                <ActionBar sticky>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusChip status="active" label={academicDisplay(`${filteredRows.length} rows`)} />
                    <StatusChip
                      status={dirtyCount > 0 ? "draft" : "saved"}
                      label={academicDisplay(`${dirtyCount} unsaved`)}
                    />
                  </Stack>

                  <Stack
                    direction={{ xs: "column-reverse", sm: "row" }}
                    spacing={1}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => loadStudents()}
                      disabled={loadingRows || saving}
                      startIcon={<RefreshRoundedIcon />}
                      fullWidth={isMobile}
                    >
                      Reload
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSave}
                      disabled={teacherEntryLocked || saving || loadingRows || dirtyCount === 0}
                      fullWidth={isMobile}
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
