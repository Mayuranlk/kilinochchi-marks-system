import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
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

// ── REMOVED: import { GRADES, SECTIONS } from "../constants";
// Grades and sections now come from Firestore classrooms collection

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
};

export default function Students() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fileInputRef = useRef();

  // ── state ──────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]); // ← NEW: from Firestore
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
  const [filterStatus, setFilterStatus] = useState("Active");

  // bulk upload
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState(null);

  // ── derived: unique grades from classrooms ─────────────
  const gradeOptions = [...new Set(classrooms.map((c) => c.grade))]
    .sort((a, b) => a - b);

  // ── derived: sections for the currently selected grade ─
  // (used in the filter bar — shows all sections if no grade selected)
  const sectionOptionsForFilter = filterGrade
    ? [...new Set(
        classrooms
          .filter((c) => c.grade === Number(filterGrade))
          .map((c) => c.section)
      )].sort()
    : [...new Set(classrooms.map((c) => c.section))].sort();

  // ── derived: sections for the form (depends on form.grade) ─
  const sectionOptionsForForm = form.grade
    ? [...new Set(
        classrooms
          .filter((c) => c.grade === Number(form.grade))
          .map((c) => c.section)
      )].sort()
    : [];

  // ── fetch students + classrooms ────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  // Reset section filter when grade filter changes
  useEffect(() => {
    setFilterSection("");
  }, [filterGrade]);

  // Reset form section when form grade changes
  useEffect(() => {
    setForm((prev) => ({ ...prev, section: "" }));
  }, [form.grade]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, "students"), orderBy("name"))),
        getDocs(collection(db, "classrooms")),
      ]);
      setStudents(studSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setClassrooms(classSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── filtered list ──────────────────────────────────────
  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.admissionNo || "").toLowerCase().includes(q) ||
      (s.phone || "").includes(q) ||
      (s.parentPhone || "").includes(q);
    const matchGrade =
      !filterGrade || String(s.grade) === String(filterGrade);
    const matchSection = !filterSection || s.section === filterSection;
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchGrade && matchSection && matchStatus;
  });

  // ── stats ──────────────────────────────────────────────
  const activeCount = students.filter((s) => s.status === "Active").length;
  const leftCount = students.filter((s) => s.status === "Left").length;

  // ── save (add / edit) ──────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setError("Student name is required."); return; }
    if (!form.grade) { setError("Grade is required."); return; }
    if (!form.section) { setError("Section is required."); return; }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        grade: Number(form.grade),
        updatedAt: new Date().toISOString(),
      };
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

  // ── edit ───────────────────────────────────────────────
  const handleEdit = (s) => {
    setForm({
      name: s.name || "",
      admissionNo: s.admissionNo || "",
      grade: s.grade || "",
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
    });
    setEditId(s.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  // ── delete ─────────────────────────────────────────────
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

  // ── bulk upload via Excel ──────────────────────────────
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkUploading(true);
    setBulkProgress(0);
    setBulkResults(null);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          await addDoc(collection(db, "students"), {
            name: String(row["Name"] || row["name"] || "").trim(),
            admissionNo: String(row["Admission No"] || row["admissionNo"] || "").trim(),
            grade: Number(row["Grade"] || row["grade"] || 0),
            section: String(row["Section"] || row["section"] || "").trim(),
            gender: String(row["Gender"] || row["gender"] || "").trim(),
            dob: String(row["DOB"] || row["dob"] || "").trim(),
            phone: String(row["Phone"] || row["phone"] || "").trim(),
            parentName: String(row["Parent Name"] || row["parentName"] || "").trim(),
            parentPhone: String(row["Parent Phone"] || row["parentPhone"] || "").trim(),
            address: String(row["Address"] || row["address"] || "").trim(),
            status: String(row["Status"] || row["status"] || "Active").trim(),
            joinDate: String(row["Join Date"] || row["joinDate"] || "").trim(),
            notes: String(row["Notes"] || row["notes"] || "").trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          successCount++;
        } catch (err) {
          failCount++;
          errors.push(`Row ${i + 2}: ${err.message}`);
        }
        setBulkProgress(Math.round(((i + 1) / rows.length) * 100));
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

  // ── export to Excel ────────────────────────────────────
  const handleExport = () => {
    const exportData = filtered.map((s) => ({
      "Admission No": s.admissionNo,
      Name: s.name,
      Grade: s.grade,
      Section: s.section,
      Gender: s.gender,
      DOB: s.dob,
      Phone: s.phone,
      "Parent Name": s.parentName,
      "Parent Phone": s.parentPhone,
      Address: s.address,
      Status: s.status,
      "Join Date": s.joinDate,
      Notes: s.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `students_export_${Date.now()}.xlsx`);
  };

  // ── download template ──────────────────────────────────
  const handleDownloadTemplate = () => {
    const template = [
      {
        Name: "John Doe",
        "Admission No": "ADM001",
        Grade: 10,
        Section: "A",
        Gender: "Male",
        DOB: "2010-01-15",
        Phone: "0771234567",
        "Parent Name": "Jane Doe",
        "Parent Phone": "0777654321",
        Address: "123 Main St",
        Status: "Active",
        "Join Date": "2024-01-01",
        Notes: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_upload_template.xlsx");
  };

  // ── status chip color ──────────────────────────────────
  const statusColor = (s) => {
    if (s === "Active") return "success";
    if (s === "Left") return "error";
    if (s === "Graduated") return "primary";
    return "warning";
  };

  // ── avatar initials ────────────────────────────────────
  const initials = (name = "") =>
    name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // ──────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Header bar ── */}
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
            {/* Bulk Upload */}
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

        {/* Bulk progress */}
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

        {/* Bulk results */}
        {bulkResults && (
          <Alert
            severity={bulkResults.failCount > 0 ? "warning" : "success"}
            sx={{ mt: 1.5, borderRadius: 2 }}
            onClose={() => setBulkResults(null)}
          >
            Uploaded {bulkResults.successCount} students
            {bulkResults.failCount > 0 &&
              `, ${bulkResults.failCount} failed`}
            {bulkResults.errors.length > 0 && (
              <Box mt={0.5}>
                {bulkResults.errors.slice(0, 3).map((e, i) => (
                  <Typography key={i} variant="caption" display="block">
                    {e}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}

        {/* ── Filters ── */}
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

          {/* ── Grade filter — FROM CLASSROOMS ── */}
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

          {/* ── Section filter — FROM CLASSROOMS ── */}
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
              setFilterStatus("Active");
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

      {/* ── Alerts ── */}
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

      {/* ── Loading ── */}
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
        /* ── Mobile card list ── */
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
                      {initials(s.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.admissionNo || "No Adm#"} •{" "}
                        Grade {s.grade}-{s.section}
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
        /* ── Desktop table ── */
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
                        {initials(s.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {s.name}
                        </Typography>
                        {s.gender && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
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

      {/* ── Add / Edit Dialog ── */}
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
            {/* Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>
            {/* Admission No */}
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

            {/* ── Grade — FROM CLASSROOMS ── */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={form.grade}
                  label="Grade"
                  onChange={(e) =>
                    setForm({ ...form, grade: e.target.value })
                  }
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
                <Typography variant="caption" color="error" mt={0.5} display="block">
                  No classrooms found. Please create classrooms first.
                </Typography>
              )}
            </Grid>

            {/* ── Section — FROM CLASSROOMS (filtered by grade) ── */}
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
                <Typography variant="caption" color="error" mt={0.5} display="block">
                  No sections for Grade {form.grade}. Add in Classroom Management.
                </Typography>
              )}
            </Grid>

            {/* Status */}
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

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Personal Info
                </Typography>
              </Divider>
            </Grid>

            {/* Gender */}
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
            {/* DOB */}
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
            {/* Join Date */}
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

            {/* Phone */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Student Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Grid>
            {/* Parent Name */}
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
            {/* Parent Phone */}
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
            {/* Address */}
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
            {/* Notes */}
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