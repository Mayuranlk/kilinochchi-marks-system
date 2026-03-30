import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  Card,
  CardContent,
  Grid,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import { db } from "../firebase";

const OLD_FIELDS = [
  "religionSubject",
  "aestheticSubject",
  "basketA",
  "basketB",
  "basketC",
  "alSubjects",
];

const normalizeText = (value) => String(value || "").trim();

const buildSubjectDocsFromStudent = (student) => {
  const docs = [];
  const grade = Number(student.grade) || 0;
  const studentId = student.id;
  const studentName = student.name || "";
  const admissionNo = student.admissionNo || "";
  const section = student.section || "";
  const academicYear =
    student.academicYear || student.year || new Date().getFullYear().toString();

  const base = {
    studentId,
    studentName,
    admissionNo,
    grade,
    section,
    academicYear,
    medium: "",
    stream: "",
  };

  if (normalizeText(student.religionSubject)) {
    docs.push({
      ...base,
      subjectCategory: "religion",
      subjectName: normalizeText(student.religionSubject),
    });
  }

  if (normalizeText(student.aestheticSubject)) {
    docs.push({
      ...base,
      subjectCategory: "aesthetic",
      subjectName: normalizeText(student.aestheticSubject),
    });
  }

  if (normalizeText(student.basketA)) {
    docs.push({
      ...base,
      subjectCategory: "basket",
      subjectName: normalizeText(student.basketA),
    });
  }

  if (normalizeText(student.basketB)) {
    docs.push({
      ...base,
      subjectCategory: "basket",
      subjectName: normalizeText(student.basketB),
    });
  }

  if (normalizeText(student.basketC)) {
    docs.push({
      ...base,
      subjectCategory: "basket",
      subjectName: normalizeText(student.basketC),
    });
  }

  if (Array.isArray(student.alSubjects)) {
    student.alSubjects
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .forEach((subject) => {
        docs.push({
          ...base,
          subjectCategory: "al_main",
          subjectName: subject,
          stream: normalizeText(student.stream || ""),
        });
      });
  }

  return docs;
};

const uniqueKeyForEnrollment = (item) =>
  [
    item.studentId,
    item.academicYear,
    item.subjectCategory,
    item.subjectName.toLowerCase(),
    item.grade,
    item.section,
  ].join("__");

