import { academicDisplay } from "../utils/academicDisplay";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableViewRoundedIcon from "@mui/icons-material/TableViewRounded";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { loadTeacherProgress } from "../services/teacherProgressService";
import { loadSbaTeacherAssignments } from "../services/sbaService";
import { getCollectionRows } from "../services/firestoreReadCache";
import {
  EmptyState,
  MobileListRow,
  PageContainer,
  StatCard,
  StatusChip,
} from "../components/ui";
import { buildClassMarksReportData } from "../utils/classMarksReportBuilder";
import {
  exportClassMarksPdf,
  exportClassMarksExcel,
  exportClassMarksEmisExcel,
  isClassMarksEmisExportSupported,
} from "../utils/classMarksExportUtils";
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

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const sanitizePhone = (phone) => String(phone || "").replace(/[^\d+]/g, "");

const buildTermKey = (term) =>
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

const isActiveStatus = (value) => normalize(value || "active") === "active";

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

const getResolvedStream = (row = {}, fallback = {}) =>
  normalizeText(pick(row.stream, fallback.stream, ""));

const getResolvedSection = (row = {}, fallback = {}) =>
  normalizeSection(pick(row.section, row.className, fallback.section, fallback.className, ""));

const getResolvedGrade = (row = {}, fallback = {}) =>
  parseGrade(pick(row.grade, fallback.grade, ""));

const getComparableALClassName = (row = {}, fallback = {}) => {
  const explicit = pick(row.fullClassName, row.alClassName, "");
  if (explicit) return explicit;

  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return "";
};

const getClassDisplayName = (row = {}, fallback = {}) => {
  const explicitFull = pick(
    row.fullClassName,
    row.alClassName,
    fallback.fullClassName,
    fallback.alClassName,
    ""
  );
  if (explicitFull) return explicitFull;

  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  if (grade && section) return `${grade}${section}`;
  return normalizeText(pick(row.className, fallback.className, ""));
};

const getClassShortDisplayName = (row = {}, fallback = {}) => {
  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALDisplayClassName(grade, stream, section) || getClassDisplayName(row, fallback);
  }

  if (grade && section) return `${grade}${section}`;
  return normalizeText(pick(row.className, fallback.className, ""));
};

const getClassContext = (row = {}, fallback = {}) => {
  const grade = getResolvedGrade(row, fallback);
  const section = getResolvedSection(row, fallback);
  const stream = getResolvedStream(row, fallback);

  return {
    grade,
    section,
    stream,
    className: pick(row.className, fallback.className, ""),
    alClassName: pick(row.alClassName, fallback.alClassName, ""),
    fullClassName:
      getComparableALClassName(row, fallback) || getClassDisplayName(row, fallback),
  };
};

const matchesClassContext = (row = {}, target = {}, fallback = {}) => {
  const rowGrade = getResolvedGrade(row, fallback);
  const rowSection = getResolvedSection(row, fallback);
  const rowStream = normalize(getResolvedStream(row, fallback));

  const targetGrade = parseGrade(target.grade);
  const targetSection = normalizeSection(target.section);
  const targetStream = normalize(target.stream);

  const rowClassIdentity = normalize(
    getComparableALClassName(row, fallback) ||
      pick(row.fullClassName, row.alClassName, row.className, "") ||
      getClassDisplayName(row, fallback)
  );

  const targetClassIdentity = normalize(
    pick(target.fullClassName, target.alClassName, target.className, "")
  );

  if (isALGrade(targetGrade)) {
    if (rowClassIdentity && targetClassIdentity && rowClassIdentity === targetClassIdentity) {
      return true;
    }

    if (rowGrade !== targetGrade || rowSection !== targetSection) {
      return false;
    }

    if (!targetStream) {
      return true;
    }

    if (rowStream) {
      return rowStream === targetStream;
    }

    return false;
  }

  if (rowClassIdentity && targetClassIdentity) {
    return rowClassIdentity === targetClassIdentity;
  }

  return rowGrade === targetGrade && rowSection === targetSection;
};

const getSubjectIdentity = (row = {}) => {
  const subjectId = normalize(pick(row.subjectId, ""));
  const subjectNumber = normalize(pick(row.subjectNumber, ""));
  const subjectName = normalize(pick(row.subjectName, row.subject, ""));

  if (subjectId) return `id:${subjectId}`;
  if (subjectNumber) return `no:${subjectNumber}`;
  return `name:${subjectName}`;
};

const matchesSubject = (row = {}, subjectRow = {}) => {
  const rowSubjectId = normalize(pick(row.subjectId, ""));
  const rowSubjectNumber = normalize(pick(row.subjectNumber, ""));
  const rowSubjectName = normalize(pick(row.subjectName, row.subject, ""));

  const targetSubjectId = normalize(pick(subjectRow.subjectId, ""));
  const targetSubjectNumber = normalize(pick(subjectRow.subjectNumber, ""));
  const targetSubjectName = normalize(pick(subjectRow.subjectName, subjectRow.subject, ""));

  if (targetSubjectId && rowSubjectId) {
    return rowSubjectId === targetSubjectId;
  }

  if (targetSubjectNumber && rowSubjectNumber) {
    return rowSubjectNumber === targetSubjectNumber;
  }

  if (targetSubjectName && rowSubjectName) {
    return rowSubjectName === targetSubjectName;
  }

  return false;
};

