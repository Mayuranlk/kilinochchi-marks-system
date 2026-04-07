import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import PreviewIcon from "@mui/icons-material/Preview";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import FactCheckIcon from "@mui/icons-material/FactCheck";

import {
  deleteStudentsAndRelated,
  getStudentsByClassForSelection,
  previewClassData,
  resetClassData,
} from "../services/classDataService";

// Optional:
// import { useAuth } from "../contexts/AuthContext";

const gradeOptions = ["6", "7", "8", "9", "10", "11", "12", "13"];
const sectionOptions = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function ClassDataManagement() {
  // Optional current user integration:
  // const { currentUser, userProfile } = useAuth();

  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");

  const [removeTeacherAssignments, setRemoveTeacherAssignments] = useState(false);
  const [removeClassroomMapping, setRemoveClassroomMapping] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [previewData, setPreviewData] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [confirmText, setConfirmText] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fullClassName = useMemo(() => {
    if (!grade || !section) return "";
    return `${grade}${String(section).toUpperCase()}`;
  }, [grade, section]);

  const expectedConfirmText = useMemo(() => {
    if (!fullClassName) return "";
    return `RESET ${fullClassName}`;
  }, [fullClassName]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleLoadPreview = async () => {
    clearMessages();

    if (!grade || !section) {
      setError("Please select grade and section.");
      return;
    }

    try {
      setPreviewLoading(true);
      setStudentsLoading(true);
      setPreviewData(null);
      setStudents([]);
      setSelectedStudentIds([]);
      setConfirmText("");

      const [preview, classStudents] = await Promise.all([
        previewClassData({
          grade,
          section,
          academicYear,
          includeTeacherAssignments: true,
          includeClassrooms: true,
        }),
        getStudentsByClassForSelection({
          grade,
          section,
          academicYear,
        }),
      ]);

      setPreviewData(preview);
      setStudents(classStudents);
    } catch (err) {
      console.error("Preview load failed:", err);
      setError(err.message || "Failed to load class preview.");
    } finally {
      setPreviewLoading(false);
      setStudentsLoading(false);
    }
  };

  const toggleStudent = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
      return;
    }
    setSelectedStudentIds(students.map((student) => student.id));
  };

  const handleDeleteSelectedStudents = async () => {
    clearMessages();

    if (!selectedStudentIds.length) {
      setError("Please select at least one student.");
      return;
    }

    const proceed = window.confirm(
      `Delete ${selectedStudentIds.length} selected student(s) and all related enrollments and marks?`
    );
    if (!proceed) return;

    try {
      setActionLoading(true);

      const result = await deleteStudentsAndRelated({
        studentIds: selectedStudentIds,
        performedBy: "admin", // replace with currentUser?.uid when auth is connected
        reason: "DELETE_SELECTED_STUDENTS",
      });

      setSuccess(
        `Deleted ${result.deletedStudents} students, ${result.deletedEnrollments} enrollments, and ${result.deletedMarks} marks.`
      );

      await handleLoadPreview();
    } catch (err) {
      console.error("Delete selected students failed:", err);
      setError(err.message || "Failed to delete selected students.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetClassData = async () => {
    clearMessages();

    if (!previewData) {
      setError("Please preview the class data first.");
      return;
    }

    if (confirmText.trim() !== expectedConfirmText) {
      setError(`Type exactly "${expectedConfirmText}" to confirm.`);
      return;
    }

    const proceed = window.confirm(
      `This will reset ALL class data for ${fullClassName}. This cannot be undone. Continue?`
    );
    if (!proceed) return;

    try {
      setActionLoading(true);

      const result = await resetClassData({
        grade,
        section,
        academicYear,
        removeTeacherAssignments,
        removeClassroomMapping,
        performedBy: "admin", // replace with currentUser?.uid when auth is connected
      });

      setSuccess(
        `Class ${result.className} reset completed. Deleted ${result.deletedStudents} students, ${result.deletedEnrollments} enrollments, ${result.deletedMarks} marks, ${result.deletedTeacherAssignments} teacher assignments, and ${result.deletedClassrooms} classroom records.`
      );

      setPreviewData(null);
      setStudents([]);
      setSelectedStudentIds([]);
      setConfirmText("");
    } catch (err) {
      console.error("Class reset failed:", err);
      setError(err.message || "Failed to reset class data.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Class Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Delete selected students or reset all records for a class.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6" fontWeight={700}>
                Select Class
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Academic Year"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Grade</InputLabel>
                    <Select
                      value={grade}
                      label="Grade"
                      onChange={(e) => setGrade(e.target.value)}
                    >
                      {gradeOptions.map((item) => (
                        <MenuItem key={item} value={item}>
                          Grade {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Section</InputLabel>
                    <Select
                      value={section}
                      label="Section"
                      onChange={(e) => setSection(e.target.value)}
                    >
                      {sectionOptions.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box>
                <Button
                  variant="contained"
                  startIcon={
                    previewLoading ? <CircularProgress size={18} color="inherit" /> : <PreviewIcon />
                  }
                  onClick={handleLoadPreview}
                  disabled={previewLoading || actionLoading}
                >
                  {previewLoading ? "Loading Preview..." : "Load Preview"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {previewData ? (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Preview Summary
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Class: {previewData.className} | Academic Year: {previewData.academicYear || "-"}
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <PeopleIcon />
                          <Typography variant="body2" color="text.secondary">
                            Students
                          </Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {previewData.studentCount}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <SchoolIcon />
                          <Typography variant="body2" color="text.secondary">
                            Enrollments
                          </Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {previewData.enrollmentCount}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <FactCheckIcon />
                          <Typography variant="body2" color="text.secondary">
                            Marks
                          </Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {previewData.marksCount}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <AssignmentTurnedInIcon />
                          <Typography variant="body2" color="text.secondary">
                            Teacher Assignments
                          </Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {previewData.teacherAssignmentCount}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <WarningAmberIcon />
                          <Typography variant="body2" color="text.secondary">
                            Classrooms
                          </Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {previewData.classroomCount}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {previewData ? (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "stretch", sm: "center" }}
                      spacing={1.5}
                    >
                      <Box>
                        <Typography variant="h6" fontWeight={700}>
                          Delete Selected Students
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          This removes selected students and their related enrollments and marks.
                        </Typography>
                      </Box>

                      <Chip
                        label={`${selectedStudentIds.length} selected`}
                        color={selectedStudentIds.length ? "warning" : "default"}
                      />
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={handleSelectAllStudents}
                        disabled={!students.length || actionLoading || studentsLoading}
                      >
                        {selectedStudentIds.length === students.length && students.length
                          ? "Unselect All"
                          : "Select All"}
                      </Button>

                      <Button
                        variant="contained"
                        color="error"
                        startIcon={
                          actionLoading ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            <DeleteForeverIcon />
                          )
                        }
                        onClick={handleDeleteSelectedStudents}
                        disabled={!selectedStudentIds.length || actionLoading}
                      >
                        Delete Selected
                      </Button>
                    </Stack>

                    <Divider />

                    {studentsLoading ? (
                      <Box sx={{ py: 4, textAlign: "center" }}>
                        <CircularProgress />
                      </Box>
                    ) : students.length ? (
                      <List
                        sx={{
                          maxHeight: 460,
                          overflow: "auto",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                        }}
                      >
                        {students.map((student) => (
                          <ListItem
                            key={student.id}
                            divider
                            secondaryAction={
                              <Checkbox
                                edge="end"
                                checked={selectedStudentIds.includes(student.id)}
                                onChange={() => toggleStudent(student.id)}
                              />
                            }
                          >
                            <ListItemText
                              primary={student.fullName}
                              secondary={`Index: ${student.indexNo || "-"} | Grade: ${
                                student.grade || "-"
                              } | Section: ${student.section || "-"}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Alert severity="info">No students found for this class.</Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Card
                sx={{
                  border: "1px solid",
                  borderColor: "error.main",
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} color="error.main">
                        Danger Zone
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Reset the full class data. This action cannot be undone.
                      </Typography>
                    </Box>

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={removeTeacherAssignments}
                          onChange={(e) => setRemoveTeacherAssignments(e.target.checked)}
                        />
                      }
                      label="Also delete teacher assignments for this class"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={removeClassroomMapping}
                          onChange={(e) => setRemoveClassroomMapping(e.target.checked)}
                        />
                      }
                      label="Also delete classroom mapping for this class"
                    />

                    <TextField
                      fullWidth
                      label={`Type "${expectedConfirmText}" to confirm`}
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                    />

                    <Button
                      variant="contained"
                      color="error"
                      startIcon={
                        actionLoading ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <DeleteForeverIcon />
                        )
                      }
                      onClick={handleResetClassData}
                      disabled={
                        actionLoading ||
                        !previewData ||
                        confirmText.trim() !== expectedConfirmText
                      }
                    >
                      Reset Class Data
                    </Button>

                    <Alert severity="warning">
                      This will delete students, enrollments, and marks for {fullClassName || "this class"}.
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Stack>
    </Box>
  );
}