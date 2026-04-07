import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  useMediaQuery,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SchoolIcon from "@mui/icons-material/School";
import ClassIcon from "@mui/icons-material/Class";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PersonIcon from "@mui/icons-material/Person";
import TagIcon from "@mui/icons-material/Tag";
import { useTheme } from "@mui/material/styles";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const STREAM_OPTIONS = [
  "Physical Science",
  "Biological Science",
  "Engineering Technology",
  "Bio Systems Technology",
  "Commerce",
  "Arts",
];

const getStudentName = (student = {}) =>
  student.fullName ||
  student.name ||
  student.studentName ||
  student.displayName ||
  "Unnamed Student";

const getIndexNumber = (student = {}) =>
  student.indexNumber ||
  student.indexNo ||
  student.admissionNumber ||
  student.admissionNo ||
  student.rollNumber ||
  student.rollNo ||
  student.studentNumber ||
  "-";

const normalizeGradeValue = (value) => {
  if (value === undefined || value === null || value === "") return "";
  return String(value).trim();
};

const normalizeSubjectNumber = (value) => {
  if (value === undefined || value === null || value === "") return "";
  return String(value).trim();
};

const buildClassLabel = (row) => {
  const fullClassName =
    row.fullClassName ||
    row.alClassName ||
    row.className ||
    (row.grade && row.section ? `${row.grade}${row.section}` : "") ||
    "";

  const stream = row.stream || "";
  const isAL = Number(row.grade) >= 12 || Boolean(stream) || Boolean(row.alClassName);

  if (isAL) {
    if (fullClassName) return fullClassName;
    if (row.grade && stream && row.section) return `${row.grade} ${stream} ${row.section}`;
    if (row.grade && stream) return `${row.grade} ${stream}`;
  }

  return fullClassName || "-";
};

const buildSubjectLabel = (row) => {
  const subjectName =
    row.subjectName ||
    row.subject ||
    row.subjectTitle ||
    "Unknown Subject";

  const subjectNumber = normalizeSubjectNumber(row.subjectNumber);

  return subjectNumber ? `${subjectName} (${subjectNumber})` : subjectName;
};

const sortGrade = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  const aIsNum = !Number.isNaN(na);
  const bIsNum = !Number.isNaN(nb);

  if (aIsNum && bIsNum) return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

