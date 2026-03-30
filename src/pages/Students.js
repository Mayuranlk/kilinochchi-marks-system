import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Divider,
  LinearProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import * as XLSX from "xlsx";

// Grades and sections come from Firestore classrooms collection

const STUDENT_STATUSES = ["Active", "Left", "Graduated", "Suspended"];
const GENDERS = ["Male", "Female", "Other"];

const emptyForm = {
  name: "",
  admissionNo: "",
  grade: "",
  section: "",
  gender: "",
  dob: "",
  phone: "",
  parentName: "",
  parentPhone: "",
  address: "",
  status: "Active",
  joinDate: "",
  notes: "",
  aestheticSubject: "",
  religionSubject: "",
  basketA: "",
  basketB: "",
  basketC: "",
  alSubjects: [],
  alSubjectsInput: "",
};

const normalizeText = (value) => String(value || "").trim();

const normalizeGradeValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeSectionValue = (value) => normalizeText(value);

const parseALSubjectsInput = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatALSubjectsForInput = (subjects) =>
  Array.isArray(subjects) ? subjects.join(", ") : "";

const sortStudentsClientSide = (list) => {
  return [...list].sort((a, b) => {
    const gradeA = Number(a.grade) || 0;
    const gradeB = Number(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = String(a.section || "").toUpperCase();
    const sectionB = String(b.section || "").toUpperCase();
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const nameA = String(a.name || "").toLowerCase();
    const nameB = String(b.name || "").toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const admA = String(a.admissionNo || "").toLowerCase();
    const admB = String(b.admissionNo || "").toLowerCase();
    return admA.localeCompare(admB);
  });
};

export default function Students() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fileInputRef = useRef();

  // state
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // bulk upload
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState(null);

  const classroomLookup = useMemo(() => {
    const map = new Set();
    classrooms.forEach((c) => {
      const grade = normalizeGradeValue(c.grade);
      const section = normalizeSectionValue(c.section);
      if (grade && section) {
        map.add(`${grade}__${section.toUpperCase()}`);
      }
    });
    return map;
  }, [classrooms]);

  const gradeOptions = useMemo(
    () =>
      [...new Set(classrooms.map((c) => normalizeGradeValue(c.grade)).filter(Boolean))].sort(
        (a, b) => a - b
      ),
    [classrooms]
  );

  const sectionOptionsForFilter = useMemo(() => {
    if (filterGrade) {
      return [
        ...new Set(
          classrooms
            .filter((c) => normalizeGradeValue(c.grade) === Number(filterGrade))
            .map((c) => normalizeSectionValue(c.section))
            .filter(Boolean)
        ),
      ].sort();
    }
    return [
      ...new Set(
        classrooms.map((c) => normalizeSectionValue(c.section)).filter(Boolean)
      ),
    ].sort();
  }, [classrooms, filterGrade]);

  const sectionOptionsForForm = useMemo(() => {
    if (!form.grade) return [];
    return [
      ...new Set(
        classrooms
          .filter((c) => normalizeGradeValue(c.grade) === Number(form.grade))
          .map((c) => normalizeSectionValue(c.section))
          .filter(Boolean)
      ),
    ].sort();
  }, [classrooms, form.grade]);

  const selectedGradeNumber = Number(form.grade) || 0;
  const isJuniorGrade = selectedGradeNumber >= 6 && selectedGradeNumber <= 9;
  const isOrdinaryLevelGrade =
    selectedGradeNumber >= 10 && selectedGradeNumber <= 11;
  const isALGrade = selectedGradeNumber >= 12 && selectedGradeNumber <= 13;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilterSection("");
  }, [filterGrade]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studSnap, classSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classrooms")),
      ]);

      const loadedStudents = studSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        alSubjects: Array.isArray(d.data().alSubjects) ? d.data().alSubjects : [],
      }));

      setStudents(sortStudentsClientSide(loadedStudents));
      setClassrooms(classSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isValidClassroom = (grade, section) => {
    if (!grade || !section) return false;
    return classroomLookup.has(
      `${Number(grade)}__${String(section).trim().toUpperCase()}`
    );
  };

  const getStudentName = (student) => student.name || "";

  const buildPayloadFromForm = () => {
    const grade = Number(form.grade);
    const basePayload = {
      name: normalizeText(form.name),
      admissionNo: normalizeText(form.admissionNo),
      grade,
      section: normalizeSectionValue(form.section),
      gender: normalizeText(form.gender),
      dob: normalizeText(form.dob),
      phone: normalizeText(form.phone),
      parentName: normalizeText(form.parentName),
      parentPhone: normalizeText(form.parentPhone),
      address: normalizeText(form.address),
      status: normalizeText(form.status) || "Active",
      joinDate: normalizeText(form.joinDate),
      notes: normalizeText(form.notes),
      updatedAt: new Date().toISOString(),
    };

    if (grade >= 6 && grade <= 9) {
      return {
        ...basePayload,
        religionSubject: normalizeText(form.religionSubject),
        aestheticSubject: normalizeText(form.aestheticSubject),
        basketA: "",
        basketB: "",
        basketC: "",
        alSubjects: [],
      };
    }

    if (grade >= 10 && grade <= 11) {
      return {
        ...basePayload,
        religionSubject: normalizeText(form.religionSubject),
        aestheticSubject: "",
        basketA: normalizeText(form.basketA),
        basketB: normalizeText(form.basketB),
        basketC: normalizeText(form.basketC),
        alSubjects: [],
      };
    }

    if (grade >= 12 && grade <= 13) {
      return {
        ...basePayload,
        religionSubject: "",
        aestheticSubject: "",
        basketA: "",
        basketB: "",
        basketC: "",
        alSubjects: parseALSubjectsInput(form.alSubjectsInput),
      };
    }

    return {
      ...basePayload,
      religionSubject: "",
      aestheticSubject: "",
      basketA: "",
      basketB: "",
      basketC: "",
      alSubjects: [],
    };
  };

  const validateForm = () => {
    if (!normalizeText(form.name)) return "Student name is required.";
    if (!form.grade) return "Grade is required.";
    if (!form.section) return "Section is required.";
    if (!isValidClassroom(form.grade, form.section)) {
      return "Selected grade and section do not match an existing classroom.";
    }

    const grade = Number(form.grade);

    if (grade >= 6 && grade <= 9) {
      if (!normalizeText(form.religionSubject)) {
        return "Religion subject is required for Grades 6 to 9.";
      }
      if (!normalizeText(form.aestheticSubject)) {
        return "Aesthetic subject is required for Grades 6 to 9.";
      }
    }

    if (grade >= 10 && grade <= 11) {
      if (!normalizeText(form.religionSubject)) {
        return "Religion subject is required for Grades 10 to 11.";
      }
    }

    if (grade >= 12 && grade <= 13) {
      const alSubjects = parseALSubjectsInput(form.alSubjectsInput);
      if (alSubjects.length === 0) {
        return "Enter at least one A/L subject for Grades 12 to 13.";
      }
    }

    return "";
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const studentName = getStudentName(s).toLowerCase();

    const matchSearch =
      !q ||
      studentName.includes(q) ||
      normalizeText(s.admissionNo).toLowerCase().includes(q) ||
      normalizeText(s.phone).includes(q) ||
      normalizeText(s.parentPhone).includes(q);

    const matchGrade = !filterGrade || String(s.grade) === String(filterGrade);
    const matchSection = !filterSection || s.section === filterSection;
    const matchStatus = !filterStatus || s.status === filterStatus;

    return matchSearch && matchGrade && matchSection && matchStatus;
  });

  const activeCount = students.filter((s) => s.status === "Active").length;
  const leftCount = students.filter((s) => s.status === "Left").length;

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayloadFromForm();

      if (editId) {
        await updateDoc(doc(db, "students", editId), payload);
        setSuccess("Student updated successfully!");
      } else {
        await addDoc(collection(db, "students"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Student added successfully!");
      }

      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await fetchData();
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s) => {
    const grade = s.grade || "";
    const alSubjects = Array.isArray(s.alSubjects) ? s.alSubjects : [];

    setForm({
      name: s.name || "",
      admissionNo: s.admissionNo || "",
      grade,
      section: s.section || "",
      gender: s.gender || "",
      dob: s.dob || "",
      phone: s.phone || "",
      parentName: s.parentName || "",
      parentPhone: s.parentPhone || "",
      address: s.address || "",
      status: s.status || "Active",
      joinDate: s.joinDate || "",
      notes: s.notes || "",
      aestheticSubject: s.aestheticSubject || "",
      religionSubject: s.religionSubject || "",
      basketA: s.basketA || "",
      basketB: s.basketB || "",
      basketC: s.basketC || "",
      alSubjects,
      alSubjectsInput: formatALSubjectsForInput(alSubjects),
    });

    setEditId(s.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this student? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "students", id));
      setSuccess("Student deleted.");
      await fetchData();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  };

  const mapExcelRowToStudent = (row) => {
    const grade = normalizeGradeValue(row["Grade"] || row["grade"]);
    const section = normalizeSectionValue(row["Section"] || row["section"]);
    const alSubjectsInput = normalizeText(
      row["A/L Subjects"] || row["alSubjects"] || row["AL Subjects"]
    );
    const alSubjects = parseALSubjectsInput(alSubjectsInput);

    return {
      name: normalizeText(row["Name"] || row["name"]),
      admissionNo: normalizeText(
        row["Admission No"] || row["admissionNo"] || row["AdmissionNo"]
      ),
      grade,
      section,
      gender: normalizeText(row["Gender"] || row["gender"]),
      dob: normalizeText(row["DOB"] || row["dob"]),
      phone: normalizeText(row["Phone"] || row["phone"]),
      parentName: normalizeText(row["Parent Name"] || row["parentName"]),
      parentPhone: normalizeText(row["Parent Phone"] || row["parentPhone"]),
      address: normalizeText(row["Address"] || row["address"]),
      status: normalizeText(row["Status"] || row["status"]) || "Active",
      joinDate: normalizeText(row["Join Date"] || row["joinDate"]),
      notes: normalizeText(row["Notes"] || row["notes"]),
      religionSubject: normalizeText(
        row["Religion Subject"] || row["religionSubject"]
      ),
      aestheticSubject: normalizeText(
        row["Aesthetic Subject"] || row["aestheticSubject"]
      ),
      basketA: normalizeText(row["Basket A"] || row["basketA"]),
      basketB: normalizeText(row["Basket B"] || row["basketB"]),
      basketC: normalizeText(row["Basket C"] || row["basketC"]),
      alSubjects,
      alSubjectsInput,
    };
  };

  const validateBulkRow = (student, rowNumber) => {
    if (!student.name) {
      return `Row ${rowNumber}: Student name is required.`;
    }

    if (!student.grade) {
      return `Row ${rowNumber}: Grade is required.`;
    }

    if (!student.section) {
      return `Row ${rowNumber}: Section is required.`;
    }

    if (!isValidClassroom(student.grade, student.section)) {
      return `Row ${rowNumber}: Grade ${student.grade} Section ${student.section} does not exist in classrooms.`;
    }

    if (student.grade >= 6 && student.grade <= 9) {
      if (!student.religionSubject) {
        return `Row ${rowNumber}: Religion Subject is required for Grades 6 to 9.`;
      }
      if (!student.aestheticSubject) {
        return `Row ${rowNumber}: Aesthetic Subject is required for Grades 6 to 9.`;
      }
    }

    if (student.grade >= 10 && student.grade <= 11) {
      if (!student.religionSubject) {
        return `Row ${rowNumber}: Religion Subject is required for Grades 10 to 11.`;
      }
    }

    if (student.grade >= 12 && student.grade <= 13 && student.alSubjects.length === 0) {
      return `Row ${rowNumber}: A/L Subjects is required for Grades 12 to 13.`;
    }

    return "";
  };

  const buildBulkPayload = (student) => {
    const basePayload = {
      name: student.name,
      admissionNo: student.admissionNo,
      grade: student.grade,
      section: student.section,
      gender: student.gender,
      dob: student.dob,
      phone: student.phone,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      address: student.address,
      status: student.status || "Active",
      joinDate: student.joinDate,
      notes: student.notes,
      updatedAt: new Date().toISOString(),
    };

    if (student.grade >= 6 && student.grade <= 9) {
      return {
        ...basePayload,
        religionSubject: student.religionSubject,
        aestheticSubject: student.aestheticSubject,
        basketA: "",
        basketB: "",
        basketC: "",
        alSubjects: [],
      };
    }

    if (student.grade >= 10 && student.grade <= 11) {
      return {
        ...basePayload,
        religionSubject: student.religionSubject,
        aestheticSubject: "",
        basketA: student.basketA,
        basketB: student.basketB,
        basketC: student.basketC,
        alSubjects: [],
      };
    }

    if (student.grade >= 12 && student.grade <= 13) {
      return {
        ...basePayload,
        religionSubject: "",
        aestheticSubject: "",
        basketA: "",
        basketB: "",
        basketC: "",
        alSubjects: student.alSubjects,
      };
    }

    return {
      ...basePayload,
      religionSubject: "",
      aestheticSubject: "",
      basketA: "",
      basketB: "",
      basketC: "",
      alSubjects: [],
    };
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkUploading(true);
    setBulkProgress(0);
    setBulkResults(null);
    setError("");
    setSuccess("");

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (!rows.length) {
        throw new Error("The selected Excel file is empty.");
      }

      const preparedRows = rows.map((row, idx) => {
        const student = mapExcelRowToStudent(row);
        const rowNumber = idx + 2;
        const validationError = validateBulkRow(student, rowNumber);
        return { student, rowNumber, validationError };
      });

      const validRows = preparedRows.filter((item) => !item.validationError);
      const invalidRows = preparedRows.filter((item) => item.validationError);

      let successCount = 0;
      let failCount = invalidRows.length;
      const errors = invalidRows.map((item) => item.validationError);

      for (let i = 0; i < validRows.length; i++) {
        const item = validRows[i];
        try {
          await addDoc(collection(db, "students"), {
            ...buildBulkPayload(item.student),
            createdAt: new Date().toISOString(),
          });
          successCount++;
        } catch (err) {
          failCount++;
          errors.push(`Row ${item.rowNumber}: ${err.message}`);
        }
        setBulkProgress(
          Math.round(((i + 1) / Math.max(validRows.length, 1)) * 100)
        );
      }

      if (validRows.length === 0) {
        setBulkProgress(100);
      }

      setBulkResults({ successCount, failCount, errors });
      await fetchData();
    } catch (err) {
      setError("Bulk upload failed: " + err.message);
    } finally {
      setBulkUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    const exportData = filtered.map((s) => ({
      "Admission No": s.admissionNo || "",
      Name: s.name || "",
      Grade: s.grade || "",
      Section: s.section || "",
      Gender: s.gender || "",
      DOB: s.dob || "",
      Phone: s.phone || "",
      "Parent Name": s.parentName || "",
      "Parent Phone": s.parentPhone || "",
      Address: s.address || "",
      Status: s.status || "",
      "Join Date": s.joinDate || "",
      "Religion Subject": s.religionSubject || "",
      "Aesthetic Subject": s.aestheticSubject || "",
      "Basket A": s.basketA || "",
      "Basket B": s.basketB || "",
      "Basket C": s.basketC || "",
      "A/L Subjects": Array.isArray(s.alSubjects) ? s.alSubjects.join(", ") : "",
      Notes: s.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `students_export_${Date.now()}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        Name: "John Doe",
        "Admission No": "ADM001",
        Grade: 8,
        Section: "A",
        Gender: "Male",
        DOB: "2012-01-15",
        Phone: "0771234567",
        "Parent Name": "Jane Doe",
        "Parent Phone": "0777654321",
        Address: "123 Main St",
        Status: "Active",
        "Join Date": "2026-01-01",
        "Religion Subject": "Hinduism",
        "Aesthetic Subject": "Art",
        "Basket A": "",
        "Basket B": "",
        "Basket C": "",
        "A/L Subjects": "",
        Notes: "",
      },
      {
        Name: "Mary Silva",
        "Admission No": "ADM010",
        Grade: 11,
        Section: "B",
        Gender: "Female",
        DOB: "2010-05-12",
        Phone: "0771112233",
        "Parent Name": "Peter Silva",
        "Parent Phone": "0773332211",
        Address: "45 School Road",
        Status: "Active",
        "Join Date": "2026-01-01",
        "Religion Subject": "Catholicism",
        "Aesthetic Subject": "",
        "Basket A": "Commerce",
        "Basket B": "Art",
        "Basket C": "Drama",
        "A/L Subjects": "",
        Notes: "",
      },
      {
        Name: "Kumaran",
        "Admission No": "ADM100",
        Grade: 12,
        Section: "Maths A",
        Gender: "Male",
        DOB: "2008-03-10",
        Phone: "0779991111",
        "Parent Name": "Sivakumar",
        "Parent Phone": "0779992222",
        Address: "Kilinochchi",
        Status: "Active",
        "Join Date": "2026-01-01",
        "Religion Subject": "",
        "Aesthetic Subject": "",
        "Basket A": "",
        "Basket B": "",
        "Basket C": "",
        "A/L Subjects": "Combined Maths, Physics, Chemistry",
        Notes: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_upload_template.xlsx");
  };

  const statusColor = (s) => {
    if (s === "Active") return "success";
    if (s === "Left") return "error";
    if (s === "Graduated") return "primary";
    return "warning";
  };

  const initials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

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
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1.5}
        >
          <Box>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              fontWeight={800}
              color="#1a237e"
            >
              Students
            </Typography>
            <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
              <Chip
                label={`Active: ${activeCount}`}
                size="small"
                color="success"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Left: ${leftCount}`}
                size="small"
                color="error"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Total: ${students.length}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          <Box display="flex" gap={1} flexWrap="wrap">
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleBulkUpload}
            />
            <Tooltip title="Download Upload Template">
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ borderColor: "#1a237e", color: "#1a237e" }}
              >
                {isMobile ? "" : "Template"}
              </Button>
            </Tooltip>
            <Tooltip title="Bulk Upload Excel">
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current.click()}
                disabled={bulkUploading}
                sx={{ borderColor: "#43a047", color: "#43a047" }}
              >
                {isMobile ? "" : "Bulk Upload"}
              </Button>
            </Tooltip>
            <Tooltip title="Export to Excel">
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                sx={{ borderColor: "#0288d1", color: "#0288d1" }}
              >
                {isMobile ? "" : "Export"}
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size={isMobile ? "small" : "medium"}
              onClick={() => {
                setForm(emptyForm);
                setEditId(null);
                setError("");
                setSuccess("");
                setOpen(true);
              }}
              sx={{ bgcolor: "#1a237e", fontWeight: 700, borderRadius: 2 }}
            >
              {isMobile ? "Add" : "Add Student"}
            </Button>
          </Box>
        </Box>

        {bulkUploading && (
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              Uploading... {bulkProgress}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={bulkProgress}
              sx={{ mt: 0.5, borderRadius: 2 }}
            />
          </Box>
        )}

        {bulkResults && (
          <Alert
            severity={bulkResults.failCount > 0 ? "warning" : "success"}
            sx={{ mt: 1.5, borderRadius: 2 }}
            onClose={() => setBulkResults(null)}
          >
            Uploaded {bulkResults.successCount} students
            {bulkResults.failCount > 0 && `, ${bulkResults.failCount} failed`}
            {bulkResults.errors.length > 0 && (
              <Box mt={0.5}>
                {bulkResults.errors.slice(0, 5).map((e, i) => (
                  <Typography key={i} variant="caption" display="block">
                    {e}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}

        <Box display="flex" flexWrap="wrap" gap={1.5} mt={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search name, adm no, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
            InputProps={{
              startAdornment: (
                <SearchIcon
                  fontSize="small"
                  sx={{ mr: 0.5, color: "text.secondary" }}
                />
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Grade</InputLabel>
            <Select
              value={filterGrade}
              label="Grade"
              onChange={(e) => setFilterGrade(e.target.value)}
            >
              <MenuItem value="">All Grades</MenuItem>
              {gradeOptions.map((g) => (
                <MenuItem key={g} value={g}>
                  Grade {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filterSection}
              label="Section"
              onChange={(e) => setFilterSection(e.target.value)}
            >
              <MenuItem value="">All Sections</MenuItem>
              {sectionOptionsForFilter.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STUDENT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSearch("");
              setFilterGrade("");
              setFilterSection("");
              setFilterStatus("");
            }}
            sx={{ borderColor: "#e8eaf6", color: "text.secondary" }}
          >
            Clear
          </Button>

          <Typography variant="caption" color="text.secondary">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Box>

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setSuccess("")}
        >
          {success}
        </Alert>
      )}

      {error && !open && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            border: "1px solid #e8eaf6",
          }}
        >
          <PersonIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography
            variant="h6"
            color="text.secondary"
            mt={1}
            fontWeight={600}
          >
            No students found
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {students.length === 0
              ? 'Click "Add Student" to get started'
              : "Try adjusting your filters"}
          </Typography>
        </Box>
      ) : isMobile ? (
        <Box>
          {filtered.map((s) => (
            <Card
              key={s.id}
              sx={{
                mb: 1.5,
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.07)",
              }}
            >
              <CardContent sx={{ pb: 0 }}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Avatar
                      sx={{
                        bgcolor: "#1a237e",
                        width: 38,
                        height: 38,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {initials(getStudentName(s))}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {getStudentName(s)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.admissionNo || "No Adm#"} • Grade {s.grade}-{s.section}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={s.status}
                    size="small"
                    color={statusColor(s.status)}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                {(s.phone || s.parentPhone) && (
                  <Box mt={0.8}>
                    {s.phone && (
                      <Typography variant="caption" color="text.secondary">
                        📞 {s.phone}
                      </Typography>
                    )}
                    {s.parentPhone && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        👨‍👩‍👧 {s.parentPhone}
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
              <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(s)}
                  sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(s.id)}
                >
                  Delete
                </Button>
              </CardActions>
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
                {[
                  "#",
                  "Student",
                  "Adm No",
                  "Grade/Sec",
                  "Status",
                  "Phone",
                  "Parent",
                  "Actions",
                ].map((h) => (
                  <TableCell
                    key={h}
                    sx={{ color: "white", fontWeight: 700, fontSize: 13 }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s, idx) => (
                <TableRow
                  key={s.id}
                  hover
                  sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}
                >
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar
                        sx={{
                          width: 30,
                          height: 30,
                          bgcolor: "#1a237e",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {initials(getStudentName(s))}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {getStudentName(s)}
                        </Typography>
                        {s.gender && (
                          <Typography variant="caption" color="text.secondary">
                            {s.gender}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="#1a237e"
                    >
                      {s.admissionNo || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`G${s.grade}-${s.section}`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700, fontSize: 12 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.status}
                      size="small"
                      color={statusColor(s.status)}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {s.phone || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {s.parentName || "—"}
                      {s.parentPhone ? ` • ${s.parentPhone}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEdit(s)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(s.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "✏️ Edit Student" : "➕ Add Student"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Admission No."
                value={form.admissionNo}
                onChange={(e) =>
                  setForm({ ...form, admissionNo: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Class
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={form.grade}
                  label="Grade"
                  onChange={(e) => {
                    const nextGrade = e.target.value;
                    const currentGrade = Number(form.grade) || 0;
                    const nextGradeNumber = Number(nextGrade) || 0;

                    const shouldResetAcademicFields = currentGrade !== nextGradeNumber;

                    setForm({
                      ...form,
                      grade: nextGrade,
                      section: "",
                      religionSubject: shouldResetAcademicFields
                        ? ""
                        : form.religionSubject,
                      aestheticSubject: shouldResetAcademicFields
                        ? ""
                        : form.aestheticSubject,
                      basketA: shouldResetAcademicFields ? "" : form.basketA,
                      basketB: shouldResetAcademicFields ? "" : form.basketB,
                      basketC: shouldResetAcademicFields ? "" : form.basketC,
                      alSubjects: shouldResetAcademicFields ? [] : form.alSubjects,
                      alSubjectsInput: shouldResetAcademicFields
                        ? ""
                        : form.alSubjectsInput,
                    });
                  }}
                >
                  <MenuItem value="">
                    <em>Select Grade</em>
                  </MenuItem>
                  {gradeOptions.map((g) => (
                    <MenuItem key={g} value={g}>
                      Grade {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {gradeOptions.length === 0 && (
                <Typography
                  variant="caption"
                  color="error"
                  mt={0.5}
                  display="block"
                >
                  No classrooms found. Please create classrooms first.
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required disabled={!form.grade}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={form.section}
                  label="Section"
                  onChange={(e) =>
                    setForm({ ...form, section: e.target.value })
                  }
                >
                  <MenuItem value="">
                    <em>Select Section</em>
                  </MenuItem>
                  {sectionOptionsForForm.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {form.grade && sectionOptionsForForm.length === 0 && (
                <Typography
                  variant="caption"
                  color="error"
                  mt={0.5}
                  display="block"
                >
                  No sections for Grade {form.grade}. Add in Classroom Management.
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  {STUDENT_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {form.grade && (
              <>
                <Grid item xs={12}>
                  <Divider>
                    <Typography variant="caption" color="text.secondary">
                      Subject Selection
                    </Typography>
                  </Divider>
                </Grid>

                {isJuniorGrade && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="Religion Subject"
                        value={form.religionSubject}
                        onChange={(e) =>
                          setForm({ ...form, religionSubject: e.target.value })
                        }
                        helperText="For Grades 6 to 9"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="Aesthetic Subject"
                        value={form.aestheticSubject}
                        onChange={(e) =>
                          setForm({ ...form, aestheticSubject: e.target.value })
                        }
                        helperText="For Grades 6 to 9"
                      />
                    </Grid>
                  </>
                )}

                {isOrdinaryLevelGrade && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="Religion Subject"
                        value={form.religionSubject}
                        onChange={(e) =>
                          setForm({ ...form, religionSubject: e.target.value })
                        }
                        helperText="For Grades 10 to 11"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Basket A"
                        value={form.basketA}
                        onChange={(e) =>
                          setForm({ ...form, basketA: e.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Basket B"
                        value={form.basketB}
                        onChange={(e) =>
                          setForm({ ...form, basketB: e.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Basket C"
                        value={form.basketC}
                        onChange={(e) =>
                          setForm({ ...form, basketC: e.target.value })
                        }
                      />
                    </Grid>
                  </>
                )}

                {isALGrade && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      label="A/L Subjects"
                      value={form.alSubjectsInput}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          alSubjectsInput: e.target.value,
                          alSubjects: parseALSubjectsInput(e.target.value),
                        })
                      }
                      helperText="Enter subjects separated by commas. Example: Combined Maths, Physics, Chemistry"
                    />
                  </Grid>
                )}
              </>
            )}

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Personal Info
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={form.gender}
                  label="Gender"
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value })
                  }
                >
                  <MenuItem value="">—</MenuItem>
                  {GENDERS.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Join Date"
                type="date"
                value={form.joinDate}
                onChange={(e) =>
                  setForm({ ...form, joinDate: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Contact
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Student Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Parent Name"
                value={form.parentName}
                onChange={(e) =>
                  setForm({ ...form, parentName: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Parent Phone"
                value={form.parentPhone}
                onChange={(e) =>
                  setForm({ ...form, parentPhone: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Address"
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editId ? (
              "Update Student"
            ) : (
              "Save Student"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}