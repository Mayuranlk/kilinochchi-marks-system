import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const normalizeGrade = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeSection = (value) => normalizeText(value);
const normalizeStatus = (value) => normalizeLower(value);

const sortStudents = (list) => {
  return [...list].sort((a, b) => {
    const gradeA = normalizeGrade(a.grade);
    const gradeB = normalizeGrade(b.grade);
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = normalizeSection(a.section).toUpperCase();
    const sectionB = normalizeSection(b.section).toUpperCase();
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const nameA = normalizeText(a.name).toLowerCase();
    const nameB = normalizeText(b.name).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return normalizeText(a.admissionNo)
      .toLowerCase()
      .localeCompare(normalizeText(b.admissionNo).toLowerCase(), undefined, {
        numeric: true,
        sensitivity: "base",
      });
  });
};

const getSubjectCategoryLabel = (value) => {
  const map = {
    compulsory: "Compulsory",
    religion: "Religion",
    aesthetic: "Aesthetic",
    basket: "Basket",
    al_main: "A/L Main",
    general_english: "General English",
    common_compulsory: "Common Compulsory",
    other: "Other",
  };
  return map[value] || value || "—";
};

const getStudentDisplay = (student) =>
  `${student.name || "Unnamed"}${
    student.admissionNo ? ` (${student.admissionNo})` : ""
  }`;

const getEnrollmentDocId = ({ academicYear, studentId, subjectId }) =>
  `${normalizeText(academicYear)}_${normalizeText(studentId)}_${normalizeText(subjectId)}`;

const getEnrollmentKey = (item) =>
  [
    normalizeText(item.academicYear),
    normalizeText(item.studentId),
    normalizeText(item.subjectId),
  ].join("__");

const buildChoiceNameSet = (list) => {
  if (!Array.isArray(list)) return new Set();
  return new Set(list.map((item) => normalizeLower(item)).filter(Boolean));
};