const dedupeBy = (items = [], buildKey) => {
  const map = new Map();
  items.forEach((item) => {
    const key = buildKey(item);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

const isCompletedForSubject = (
  students,
  marks,
  classContext,
  subjectRow,
  targetTerm
) => {
  const targetYear = normalizeAcademicYear(targetTerm.year);
  const targetTermName = normalize(pick(targetTerm.term, targetTerm.termName, ""));

  const subjectStudentsRaw = students.filter((enrollment) => {
    const sameClass = matchesClassContext(enrollment, classContext);
    const sameSubject = matchesSubject(enrollment, subjectRow);
    const sameYear =
      normalizeAcademicYear(pick(enrollment.academicYear, enrollment.year, "")) === targetYear;
    const sameMedium = matchesAcademicMedium(enrollment, subjectRow.medium);
    const activeEnrollment = isActiveStatus(enrollment.status);

    return activeEnrollment && sameClass && sameSubject && sameMedium && sameYear;
  });

  const subjectStudents = dedupeBy(
    subjectStudentsRaw,
    (row) => String(pick(row.studentId, row.id, "")).trim()
  );

  const studentIds = new Set(
    subjectStudents.map((row) => String(pick(row.studentId, row.id, "")).trim()).filter(Boolean)
  );

  const subjectMarksRaw = marks.filter((mark) => {
    const sameClass = matchesClassContext(mark, classContext);
    const sameSubject = matchesSubject(mark, subjectRow);
    const sameTerm = normalize(pick(mark.term, mark.termName, "")) === targetTermName;
    const sameYear =
      normalizeAcademicYear(pick(mark.academicYear, mark.year, "")) === targetYear;
    const studentId = String(pick(mark.studentId, "")).trim();

    return sameClass && sameSubject && sameTerm && sameYear && studentIds.has(studentId);
  });

  const subjectMarks = dedupeBy(subjectMarksRaw, (row) => String(pick(row.studentId, "")).trim());

  const doneCount = subjectMarks.length;
  const total = subjectStudents.length;
  const pending = Math.max(0, total - doneCount);
  const progress = total ? Math.round((doneCount / total) * 100) : 0;
  const completed = total > 0 && doneCount === total;

  return {
    total,
    doneCount,
    pending,
    progress,
    completed,
  };
};

const sectionCardSx = {
  borderRadius: 3,
  border: "1px solid",
  borderColor: "divider",
  boxShadow: 1,
  backgroundColor: "background.paper",
};

const buildTeacherDashboardData = ({
  user,
  users,
  assignments,
  classrooms,
  enrollments = [],
  marks = [],
  sortedTerms,
  effectiveTermKey,
  progressReady,
}) => {
  const currentTeacher =
    users.find(
      (u) =>
        normalize(u.id) === normalize(user.uid) ||
        normalize(u.uid) === normalize(user.uid) ||
        normalize(u.email) === normalize(user.email)
    ) || null;

  const teacherName = pick(
    currentTeacher?.name,
    currentTeacher?.fullName,
    user.displayName,
    "Teacher"
  );

  const defaultTerm = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;
  const chosenTerm =
    sortedTerms.find((term) => buildTermKey(term) === effectiveTermKey) || defaultTerm;

  const targetTerm = {
    term: pick(chosenTerm?.term, chosenTerm?.termName, ""),
    year: String(pick(chosenTerm?.year, chosenTerm?.academicYear, "")),
  };

  const myAssignments = assignments.filter(
    (assignment) =>
      isActiveStatus(assignment.status) &&
      (normalize(pick(assignment.teacherId, assignment.teacherUid, assignment.userId)) === normalize(user.uid) ||
        normalize(pick(assignment.teacherEmail, assignment.email)) === normalize(user.email))
  );

  const dedupedAssignments = dedupeBy(myAssignments, (assignment) => {
    const classIdentity = normalize(getClassDisplayName(assignment));
    const subjectIdentity = getSubjectIdentity(assignment);
    const stream = normalize(getResolvedStream(assignment));
    return `${classIdentity}__${subjectIdentity}__${stream}__${normalize(getAcademicMedium(assignment))}`;
  });

  const dedupedSubjectRowsMap = new Map();

  dedupedAssignments.forEach((assignment) => {
    const classIdentity = getClassDisplayName(assignment);
    const classShort = getClassShortDisplayName(assignment);
    const classContext = getClassContext(assignment);
    const subjectName = pick(assignment.subjectName, assignment.subject, "");
    const subjectId = pick(assignment.subjectId, "");
    const subjectNumber = pick(assignment.subjectNumber, "");
    const stream = normalizeText(assignment.stream);
    const medium = getAcademicMedium(assignment);

    if (!subjectName && !subjectId && !subjectNumber) return;

    const progressInfo = progressReady
      ? isCompletedForSubject(
          enrollments,
          marks,
          classContext,
          {
            subjectName,
            subjectId,
            subjectNumber,
            medium,
          },
          targetTerm
        )
      : {
          total: 0,
          doneCount: 0,
          pending: 0,
          progress: 0,
          completed: false,
        };

    if (progressReady && progressInfo.total === 0) return;

    const rowKey = `${normalize(classIdentity)}__${getSubjectIdentity({
      subjectId,
      subjectName,
      subjectNumber,
    })}__${normalize(stream)}__${normalize(medium)}`;

    if (!dedupedSubjectRowsMap.has(rowKey)) {
      dedupedSubjectRowsMap.set(rowKey, {
        className: pick(assignment.className, ""),
        fullClassName: classIdentity,
        displayClassName: classShort,
        stream,
        streamCode: pick(assignment.streamCode, ""),
        subjectName,
        subjectId,
        subjectNumber,
        medium,
        total: progressInfo.total,
        done: progressInfo.doneCount,
        pending: progressInfo.pending,
        progress: progressInfo.progress,
        progressLoading: !progressReady,
      });
    }
  });

  const subjectRows = Array.from(dedupedSubjectRowsMap.values()).sort((a, b) => {
    const classDiff = String(a.fullClassName).localeCompare(String(b.fullClassName), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (classDiff !== 0) return classDiff;
    return String(a.subjectName).localeCompare(String(b.subjectName), undefined, {
      sensitivity: "base",
    });
  });

  const assignedClassroom =
    classrooms.find(
      (c) =>
        normalize(pick(c.classTeacherId, c.classTeacherUid, c.teacherId)) === normalize(user.uid) ||
        normalize(pick(c.classTeacherEmail, c.teacherEmail)) === normalize(user.email)
    ) || null;

  let classTeacherData = null;

  if (assignedClassroom) {
    const classIdentity = getClassDisplayName(assignedClassroom);
    const classContext = getClassContext(assignedClassroom);
    const classStream = normalizeText(assignedClassroom.stream);

    const classStudentsRaw = progressReady
      ? enrollments.filter(
          (enrollment) =>
            isActiveStatus(enrollment.status) &&
            matchesClassContext(enrollment, classContext) &&
            normalizeAcademicYear(pick(enrollment.academicYear, enrollment.year, "")) ===
              normalizeAcademicYear(targetTerm.year)
        )
      : [];

    const classStudents = dedupeBy(
      classStudentsRaw,
      (row) => String(pick(row.studentId, row.id, "")).trim()
    );

    const uniqueStudentIds = new Set(
      classStudents
        .map((student) => String(pick(student.studentId, student.id, "")).trim())
        .filter(Boolean)
    );

    const dedupedClassSubjects = new Map();

    dedupeBy(
      assignments.filter(
        (assignment) =>
          isActiveStatus(assignment.status) &&
          matchesClassContext(assignment, classContext)
      ),
      (assignment) =>
        `${getSubjectIdentity(assignment)}__${normalize(getResolvedStream(assignment))}__${normalize(
          getAcademicMedium(assignment)
        )}`
    ).forEach((assignment) => {
      const teacherUser =
        users.find(
          (u) =>
            normalize(u.id) === normalize(assignment.teacherId) ||
            normalize(u.email) === normalize(assignment.teacherEmail)
        ) || null;

      const subjectName = pick(assignment.subjectName, assignment.subject, "");
      const subjectId = pick(assignment.subjectId, "");
      const subjectNumber = pick(assignment.subjectNumber, "");
      const medium = getAcademicMedium(assignment);

      if (!subjectName && !subjectId && !subjectNumber) return;

      const progressInfo = progressReady
        ? isCompletedForSubject(
            enrollments,
            marks,
            getClassContext(assignment),
            {
              subjectName,
              subjectId,
              subjectNumber,
              medium,
            },
            targetTerm
          )
        : {
            total: 0,
            doneCount: 0,
            pending: 0,
            progress: 0,
            completed: false,
          };

      if (progressReady && progressInfo.total === 0) return;

      const isMine =
        normalize(pick(assignment.teacherId, assignment.teacherUid, assignment.userId)) === normalize(user.uid) ||
        normalize(pick(assignment.teacherEmail, assignment.email)) === normalize(user.email);

      const rowKey = `${getSubjectIdentity({ subjectId, subjectName, subjectNumber })}__${normalize(
        getResolvedStream(assignment)
      )}__${normalize(medium)}`;

      if (!dedupedClassSubjects.has(rowKey)) {
        dedupedClassSubjects.set(rowKey, {
          subjectName,
          subjectId,
          subjectNumber,
          medium,
          teacherName: pick(
            teacherUser?.name,
            teacherUser?.fullName,
            assignment.teacherName,
            "Teacher"
          ),
          teacherPhone: pick(teacherUser?.phone, ""),
          total: progressInfo.total,
          done: progressInfo.doneCount,
          pending: progressInfo.pending,
          progress: progressInfo.progress,
          completed: progressInfo.completed,
          isMine,
          progressLoading: !progressReady,
        });
      }
    });

    const classSubjects = Array.from(dedupedClassSubjects.values()).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return String(a.subjectName).localeCompare(String(b.subjectName), undefined, {
        sensitivity: "base",
      });
    });

    const completedCount = classSubjects.filter((subject) => subject.completed).length;
    const pendingCount = classSubjects.length - completedCount;

    classTeacherData = {
      className: pick(assignedClassroom.className, ""),
      fullClassName: classIdentity,
      displayClassName: getClassShortDisplayName(assignedClassroom),
      stream: classStream,
      totalStudents: uniqueStudentIds.size,
      totalSubjects: classSubjects.length,
      completed: completedCount,
      pending: pendingCount,
      progress: classSubjects.length
        ? Math.round((completedCount / classSubjects.length) * 100)
        : 0,
      subjects: classSubjects,
      progressLoading: !progressReady,
    };
  }

  return {
    teacherName,
    subjectRows,
    classTeacherData,
    assignedClassroom,
  };
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [terms, setTerms] = useState([]);
  const [selectedTermKey, setSelectedTermKey] = useState("");

  const [teacherName, setTeacherName] = useState("Teacher");
  const [subjectRows, setSubjectRows] = useState([]);
  const [classTeacherData, setClassTeacherData] = useState(null);
  const [assignedClassroom, setAssignedClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const progressPending = progressLoading || !progressReady;
  const progressLabel = progressLoading ? "Loading" : "Not loaded";
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [marksEntrySettings, setMarksEntrySettings] = useState(DEFAULT_MARKS_ENTRY_SETTINGS);
  const lastLoadedTermKey = useRef("");
  const dashboardLoadVersion = useRef(0);

  const marksEntryDisabled = isTeacherMarksEntryLocked(marksEntrySettings);
  const marksEntryDisabledReason = getTeacherMarksEntryLockReason(marksEntrySettings);

  const currentTerm = useMemo(
    () => terms.find((term) => buildTermKey(term) === selectedTermKey) || terms.find(isActiveTerm) || null,
    [terms, selectedTermKey]
  );

  const subjectProgressSummary = useMemo(
    () =>
      subjectRows.reduce(
        (summary, row) => {
          summary.assignedClasses.add(row.fullClassName);
          if (row.pending === 0 && row.total > 0) summary.completed += 1;
          if (row.pending > 0 || row.total === 0) summary.pending += 1;
          return summary;
        },
        { assignedClasses: new Set(), completed: 0, pending: 0 }
      ),
    [subjectRows]
  );

  const loadDashboard = async (silent = false, forceRefresh = false, includeProgress = false) => {
    const version = ++dashboardLoadVersion.current;
    try {
      setError("");
      setProgressReady(false);
      setProgressLoading(false);
      setEnrollments([]); setMarks([]);
      if (silent) setRefreshing(true);
      else setLoading(true);

      const user = auth.currentUser;
      if (!user) throw new Error("User is not logged in.");
      const [assignments, classrooms, loadedTerms] = await Promise.all([
        loadSbaTeacherAssignments(user, { forceRefresh }),
        getCollectionRows(db, "classrooms", { forceRefresh }),
        getCollectionRows(db, "academicTerms", { forceRefresh }),
      ]);
      const users = [{ ...profile, id: profile?.id || user.uid, uid: user.uid, email: user.email }];

      if (version !== dashboardLoadVersion.current) return;
      setClassrooms(classrooms);

      const sortedTerms = [...loadedTerms].sort((a, b) => {
        const yearDiff =
          Number(pick(b.year, b.academicYear, 0)) -
          Number(pick(a.year, a.academicYear, 0));
        if (yearDiff !== 0) return yearDiff;
        return String(pick(a.term, a.termName, "")).localeCompare(
          String(pick(b.term, b.termName, ""))
        );
      });

      setTerms(sortedTerms);

      const defaultTerm = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;
      const effectiveTermKey =
        selectedTermKey || (defaultTerm ? buildTermKey(defaultTerm) : "");

      if (!selectedTermKey && defaultTerm) {
        setSelectedTermKey(effectiveTermKey);
      }
      lastLoadedTermKey.current = effectiveTermKey;

      const initialData = buildTeacherDashboardData({
        user,
        users,
        assignments,
        classrooms,
        sortedTerms,
        effectiveTermKey,
        progressReady: false,
      });

      setTeacherName(initialData.teacherName);
      setSubjectRows(initialData.subjectRows);
      setClassTeacherData(initialData.classTeacherData);
      setAssignedClassroom(initialData.assignedClassroom);
      setLoading(false);
      setRefreshing(false);
      if (!includeProgress) return;
      setProgressLoading(true);

      try {
        const { enrollments: loadedEnrollments, marks: loadedMarks } = await loadTeacherProgress({ forceRefresh });

        if (version !== dashboardLoadVersion.current) return;
        setEnrollments(loadedEnrollments);
        setMarks(loadedMarks);
        setProgressReady(true);

        const completedData = buildTeacherDashboardData({
          user,
          users,
          assignments,
          classrooms,
          enrollments: loadedEnrollments,
          marks: loadedMarks,
          sortedTerms,
          effectiveTermKey,
          progressReady: true,
        });

        setSubjectRows(completedData.subjectRows);
        setClassTeacherData(completedData.classTeacherData);
        setAssignedClassroom(completedData.assignedClassroom);
      } catch (statsError) {
        if (version !== dashboardLoadVersion.current) return;
        console.error(statsError);
        setError(statsError.message || "Dashboard opened, but progress stats failed to load.");
      } finally {
        if (version === dashboardLoadVersion.current) setProgressLoading(false);
      }
    } catch (e) {
      if (version !== dashboardLoadVersion.current) return;
      console.error(e);
      setError(e.message || "Failed to load teacher dashboard.");
    } finally {
      if (version === dashboardLoadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => {
    loadDashboard(false);
    return () => { dashboardLoadVersion.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onSnapshot(
      doc(db, "systemSettings", "marksEntry"),
      (snapshot) =>
        setMarksEntrySettings(
          snapshot.exists()
            ? normalizeMarksEntrySettings(snapshot.data())
            : DEFAULT_MARKS_ENTRY_SETTINGS
        ),
      (settingsError) =>
        console.error("Teacher marks entry access sync error:", settingsError)
    );
  }, []);

  useEffect(() => {
    if (selectedTermKey) {
      if (selectedTermKey === lastLoadedTermKey.current) return;
      loadDashboard(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTermKey]);

  const ensureStudentsLoaded = useCallback(async () => {
    if (students.length > 0) return students;

    const studentsData = await getCollectionRows(db, "students");
    setStudents(studentsData);
    return studentsData;
  }, [students]);

  const buildAssignedClassReportData = useCallback((studentRows = students) => {
    if (!assignedClassroom || !currentTerm || !studentRows.length) return null;

    const termName = pick(currentTerm.term, currentTerm.termName, "");
    const year = pick(currentTerm.year, currentTerm.academicYear, "");

    try {
      return buildClassMarksReportData({
        students: studentRows,
        enrollments,
        marks,
        classrooms,
        grade: assignedClassroom.grade,
        className:
          assignedClassroom.alClassName ||
          assignedClassroom.fullClassName ||
          assignedClassroom.className,
        section: assignedClassroom.section,
        termName,
        year,
      });
    } catch (err) {
      console.error("Failed to build teacher report data:", err);
      return null;
    }
  }, [assignedClassroom, students, enrollments, marks, classrooms, currentTerm]);

  const handleExportPdf = async () => {
    if (!assignedClassroom || !currentTerm) return;
    setExportingPdf(true);
    setError("");

    try {
      const studentRows = await ensureStudentsLoaded();
      const reportData = buildAssignedClassReportData(studentRows);
      if (!reportData) throw new Error("Unable to build class report data.");
      exportClassMarksPdf(reportData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!assignedClassroom || !currentTerm) return;
    setExportingExcel(true);
    setError("");

    try {
      const studentRows = await ensureStudentsLoaded();
      const reportData = buildAssignedClassReportData(studentRows);
      if (!reportData) throw new Error("Unable to build class report data.");
      exportClassMarksExcel(reportData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to export Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportEmis = async () => {
    if (!assignedClassroom || !currentTerm) return;
    setError("");

    try {
      const studentRows = await ensureStudentsLoaded();
      const reportData = buildAssignedClassReportData(studentRows);
      if (!reportData) throw new Error("Unable to build class report data.");
      exportClassMarksEmisExcel(reportData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to export EMIS Excel.");
    }
  };

  const openMarks = useCallback(
    (row) => {
      const params = new URLSearchParams();

      params.set("fullClassName", row.fullClassName || "");
      params.set("stream", row.stream || "");
      params.set("subjectName", row.subjectName || "");
      params.set("subjectId", row.subjectId || "");
      params.set("medium", row.medium || "");

      if (selectedTermKey) params.set("termKey", selectedTermKey);

      navigate(`/teacher/marks?${params.toString()}`);
    },
    [navigate, selectedTermKey]
  );

  if (loading) {
    return (
      <PageContainer title="Teacher Dashboard">
        <Paper sx={{ ...sectionCardSx, p: 2.25 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress size={24} />
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  Opening your dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Loading your classes and current term.
                </Typography>
              </Box>
            </Stack>
            <LinearProgress />
          </Stack>
        </Paper>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Teacher Dashboard"
      subtitle={academicDisplay(`Welcome ${teacherName}`)}
      actions={
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
          disabled={refreshing || progressLoading}
          onClick={() => loadDashboard(true, true)}
          fullWidth={isMobile}
        >
          Refresh
        </Button>
      }
    >
      <Stack spacing={2.25}>
        {!progressReady && <Alert severity="info" action={<Button disabled={refreshing || progressLoading} onClick={() => loadDashboard(true, false, true)}>Load term statistics</Button>}>
          Term statistics load only when requested. You can open SBA or enter marks without loading them.
        </Alert>}
        {error ? <Alert severity="error">{academicDisplay(error)}</Alert> : null}
        {marksEntryDisabled ? (
          <Alert severity="warning" icon={<LockRoundedIcon />}>
            <Typography component="span" sx={{ fontWeight: 900 }}>
              Marks Entry Disabled.
            </Typography>{" "}
            {marksEntryDisabledReason} You can continue using all other dashboard features.
          </Alert>
        ) : null}
        {progressLoading ? (
          <Paper sx={{ ...sectionCardSx, p: 1.25 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                Syncing marks progress in the background
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        <Paper
          sx={{
            ...sectionCardSx,
            p: { xs: 1.5, sm: 2 },
            borderColor: "primary.light",
            backgroundColor: "background.paper",
            backgroundImage: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main}14 0%, transparent 64%)`,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={0.75}>
                <Typography
                  variant={isMobile ? "h6" : "subtitle1"}
                  sx={{ fontWeight: 900, color: "text.primary", lineHeight: 1.15 }}
                >
                  Today&apos;s Work
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Marks entry and class monitoring for the selected term.
                </Typography>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="teacher-dashboard-term-label">Academic Term</InputLabel>
                <Select
                  labelId="teacher-dashboard-term-label"
                  label="Academic Term"
                  value={selectedTermKey}
                  onChange={(e) => setSelectedTermKey(e.target.value)}
                >
                  {terms.map((term) => (
                    <MenuItem key={term.id} value={buildTermKey(term)}>
                      {academicDisplay(buildTermLabel(term))}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                justifyContent={{ xs: "flex-start", md: "flex-end" }}
              >
                {currentTerm ? <Chip label={academicDisplay(buildTermLabel(currentTerm))} color="primary" /> : null}
                <Chip label={academicDisplay(`Subject Assignments: ${subjectRows.length}`)} />
                <Chip label={academicDisplay(`Class Teacher Roles: ${classTeacherData ? 1 : 0}`)} />
                {progressPending ? <Chip label={progressLabel} color="info" variant="outlined" /> : null}
              </Stack>
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
                <StatusChip
                  status="active"
                  label={academicDisplay(`${subjectProgressSummary.assignedClasses.size} classes`)}
                />
                <StatusChip status="saved" label={academicDisplay(`${subjectRows.length} subjects`)} />
                <StatusChip
                  status="completed"
                  label={
                    academicDisplay(progressPending
                      ? progressLabel
                      : `${subjectProgressSummary.completed} completed`)
                  }
                />
                <StatusChip
                  status="pending"
                  label={
                    academicDisplay(progressPending
                      ? progressLabel
                      : `${subjectProgressSummary.pending} pending`)
                  }
                />
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Assigned Classes"
                value={subjectProgressSummary.assignedClasses.size}
                icon={<ClassRoundedIcon />}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Assigned Subjects"
                value={subjectRows.length}
                icon={<MenuBookRoundedIcon />}
                color="secondary"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Completed"
                value={progressPending ? "..." : subjectProgressSummary.completed}
                icon={<CheckCircleRoundedIcon />}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Pending"
                value={progressPending ? "..." : subjectProgressSummary.pending}
                icon={<HourglassBottomRoundedIcon />}
                color="warning"
              />
            </Grid>
          </Grid>
        )}

        {classTeacherData && (
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
                    Class Monitoring
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {academicDisplay(classTeacherData.fullClassName)}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {classTeacherData.stream ? (
                    <Chip
                      label={academicDisplay(classTeacherData.stream)}
                      color="secondary"
                      variant="outlined"
                    />
                  ) : null}
                  <Chip
                    label={
                      academicDisplay(progressPending
                        ? progressLabel
                        : `${classTeacherData.progress}% Completed`)
                    }
                    color={classTeacherData.progress === 100 ? "success" : "warning"}
                  />
                </Stack>
              </Stack>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate("/teacher/class-report")}
                  startIcon={<MenuBookRoundedIcon />}
                >
                  View Class Schedule & Analysis
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleExportPdf}
                  disabled={!assignedClassroom || !currentTerm || exportingPdf || progressPending}
                  startIcon={<PictureAsPdfIcon />}
                >
                  {exportingPdf ? "Exporting PDF..." : "Export PDF"}
                </Button>
                <Button
                  variant="outlined"
                  color="info"
                  onClick={handleExportExcel}
                  disabled={!assignedClassroom || !currentTerm || exportingExcel || progressPending}
                  startIcon={<TableViewRoundedIcon />}
                >
                  {exportingExcel ? "Exporting Excel..." : "Export Excel"}
                </Button>
                {assignedClassroom && isClassMarksEmisExportSupported({ grade: assignedClassroom.grade }) && (
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={handleExportEmis}
                    disabled={!assignedClassroom || !currentTerm || progressPending}
                    startIcon={<TableViewRoundedIcon />}
                  >
                    Export EMIS NP
                  </Button>
                )}
              </Box>

              {isMobile ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <StatusChip
                    status="active"
                    label={academicDisplay(progressPending ? progressLabel : `${classTeacherData.totalStudents} students`)}
                  />
                  <StatusChip status="saved" label={academicDisplay(`${classTeacherData.totalSubjects} subjects`)} />
                  <StatusChip
                    status="completed"
                    label={academicDisplay(progressPending ? progressLabel : `${classTeacherData.completed} completed`)}
                  />
                  <StatusChip
                    status="pending"
                    label={academicDisplay(progressPending ? progressLabel : `${classTeacherData.pending} pending`)}
                  />
                </Stack>
              ) : (
                <Grid container spacing={1.25}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      title="Students"
                      value={progressPending ? "..." : classTeacherData.totalStudents}
                      icon={<GroupRoundedIcon />}
                      color="primary"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      title="Subjects"
                      value={classTeacherData.totalSubjects}
                      icon={<MenuBookRoundedIcon />}
                      color="secondary"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      title="Completed"
                      value={progressPending ? "..." : classTeacherData.completed}
                      icon={<CheckCircleRoundedIcon />}
                      color="success"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      title="Pending"
                      value={progressPending ? "..." : classTeacherData.pending}
                      icon={<HourglassBottomRoundedIcon />}
                      color="error"
                      sx={{ boxShadow: "none" }}
                    />
                  </Grid>
                </Grid>
              )}

              <Box>
                <LinearProgress
                  variant={progressLoading ? "indeterminate" : "determinate"}
                  value={progressLoading ? undefined : classTeacherData.progress}
                  sx={{ height: 8, borderRadius: 5 }}
                />
                <Typography variant="body2" color="text.secondary" mt={0.75}>
                  {progressPending
                    ? progressLabel
                    : `${classTeacherData.progress}% overall class completion`}
                </Typography>
              </Box>

              <Stack spacing={1}>
                {classTeacherData.subjects.length === 0 ? (
                  <EmptyState title="No subjects assigned to this class" />
                ) : (
                  classTeacherData.subjects.map((subject) =>
                    isMobile ? (
                      <MobileListRow
                        key={`${subject.subjectId || `${subject.subjectName}_${subject.subjectNumber}`}__${subject.medium || "all"}`}
                        compact
                        title={academicDisplay(`${subject.subjectName}${subject.medium ? ` - ${subject.medium} Medium` : ""}`)}
                        subtitle={
                          academicDisplay(progressPending
                            ? progressLabel
                            : `${subject.done}/${subject.total} students`)
                        }
                        right={
                          <StatusChip
                            status={progressPending ? "active" : subject.completed ? "completed" : "pending"}
                            label={
                              academicDisplay(progressPending
                                ? progressLabel
                                : subject.completed
                                ? "Completed"
                                : "Pending")
                            }
                          />
                        }
                        meta={
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {subject.subjectNumber ? (
                              <Chip size="small" variant="outlined" label={academicDisplay(`No. ${subject.subjectNumber}`)} />
                            ) : null}
                            <Chip
                              size="small"
                              variant="outlined"
                              label={academicDisplay(progressPending ? progressLabel : `${subject.progress}%`)}
                            />
                            <Chip size="small" variant="outlined" label={academicDisplay(subject.teacherName)} />
                          </Stack>
                        }
                        footer={
                          <Stack spacing={1}>
                            {!subject.completed && subject.teacherPhone ? (
                              <Link
                                href={`tel:${sanitizePhone(subject.teacherPhone)}`}
                                underline="hover"
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                  fontWeight: 700,
                                  width: "fit-content",
                                }}
                              >
                                <PhoneRoundedIcon sx={{ fontSize: 18 }} />
                                {academicDisplay(subject.teacherPhone)}
                              </Link>
                            ) : null}

                            {subject.isMine ? (
                              <Button
                                variant="outlined"
                                startIcon={<EditNoteRoundedIcon />}
                                onClick={() =>
                                  openMarks({
                                    className: classTeacherData.className,
                                    fullClassName: classTeacherData.fullClassName,
                                    stream: classTeacherData.stream,
                                    subjectName: subject.subjectName,
                                    subjectId: subject.subjectId,
                                    medium: subject.medium,
                                  })
                                }
                                fullWidth
                              >
                                Enter Marks
                              </Button>
                            ) : null}
                          </Stack>
                        }
                        sx={{
                          bgcolor: subject.completed ? "success.lighter" : "error.lighter",
                        }}
                      />
                    ) : (
                      <Box
                        key={`${subject.subjectId || `${subject.subjectName}_${subject.subjectNumber}`}__${subject.medium || "all"}`}
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: subject.completed ? "success.lighter" : "error.lighter",
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            spacing={1}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                  {academicDisplay(subject.subjectName)}
                                </Typography>
                                {subject.subjectNumber ? (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={academicDisplay(`No. ${subject.subjectNumber}`)}
                                  />
                                ) : null}
                                {subject.medium ? (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={academicDisplay(`${subject.medium} Medium`)}
                                  />
                                ) : null}
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                {academicDisplay(progressPending
                                  ? progressLabel
                                  : `${subject.done}/${subject.total} students`)}
                              </Typography>
                            </Box>

                            <StatusChip
                              status={subject.completed ? "completed" : "pending"}
                              label={academicDisplay(subject.completed ? "Completed" : "Pending")}
                            />
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Typography variant="body2" color="text.secondary">
                              {academicDisplay(progressPending ? progressLabel : `${subject.progress}%`)}
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                              {academicDisplay(subject.teacherName)}
                            </Typography>
                          </Stack>

                          {!subject.completed && subject.teacherPhone ? (
                            <Link
                              href={`tel:${sanitizePhone(subject.teacherPhone)}`}
                              underline="hover"
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.75,
                                fontWeight: 700,
                                width: "fit-content",
                              }}
                            >
                              <PhoneRoundedIcon sx={{ fontSize: 18 }} />
                              {academicDisplay(subject.teacherPhone)}
                            </Link>
                          ) : null}

                          {subject.isMine ? (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<EditNoteRoundedIcon />}
                              onClick={() =>
                                openMarks({
                                  className: classTeacherData.className,
                                  fullClassName: classTeacherData.fullClassName,
                                  stream: classTeacherData.stream,
                                  subjectName: subject.subjectName,
                                  subjectId: subject.subjectId,
                                  medium: subject.medium,
                                })
                              }
                              sx={{ alignSelf: "flex-start" }}
                            >
                              Enter Marks
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>
                    )
                  )
                )}
              </Stack>
            </Stack>
          </Paper>
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
                  My Subject Work
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter marks for the subjects assigned to you.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<AutoStoriesRoundedIcon />}
                  label={academicDisplay(`${subjectRows.length} Subjects`)}
                  variant="outlined"
                />
                <Chip
                  icon={<TimelineRoundedIcon />}
                  label={
                    academicDisplay(progressPending
                      ? progressLabel
                      : `${subjectProgressSummary.pending} Pending`)
                  }
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            </Stack>

            {subjectRows.length === 0 ? (
              <EmptyState title="No assignments" />
            ) : (
              <Grid container spacing={1.5}>
                {subjectRows.map((row, i) => (
                  <Grid size={{ xs: 12, md: 6 }} key={`${row.fullClassName}_${row.subjectId}_${row.subjectName}_${row.medium}_${i}`}>
                    <MobileListRow
                      compact={isMobile}
                      title={academicDisplay(`${row.displayClassName} - ${row.subjectName}${row.medium ? ` - ${row.medium} Medium` : ""}`)}
                      right={
                        <StatusChip
                          status={row.pending > 0 || row.total === 0 ? "pending" : "completed"}
                          label={academicDisplay(row.pending > 0 || row.total === 0 ? "Pending" : "Completed")}
                        />
                      }
                      meta={
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {row.stream ? (
                            <Chip size="small" variant="outlined" label={academicDisplay(row.stream)} />
                          ) : null}
                          {row.subjectNumber ? (
                            <Chip size="small" variant="outlined" label={academicDisplay(`No. ${row.subjectNumber}`)} />
                          ) : null}
                          {row.medium ? (
                            <Chip size="small" color="primary" variant="outlined" label={academicDisplay(`${row.medium} Medium`)} />
                          ) : null}
                        </Stack>
                      }
                      footer={
                        <Stack spacing={1}>
                          <Typography variant="body2" color="text.secondary">
                            {progressPending
                              ? progressLabel
                              : `${row.done}/${row.total} students completed`}
                          </Typography>

                          <LinearProgress
                            variant={progressLoading ? "indeterminate" : "determinate"}
                            value={progressLoading ? undefined : row.progress}
                            sx={{ height: 6, borderRadius: 5 }}
                          />

                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">
                              {progressPending ? progressLabel : `${row.progress}%`}
                            </Typography>

                            <Typography variant="body2">
                              {progressPending ? "" : `${row.done}/${row.total}`}
                            </Typography>
                          </Stack>

                          <Button
                            variant="contained"
                            size={isMobile ? "medium" : "small"}
                            startIcon={<EditNoteRoundedIcon />}
                            onClick={() => openMarks(row)}
                            fullWidth={isMobile}
                          >
                            Enter Marks
                          </Button>
                        </Stack>
                      }
                    />
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