const StudentCard = ({ student }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        height: "100%",
      }}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={0.75}>
          <Typography variant="body2" fontWeight={700}>
            {student.studentName}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              size="small"
              icon={<TagIcon />}
              label={`Index: ${student.indexNumber}`}
              variant="outlined"
            />
            {student.subjectNumber ? (
              <Chip
                size="small"
                label={`No: ${student.subjectNumber}`}
                color="primary"
                variant="outlined"
              />
            ) : null}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {student.classLabel}
            {student.stream ? ` • ${student.stream}` : ""}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function StudentSubjectEnrollments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);

  const [gradeFilter, setGradeFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [enrollmentSnap, studentSnap, subjectSnap] = await Promise.all([
          getDocs(collection(db, "studentSubjectEnrollments")),
          getDocs(collection(db, "students")),
          getDocs(collection(db, "subjects")),
        ]);

        const studentMap = new Map();
        studentSnap.forEach((docSnap) => {
          studentMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });

        const subjectMap = new Map();
        subjectSnap.forEach((docSnap) => {
          subjectMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });

        const normalizedRows = enrollmentSnap.docs.map((docSnap) => {
          const enrollment = { id: docSnap.id, ...docSnap.data() };

          const student = studentMap.get(enrollment.studentId) || {};
          const subject = subjectMap.get(enrollment.subjectId) || {};

          const grade = normalizeGradeValue(
            enrollment.grade ?? student.grade ?? subject.grade ?? ""
          );

          const stream =
            enrollment.stream ||
            student.stream ||
            "";

          const section =
            enrollment.section ||
            student.section ||
            student.className ||
            "";

          const fullClassName =
            enrollment.fullClassName ||
            enrollment.alClassName ||
            enrollment.className ||
            student.fullClassName ||
            student.alClassName ||
            (grade && stream && section
              ? `${grade} ${stream} ${section}`
              : grade && section
              ? `${grade}${section}`
              : "");

          const subjectName =
            enrollment.subjectName ||
            enrollment.subject ||
            subject.subjectName ||
            subject.name ||
            "Unknown Subject";

          const subjectNumber = normalizeSubjectNumber(
            enrollment.subjectNumber ||
              enrollment.subjectNo ||
              subject.subjectNumber ||
              ""
          );

          const studentName = getStudentName(student);
          const indexNumber = getIndexNumber(student);

          const classLabel = buildClassLabel({
            ...enrollment,
            grade,
            stream,
            section,
            fullClassName,
          });

          const subjectLabel = buildSubjectLabel({
            ...enrollment,
            subjectName,
            subjectNumber,
          });

          return {
            id: enrollment.id,
            studentId: enrollment.studentId || "",
            subjectId: enrollment.subjectId || "",
            status: enrollment.status || "active",

            grade,
            stream,
            section,

            fullClassName,
            alClassName: enrollment.alClassName || student.alClassName || "",
            className: enrollment.className || student.className || "",

            subjectName,
            subjectNumber,
            subjectLabel,

            studentName,
            indexNumber,
            classLabel,

            academicYear:
              enrollment.academicYear ||
              enrollment.year ||
              "",

            raw: {
              enrollment,
              student,
              subject,
            },
          };
        });

        if (mounted) {
          setRows(normalizedRows);
        }
      } catch (err) {
        console.error("Failed to load student subject enrollments:", err);
        if (mounted) {
          setError(err.message || "Failed to load enrollments.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const gradeOptions = useMemo(() => {
    return [...new Set(rows.map((row) => row.grade).filter(Boolean))].sort(sortGrade);
  }, [rows]);

  const filteredForStreamOptions = useMemo(() => {
    return rows.filter((row) => !gradeFilter || row.grade === gradeFilter);
  }, [rows, gradeFilter]);

  const streamOptions = useMemo(() => {
    const dynamicStreams = filteredForStreamOptions
      .map((row) => row.stream)
      .filter(Boolean);

    const merged = [...new Set([...STREAM_OPTIONS, ...dynamicStreams])];

    return merged.filter(Boolean);
  }, [filteredForStreamOptions]);

  const filteredForClassOptions = useMemo(() => {
    return rows.filter((row) => {
      if (gradeFilter && row.grade !== gradeFilter) return false;
      if (streamFilter && row.stream !== streamFilter) return false;
      return true;
    });
  }, [rows, gradeFilter, streamFilter]);

  const classOptions = useMemo(() => {
    return [...new Set(filteredForClassOptions.map((row) => row.classLabel).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [filteredForClassOptions]);

  const filteredForSubjectOptions = useMemo(() => {
    return rows.filter((row) => {
      if (gradeFilter && row.grade !== gradeFilter) return false;
      if (streamFilter && row.stream !== streamFilter) return false;
      if (classFilter && row.classLabel !== classFilter) return false;
      return true;
    });
  }, [rows, gradeFilter, streamFilter, classFilter]);

  const subjectOptions = useMemo(() => {
    return [...new Set(filteredForSubjectOptions.map((row) => row.subjectLabel).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [filteredForSubjectOptions]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        if (gradeFilter && row.grade !== gradeFilter) return false;
        if (streamFilter && row.stream !== streamFilter) return false;
        if (classFilter && row.classLabel !== classFilter) return false;
        if (subjectFilter && row.subjectLabel !== subjectFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const classCompare = a.classLabel.localeCompare(b.classLabel, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (classCompare !== 0) return classCompare;

        const subjectCompare = a.subjectLabel.localeCompare(b.subjectLabel, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (subjectCompare !== 0) return subjectCompare;

        const indexCompare = String(a.indexNumber).localeCompare(String(b.indexNumber), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (indexCompare !== 0) return indexCompare;

        return a.studentName.localeCompare(b.studentName, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [rows, gradeFilter, streamFilter, classFilter, subjectFilter]);

  const groupedData = useMemo(() => {
    const classMap = new Map();

    filteredRows.forEach((row) => {
      const classKey = row.classLabel || "Unknown Class";
      const subjectKey = row.subjectLabel || "Unknown Subject";

      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          classLabel: classKey,
          grade: row.grade || "",
          stream: row.stream || "",
          fullClassName: row.fullClassName || "",
          alClassName: row.alClassName || "",
          subjects: new Map(),
        });
      }

      const classEntry = classMap.get(classKey);

      if (!classEntry.subjects.has(subjectKey)) {
        classEntry.subjects.set(subjectKey, {
          subjectLabel: subjectKey,
          subjectName: row.subjectName || "",
          subjectNumber: row.subjectNumber || "",
          students: [],
        });
      }

      classEntry.subjects.get(subjectKey).students.push({
        enrollmentId: row.id,
        studentId: row.studentId,
        studentName: row.studentName,
        indexNumber: row.indexNumber,
        subjectNumber: row.subjectNumber,
        classLabel: row.classLabel,
        stream: row.stream,
      });
    });

    return Array.from(classMap.values()).map((classEntry) => ({
      ...classEntry,
      subjects: Array.from(classEntry.subjects.values()).sort((a, b) =>
        a.subjectLabel.localeCompare(b.subjectLabel, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    }));
  }, [filteredRows]);

  const summary = useMemo(() => {
    const uniqueStudents = new Set(filteredRows.map((row) => row.studentId).filter(Boolean)).size;
    const uniqueSubjects = new Set(filteredRows.map((row) => row.subjectLabel).filter(Boolean)).size;
    const uniqueClasses = new Set(filteredRows.map((row) => row.classLabel).filter(Boolean)).size;

    return {
      enrollments: filteredRows.length,
      students: uniqueStudents,
      subjects: uniqueSubjects,
      classes: uniqueClasses,
    };
  }, [filteredRows]);

  const resetDependentFilters = (type, value) => {
    if (type === "grade") {
      setGradeFilter(value);
      setStreamFilter("");
      setClassFilter("");
      setSubjectFilter("");
      return;
    }

    if (type === "stream") {
      setStreamFilter(value);
      setClassFilter("");
      setSubjectFilter("");
      return;
    }

    if (type === "class") {
      setClassFilter(value);
      setSubjectFilter("");
      return;
    }

    if (type === "subject") {
      setSubjectFilter(value);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading student subject enrollments...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Student Subject Enrollments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Canonical enrollment view grouped by class and subject, with A/L stream and subject number support.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Grade</InputLabel>
                  <Select
                    value={gradeFilter}
                    label="Grade"
                    onChange={(e) => resetDependentFilters("grade", e.target.value)}
                  >
                    <MenuItem value="">All Grades</MenuItem>
                    {gradeOptions.map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        {grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stream</InputLabel>
                  <Select
                    value={streamFilter}
                    label="Stream"
                    onChange={(e) => resetDependentFilters("stream", e.target.value)}
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

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={classFilter}
                    label="Class"
                    onChange={(e) => resetDependentFilters("class", e.target.value)}
                  >
                    <MenuItem value="">All Classes</MenuItem>
                    {classOptions.map((className) => (
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
                    value={subjectFilter}
                    label="Subject"
                    onChange={(e) => resetDependentFilters("subject", e.target.value)}
                  >
                    <MenuItem value="">All Subjects</MenuItem>
                    {subjectOptions.map((subject) => (
                      <MenuItem key={subject} value={subject}>
                        {subject}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Grid container spacing={1.25}>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Enrollments
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {summary.enrollments}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Students
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {summary.students}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Classes
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {summary.classes}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Subjects
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {summary.subjects}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {groupedData.length === 0 ? (
          <Alert severity="info">No student subject enrollments found for the selected filters.</Alert>
        ) : (
          <Stack spacing={1.25}>
            {groupedData.map((classGroup) => (
              <Accordion
                key={classGroup.classLabel}
                defaultExpanded={!classFilter || groupedData.length === 1}
                disableGutters
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  "&:before": { display: "none" },
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ width: "100%", alignItems: { sm: "center" } }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <ClassIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle1" fontWeight={700}>
                        {classGroup.classLabel}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {classGroup.grade ? (
                        <Chip size="small" label={`Grade ${classGroup.grade}`} variant="outlined" />
                      ) : null}
                      {classGroup.stream ? (
                        <Chip size="small" label={classGroup.stream} color="primary" variant="outlined" />
                      ) : null}
                      <Chip
                        size="small"
                        label={`${classGroup.subjects.length} subject${classGroup.subjects.length !== 1 ? "s" : ""}`}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                </AccordionSummary>

                <AccordionDetails sx={{ p: { xs: 1, sm: 1.5 } }}>
                  <Stack spacing={1.25}>
                    {classGroup.subjects.map((subjectGroup, subjectIndex) => (
                      <Paper
                        key={`${classGroup.classLabel}-${subjectGroup.subjectLabel}`}
                        variant="outlined"
                        sx={{ borderRadius: 2, overflow: "hidden" }}
                      >
                        <Box sx={{ p: 1.25, bgcolor: "action.hover" }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <MenuBookIcon fontSize="small" color="action" />
                              <Typography variant="subtitle2" fontWeight={700}>
                                {subjectGroup.subjectLabel}
                              </Typography>
                            </Stack>

                            <Chip
                              size="small"
                              label={`${subjectGroup.students.length} student${
                                subjectGroup.students.length !== 1 ? "s" : ""
                              }`}
                              variant="outlined"
                            />
                          </Stack>
                        </Box>

                        <Divider />

                        {isMobile ? (
                          <Box sx={{ p: 1 }}>
                            <Grid container spacing={1}>
                              {subjectGroup.students.map((student) => (
                                <Grid item xs={12} key={student.enrollmentId}>
                                  <StudentCard student={student} />
                                </Grid>
                              ))}
                            </Grid>
                          </Box>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell width="5%">#</TableCell>
                                <TableCell width="35%">Student Name</TableCell>
                                <TableCell width="20%">Index Number</TableCell>
                                <TableCell width="15%">Subject No.</TableCell>
                                <TableCell width="25%">Class / Stream</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {subjectGroup.students.map((student, index) => (
                                <TableRow key={student.enrollmentId} hover>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <PersonIcon fontSize="small" color="disabled" />
                                      <Typography variant="body2" fontWeight={600}>
                                        {student.studentName}
                                      </Typography>
                                    </Stack>
                                  </TableCell>
                                  <TableCell>{student.indexNumber}</TableCell>
                                  <TableCell>{student.subjectNumber || "-"}</TableCell>
                                  <TableCell>
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap">
                                      <Chip
                                        size="small"
                                        icon={<SchoolIcon />}
                                        label={student.classLabel}
                                        variant="outlined"
                                      />
                                      {student.stream ? (
                                        <Chip
                                          size="small"
                                          label={student.stream}
                                          color="primary"
                                          variant="outlined"
                                        />
                                      ) : null}
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}