import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import ClassRoundedIcon from "@mui/icons-material/ClassRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { EmptyState, PageContainer } from "../components/ui";
import {
  buildALClassName,
  buildALDisplayClassName,
  isALGrade,
  normalizeSection,
  normalizeText,
  parseGrade,
} from "../constants";

const ROWS_PER_PAGE = 40;

const sectionCardSx = {
  borderRadius: 3,
  border: "1px solid #e8eaf6",
  boxShadow: "0 2px 10px rgba(26,35,126,0.06)",
  backgroundColor: "white",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thTdBaseStyle = {
  border: "1px solid #000",
  padding: "6px 8px",
  fontSize: 11,
  lineHeight: 1.2,
  verticalAlign: "middle",
};

const pageCellStyle = {
  ...thTdBaseStyle,
  height: 28,
};

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const normalizeAcademicYear = (value) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  return match ? match[0] : raw;
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const safeNormalizedEquals = (left, right) => {
  if (!hasValue(left) || !hasValue(right)) return false;
  return normalize(left) === normalize(right);
};

const buildSubjectIdentity = (item = {}, fallback = {}) => ({
  subjectId: pick(item.subjectId, fallback.subjectId, ""),
  subjectName: pick(
    item.subjectName,
    item.subject,
    fallback.subjectName,
    fallback.subject,
    ""
  ),
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

const getClassIdentity = (item = {}) =>
  pick(item.alClassName, item.fullClassName, item.className, "");

const getResolvedStream = (item = {}, fallback = {}) =>
  normalizeText(pick(item.stream, fallback.stream, ""));

const getResolvedSection = (item = {}, fallback = {}) =>
  normalizeSection(
    pick(item.section, item.className, fallback.section, fallback.className, "")
  );

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
    `${pick(item.grade, fallback.grade, "")}${pick(
      item.section,
      fallback.section,
      ""
    )}`.trim()
  );
};

const getDisplayClassName = (item = {}, fallback = {}) => {
  const explicit = pick(
    item.alClassName,
    item.fullClassName,
    fallback.alClassName,
    fallback.fullClassName,
    ""
  );

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

    if (!targetStream) return true;
    if (itemStream) return itemStream === targetStream;
    return false;
  }

  if (itemIdentity && targetIdentity) {
    return itemIdentity === targetIdentity;
  }

  return itemGrade === targetGrade && itemSection === targetSection;
};

const buildEnrollmentDedupKey = (item = {}, fallback = {}) => {
  const classContext = getClassContext(item, fallback);
  const subject = buildSubjectIdentity(item, fallback);
  const academicYear = normalizeAcademicYear(
    pick(item.academicYear, item.year, fallback.academicYear, fallback.year, "")
  );

  return [
    String(pick(item.studentId, fallback.studentId, "")).trim(),
    normalize(classContext.fullClassName || classContext.className || ""),
    normalize(subject.subjectId),
    normalize(subject.subjectName),
    normalize(subject.subjectNumber),
    normalize(academicYear),
  ].join("__");
};

const buildTermKey = (term = {}) =>
  `${pick(term.term, term.termName, "")}__${pick(term.year, term.academicYear, "")}`;

const buildTermLabel = (term = {}) => {
  const termName = pick(term.term, term.termName, term.name, "Term");
  const year = pick(term.year, term.academicYear, "");
  return year ? `${termName} - ${year}` : termName;
};

const isActiveTerm = (term = {}) => {
  const raw = pick(term.isActive, term.active, term.status);
  if (typeof raw === "boolean") return raw;
  return normalize(raw) === "active" || normalize(raw) === "true";
};

const isSameTeacher = (item = {}, user) => {
  const itemTeacherId = normalize(pick(item.teacherId, item.teacherUid, item.userId));
  const itemTeacherEmail = normalize(pick(item.teacherEmail, item.email));

  return (
    itemTeacherId === normalize(user?.uid) ||
    itemTeacherEmail === normalize(user?.email)
  );
};

const getStudentSortIndex = (row = {}) =>
  String(row.indexNo || row.admissionNo || "").trim();