export default function MigrateStudentSubjects() {
  const [students, setStudents] = useState([]);
  const [existingEnrollments, setExistingEnrollments] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningMigration, setRunningMigration] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cleanupOldFields, setCleanupOldFields] = useState(false);

  const existingEnrollmentKeys = useMemo(() => {
    return new Set(existingEnrollments.map(uniqueKeyForEnrollment));
  }, [existingEnrollments]);

  const totals = useMemo(() => {
    const totalStudentsWithOldFields = previewRows.filter(
      (row) => row.generatedDocs.length > 0
    ).length;

    const totalDocsToCreate = previewRows.reduce(
      (sum, row) => sum + row.newDocs.length,
      0
    );

    const totalExistingMatches = previewRows.reduce(
      (sum, row) => sum + row.duplicateDocs.length,
      0
    );

    return {
      totalStudentsWithOldFields,
      totalDocsToCreate,
      totalExistingMatches,
    };
  }, [previewRows]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [studentSnap, enrollmentSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentSubjectEnrollments")),
      ]);

      const loadedStudents = studentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const loadedEnrollments = enrollmentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setStudents(loadedStudents);
      setExistingEnrollments(loadedEnrollments);

      const preview = loadedStudents.map((student) => {
        const generatedDocs = buildSubjectDocsFromStudent(student);

        const duplicateDocs = generatedDocs.filter((item) =>
          loadedEnrollments.some(
            (existing) => uniqueKeyForEnrollment(existing) === uniqueKeyForEnrollment(item)
          )
        );

        const newDocs = generatedDocs.filter(
          (item) =>
            !loadedEnrollments.some(
              (existing) =>
                uniqueKeyForEnrollment(existing) === uniqueKeyForEnrollment(item)
            )
        );

        return {
          student,
          generatedDocs,
          newDocs,
          duplicateDocs,
        };
      });

      setPreviewRows(preview);
    } catch (err) {
      setError("Failed to load migration data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigration = async () => {
    setRunningMigration(true);
    setError("");
    setSuccess("");

    try {
      const docsToCreate = previewRows.flatMap((row) => row.newDocs);

      if (docsToCreate.length === 0) {
        setSuccess("No new subject enrollment records need migration.");
        setRunningMigration(false);
        return;
      }

      let createdCount = 0;

      for (const item of docsToCreate) {
        await addDoc(collection(db, "studentSubjectEnrollments"), {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          migratedAt: new Date().toISOString(),
          migrationSource: "students_legacy_subject_fields",
        });
        createdCount++;
      }

      if (cleanupOldFields) {
        const studentsToClean = previewRows.filter((row) => row.generatedDocs.length > 0);

        for (let i = 0; i < studentsToClean.length; i += 400) {
          const chunk = studentsToClean.slice(i, i + 400);
          const batch = writeBatch(db);

          chunk.forEach((row) => {
            const ref = doc(db, "students", row.student.id);
            batch.update(ref, {
              religionSubject: "",
              aestheticSubject: "",
              basketA: "",
              basketB: "",
              basketC: "",
              alSubjects: [],
              updatedAt: new Date().toISOString(),
            });
          });

          await batch.commit();
        }

        setSuccess(
          `Migration completed. Created ${createdCount} subject enrollment records and cleared old subject fields from matching students.`
        );
      } else {
        setSuccess(
          `Migration completed. Created ${createdCount} subject enrollment records. Old student fields were left unchanged.`
        );
      }

      await loadData();
    } catch (err) {
      setError("Migration failed: " + err.message);
    } finally {
      setRunningMigration(false);
    }
  };

  const handleCleanupOnly = async () => {
    setRunningCleanup(true);
    setError("");
    setSuccess("");

    try {
      const studentsToClean = previewRows.filter((row) => row.generatedDocs.length > 0);

      if (studentsToClean.length === 0) {
        setSuccess("No students found with old subject fields to clear.");
        setRunningCleanup(false);
        return;
      }

      for (let i = 0; i < studentsToClean.length; i += 400) {
        const chunk = studentsToClean.slice(i, i + 400);
        const batch = writeBatch(db);

        chunk.forEach((row) => {
          const ref = doc(db, "students", row.student.id);
          batch.update(ref, {
            religionSubject: "",
            aestheticSubject: "",
            basketA: "",
            basketB: "",
            basketC: "",
            alSubjects: [],
            updatedAt: new Date().toISOString(),
          });
        });

        await batch.commit();
      }

      setSuccess("Old subject fields were cleared from students.");
      await loadData();
    } catch (err) {
      setError("Cleanup failed: " + err.message);
    } finally {
      setRunningCleanup(false);
    }
  };

  const rowsWithData = previewRows.filter((row) => row.generatedDocs.length > 0);

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
        <Typography variant="h5" fontWeight={800} color="#1a237e">
          Migrate Student Subject Fields
        </Typography>

        <Typography variant="body2" color="text.secondary" mt={1}>
          This utility reads old subject fields stored inside the <b>students</b>{" "}
          collection and creates proper records in{" "}
          <b>studentSubjectEnrollments</b>.
        </Typography>

        <Box display="flex" gap={1} mt={2} flexWrap="wrap">
          <Chip
            label={`Students Loaded: ${students.length}`}
            color="primary"
            size="small"
            sx={{ fontWeight: 700 }}
          />
          <Chip
            label={`Students With Old Fields: ${totals.totalStudentsWithOldFields}`}
            color="warning"
            size="small"
            sx={{ fontWeight: 700 }}
          />
          <Chip
            label={`New Records To Create: ${totals.totalDocsToCreate}`}
            color="success"
            size="small"
            sx={{ fontWeight: 700 }}
          />
          <Chip
            label={`Already Existing: ${totals.totalExistingMatches}`}
            color="default"
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        <Grid container spacing={2} mt={1}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8eaf6" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>
                  Step 1
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Preview old fields in students and the new enrollment records that
                  will be created.
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
                  Migrate only missing records to avoid duplicates.
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
                  Optionally clear old student subject fields after migration is done.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <FormControlLabel
          sx={{ mt: 2 }}
          control={
            <Checkbox
              checked={cleanupOldFields}
              onChange={(e) => setCleanupOldFields(e.target.checked)}
            />
          }
          label="After migration, also clear old subject fields from students"
        />

        <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading || runningMigration || runningCleanup}
          >
            Refresh Preview
          </Button>

          <Button
            variant="contained"
            startIcon={
              runningMigration ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />
            }
            onClick={handleMigration}
            disabled={loading || runningMigration || runningCleanup}
            sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
          >
            {runningMigration ? "Migrating..." : "Run Migration"}
          </Button>

          <Button
            variant="outlined"
            color="warning"
            startIcon={
              runningCleanup ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <CleaningServicesIcon />
              )
            }
            onClick={handleCleanupOnly}
            disabled={loading || runningMigration || runningCleanup}
          >
            {runningCleanup ? "Cleaning..." : "Cleanup Old Fields Only"}
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

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : rowsWithData.length === 0 ? (
        <Paper
          sx={{
            p: 4,
            borderRadius: 3,
            border: "1px solid #e8eaf6",
            textAlign: "center",
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            No old subject fields found in students
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            There is nothing to migrate right now.
          </Typography>
        </Paper>
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
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Student</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Admission No</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Grade/Sec</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Old Fields Found</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>New Records</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Existing Matches</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsWithData.map((row, idx) => (
                <TableRow key={row.student.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.student.name || "—"}</TableCell>
                  <TableCell>{row.student.admissionNo || "—"}</TableCell>
                  <TableCell>
                    {row.student.grade || "—"}-{row.student.section || "—"}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {normalizeText(row.student.religionSubject) && (
                        <Chip size="small" label={`Religion: ${row.student.religionSubject}`} />
                      )}
                      {normalizeText(row.student.aestheticSubject) && (
                        <Chip size="small" label={`Aesthetic: ${row.student.aestheticSubject}`} />
                      )}
                      {normalizeText(row.student.basketA) && (
                        <Chip size="small" label={`Basket A: ${row.student.basketA}`} />
                      )}
                      {normalizeText(row.student.basketB) && (
                        <Chip size="small" label={`Basket B: ${row.student.basketB}`} />
                      )}
                      {normalizeText(row.student.basketC) && (
                        <Chip size="small" label={`Basket C: ${row.student.basketC}`} />
                      )}
                      {Array.isArray(row.student.alSubjects) &&
                        row.student.alSubjects
                          .filter((item) => normalizeText(item))
                          .map((subject, index) => (
                            <Chip key={index} size="small" label={`A/L: ${subject}`} />
                          ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {row.newDocs.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        None
                      </Typography>
                    ) : (
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {row.newDocs.map((item, index) => (
                          <Chip
                            key={index}
                            size="small"
                            color="success"
                            label={`${item.subjectCategory}: ${item.subjectName}`}
                          />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.duplicateDocs.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        None
                      </Typography>
                    ) : (
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {row.duplicateDocs.map((item, index) => (
                          <Chip
                            key={index}
                            size="small"
                            color="warning"
                            label={`${item.subjectCategory}: ${item.subjectName}`}
                          />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}