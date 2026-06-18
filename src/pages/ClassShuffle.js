import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { addDoc, collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import * as XLSX from "xlsx";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { ACADEMIC_YEARS, GRADES } from "../constants";
import PageContainer from "../components/ui/PageContainer";
import StatCard from "../components/ui/StatCard";
import ResponsiveTableWrapper from "../components/ui/ResponsiveTableWrapper";
import {
  buildClassShufflePlan,
  getShuffleAdmissionNo,
  getShuffleStudentGrade,
  getShuffleStudentName,
  getShuffleStudentSection,
  isShuffleStudentActive,
  makeClassShuffleExportRows,
  mapClassShuffleCounts,
} from "../utils/classShuffleUtils";

const SUPPORTED_GRADES = GRADES.filter((grade) => grade >= 6 && grade <= 11);
const TARGET_CLASS_OPTIONS = [2, 3, 4, 5, 6];
const BATCH_LIMIT = 400;

const currentAcademicYear = () => String(new Date().getFullYear());

const getBandLabel = (band) => {
  if (band === "junior") return "Religion + Aesthetic";
  if (band === "ol") return "Religion + Basket";
  return "Unsupported";
};

const safeCountEntries = (countMap) => Object.entries(mapClassShuffleCounts(countMap));

const commitStudentUpdates = async ({ plan, academicYear, performedBy }) => {
  const rows = plan.classes.flatMap((classItem) => classItem.students);

  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    rows.slice(i, i + BATCH_LIMIT).forEach((student) => {
      batch.set(
        doc(db, "students", student.id),
        {
          section: student.newSection,
          className: student.newSection,
          fullClassName: student.newClassName,
          previousSection: student.oldSection,
          previousClassName: student.oldClassName,
          classShuffle: {
            academicYear,
            grade: plan.grade,
            fromSection: student.oldSection,
            toSection: student.newSection,
            toClassName: student.newClassName,
            appliedBy: performedBy,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }
};

const serializePlan = (plan) => ({
  grade: plan.grade,
  band: plan.band,
  totalStudents: plan.totalStudents,
  targetClassCount: plan.targetClassCount,
  rareReligionClassCount: plan.rareReligionClassCount,
  targetSections: plan.targetSections,
  rareSections: plan.rareSections,
  warnings: plan.warnings,
  classes: plan.classes.map((classItem) => ({
    section: classItem.section,
    className: classItem.className,
    studentCount: classItem.students.length,
    religionCounts: mapClassShuffleCounts(classItem.religionCounts),
    profileCounts: mapClassShuffleCounts(classItem.profileCounts),
    students: classItem.students.map((student) => ({
      id: student.id,
      admissionNo: getShuffleAdmissionNo(student),
      name: getShuffleStudentName(student),
      oldSection: student.oldSection,
      newSection: student.newSection,
      religion: student.shuffleProfile.religion,
      aesthetic: student.shuffleProfile.aesthetic,
      basketAChoice: student.shuffleProfile.basketAChoice,
      basketBChoice: student.shuffleProfile.basketBChoice,
      basketCChoice: student.shuffleProfile.basketCChoice,
    })),
  })),
});

function downloadPlanWorkbook(plan, academicYear) {
  const workbook = XLSX.utils.book_new();
  const rows = makeClassShuffleExportRows(plan);
  const summaryRows = plan.classes.map((classItem) => ({
    Class: classItem.className,
    Students: classItem.students.length,
    Religions: safeCountEntries(classItem.religionCounts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", "),
    "Aesthetic / Basket Profiles": safeCountEntries(classItem.profileCounts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", "),
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Students");
  XLSX.writeFile(workbook, `class_shuffle_grade_${plan.grade}_${academicYear}.xlsx`);
}

function ProfileCountChips({ countMap }) {
  const entries = safeCountEntries(countMap);
  if (!entries.length) return <Typography variant="body2" color="text.secondary">No data</Typography>;

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {entries.map(([key, value]) => (
        <Chip key={key} size="small" label={`${key}: ${value}`} variant="outlined" />
      ))}
    </Stack>
  );
}

export default function ClassShuffle() {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [grade, setGrade] = useState(6);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [targetClassCount, setTargetClassCount] = useState(3);
  const [rareReligionClassCount, setRareReligionClassCount] = useState(1);
  const [seed, setSeed] = useState("balanced");
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadStudents = async () => {
      setLoading(true);
      setError("");
      try {
        const snap = await getDocs(collection(db, "students"));
        const rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        if (mounted) setStudents(rows);
      } catch (err) {
        console.error("Class shuffle load failed:", err);
        if (mounted) setError(err.message || "Failed to load students.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadStudents();
    return () => {
      mounted = false;
    };
  }, []);

  const gradeStudents = useMemo(() => {
    return students
      .filter(isShuffleStudentActive)
      .filter((student) => getShuffleStudentGrade(student) === Number(grade));
  }, [students, grade]);

  const currentClassCount = useMemo(() => {
    return new Set(gradeStudents.map(getShuffleStudentSection).filter(Boolean)).size;
  }, [gradeStudents]);

  const currentSections = useMemo(() => {
    return [...new Set(gradeStudents.map(getShuffleStudentSection).filter(Boolean))].sort();
  }, [gradeStudents]);

  const handleBuildPlan = () => {
    setBuilding(true);
    setError("");
    setSuccess("");

    try {
      const nextPlan = buildClassShufflePlan({
        students,
        grade,
        targetClassCount,
        rareReligionClassCount,
        seed,
      });
      setPlan(nextPlan);
    } catch (err) {
      setPlan(null);
      setError(err.message || "Failed to build class shuffle plan.");
    } finally {
      setBuilding(false);
    }
  };

  const handleExport = () => {
    if (!plan) return;
    downloadPlanWorkbook(plan, academicYear);
  };

  const handleApply = async () => {
    if (!plan || applying) return;

    const confirmed = window.confirm(
      `Apply this shuffle for Grade ${plan.grade}?\n\n${plan.totalStudents} students will be moved into ${plan.targetClassCount} classes. Export the plan before applying if you need a paper record.`
    );
    if (!confirmed) return;

    setApplying(true);
    setError("");
    setSuccess("");

    const performedBy = profile?.name || profile?.email || "";

    try {
      await commitStudentUpdates({ plan, academicYear, performedBy });
      await addDoc(collection(db, "classShufflePlans"), {
        ...serializePlan(plan),
        academicYear,
        status: "applied",
        performedBy,
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "auditLogs"), {
        action: "CLASS_SHUFFLE_APPLIED",
        grade: plan.grade,
        academicYear,
        targetClassCount: plan.targetClassCount,
        totalStudents: plan.totalStudents,
        performedBy,
        createdAt: serverTimestamp(),
      });

      setSuccess(`Class shuffle applied for Grade ${plan.grade}. Regenerate subject enrollments if class fields must be reflected there too.`);
    } catch (err) {
      console.error("Class shuffle apply failed:", err);
      setError(err.message || "Failed to apply class shuffle.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title="Class Shuffle" subtitle="Loading student data...">
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack alignItems="center" spacing={2}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading students from Firebase...
            </Typography>
          </Stack>
        </Paper>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Class Shuffle"
      subtitle="Reshuffle Grades 6-11 using religion, aesthetic choices, and O/L basket combinations."
      actions={
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={handleExport}
            disabled={!plan}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={applying ? <CircularProgress size={18} color="inherit" /> : <SaveRoundedIcon />}
            onClick={handleApply}
            disabled={!plan || applying}
          >
            Apply Shuffle
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Shuffle Setup
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Catholicism and Christianity are clustered into selected classes first, then the remaining students are balanced.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Academic Year</InputLabel>
                    <Select
                      value={academicYear}
                      label="Academic Year"
                      onChange={(event) => setAcademicYear(event.target.value)}
                    >
                      {[...new Set([...ACADEMIC_YEARS, currentAcademicYear()])].map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Grade</InputLabel>
                    <Select
                      value={grade}
                      label="Grade"
                      onChange={(event) => {
                        setGrade(Number(event.target.value));
                        setPlan(null);
                      }}
                    >
                      {SUPPORTED_GRADES.map((item) => (
                        <MenuItem key={item} value={item}>
                          Grade {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>New Classes</InputLabel>
                    <Select
                      value={targetClassCount}
                      label="New Classes"
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setTargetClassCount(value);
                        setRareReligionClassCount((current) => Math.min(current, value));
                        setPlan(null);
                      }}
                    >
                      {TARGET_CLASS_OPTIONS.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>RC Classes</InputLabel>
                    <Select
                      value={rareReligionClassCount}
                      label="RC Classes"
                      onChange={(event) => {
                        setRareReligionClassCount(Number(event.target.value));
                        setPlan(null);
                      }}
                    >
                      {Array.from({ length: targetClassCount }, (_, index) => index + 1).map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    label="Shuffle Seed"
                    value={seed}
                    onChange={(event) => {
                      setSeed(event.target.value);
                      setPlan(null);
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={building ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighRoundedIcon />}
                    onClick={handleBuildPlan}
                    disabled={building || !gradeStudents.length}
                    sx={{ height: "100%" }}
                  >
                    Generate
                  </Button>
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={1.25}>
          <Grid item xs={6} md={3}>
            <StatCard title="Active Students" value={gradeStudents.length} icon={<GroupsRoundedIcon />} color="primary" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard title="Current Classes" value={currentClassCount} helperText={currentSections.join(", ") || "-"} icon={<MeetingRoomRoundedIcon />} color="secondary" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard title="New Classes" value={targetClassCount} helperText={plan ? plan.targetSections.join(", ") : "Preview pending"} color="success" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard title="Rule Set" value={plan ? getBandLabel(plan.band) : getBandLabel(Number(grade) <= 9 ? "junior" : "ol")} color="warning" />
          </Grid>
        </Grid>

        {!gradeStudents.length ? (
          <Alert severity="info">No active students found for Grade {grade}.</Alert>
        ) : null}

        {plan?.warnings?.length ? (
          <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
            <Stack spacing={0.5}>
              {plan.warnings.map((warning) => (
                <Typography key={warning} variant="body2">
                  {warning}
                </Typography>
              ))}
            </Stack>
          </Alert>
        ) : null}

        {plan ? (
          <Stack spacing={2}>
            <Card>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Preview Summary
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Rare religion classes: {plan.rareSections.join(", ")}. Target size: about {plan.targetSize} students.
                    </Typography>
                  </Box>

                  <Grid container spacing={1.25}>
                    {plan.classes.map((classItem) => (
                      <Grid item xs={12} md={6} xl={4} key={classItem.section}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                {classItem.className}
                              </Typography>
                              <Chip size="small" color="primary" label={`${classItem.students.length} students`} />
                            </Stack>
                            <Divider />
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              Religion
                            </Typography>
                            <ProfileCountChips countMap={classItem.religionCounts} />
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {plan.band === "junior" ? "Aesthetic" : "Basket Combination"}
                            </Typography>
                            <ProfileCountChips countMap={classItem.profileCounts} />
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={1.5}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Student Allocation
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <ResponsiveTableWrapper minWidth={980}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>New Class</TableCell>
                            <TableCell>#</TableCell>
                            <TableCell>Admission</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Old</TableCell>
                            <TableCell>Religion</TableCell>
                            <TableCell>{plan.band === "junior" ? "Aesthetic" : "Basket A"}</TableCell>
                            {plan.band === "ol" ? (
                              <>
                                <TableCell>Basket B</TableCell>
                                <TableCell>Basket C</TableCell>
                              </>
                            ) : null}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {plan.classes.flatMap((classItem) =>
                            classItem.students.map((student, index) => (
                              <TableRow key={`${classItem.section}-${student.id}`} hover>
                                <TableCell sx={{ fontWeight: 900 }}>{classItem.className}</TableCell>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{getShuffleAdmissionNo(student) || "-"}</TableCell>
                                <TableCell>{getShuffleStudentName(student)}</TableCell>
                                <TableCell>{student.oldClassName || "-"}</TableCell>
                                <TableCell>{student.shuffleProfile.religion || "-"}</TableCell>
                                <TableCell>
                                  {plan.band === "junior"
                                    ? student.shuffleProfile.aesthetic || "-"
                                    : student.shuffleProfile.basketAChoice || "-"}
                                </TableCell>
                                {plan.band === "ol" ? (
                                  <>
                                    <TableCell>{student.shuffleProfile.basketBChoice || "-"}</TableCell>
                                    <TableCell>{student.shuffleProfile.basketCChoice || "-"}</TableCell>
                                  </>
                                ) : null}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ResponsiveTableWrapper>
                  </TableContainer>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : (
          <Alert severity="info">Choose the target class count, then generate a preview before applying changes.</Alert>
        )}
      </Stack>
    </PageContainer>
  );
}