const sortRowsInTeacherMarkSheetOrder = (rows = []) =>
  [...rows].sort((a, b) => {
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

const chunkArray = (items = [], size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function SBAFormPage({ page, meta }) {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "210mm",
        minHeight: "297mm",
        mx: "auto",
        bgcolor: "#fff",
        color: "#000",
        p: { xs: 2, md: "12mm" },
        boxSizing: "border-box",
        border: "1px solid #d9deea",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      <Stack spacing={1.5}>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
            Assessment Marks
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 12, color: "#334155" }}>
            {meta.classLabel} | Subject: {meta.subjectName} | {meta.termName} |{" "}
            {meta.academicYear}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 11, color: "#475569" }}>
            Grade {meta.grade || "-"} | Division {meta.division || "-"}
            {meta.stream ? ` | Stream: ${meta.stream}` : ""}
          </Typography>
        </Box>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thTdBaseStyle, width: "8%", fontWeight: 700 }}>No</th>
              <th style={{ ...thTdBaseStyle, width: "46%", fontWeight: 700 }}>
                Student Name
              </th>
              <th
                style={{
                  ...thTdBaseStyle,
                  width: "32%",
                  fontWeight: 700,
                  textAlign: "center",
                }}
                colSpan={5}
              >
                Assessment Marks
              </th>
              <th style={{ ...thTdBaseStyle, width: "14%", fontWeight: 700 }}>
                Marks (20)
              </th>
            </tr>
            <tr>
              <th style={{ ...thTdBaseStyle, fontWeight: 400 }} />
              <th style={{ ...thTdBaseStyle, fontWeight: 400 }} />
              {[1, 2, 3, 4, 5].map((value) => (
                <th
                  key={value}
                  style={{
                    ...thTdBaseStyle,
                    width: "6.4%",
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                >
                  {value}
                </th>
              ))}
              <th style={{ ...thTdBaseStyle, fontWeight: 400 }} />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.key}>
                <td style={{ ...pageCellStyle, textAlign: "center" }}>{row.no}</td>
                <td style={pageCellStyle}>{row.studentName}</td>
                {[1, 2, 3, 4, 5].map((value) => (
                  <td
                    key={`${row.key}-assessment-${value}`}
                    style={{ ...pageCellStyle, textAlign: "center" }}
                  />
                ))}
                <td style={{ ...pageCellStyle, textAlign: "center" }} />
              </tr>
            ))}
          </tbody>
        </table>

        <table style={{ ...tableStyle, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ ...thTdBaseStyle, width: "16%", fontWeight: 700 }}>
                Criteria No
              </th>
              <th style={{ ...thTdBaseStyle, width: "42%", fontWeight: 700 }}>
                Review
              </th>
              <th style={{ ...thTdBaseStyle, width: "42%", fontWeight: 700 }}>
                Feedback Action
              </th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((value) => (
              <tr key={`criteria-${page.pageNumber}-${value}`}>
                <td style={{ ...pageCellStyle, textAlign: "center", height: 34 }}>
                  {value}
                </td>
                <td style={{ ...pageCellStyle, height: 34 }} />
                <td style={{ ...pageCellStyle, height: 34 }} />
              </tr>
            ))}
          </tbody>
        </table>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: 2.5,
            pt: 1.5,
          }}
        >
          {["Teacher Signature", "Principal Signature", "Reviewer Signature"].map(
            (label) => (
              <Box key={`${page.pageNumber}-${label}`} sx={{ textAlign: "center" }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    borderTop: "1px solid #000",
                    pt: 1,
                    mt: 3.5,
                  }}
                >
                  {label}
                </Typography>
              </Box>
            )
          )}
        </Box>

        <Typography sx={{ fontSize: 10, color: "#475569", textAlign: "right" }}>
          Page {page.pageNumber} of {page.totalPages}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function SBAForm() {
  const { isAdmin } = useAuth();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const [bootLoading, setBootLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
  const [selectedTermKey, setSelectedTermKey] = useState("");
  const [studentRows, setStudentRows] = useState([]);

  const activeTerm = useMemo(
    () => terms.find((term) => buildTermKey(term) === selectedTermKey) || null,
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

        if (targetClassContext && matchesClassContext(assignment, targetClassContext)) {
          return true;
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

  const contextReady = Boolean(selectedClass && selectedSubject && activeTerm);

  const printablePages = useMemo(() => {
    if (!studentRows.length) return [];

    const chunks = chunkArray(studentRows, ROWS_PER_PAGE);

    return chunks.map((rows, pageIndex) => {
      const startingNumber = pageIndex * ROWS_PER_PAGE;
      const pageRows = Array.from({ length: ROWS_PER_PAGE }, (_, rowIndex) => {
        const row = rows[rowIndex];
        return {
          key: row?.key || `blank-${pageIndex + 1}-${rowIndex + 1}`,
          no: startingNumber + rowIndex + 1,
          studentName: row?.studentName || "",
        };
      });

      return {
        pageNumber: pageIndex + 1,
        totalPages: chunks.length,
        rows: pageRows,
      };
    });
  }, [studentRows]);

  const printMeta = useMemo(
    () => ({
      classLabel: selectedClassRow?.displayClassName || selectedClass || "-",
      grade: selectedClassRow?.grade || "",
      division: selectedClassRow?.section || "",
      stream: selectedClassRow?.stream || "",
      subjectName: selectedSubject?.subjectName || "-",
      termName: pick(activeTerm?.term, activeTerm?.termName, "Term"),
      academicYear: normalizeAcademicYear(
        pick(activeTerm?.year, activeTerm?.academicYear, "")
      ),
    }),
    [activeTerm, selectedClass, selectedClassRow, selectedSubject]
  );

  const loadBase = useCallback(async () => {
    try {
      setBootLoading(true);
      setError("");

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User is not logged in.");

      const [teacherAssignmentsSnap, academicTermsSnap] = await Promise.all([
        getDocs(collection(db, "teacherAssignments")),
        getDocs(
          query(collection(db, "academicTerms"), orderBy("year", "desc"))
        ).catch(() => getDocs(collection(db, "academicTerms"))),
      ]);

      const allAssignments = teacherAssignmentsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const scopedAssignments = isAdmin
        ? allAssignments
        : allAssignments.filter((item) => isSameTeacher(item, currentUser));

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

      setTeacherAssignments(scopedAssignments);
      setTerms(sortedTerms);

      const defaultTerm = sortedTerms.find(isActiveTerm) || sortedTerms[0] || null;
      if (defaultTerm) {
        setSelectedTermKey((prev) => prev || buildTermKey(defaultTerm));
      }

      if (!selectedClass && scopedAssignments.length > 0) {
        const defaultClass =
          getComparableALClassName(scopedAssignments[0]) ||
          getClassIdentity(scopedAssignments[0]) ||
          getClassFallback(scopedAssignments[0]);
        setSelectedClass(defaultClass);
      }
    } catch (err) {
      console.error("SBA load error:", err);
      setError(err.message || "Failed to load SBA page.");
    } finally {
      setBootLoading(false);
    }
  }, [isAdmin, selectedClass]);

  const loadStudents = useCallback(async () => {
    try {
      setLoadingRows(true);
      setError("");

      if (!selectedClass || !selectedSubject || !activeTerm) {
        setStudentRows([]);
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

      const studentMap = new Map(allStudents.map((student) => [String(student.id), student]));

      const termYear = normalizeAcademicYear(
        pick(activeTerm.year, activeTerm.academicYear, "")
      );

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
          normalizeAcademicYear(
            pick(enrollment.academicYear, enrollment.year, "")
          ) === termYear;

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

        return {
          key: `${studentId}-${selectedSubject.subjectName}-${termYear}`,
          studentId,
          studentName: pick(
            student.fullName,
            student.name,
            enrollment.studentName,
            "Student"
          ),
          indexNo: pick(student.indexNo, enrollment.indexNo, ""),
          admissionNo: pick(student.admissionNo, enrollment.admissionNo, ""),
        };
      });

      setStudentRows(sortRowsInTeacherMarkSheetOrder(mappedRows));
    } catch (err) {
      console.error("SBA student load error:", err);
      setError(err.message || "Failed to load enrolled students.");
      setStudentRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, [activeTerm, selectedClass, selectedClassRow, selectedSubject]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (subjectOptions.length === 0) {
      setSelectedSubjectKey("");
      return;
    }

    const subjectStillExists = subjectOptions.some(
      (subject) => subject.key === selectedSubjectKey
    );

    if (!subjectStillExists) {
      setSelectedSubjectKey(subjectOptions[0].key);
    }
  }, [selectedSubjectKey, subjectOptions]);

  useEffect(() => {
    if (bootLoading) return;
    loadStudents();
  }, [bootLoading, loadStudents]);

  const buildPrintableHtml = () => {
    const pagesHtml = printablePages
      .map((page) => {
        const rowsHtml = page.rows
          .map(
            (row) => `
              <tr>
                <td class="cell cell-center">${row.no}</td>
                <td class="cell">${escapeHtml(row.studentName)}</td>
                <td class="cell cell-center"></td>
                <td class="cell cell-center"></td>
                <td class="cell cell-center"></td>
                <td class="cell cell-center"></td>
                <td class="cell cell-center"></td>
                <td class="cell cell-center"></td>
              </tr>
            `
          )
          .join("");

        const reviewRowsHtml = [1, 2, 3, 4, 5]
          .map(
            (value) => `
              <tr>
                <td class="cell cell-center review-row">${value}</td>
                <td class="cell review-row"></td>
                <td class="cell review-row"></td>
              </tr>
            `
          )
          .join("");

        return `
          <section class="sheet-page">
            <div class="header">
              <div class="title">Assessment Marks</div>
              <div class="meta">${escapeHtml(printMeta.classLabel)} | Subject: ${escapeHtml(
                printMeta.subjectName
              )} | ${escapeHtml(printMeta.termName)} | ${escapeHtml(
                printMeta.academicYear
              )}</div>
              <div class="meta subtle">Grade ${escapeHtml(
                printMeta.grade
              )} | Division ${escapeHtml(printMeta.division)}${
                printMeta.stream
                  ? ` | Stream: ${escapeHtml(printMeta.stream)}`
                  : ""
              }</div>
            </div>

            <table class="main-table">
              <thead>
                <tr>
                  <th class="cell no-col">No</th>
                  <th class="cell name-col">Student Name</th>
                  <th class="cell assess-col" colspan="5">Assessment Marks</th>
                  <th class="cell marks-col">Marks (20)</th>
                </tr>
                <tr>
                  <th class="cell"></th>
                  <th class="cell"></th>
                  <th class="cell cell-center">1</th>
                  <th class="cell cell-center">2</th>
                  <th class="cell cell-center">3</th>
                  <th class="cell cell-center">4</th>
                  <th class="cell cell-center">5</th>
                  <th class="cell"></th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>

            <table class="review-table">
              <thead>
                <tr>
                  <th class="cell review-no">Criteria No</th>
                  <th class="cell review-col">Review</th>
                  <th class="cell review-col">Feedback Action</th>
                </tr>
              </thead>
              <tbody>${reviewRowsHtml}</tbody>
            </table>

            <div class="signatures">
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Teacher Signature</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Principal Signature</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Reviewer Signature</div>
              </div>
            </div>

            <div class="page-footer">Page ${page.pageNumber} of ${page.totalPages}</div>
          </section>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <title>Assessment Marks - ${escapeHtml(printMeta.classLabel)} - ${escapeHtml(
            printMeta.subjectName
          )}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              color: #000;
              background: #fff;
            }
            .sheet-page {
              width: 190mm;
              min-height: 277mm;
              margin: 0 auto;
              page-break-after: always;
              display: flex;
              flex-direction: column;
            }
            .sheet-page:last-child {
              page-break-after: auto;
            }
            .header {
              text-align: center;
              margin-bottom: 8px;
            }
            .title {
              font-size: 22px;
              font-weight: 700;
            }
            .meta {
              margin-top: 4px;
              font-size: 11px;
              color: #111827;
            }
            .meta.subtle {
              color: #475569;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            .main-table {
              margin-top: 4px;
            }
            .review-table {
              margin-top: 8px;
            }
            .cell {
              border: 1px solid #000;
              padding: 6px 8px;
              font-size: 11px;
              line-height: 1.2;
              vertical-align: middle;
            }
            .cell-center {
              text-align: center;
            }
            .no-col {
              width: 8%;
            }
            .name-col {
              width: 46%;
            }
            .assess-col {
              width: 32%;
            }
            .marks-col {
              width: 14%;
            }
            .review-no {
              width: 16%;
            }
            .review-col {
              width: 42%;
            }
            .main-table tbody .cell {
              height: 28px;
            }
            .review-row {
              height: 34px;
            }
            .signatures {
              margin-top: 16px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 14px;
            }
            .signature-block {
              text-align: center;
              padding-top: 20px;
            }
            .signature-line {
              border-top: 1px solid #000;
              margin-bottom: 8px;
            }
            .signature-label {
              font-size: 11px;
            }
            .page-footer {
              margin-top: auto;
              padding-top: 8px;
              text-align: right;
              font-size: 10px;
              color: #475569;
            }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `;
  };

  const handlePrint = () => {
    if (!contextReady || printablePages.length === 0) {
      setError("Select class, subject, and term with enrolled students before printing.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Unable to open print window.");
      return;
    }

    printWindow.document.write(buildPrintableHtml());
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <PageContainer
      title="SBA Assessment Sheets"
      subtitle="Generate print-ready assessment sheets using the same class and subject enrollment logic as marks entry."
      actions={
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadBase}
            disabled={bootLoading || loadingRows}
            fullWidth={isMobile}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={
              loadingRows ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PrintRoundedIcon />
              )
            }
            onClick={handlePrint}
            disabled={bootLoading || loadingRows || !contextReady || !printablePages.length}
            sx={{ bgcolor: "#1a237e" }}
            fullWidth={isMobile}
          >
            Print SBA Form
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2.5}>
        {error ? (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        ) : null}

        <Alert severity="info">
          This page uses <strong>studentSubjectEnrollments</strong> as the source of
          truth, so printed student names follow the selected class, division, and
          subject exactly like marks entry.
        </Alert>

        <Paper sx={{ ...sectionCardSx, p: 2.25 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a237e" }}>
                  Select SBA Context
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose the term, class, and subject to print the correct enrolled
                  student list.
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small" disabled={bootLoading}>
                <InputLabel id="sba-term-label">Academic Term</InputLabel>
                <Select
                  labelId="sba-term-label"
                  label="Academic Term"
                  value={selectedTermKey}
                  onChange={(event) => setSelectedTermKey(event.target.value)}
                >
                  {terms.map((term) => (
                    <MenuItem key={term.id} value={buildTermKey(term)}>
                      {buildTermLabel(term)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small" disabled={bootLoading}>
                <InputLabel id="sba-class-label">Class</InputLabel>
                <Select
                  labelId="sba-class-label"
                  label="Class"
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                >
                  {classOptions.map((option) => (
                    <MenuItem key={option.fullClassName} value={option.fullClassName}>
                      {option.displayClassName || option.fullClassName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4} md={3}>
              <FormControl
                fullWidth
                size="small"
                disabled={bootLoading || !selectedClass || subjectOptions.length === 0}
              >
                <InputLabel id="sba-subject-label">Subject</InputLabel>
                <Select
                  labelId="sba-subject-label"
                  label="Subject"
                  value={selectedSubjectKey}
                  onChange={(event) => setSelectedSubjectKey(event.target.value)}
                >
                  {subjectOptions.map((option) => (
                    <MenuItem key={option.key} value={option.key}>
                      {option.subjectName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {bootLoading ? (
          <Paper sx={{ ...sectionCardSx, p: 5, textAlign: "center" }}>
            <CircularProgress />
          </Paper>
        ) : !classOptions.length ? (
          <EmptyState
            title="No classes available"
            description="No teacher assignments were found for this account, so the SBA filters cannot be built yet."
          />
        ) : contextReady ? (
          <>
            <Paper sx={{ ...sectionCardSx, p: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<SchoolRoundedIcon />}
                    label={printMeta.classLabel}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    icon={<AutoStoriesRoundedIcon />}
                    label={printMeta.subjectName}
                    variant="outlined"
                  />
                  <Chip
                    icon={<TimelineRoundedIcon />}
                    label={buildTermLabel(activeTerm)}
                    variant="outlined"
                  />
                  <Chip
                    icon={<ClassRoundedIcon />}
                    label={`Grade ${printMeta.grade || "-"} / Division ${printMeta.division || "-"}`}
                    variant="outlined"
                  />
                  {printMeta.stream ? (
                    <Chip label={`Stream: ${printMeta.stream}`} variant="outlined" />
                  ) : null}
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<AssignmentRoundedIcon />}
                    label={`${studentRows.length} students`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    icon={<PrintRoundedIcon />}
                    label={`${printablePages.length} page${
                      printablePages.length === 1 ? "" : "s"
                    }`}
                    color="secondary"
                    variant="outlined"
                  />
                </Stack>
              </Stack>
            </Paper>

            {loadingRows ? (
              <Paper sx={{ ...sectionCardSx, p: 5, textAlign: "center" }}>
                <CircularProgress />
              </Paper>
            ) : studentRows.length === 0 ? (
              <EmptyState
                title="No enrolled students found"
                description="No active student subject enrollments matched the selected class, subject, and academic year."
              />
            ) : (
              <Stack spacing={2.5}>
                {printablePages.map((page) => (
                  <SBAFormPage
                    key={`sba-page-${page.pageNumber}`}
                    page={page}
                    meta={printMeta}
                  />
                ))}
              </Stack>
            )}
          </>
        ) : (
          <EmptyState
            title="Select filters to start"
            description="Choose academic term, class, and subject to load the SBA print sheet."
          />
        )}
      </Stack>
    </PageContainer>
  );
}