export default function GenerateSubjectEnrollments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  const [existingEnrollments, setExistingEnrollments] = useState([]);

  const [academicYear, setAcademicYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [previewRows, setPreviewRows] = useState([]);
  const [previewSummary, setPreviewSummary] = useState({
    studentsCount: 0,
    generatedCount: 0,
    duplicateCount: 0,
    warningCount: 0,
  });

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (academicYear && selectedGrade && selectedSection) {
      loadExistingEnrollmentsForSelection();
    } else {
      setExistingEnrollments([]);
    }
  }, [academicYear, selectedGrade, selectedSection]);

  const loadBaseData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [studentSnap, subjectSnap, classroomSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "classrooms")),
      ]);

      const loadedStudents = studentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        alSubjectChoices: Array.isArray(d.data().alSubjectChoices)
          ? d.data().alSubjectChoices
          : [],
      }));

      const loadedSubjects = subjectSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        grades: Array.isArray(d.data().grades)
          ? d.data().grades.map((g) => Number(g))
          : [],
        mediums: Array.isArray(d.data().mediums) ? d.data().mediums : [],
      }));

      const loadedClassrooms = classroomSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setStudents(sortStudents(loadedStudents));
      setSubjects(loadedSubjects);
      setClassrooms(loadedClassrooms);
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingEnrollmentsForSelection = async () => {
    try {
      const year = normalizeText(academicYear);
      const grade = Number(selectedGrade);
      const section = normalizeSection(selectedSection);

      const q = query(
        collection(db, "studentSubjectEnrollments"),
        where("academicYear", "==", year),
        where("grade", "==", grade),
        where("section", "==", section)
      );

      const snap = await getDocs(q);
      const loaded = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setExistingEnrollments(loaded);
    } catch (err) {
      setError("Failed to load existing enrollments: " + err.message);
      setExistingEnrollments([]);
    }
  };

  const gradeOptions = useMemo(() => {
    return [...new Set(classrooms.map((c) => normalizeGrade(c.grade)).filter(Boolean))].sort(
      (a, b) => a - b
    );
  }, [classrooms]);

  const sectionOptions = useMemo(() => {
    if (!selectedGrade) return [];
    return [
      ...new Set(
        classrooms
          .filter((c) => normalizeGrade(c.grade) === Number(selectedGrade))
          .map((c) => normalizeSection(c.section))
          .filter(Boolean)
      ),
    ].sort();
  }, [classrooms, selectedGrade]);

  const existingKeys = useMemo(() => {
    return new Set(
      existingEnrollments
        .filter(
          (item) =>
            normalizeText(item.studentId) &&
            normalizeText(item.subjectId) &&
            normalizeText(item.academicYear)
        )
        .map(getEnrollmentKey)
    );
  }, [existingEnrollments]);

  const getStudentsForSelection = () => {
    const grade = Number(selectedGrade);
    const section = normalizeSection(selectedSection);

    return students.filter((student) => {
      const status = normalizeStatus(student.status);
      const isActive = status === "" || status === "active";

      return (
        normalizeGrade(student.grade) === grade &&
        normalizeSection(student.section) === section &&
        isActive
      );
    });
  };

  const getSubjectsForGrade = (grade) => {
    return subjects.filter((subject) => {
      const isActive = normalizeStatus(subject.status || "active") === "active";
      const supportsGrade =
        Array.isArray(subject.grades) &&
        subject.grades.map((g) => Number(g)).includes(Number(grade));

      return isActive && supportsGrade;
    });
  };

  const buildEnrollmentDoc = ({
    student,
    subject,
    academicYear,
    selectedGrade,
    selectedSection,
  }) => {
    return {
      studentId: student.id,
      studentName: student.name || "",
      admissionNo: student.admissionNo || "",

      subjectId: subject.id,
      subjectName: subject.name || "",
      subjectCode: subject.code || "",
      subjectCategory: subject.category || "other",

      academicYear: normalizeText(academicYear),
      grade: Number(selectedGrade),
      section: normalizeSection(selectedSection),
      className: `${Number(selectedGrade)}${normalizeSection(selectedSection)}`,

      religionKey: subject.religionKey || "",
      basketGroup: subject.basketGroup || "",
      stream: student.stream || subject.stream || "",
      medium: student.medium || "",

      status: "active",
      generatedBy: "system",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const buildStudentEnrollmentDocs = (student, grade, year, section) => {
    const gradeSubjects = getSubjectsForGrade(grade);
    const docs = [];
    const warnings = [];

    const pushIfValid = (subject, warningMessage) => {
      if (!subject) {
        if (warningMessage) warnings.push(warningMessage);
        return;
      }

      docs.push(
        buildEnrollmentDoc({
          student,
          subject,
          academicYear: year,
          selectedGrade: grade,
          selectedSection: section,
        })
      );
    };

    if (grade >= 6 && grade <= 9) {
      const compulsorySubjects = gradeSubjects.filter(
        (subject) => subject.category === "compulsory"
      );
      compulsorySubjects.forEach((subject) =>
        pushIfValid(subject, null)
      );

      const religionSubject = gradeSubjects.find(
        (subject) =>
          subject.category === "religion" &&
          normalizeLower(subject.religionKey) === normalizeLower(student.religion)
      );

      pushIfValid(
        religionSubject,
        `Missing religion subject mapping for religion "${normalizeText(
          student.religion
        ) || "blank"}"`
      );

      const aestheticSubject = gradeSubjects.find(
        (subject) =>
          subject.category === "aesthetic" &&
          normalizeLower(subject.name) === normalizeLower(student.aestheticChoice)
      );

      pushIfValid(
        aestheticSubject,
        `Missing aesthetic subject mapping for choice "${normalizeText(
          student.aestheticChoice
        ) || "blank"}"`
      );
    }

    if (grade >= 10 && grade <= 11) {
      const compulsorySubjects = gradeSubjects.filter(
        (subject) => subject.category === "compulsory"
      );
      compulsorySubjects.forEach((subject) =>
        pushIfValid(subject, null)
      );

      const religionSubject = gradeSubjects.find(
        (subject) =>
          subject.category === "religion" &&
          normalizeLower(subject.religionKey) === normalizeLower(student.religion)
      );

      pushIfValid(
        religionSubject,
        `Missing religion subject mapping for religion "${normalizeText(
          student.religion
        ) || "blank"}"`
      );

      const basketChoices = [
        { group: "A", choice: student.basketAChoice },
        { group: "B", choice: student.basketBChoice },
        { group: "C", choice: student.basketCChoice },
      ];

      basketChoices.forEach((item) => {
        const basketSubject = gradeSubjects.find(
          (subject) =>
            subject.category === "basket" &&
            normalizeUpper(subject.basketGroup) === item.group &&
            normalizeLower(subject.name) === normalizeLower(item.choice)
        );

        pushIfValid(
          basketSubject,
          `Missing basket ${item.group} subject mapping for choice "${normalizeText(
            item.choice
          ) || "blank"}"`
        );
      });
    }

    if (grade >= 12 && grade <= 13) {
      const alChoices = Array.isArray(student.alSubjectChoices)
        ? student.alSubjectChoices.map((item) => normalizeText(item)).filter(Boolean)
        : [];

      const alChoiceSet = buildChoiceNameSet(alChoices);

      const alSubjects = gradeSubjects.filter((subject) => {
        if (subject.category !== "al_main") return false;
        if (!alChoiceSet.has(normalizeLower(subject.name))) return false;

        if (!normalizeText(student.stream)) return true;
        if (!normalizeText(subject.stream)) return true;

        return normalizeLower(subject.stream) === normalizeLower(student.stream);
      });

      alSubjects.forEach((subject) => {
        pushIfValid(subject, null);
      });

      if (alChoices.length > 0 && alSubjects.length === 0) {
        warnings.push("No A/L main subjects matched the student's A/L choices");
      }

      const matchedALNames = new Set(alSubjects.map((subject) => normalizeLower(subject.name)));
      alChoices.forEach((choice) => {
        if (!matchedALNames.has(normalizeLower(choice))) {
          warnings.push(`A/L choice "${choice}" did not match any active subject definition`);
        }
      });

      const generalEnglishSubjects = gradeSubjects.filter(
        (subject) => subject.category === "general_english"
      );
      generalEnglishSubjects.forEach((subject) => pushIfValid(subject, null));

      const commonCompulsorySubjects = gradeSubjects.filter(
        (subject) => subject.category === "common_compulsory"
      );
      commonCompulsorySubjects.forEach((subject) => pushIfValid(subject, null));
    }

    const dedupedMap = new Map();
    docs.forEach((item) => {
      const key = getEnrollmentKey(item);
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, item);
      }
    });

    return {
      docs: [...dedupedMap.values()],
      warnings,
    };
  };

  const buildPreview = () => {
    if (!academicYear) {
      setError("Academic year is required.");
      return;
    }

    if (!selectedGrade || !selectedSection) {
      setError("Select grade and section first.");
      return;
    }

    setPreviewLoading(true);
    setError("");
    setSuccess("");

    try {
      const grade = Number(selectedGrade);
      const year = normalizeText(academicYear);
      const section = normalizeSection(selectedSection);

      const selectedStudents = getStudentsForSelection();

      const rows = selectedStudents.map((student) => {
        const { docs: generatedDocs, warnings } = buildStudentEnrollmentDocs(
          student,
          grade,
          year,
          section
        );

        const newDocs = generatedDocs.filter(
          (item) => !existingKeys.has(getEnrollmentKey(item))
        );

        const duplicateDocs = generatedDocs.filter((item) =>
          existingKeys.has(getEnrollmentKey(item))
        );

        return {
          student,
          generatedDocs,
          newDocs,
          duplicateDocs,
          warnings,
        };
      });

      setPreviewRows(rows);
      setPreviewSummary({
        studentsCount: selectedStudents.length,
        generatedCount: rows.reduce((sum, row) => sum + row.newDocs.length, 0),
        duplicateCount: rows.reduce((sum, row) => sum + row.duplicateDocs.length, 0),
        warningCount: rows.reduce((sum, row) => sum + row.warnings.length, 0),
      });
    } catch (err) {
      setError("Failed to build preview: " + err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (previewRows.length === 0) {
      setError("Build preview first before generating.");
      return;
    }

    const docsToCreate = previewRows.flatMap((row) => row.newDocs);

    if (docsToCreate.length === 0) {
      setSuccess("No new enrollments to create. Everything already exists.");
      return;
    }

    setGenerating(true);
    setError("");
    setSuccess("");

    try {
      const batch = writeBatch(db);

      docsToCreate.forEach((item) => {
        const enrollmentId = getEnrollmentDocId({
          academicYear: item.academicYear,
          studentId: item.studentId,
          subjectId: item.subjectId,
        });

        const ref = doc(db, "studentSubjectEnrollments", enrollmentId);

        batch.set(
          ref,
          {
            ...item,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      setSuccess(
        `Generated ${docsToCreate.length} subject enrollment record${
          docsToCreate.length !== 1 ? "s" : ""
        }.`
      );

      await loadExistingEnrollmentsForSelection();

      setPreviewRows([]);
      setPreviewSummary({
        studentsCount: 0,
        generatedCount: 0,
        duplicateCount: 0,
        warningCount: 0,
      });
    } catch (err) {
      setError("Failed to generate subject enrollments: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

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
        <Typography
          variant={isMobile ? "h6" : "h5"}
          fontWeight={800}
          color="#1a237e"
        >
          Generate Subject Enrollments
        </Typography>

        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Generate student subject enrollments automatically from student choices
          and subject definitions.
        </Typography>

        <Grid container spacing={1.5} mt={1}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Step 1
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Select academic year, grade, and section.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Step 2
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Preview generated enrollments and warnings before writing.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Step 3
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Generate only missing enrollments with deterministic IDs.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={1.5} mt={1}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="Academic Year"
              value={academicYear}
              onChange={(e) => {
                setAcademicYear(e.target.value);
                setPreviewRows([]);
              }}
              placeholder="2026"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Grade</InputLabel>
              <Select
                value={selectedGrade}
                label="Grade"
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedSection("");
                  setPreviewRows([]);
                }}
              >
                <MenuItem value="">
                  <em>Select Grade</em>
                </MenuItem>
                {gradeOptions.map((grade) => (
                  <MenuItem key={grade} value={grade}>
                    Grade {grade}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small" disabled={!selectedGrade}>
              <InputLabel>Section</InputLabel>
              <Select
                value={selectedSection}
                label="Section"
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setPreviewRows([]);
                }}
              >
                <MenuItem value="">
                  <em>Select Section</em>
                </MenuItem>
                {sectionOptions.map((section) => (
                  <MenuItem key={section} value={section}>
                    {section}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadBaseData}
            disabled={loading || previewLoading || generating}
          >
            Refresh Data
          </Button>

          <Button
            variant="outlined"
            startIcon={
              previewLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <CheckCircleIcon />
              )
            }
            onClick={buildPreview}
            disabled={
              !academicYear ||
              !selectedGrade ||
              !selectedSection ||
              previewLoading ||
              generating
            }
          >
            {previewLoading ? "Building Preview..." : "Build Preview"}
          </Button>

          <Button
            variant="contained"
            startIcon={
              generating ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoFixHighIcon />
              )
            }
            onClick={handleGenerate}
            disabled={previewRows.length === 0 || generating || previewLoading}
            sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
          >
            {generating ? "Generating..." : "Generate Enrollments"}
          </Button>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
        <Chip
          label={`Students in Preview: ${previewSummary.studentsCount}`}
          color="primary"
          size="small"
          sx={{ fontWeight: 700 }}
        />
        <Chip
          label={`New Enrollments: ${previewSummary.generatedCount}`}
          color="success"
          size="small"
          sx={{ fontWeight: 700 }}
        />
        <Chip
          label={`Duplicates Skipped: ${previewSummary.duplicateCount}`}
          color="warning"
          size="small"
          sx={{ fontWeight: 700 }}
        />
        <Chip
          label={`Warnings: ${previewSummary.warningCount}`}
          color="error"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      {previewRows.length === 0 ? (
        <Paper
          sx={{
            p: 4,
            borderRadius: 3,
            border: "1px solid #e8eaf6",
            textAlign: "center",
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            No preview generated yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Select academic year, grade, and section, then click Build Preview.
          </Typography>
        </Paper>
      ) : (
        <>
          {isMobile ? (
            <Box>
              {previewRows.map((row) => (
                <Card
                  key={row.student.id}
                  sx={{
                    mb: 1.5,
                    borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.07)",
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {getStudentDisplay(row.student)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Grade {row.student.grade || "—"}-{row.student.section || "—"}
                    </Typography>

                    <Divider sx={{ my: 1.2 }} />

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      New Enrollments
                    </Typography>
                    <Box display="flex" gap={0.6} flexWrap="wrap">
                      {row.newDocs.length === 0 ? (
                        <Chip label="None" size="small" />
                      ) : (
                        row.newDocs.map((item) => (
                          <Chip
                            key={getEnrollmentKey(item)}
                            label={`${getSubjectCategoryLabel(
                              item.subjectCategory
                            )}: ${item.subjectName}`}
                            size="small"
                            color="success"
                          />
                        ))
                      )}
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                      sx={{ mt: 1.2 }}
                    >
                      Existing Matches
                    </Typography>
                    <Box display="flex" gap={0.6} flexWrap="wrap">
                      {row.duplicateDocs.length === 0 ? (
                        <Chip label="None" size="small" />
                      ) : (
                        row.duplicateDocs.map((item) => (
                          <Chip
                            key={getEnrollmentKey(item)}
                            label={`${getSubjectCategoryLabel(
                              item.subjectCategory
                            )}: ${item.subjectName}`}
                            size="small"
                            color="warning"
                          />
                        ))
                      )}
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                      sx={{ mt: 1.2 }}
                    >
                      Warnings
                    </Typography>
                    <Box display="flex" gap={0.6} flexWrap="wrap">
                      {row.warnings.length === 0 ? (
                        <Chip label="None" size="small" />
                      ) : (
                        row.warnings.map((warning, idx) => (
                          <Chip
                            key={`${row.student.id}-warning-${idx}`}
                            label={warning}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        ))
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Paper
              sx={{
                borderRadius: 3,
                boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
                border: "1px solid #e8eaf6",
                overflow: "hidden",
              }}
            >
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>
                      Student
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>
                      Adm No
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>
                      Grade/Sec
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>
                      New Enrollments
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>
                      Duplicates
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 700 }}>
                      Warnings
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={row.student.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{row.student.name || "—"}</TableCell>
                      <TableCell>{row.student.admissionNo || "—"}</TableCell>
                      <TableCell>
                        {row.student.grade || "—"}-{row.student.section || "—"}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {row.newDocs.length === 0 ? (
                            <Chip label="None" size="small" />
                          ) : (
                            row.newDocs.map((item) => (
                              <Chip
                                key={getEnrollmentKey(item)}
                                label={`${getSubjectCategoryLabel(
                                  item.subjectCategory
                                )}: ${item.subjectName}`}
                                size="small"
                                color="success"
                              />
                            ))
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {row.duplicateDocs.length === 0 ? (
                            <Chip label="None" size="small" />
                          ) : (
                            row.duplicateDocs.map((item) => (
                              <Chip
                                key={getEnrollmentKey(item)}
                                label={`${getSubjectCategoryLabel(
                                  item.subjectCategory
                                )}: ${item.subjectName}`}
                                size="small"
                                color="warning"
                              />
                            ))
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {row.warnings.length === 0 ? (
                            <Chip label="None" size="small" />
                          ) : (
                            row.warnings.map((warning, warningIdx) => (
                              <Chip
                                key={`${row.student.id}-warning-${warningIdx}`}
                                label={warning}
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            ))
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}