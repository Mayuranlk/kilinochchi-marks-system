import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase";
import { GRADES } from "../constants";
import * as XLSX from "xlsx";
/* eslint-disable no-unused-vars */
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  CircularProgress,
  Grid,
  Alert,
  Card,
  CardContent,
  CardActions,
  useMediaQuery,
  useTheme,
  Tooltip,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import HomeWorkIcon from "@mui/icons-material/HomeWork";

const empty = {
  name: "",
  email: "",
  password: "",
  phone: "",
  signatureNo: "",
  status: "active",
  transferredDate: "",
  transferredReason: "",
  transferredTo: "",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeSection(value) {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function buildFullClassName(grade, section) {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : "";
}

function normalizeTeacher(docId, data = {}) {
  return {
    id: docId,
    name: normalizeText(data.name || data.fullName || data.displayName),
    email: normalizeText(data.email),
    phone: normalizeText(data.phone || data.mobile || data.phoneNumber),
    signatureNo: normalizeText(
      data.signatureNo || data.signatureNumber || data.teacherSignatureNo
    ),
    status: normalizeText(data.status || "active") || "active",
    role: normalizeText(data.role || ""),
    transferredDate: normalizeText(data.transferredDate),
    transferredReason: normalizeText(data.transferredReason),
    transferredTo: normalizeText(data.transferredTo),
    raw: data,
  };
}

function normalizeClassroom(docId, data = {}) {
  const grade = parseGrade(data.grade);
  const section = normalizeSection(data.section || data.className || "");
  return {
    id: docId,
    grade,
    section,
    className:
      normalizeText(data.className || data.fullClassName) ||
      buildFullClassName(grade, section),
    year: Number(data.year || data.academicYear || 0),
    classTeacherId: normalizeText(data.classTeacherId || data.teacherId),
    classTeacherUid: normalizeText(data.classTeacherUid),
    classTeacherName: normalizeText(data.classTeacherName || data.teacherName),
    classTeacherEmail: normalizeText(data.classTeacherEmail || data.teacherEmail),
    classTeacherPhone: normalizeText(data.classTeacherPhone || data.teacherPhone),
    classTeacherSignatureNo: normalizeText(
      data.classTeacherSignatureNo || data.teacherSignatureNo
    ),
    raw: data,
  };
}

function teacherMatchesClassroom(teacher, classroom) {
  if (!teacher || !classroom) return false;

  const teacherName = normalizeLower(teacher.name);
  const teacherEmail = normalizeLower(teacher.email);
  const teacherSignatureNo = normalizeText(teacher.signatureNo);

  return (
    (classroom.classTeacherId && classroom.classTeacherId === teacher.id) ||
    (classroom.classTeacherUid &&
      (classroom.classTeacherUid === teacher.id ||
        classroom.classTeacherUid === normalizeText(teacher.raw?.uid))) ||
    (classroom.classTeacherEmail &&
      teacherEmail &&
      normalizeLower(classroom.classTeacherEmail) === teacherEmail) ||
    (classroom.classTeacherName &&
      teacherName &&
      normalizeLower(classroom.classTeacherName) === teacherName) ||
    (classroom.classTeacherSignatureNo &&
      teacherSignatureNo &&
      classroom.classTeacherSignatureNo === teacherSignatureNo)
  );
}

export default function AdminTeachers() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [classTeacherOpen, setClassTeacherOpen] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [form, setForm] = useState(empty);
  const [editForm, setEditForm] = useState({});
  const [transferForm, setTransferForm] = useState({
    date: "",
    reason: "",
    school: "",
  });
  const [classTeacherForm, setClassTeacherForm] = useState({
    grade: 6,
    section: "A",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkProgress, setBulkProgress] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [userSnap, classroomSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "classrooms")),
      ]);

      const teacherRows = userSnap.docs
        .map((d) => normalizeTeacher(d.id, d.data()))
        .filter((user) => normalizeLower(user.role) === "teacher")
        .sort((a, b) => a.name.localeCompare(b.name));

      const classroomRows = classroomSnap.docs
        .map((d) => normalizeClassroom(d.id, d.data()))
        .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));

      setTeachers(teacherRows);
      setClassrooms(classroomRows);
    } catch (err) {
      setError(`Failed to load teachers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => normalizeLower(teacher.status) === "active"),
    [teachers]
  );

  const transferredTeachers = useMemo(
    () => teachers.filter((teacher) => normalizeLower(teacher.status) === "transferred"),
    [teachers]
  );

  const classTeacherByTeacherId = useMemo(() => {
    const map = new Map();

    activeTeachers.forEach((teacher) => {
      const assignedClassroom =
        classrooms.find((classroom) => teacherMatchesClassroom(teacher, classroom)) || null;
      if (assignedClassroom) {
        map.set(teacher.id, assignedClassroom);
      }
    });

    return map;
  }, [activeTeachers, classrooms]);

  const liveSections = useMemo(() => {
    const selectedGrade = Number(classTeacherForm.grade);
    const sections = classrooms
      .filter((classroom) => classroom.grade === selectedGrade)
      .map((classroom) => classroom.section)
      .filter(Boolean);

    return [...new Set(sections.length ? sections : ["A", "B", "C", "D"])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [classrooms, classTeacherForm.grade]);

  const clearClassTeacherFromClassroom = async (classroom) => {
    await updateDoc(doc(db, "classrooms", classroom.id), {
      classTeacherId: "",
      classTeacherUid: "",
      classTeacherName: "",
      classTeacherEmail: "",
      classTeacherPhone: "",
      classTeacherSignatureNo: "",
      updatedAt: new Date().toISOString(),
    });
  };

  const setClassTeacherOnClassroom = async (classroom, teacher) => {
    await updateDoc(doc(db, "classrooms", classroom.id), {
      classTeacherId: teacher.id,
      classTeacherUid: normalizeText(teacher.raw?.uid),
      classTeacherName: teacher.name,
      classTeacherEmail: teacher.email,
      classTeacherPhone: teacher.phone,
      classTeacherSignatureNo: teacher.signatureNo,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteTeacherAssignments = async (teacherId) => {
    const assignmentSnap = await getDocs(collection(db, "teacherAssignments"));
    const matchingDocs = assignmentSnap.docs.filter(
      (assignmentDoc) =>
        normalizeText(assignmentDoc.data()?.teacherId) === normalizeText(teacherId)
    );

    await Promise.all(
      matchingDocs.map((assignmentDoc) =>
        deleteDoc(doc(db, "teacherAssignments", assignmentDoc.id))
      )
    );

    return matchingDocs.length;
  };

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("Name, email and password are required.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);

      await setDoc(doc(db, "users", cred.user.uid), {
        name: normalizeText(form.name),
        email: normalizeText(form.email).toLowerCase(),
        role: "teacher",
        phone: normalizeText(form.phone),
        signatureNo: normalizeText(form.signatureNo),
        status: "active",
        createdAt: new Date().toISOString(),
      });

      setSuccess(`Teacher ${form.name} added.`);
      setOpen(false);
      setForm(empty);
      await fetchData();
    } catch (err) {
      setError(
        err.message.includes("email-already-in-use")
          ? "This email is already registered."
          : err.message
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editForm.name) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateDoc(doc(db, "users", selectedTeacher.id), {
        name: normalizeText(editForm.name),
        phone: normalizeText(editForm.phone),
        signatureNo: normalizeText(editForm.signatureNo),
        updatedAt: new Date().toISOString(),
      });

      const currentClassroom = classTeacherByTeacherId.get(selectedTeacher.id);
      if (currentClassroom) {
        await setClassTeacherOnClassroom(currentClassroom, {
          ...selectedTeacher,
          name: normalizeText(editForm.name),
          phone: normalizeText(editForm.phone),
          signatureNo: normalizeText(editForm.signatureNo),
        });
      }

      setSuccess("Teacher updated.");
      setEditOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.date) {
      setError("Transfer date is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateDoc(doc(db, "users", selectedTeacher.id), {
        status: "transferred",
        transferredDate: transferForm.date,
        transferredReason: normalizeText(transferForm.reason),
        transferredTo: normalizeText(transferForm.school),
        updatedAt: new Date().toISOString(),
      });

      const currentClassroom = classTeacherByTeacherId.get(selectedTeacher.id);
      if (currentClassroom) {
        await clearClassTeacherFromClassroom(currentClassroom);
      }

      const removedAssignments = await deleteTeacherAssignments(selectedTeacher.id);

      setSuccess(
        `${selectedTeacher.name} marked as transferred. ${removedAssignments} teacher assignment(s) removed.`
      );

      setTransferOpen(false);
      setTransferForm({ date: "", reason: "", school: "" });
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignClassTeacher = async () => {
    setSaving(true);
    setError("");

    try {
      const targetClassroom =
        classrooms.find(
          (classroom) =>
            classroom.grade === Number(classTeacherForm.grade) &&
            classroom.section === normalizeSection(classTeacherForm.section)
        ) || null;

      if (!targetClassroom) {
        setError(
          `Classroom Grade ${classTeacherForm.grade}-${classTeacherForm.section} does not exist. Create it first in Classroom Management.`
        );
        setSaving(false);
        return;
      }

      const existingClassTeacher =
        activeTeachers.find(
          (teacher) =>
            teacher.id !== selectedTeacher.id &&
            teacherMatchesClassroom(teacher, targetClassroom)
        ) || null;

      if (existingClassTeacher) {
        await clearClassTeacherFromClassroom(targetClassroom);
      }

      const oldClassroomForSelectedTeacher = classTeacherByTeacherId.get(selectedTeacher.id);
      if (oldClassroomForSelectedTeacher && oldClassroomForSelectedTeacher.id !== targetClassroom.id) {
        await clearClassTeacherFromClassroom(oldClassroomForSelectedTeacher);
      }

      await setClassTeacherOnClassroom(targetClassroom, selectedTeacher);

      setSuccess(
        `${selectedTeacher.name} assigned as Class Teacher for Grade ${targetClassroom.grade}-${targetClassroom.section}.`
      );

      setClassTeacherOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveClassTeacher = async (teacher) => {
    const currentClassroom = classTeacherByTeacherId.get(teacher.id);
    if (!currentClassroom) return;

    const confirmed = window.confirm(`Remove ${teacher.name} as Class Teacher?`);
    if (!confirmed) return;

    try {
      await clearClassTeacherFromClassroom(currentClassroom);
      setSuccess(`${teacher.name} removed as Class Teacher.`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRestoreTeacher = async (teacher) => {
    try {
      await updateDoc(doc(db, "users", teacher.id), {
        status: "active",
        transferredDate: "",
        transferredReason: "",
        transferredTo: "",
        updatedAt: new Date().toISOString(),
      });

      setSuccess(`${teacher.name} restored as active.`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (teacherId) => {
    const teacher = teachers.find((row) => row.id === teacherId);
    if (!teacher) return;

    const confirmed = window.confirm("Permanently delete this teacher?");
    if (!confirmed) return;

    try {
      const currentClassroom = classTeacherByTeacherId.get(teacherId);
      if (currentClassroom) {
        await clearClassTeacherFromClassroom(currentClassroom);
      }

      await deleteTeacherAssignments(teacherId);
      await deleteDoc(doc(db, "users", teacherId));

      setSuccess(`${teacher.name} deleted.`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEdit = (teacher) => {
    setSelectedTeacher(teacher);
    setEditForm({
      name: teacher.name,
      phone: teacher.phone || "",
      signatureNo: teacher.signatureNo || "",
    });
    setError("");
    setEditOpen(true);
  };

  const openTransfer = (teacher) => {
    setSelectedTeacher(teacher);
    setTransferForm({
      date: "",
      reason: "",
      school: "",
    });
    setError("");
    setTransferOpen(true);
  };

  const openClassTeacher = (teacher) => {
    const currentClassroom = classTeacherByTeacherId.get(teacher.id);

    setSelectedTeacher(teacher);
    setClassTeacherForm({
      grade: currentClassroom?.grade || 6,
      section: currentClassroom?.section || "A",
    });
    setError("");
    setClassTeacherOpen(true);
  };

  const getAvatarColor = (name) => {
    const colors = [
      "#1a237e",
      "#1565c0",
      "#0277bd",
      "#00695c",
      "#2e7d32",
      "#6a1b9a",
      "#880e4f",
      "#e65100",
    ];
    let hash = 0;
    for (let i = 0; i < (name?.length || 0); i += 1) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getTeacherClassTeacherLabel = (teacher) => {
    const classroom = classTeacherByTeacherId.get(teacher.id);
    return classroom ? `Grade ${classroom.grade}-${classroom.section}` : null;
  };

  const downloadTeacherTemplate = () => {
    const template = [
      {
        name: "Kumaran Selvam",
        email: "kumaran@school.lk",
        password: "teacher123",
        phone: "0771234567",
        signatureNo: "T-001",
      },
      {
        name: "Priya Nanthini",
        email: "priya@school.lk",
        password: "teacher123",
        phone: "0769876543",
        signatureNo: "T-002",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    ws["!cols"] = [{ wch: 22 }, { wch: 25 }, { wch: 14 }, { wch: 13 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");
    XLSX.writeFile(wb, "teachers_template.xlsx");
  };

  const handleTeacherFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setBulkErrors([]);
    setBulkData([]);
    setBulkSuccess("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (raw.length === 0) {
          setBulkErrors(["Excel file is empty."]);
          return;
        }

        const errors = [];
        const cleaned = raw.map((row, idx) => {
          const name = normalizeText(row.name);
          const email = normalizeText(row.email).toLowerCase();
          const password = normalizeText(row.password);

          if (!name) errors.push(`Row ${idx + 2}: Name is missing`);
          if (!email) errors.push(`Row ${idx + 2}: Email is missing`);
          if (!password) errors.push(`Row ${idx + 2}: Password is missing`);
          if (password && password.length < 6) {
            errors.push(`Row ${idx + 2}: Password must be at least 6 characters`);
          }

          return {
            name,
            email,
            password,
            phone: normalizeText(row.phone),
            signatureNo: normalizeText(row.signatureNo),
            status: "active",
          };
        });

        setBulkErrors(errors);
        setBulkData(cleaned);
      } catch {
        setBulkErrors(["Failed to read file. Make sure it's a valid .xlsx file."]);
      }
    };

    reader.readAsBinaryString(file);
    event.target.value = "";
  };

  const handleBulkTeacherUpload = async () => {
    if (bulkErrors.length > 0 || bulkData.length === 0) return;

    setBulkUploading(true);
    setBulkProgress(0);

    let count = 0;
    const failed = [];

    for (const teacher of bulkData) {
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          teacher.email,
          teacher.password
        );

        await setDoc(doc(db, "users", cred.user.uid), {
          name: teacher.name,
          email: teacher.email,
          role: "teacher",
          phone: teacher.phone,
          signatureNo: teacher.signatureNo,
          status: "active",
          createdAt: new Date().toISOString(),
        });

        count += 1;
      } catch (err) {
        failed.push(
          err.message.includes("email-already-in-use")
            ? `${teacher.email}: Already registered`
            : `${teacher.email}: ${err.message}`
        );
      }

      setBulkProgress(
        Math.round(((count + failed.length) / bulkData.length) * 100)
      );
    }

    if (failed.length > 0) {
      setBulkErrors(failed);
      setBulkSuccess(count > 0 ? `✅ ${count} teachers uploaded. See errors above.` : "");
    } else {
      setBulkSuccess(`✅ ${count} teachers uploaded successfully!`);
      setBulkData([]);
    }

    setBulkUploading(false);
    await fetchData();
  };

  const classTeacherCount = classrooms.filter(
    (classroom) =>
      classroom.classTeacherId ||
      classroom.classTeacherName ||
      classroom.classTeacherEmail
  ).length;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Manage Teachers
          </Typography>

          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            <Chip label={`Active: ${activeTeachers.length}`} size="small" color="success" />
            <Chip
              label={`Transferred: ${transferredTeachers.length}`}
              size="small"
              color="warning"
            />
            <Chip
              label={`Class Teachers: ${classTeacherCount}`}
              size="small"
              color="primary"
            />
          </Box>
        </Box>

        <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => {
              setBulkOpen(true);
              setBulkData([]);
              setBulkErrors([]);
              setBulkSuccess("");
            }}
            size={isMobile ? "small" : "medium"}
            sx={{ borderColor: "#1a237e", color: "#1a237e" }}
          >
            {isMobile ? "Bulk" : "Bulk Upload"}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setOpen(true);
              setError("");
              setSuccess("");
              setForm(empty);
            }}
            sx={{ bgcolor: "#1a237e", borderRadius: 2 }}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Add" : "Add Teacher"}
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
        <CircularProgress />
      ) : (
        <>
          {isMobile ? (
            <Box>
              {activeTeachers.map((teacher) => {
                const classTeacherLabel = getTeacherClassTeacherLabel(teacher);

                return (
                  <Card
                    key={teacher.id}
                    sx={{
                      mb: 1.5,
                      borderRadius: 3,
                      boxShadow: "0 2px 12px rgba(26,35,126,0.10)",
                      border: "1px solid #e8eaf6",
                    }}
                  >
                    <CardContent sx={{ pb: 0 }}>
                      <Box display="flex" gap={1.5} alignItems="flex-start">
                        <Avatar
                          sx={{
                            bgcolor: getAvatarColor(teacher.name),
                            width: 44,
                            height: 44,
                            fontSize: 18,
                            fontWeight: 700,
                          }}
                        >
                          {teacher.name?.charAt(0)}
                        </Avatar>

                        <Box flex={1}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={700}>
                              {teacher.name}
                            </Typography>

                            {classTeacherLabel && (
                              <Chip
                                label={`CT ${classTeacherLabel.replace("Grade ", "G")}`}
                                size="small"
                                color="primary"
                                icon={<HomeWorkIcon />}
                              />
                            )}
                          </Box>

                          <Typography variant="caption" color="text.secondary">
                            {teacher.email}
                          </Typography>

                          {teacher.phone && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              📞 {teacher.phone}
                            </Typography>
                          )}

                          {teacher.signatureNo && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              ✍️ {teacher.signatureNo}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </CardContent>

                    <CardActions sx={{ px: 2, pb: 1.5, pt: 0.5, gap: 0.5, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => openEdit(teacher)}
                      >
                        Edit
                      </Button>

                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<HomeWorkIcon />}
                        onClick={() => openClassTeacher(teacher)}
                      >
                        {classTeacherLabel ? "Change CT" : "Set CT"}
                      </Button>

                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<FlightTakeoffIcon />}
                        onClick={() => openTransfer(teacher)}
                      >
                        Transfer
                      </Button>

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(teacher.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                );
              })}

              {activeTeachers.length === 0 && (
                <Typography align="center" color="text.secondary" mt={3}>
                  No active teachers.
                </Typography>
              )}
            </Box>
          ) : (
            <Paper
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                boxShadow: "0 2px 16px rgba(26,35,126,0.10)",
              }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1a237e" }}>
                    {["#", "Teacher", "Phone", "Signature No", "Class Teacher", "Actions"].map(
                      (heading) => (
                        <TableCell key={heading} sx={{ color: "white", fontWeight: 600 }}>
                          {heading}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {activeTeachers.map((teacher, idx) => {
                    const classTeacherLabel = getTeacherClassTeacherLabel(teacher);

                    return (
                      <TableRow
                        key={teacher.id}
                        hover
                        sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                      >
                        <TableCell>{idx + 1}</TableCell>

                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar
                              sx={{
                                bgcolor: getAvatarColor(teacher.name),
                                width: 36,
                                height: 36,
                                fontSize: 15,
                                fontWeight: 700,
                              }}
                            >
                              {teacher.name?.charAt(0)}
                            </Avatar>

                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                {teacher.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {teacher.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell>{teacher.phone || "—"}</TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {teacher.signatureNo || "—"}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {classTeacherLabel ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <Chip
                                label={classTeacherLabel}
                                size="small"
                                color="primary"
                                icon={<HomeWorkIcon sx={{ fontSize: "14px !important" }} />}
                              />
                              <Tooltip title="Remove Class Teacher">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveClassTeacher(teacher)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              Not assigned
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openEdit(teacher)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title={classTeacherLabel ? "Change Class Teacher" : "Set Class Teacher"}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openClassTeacher(teacher)}
                            >
                              <HomeWorkIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Mark as Transferred">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => openTransfer(teacher)}
                            >
                              <FlightTakeoffIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(teacher.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {activeTeachers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No active teachers.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {transferredTeachers.length > 0 && (
            <Accordion
              sx={{
                mt: 2,
                borderRadius: "12px !important",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ bgcolor: "#fff8e1", borderRadius: 3 }}
              >
                <Typography fontWeight={700} color="#f57f17">
                  🚌 Transferred Teachers ({transferredTeachers.length})
                </Typography>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#fff3e0" }}>
                    <TableRow>
                      {["Name", "Email", "Phone", "Date", "To School", "Actions"].map((heading) => (
                        <TableCell key={heading} sx={{ fontWeight: 600, fontSize: 13 }}>
                          {heading}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {transferredTeachers.map((teacher) => (
                      <TableRow key={teacher.id} sx={{ bgcolor: "#fffde7" }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {teacher.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{teacher.email}</TableCell>
                        <TableCell>{teacher.phone || "—"}</TableCell>
                        <TableCell>{teacher.transferredDate || "—"}</TableCell>
                        <TableCell>{teacher.transferredTo || "—"}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => handleRestoreTeacher(teacher)}
                            sx={{ mr: 0.5 }}
                          >
                            Restore
                          </Button>

                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(teacher.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          Add New Teacher
        </DialogTitle>

        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email Address *"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Password (min 6 chars) *"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Signature No."
                placeholder="e.g. T-001"
                value={form.signatureNo}
                onChange={(e) => setForm({ ...form, signatureNo: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            variant="contained"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}
          >
            {saving ? <CircularProgress size={20} /> : "Add Teacher"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          Edit — {selectedTeacher?.name}
        </DialogTitle>

        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name *"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Signature No."
                value={editForm.signatureNo || ""}
                onChange={(e) => setEditForm({ ...editForm, signatureNo: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            onClick={handleEdit}
            variant="contained"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}
          >
            {saving ? <CircularProgress size={20} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={classTeacherOpen} onClose={() => setClassTeacherOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          <HomeWorkIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Assign Class Teacher
        </DialogTitle>

        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Assigning <strong>{selectedTeacher?.name}</strong> as Class Teacher for:
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={classTeacherForm.grade}
                  label="Grade"
                  onChange={(e) =>
                    setClassTeacherForm({
                      ...classTeacherForm,
                      grade: Number(e.target.value),
                      section: "A",
                    })
                  }
                >
                  {GRADES.map((g) => (
                    <MenuItem key={g} value={g}>
                      Grade {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select
                  value={classTeacherForm.section}
                  label="Section"
                  onChange={(e) =>
                    setClassTeacherForm({
                      ...classTeacherForm,
                      section: e.target.value,
                    })
                  }
                >
                  {liveSections.map((sectionValue) => (
                    <MenuItem key={sectionValue} value={sectionValue}>
                      {sectionValue}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {(() => {
            const targetClassroom =
              classrooms.find(
                (classroom) =>
                  classroom.grade === Number(classTeacherForm.grade) &&
                  classroom.section === normalizeSection(classTeacherForm.section)
              ) || null;

            if (!targetClassroom) {
              return (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This classroom does not exist yet. Create Grade {classTeacherForm.grade}-{classTeacherForm.section} first in Classroom Management.
                </Alert>
              );
            }

            const existingTeacher =
              activeTeachers.find(
                (teacher) =>
                  teacher.id !== selectedTeacher?.id &&
                  teacherMatchesClassroom(teacher, targetClassroom)
              ) || null;

            return existingTeacher ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>{existingTeacher.name}</strong> is currently Class Teacher for Grade{" "}
                {classTeacherForm.grade}-{classTeacherForm.section}. They will be removed.
              </Alert>
            ) : null;
          })()}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setClassTeacherOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAssignClassTeacher}
            variant="contained"
            disabled={saving}
            sx={{ bgcolor: "#1a237e" }}
          >
            {saving ? <CircularProgress size={20} /> : "Confirm Assign"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: "#e65100", color: "white" }}>
          <FlightTakeoffIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Mark as Transferred
        </DialogTitle>

        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            <strong>{selectedTeacher?.name}</strong> will be marked as transferred.
            {classTeacherByTeacherId.get(selectedTeacher?.id) && (
              <>
                {" "}
                Their Class Teacher role for{" "}
                {getTeacherClassTeacherLabel(selectedTeacher)} will also be removed.
              </>
            )}
            <br />
            <strong>All teacher assignments will be deleted.</strong>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Transfer Date *"
                type="date"
                value={transferForm.date}
                onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Transferred To (School Name)"
                value={transferForm.school}
                onChange={(e) => setTransferForm({ ...transferForm, school: e.target.value })}
                placeholder="e.g. Jaffna Central College"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason (optional)"
                multiline
                rows={2}
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button
            onClick={handleTransfer}
            variant="contained"
            color="warning"
            disabled={saving || !transferForm.date}
          >
            {saving ? <CircularProgress size={20} /> : "Confirm Transfer"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onClose={() => {
          if (!bulkUploading) {
            setBulkOpen(false);
            setBulkData([]);
            setBulkErrors([]);
            setBulkSuccess("");
          }
        }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          <UploadFileIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Bulk Upload Teachers
        </DialogTitle>

        <DialogContent>
          <Box mt={2}>
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button
                  size="small"
                  color="inherit"
                  variant="outlined"
                  onClick={downloadTeacherTemplate}
                >
                  ⬇ Template
                </Button>
              }
            >
              Download the Excel template, fill teacher details, then upload here.
            </Alert>

            <Box
              sx={{
                border: "2px dashed #1a237e",
                borderRadius: 2,
                p: 3,
                textAlign: "center",
                bgcolor: "#f8f9ff",
                mb: 2,
              }}
            >
              <UploadFileIcon sx={{ fontSize: 40, color: "#1a237e", mb: 1 }} />
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Select your filled Excel file (.xlsx / .xls)
              </Typography>

              <Button
                variant="contained"
                component="label"
                sx={{ bgcolor: "#1a237e" }}
                disabled={bulkUploading}
              >
                Choose File
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={handleTeacherFileUpload}
                />
              </Button>
            </Box>

            {bulkErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                  ❌ Errors:
                </Typography>
                {bulkErrors.map((entry, idx) => (
                  <Typography key={idx} variant="caption" display="block">
                    • {entry}
                  </Typography>
                ))}
              </Alert>
            )}

            {bulkSuccess && <Alert severity="success" sx={{ mb: 2 }}>{bulkSuccess}</Alert>}

            {bulkUploading && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Uploading... {bulkProgress}%
                </Typography>

                <Box
                  sx={{
                    width: "100%",
                    height: 8,
                    bgcolor: "#e0e0e0",
                    borderRadius: 4,
                  }}
                >
                  <Box
                    sx={{
                      width: `${bulkProgress}%`,
                      height: 8,
                      bgcolor: "#1a237e",
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </Box>
              </Box>
            )}

            {bulkData.length > 0 && bulkErrors.length === 0 && !bulkSuccess && (
              <>
                <Alert severity="success" sx={{ mb: 1 }}>
                  ✅ <strong>{bulkData.length} teachers</strong> ready to upload.
                </Alert>

                <Paper sx={{ maxHeight: 280, overflow: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {["#", "Name", "Email", "Phone", "Sig No"].map((heading) => (
                          <TableCell
                            key={heading}
                            sx={{
                              bgcolor: "#1a237e",
                              color: "white",
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {heading}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {bulkData.map((teacher, idx) => (
                        <TableRow
                          key={idx}
                          hover
                          sx={{ bgcolor: idx % 2 === 0 ? "white" : "#f8f9ff" }}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {teacher.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{teacher.email}</Typography>
                          </TableCell>
                          <TableCell>{teacher.phone || "—"}</TableCell>
                          <TableCell>{teacher.signatureNo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              if (!bulkUploading) {
                setBulkOpen(false);
                setBulkData([]);
                setBulkErrors([]);
                setBulkSuccess("");
              }
            }}
            disabled={bulkUploading}
            fullWidth={isMobile}
          >
            Close
          </Button>

          <Button
            variant="contained"
            onClick={handleBulkTeacherUpload}
            disabled={bulkData.length === 0 || bulkErrors.length > 0 || bulkUploading}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}
          >
            {bulkUploading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              `Upload ${bulkData.length} Teachers`
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}