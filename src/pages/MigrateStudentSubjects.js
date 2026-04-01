import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
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
} from "@mui/material";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import RefreshIcon from "@mui/icons-material/Refresh";
import { db } from "../firebase";

const OLD_FIELDS = [
  "religionSubject",
  "aestheticSubject",
  "basketA",
  "basketB",
  "basketC",
  "alSubjects",
];

const normalizeText = (v) => String(v || "").trim();

export default function MigrateStudentSubjects() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const snap = await getDocs(collection(db, "students"));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(rows);
    } catch (err) {
      setError("Failed to load students: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const studentsWithOldFields = useMemo(() => {
    return students.filter((s) =>
      OLD_FIELDS.some((field) => {
        if (Array.isArray(s[field])) return s[field].length > 0;
        return normalizeText(s[field]);
      })
    );
  }, [students]);

  const handleCleanup = async () => {
    setCleaning(true);
    setError("");
    setSuccess("");

    try {
      if (studentsWithOldFields.length === 0) {
        setSuccess("No legacy subject fields found.");
        setCleaning(false);
        return;
      }

      for (let i = 0; i < studentsWithOldFields.length; i += 400) {
        const chunk = studentsWithOldFields.slice(i, i + 400);
        const batch = writeBatch(db);

        chunk.forEach((student) => {
          const ref = doc(db, "students", student.id);

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

      setSuccess("Legacy subject fields removed successfully.");
      await loadData();
    } catch (err) {
      setError("Cleanup failed: " + err.message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} color="#1a237e" mb={2}>
        Legacy Subject Fields Cleanup
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        This tool removes old subject fields from students. Your system now uses{" "}
        <b>studentSubjectEnrollments</b> as the source of truth.
      </Typography>

      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        <Chip label={`Students: ${students.length}`} color="primary" />
        <Chip
          label={`With Old Fields: ${studentsWithOldFields.length}`}
          color="warning"
        />
      </Box>

      <Box display="flex" gap={1} mb={2}>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={loadData}
        >
          Refresh
        </Button>

        <Button
          startIcon={
            cleaning ? <CircularProgress size={18} /> : <CleaningServicesIcon />
          }
          variant="contained"
          color="warning"
          onClick={handleCleanup}
          disabled={cleaning || studentsWithOldFields.length === 0}
        >
          {cleaning ? "Cleaning..." : "Remove Old Fields"}
        </Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <CircularProgress />
      ) : studentsWithOldFields.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography>No legacy fields found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1a237e" }}>
              <TableRow>
                <TableCell sx={{ color: "white" }}>#</TableCell>
                <TableCell sx={{ color: "white" }}>Name</TableCell>
                <TableCell sx={{ color: "white" }}>Grade</TableCell>
                <TableCell sx={{ color: "white" }}>Section</TableCell>
                <TableCell sx={{ color: "white" }}>Old Fields</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {studentsWithOldFields.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{s.name || s.fullName}</TableCell>
                  <TableCell>{s.grade}</TableCell>
                  <TableCell>{s.section}</TableCell>
                  <TableCell>
                    {OLD_FIELDS.map((f) =>
                      normalizeText(s[f]) ||
                      (Array.isArray(s[f]) && s[f].length > 0) ? (
                        <Chip key={f} size="small" label={f} sx={{ mr: 0.5 }} />
                      ) : null
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