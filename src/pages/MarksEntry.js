import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
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
  FilterCard,
  MobileListRow,
  PageContainer,
  ResponsiveTableWrapper,
  SectionCard,
  StatCard,
  StatusChip,
} from "../components/ui";

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const asNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const makeClassName = (item = {}) =>
  pick(item.className, `${pick(item.grade, "")}${pick(item.section, "")}`.trim());

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

const buildSubjectKey = (item = {}) => {
  const subjectId = pick(item.subjectId, "");
  const subjectName = pick(item.subjectName, item.subject, "");
  return `${subjectId}__${subjectName}`;
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

  const navigationSelection = useMemo(
    () => ({
      className: pick(location.state?.className, ""),
      subjectName: pick(location.state?.subjectName, ""),
      subjectId: pick(location.state?.subjectId, ""),
      termKey: pick(location.state?.termKey, ""),
    }),
    [location.state]
  );

  const activeTerm = useMemo(
    () =>
      terms.find(
        (t) =>
          `${pick(t.term, t.termName)}__${pick(t.year, t.academicYear)}` ===
          selectedTermKey
      ) || null,
    [terms, selectedTermKey]
  );

  const classOptions = useMemo(() => {
    const map = new Map();

    teacherAssignments.forEach((assignment) => {
      const className = makeClassName(assignment);
      if (!className) return;

      if (!map.has(className)) {
        map.set(className, {
          className,
          grade: pick(assignment.grade, ""),
          section: pick(assignment.section, ""),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.className).localeCompare(String(b.className))
    );
  }, [teacherAssignments]);

  const subjectOptions = useMemo(() => {
    const map = new Map();

    teacherAssignments
      .filter(
        (assignment) =>
          !selectedClass ||
          normalize(makeClassName(assignment)) === normalize(selectedClass)
      )
      .forEach((assignment) => {
        const subjectId = pick(assignment.subjectId, "");
        const subjectName = pick(assignment.subjectName, assignment.subject, "");
        const subjectKey = `${subjectId}__${subjectName}`;

        if (!map.has(subjectKey)) {
          map.set(subjectKey, {
            key: subjectKey,
            subjectId,
            subjectName,
          });
        }
      });

    return Array.from(map.values()).sort((a, b) =>
      String(a.subjectName).localeCompare(String(b.subjectName))
    );
  }, [teacherAssignments, selectedClass]);

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
      } catch (err) {
        // ignore select issues on some mobile browsers
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

  const applyNavigationSelection = useCallback(() => {
    const signature = JSON.stringify(navigationSelection);

    if (
      !navigationSelection.className &&
      !navigationSelection.subjectName &&
      !navigationSelection.subjectId &&
      !navigationSelection.termKey
    ) {
      return;
    }

    if (appliedNavigationSelectionRef.current === signature) {
      return;
    }

    let nextClass = "";
    let nextSubjectKey = "";
    let nextTermKey = "";

    if (navigationSelection.className) {
      const matchedClass = classOptions.find(
        (option) => normalize(option.className) === normalize(navigationSelection.className)
      );
      nextClass = matchedClass?.className || "";
    }

    const assignmentsForClass = teacherAssignments.filter((assignment) => {
      if (!nextClass) return true;
      return normalize(makeClassName(assignment)) === normalize(nextClass);
    });

    const matchedSubjectAssignment = assignmentsForClass.find((assignment) => {
      const subjectIdMatch =
        navigationSelection.subjectId &&
        normalize(pick(assignment.subjectId, "")) === normalize(navigationSelection.subjectId);

      const subjectNameMatch =
        navigationSelection.subjectName &&
        normalize(pick(assignment.subjectName, assignment.subject, "")) ===
          normalize(navigationSelection.subjectName);

      return subjectIdMatch || subjectNameMatch;
    });

    if (matchedSubjectAssignment) {
      nextSubjectKey = buildSubjectKey(matchedSubjectAssignment);
      if (!nextClass) {
        nextClass = makeClassName(matchedSubjectAssignment);
      }
    }

    if (navigationSelection.termKey) {
      const matchedTerm = terms.find(
        (term) =>
          `${pick(term.term, term.termName)}__${pick(term.year, term.academicYear)}` ===
          navigationSelection.termKey
      );
      nextTermKey = matchedTerm
        ? `${pick(matchedTerm.term, matchedTerm.termName)}__${pick(
            matchedTerm.year,
            matchedTerm.academicYear
          )}`
        : "";
    }

    if (nextClass) {
      setSelectedClass(nextClass);
    }

    if (nextTermKey) {
      setSelectedTermKey(nextTermKey);
    }

    if (nextSubjectKey) {
      setSelectedSubjectKey(nextSubjectKey);
    }

    appliedNavigationSelectionRef.current = signature;
  }, [navigationSelection, classOptions, teacherAssignments, terms]);

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
          String(pick(b.term, b.termName, ""))
        );
      });

      setTerms(sortedTerms);

      const defaultTerm = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;

      if (!selectedTermKey && defaultTerm) {
        setSelectedTermKey(
          `${pick(defaultTerm.term, defaultTerm.termName)}__${pick(
            defaultTerm.year,
            defaultTerm.academicYear
          )}`
        );
      }

      const allMarks = marksSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMarksDocs(allMarks);

      if (!selectedClass && scopedAssignments.length > 0) {
        const defaultClass = makeClassName(scopedAssignments[0]);
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

      const termName = pick(activeTerm.term, activeTerm.termName, "");
      const termYear = pick(activeTerm.year, activeTerm.academicYear, "");

      const relevantEnrollments = allEnrollments.filter((enrollment) => {
        const sameClass =
          normalize(makeClassName(enrollment)) === normalize(selectedClass);

        const sameSubject =
          normalize(pick(enrollment.subjectId, "")) ===
            normalize(selectedSubject.subjectId) ||
          normalize(pick(enrollment.subjectName, "")) ===
            normalize(selectedSubject.subjectName);

        const sameYear =
          !termYear ||
          normalize(pick(enrollment.academicYear, enrollment.year, "")) ===
            normalize(termYear);

        const status = normalize(pick(enrollment.status, "active"));

        return sameClass && sameSubject && sameYear && (!status || status === "active");
      });

      const rows = relevantEnrollments
        .map((enrollment) => {
          const studentId = String(pick(enrollment.studentId, ""));
          const student =
            allStudents.find((s) => String(s.id) === studentId) || {};

          const existingMark = marksDocs.find((mark) => {
            const sameStudent = String(pick(mark.studentId, "")) === studentId;

            const sameClass =
              normalize(makeClassName(mark)) === normalize(selectedClass);

            const sameSubject =
              normalize(pick(mark.subjectId, "")) ===
                normalize(selectedSubject.subjectId) ||
              normalize(pick(mark.subjectName, mark.subject, "")) ===
                normalize(selectedSubject.subjectName);

            const sameTerm =
              normalize(pick(mark.term, mark.termName, "")) ===
              normalize(termName);

            const sameYear =
              normalize(pick(mark.academicYear, mark.year, "")) ===
              normalize(termYear);

            return (
              sameStudent && sameClass && sameSubject && sameTerm && sameYear
            );
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
            className: selectedClass,
            subjectId: pick(enrollment.subjectId, selectedSubject.subjectId, ""),
            subjectName: pick(
              enrollment.subjectName,
              selectedSubject.subjectName,
              ""
            ),
            term: termName,
            academicYear: termYear,
            mark: absent ? "" : markValue ?? "",
            absent,
            existingDocId: existingMark?.id || "",
            isDirty: false,
          };
        })
        .sort((a, b) => {
          const aIndex = String(a.indexNo || "").padStart(10, "0");
          const bIndex = String(b.indexNo || "").padStart(10, "0");
          return aIndex.localeCompare(bIndex) || a.studentName.localeCompare(b.studentName);
        });

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
  }, [activeTerm, marksDocs, selectedClass, selectedSubject]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!bootLoading && teacherAssignments.length > 0 && terms.length > 0) {
      applyNavigationSelection();
    }
  }, [bootLoading, teacherAssignments, terms, applyNavigationSelection]);

  useEffect(() => {
    if (!selectedClass) return;

    const currentSubjectStillExists = subjectOptions.some(
      (option) => option.key === selectedSubjectKey
    );

    if (!currentSubjectStillExists) {
      setSelectedSubjectKey(subjectOptions[0]?.key || "");
    }
  }, [selectedClass, subjectOptions, selectedSubjectKey]);

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
          className: row.className,
          grade: row.grade || "",
          section: row.section || "",
          subjectId: row.subjectId || "",
          subjectName: row.subjectName,
          subject: row.subjectName,
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
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <FilterCard
          title="Select Mark Entry Context"
          subtitle="Choose class, subject, and term before entering marks."
        >
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="marks-entry-class-label">Class</InputLabel>
              <Select
                labelId="marks-entry-class-label"
                label="Class"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classOptions.map((option) => (
                  <MenuItem key={option.className} value={option.className}>
                    {option.className}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
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

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="marks-entry-term-label">Academic Term</InputLabel>
              <Select
                labelId="marks-entry-term-label"
                label="Academic Term"
                value={selectedTermKey}
                onChange={(e) => setSelectedTermKey(e.target.value)}
              >
                {terms.map((term) => {
                  const key = `${pick(term.term, term.termName)}__${pick(
                    term.year,
                    term.academicYear
                  )}`;
                  return (
                    <MenuItem key={term.id} value={key}>
                      {buildTermLabel(term)}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
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
        </FilterCard>

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

        <SectionCard
          title="Mark Entry Sheet"
          subtitle={
            selectedClass && selectedSubject && activeTerm
              ? `${selectedClass} - ${selectedSubject.subjectName} - ${buildTermLabel(
                  activeTerm
                )}`
              : "Select class, subject, and term to begin."
          }
          action={
            selectedClass && selectedSubject && activeTerm ? (
              <StatusChip
                status={dirtyCount > 0 ? "draft" : "saved"}
                label={dirtyCount > 0 ? `${dirtyCount} unsaved` : "All saved"}
              />
            ) : null
          }
        >
          {(loadingRows || saving) && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
            </Box>
          )}

          {selectedClass && selectedSubject && activeTerm ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <StatusChip status="active" label={selectedClass} />
                    <StatusChip status="active" label={selectedSubject.subjectName} />
                    <StatusChip status="active" label={buildTermLabel(activeTerm)} />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Save progress: {saveProgress}%
                  </Typography>
                </Stack>
              </Box>

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
                    >
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
                              ref: (element) => setMarkInputRef(row.key, element),
                            }}
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
                    </MobileListRow>
                  ))}
                </Stack>
              ) : (
                <ResponsiveTableWrapper minWidth={980}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width={80}>No</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell width={140}>Index No</TableCell>
                        <TableCell width={160}>Admission No</TableCell>
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
                          <TableCell>
                            <TextField
                              value={drafts[row.key]?.mark ?? row.mark ?? ""}
                              onChange={(e) => handleMarkChange(row.key, e.target.value)}
                              onKeyDown={(e) => handleMarkInputKeyDown(e, index)}
                              disabled={drafts[row.key]?.absent ?? row.absent}
                              inputProps={{
                                inputMode: "decimal",
                                ref: (element) => setMarkInputRef(row.key, element),
                              }}
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
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}