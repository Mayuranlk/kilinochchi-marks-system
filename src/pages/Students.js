import React, { useEffect, useState } from "react";
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADES, SECTIONS } from "../constants";
import * as XLSX from "xlsx";
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableHead, TableRow, TableCell, TableBody, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip,
  CircularProgress, Grid, Alert, TablePagination, InputAdornment,
  useMediaQuery, useTheme, Card, CardContent, CardActions, Tabs, Tab,
  Divider, Tooltip
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import PrintIcon from "@mui/icons-material/Print";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useNavigate } from "react-router-dom";

const RELIGIONS = ["Hindu", "Roman Catholic", "Islam", "Buddhist", "Other"];
const AESTHETICS = ["Art", "Music", "Drama", "Dance", "None"];

const empty = {
  name: "", admissionNo: "", grade: 6, section: "A",
  gender: "Male", dob: "",
  phone: "", address: "", parentName: "", parentPhone: "",
  religion: "Hindu", aesthetic: "None",
  status: "active", leftDate: "", leftReason: ""
};

export default function Students() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [leftDialog, setLeftDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [leftReason, setLeftReason] = useState("");
  const [leftDate, setLeftDate] = useState("");
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterStatus, setFilterStatus] = useState("active");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [formTab, setFormTab] = useState(0);

  // Bulk upload states
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");

  const fetchStudents = async () => {
    const snap = await getDocs(collection(db, "students"));
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  useEffect(() => {
    let data = [...students];
    if (search) data = data.filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNo?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search) ||
      s.parentPhone?.includes(search)
    );
    if (filterGrade !== "All") data = data.filter(s => s.grade === filterGrade);
    if (filterSection !== "All") data = data.filter(s => s.section === filterSection);
    if (filterStatus !== "All") data = data.filter(s => (s.status || "active") === filterStatus);
    setFiltered(data);
    setPage(0);
  }, [search, filterGrade, filterSection, filterStatus, students]);

  const handleSave = async () => {
    if (!form.name || !form.admissionNo)
      return setError("Name and Admission No are required.");
    setSaving(true); setError("");
    try {
      if (editId) {
        await updateDoc(doc(db, "students", editId), form);
      } else {
        await addDoc(collection(db, "students"), {
          ...form, status: "active", createdAt: new Date().toISOString()
        });
      }
      setOpen(false); setForm(empty); setEditId(null);
      fetchStudents();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleEdit = (s) => {
    setForm({
      name: s.name || "", admissionNo: s.admissionNo || "",
      grade: s.grade || 6, section: s.section || "A",
      gender: s.gender || "Male", dob: s.dob || "",
      phone: s.phone || "", address: s.address || "",
      parentName: s.parentName || "", parentPhone: s.parentPhone || "",
      religion: s.religion || "Hindu", aesthetic: s.aesthetic || "None",
      status: s.status || "active", leftDate: s.leftDate || "",
      leftReason: s.leftReason || ""
    });
    setEditId(s.id); setError(""); setFormTab(0); setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this student?")) return;
    await deleteDoc(doc(db, "students", id));
    fetchStudents();
  };

  const handleMarkLeft = async () => {
    if (!leftDate) return;
    await updateDoc(doc(db, "students", selectedStudent.id), {
      status: "left", leftDate, leftReason
    });
    setLeftDialog(false); setLeftReason(""); setLeftDate("");
    fetchStudents();
  };

  const handleRestoreStudent = async (s) => {
    await updateDoc(doc(db, "students", s.id), {
      status: "active", leftDate: "", leftReason: ""
    });
    fetchStudents();
  };

  const openIdCard = (s) => { setSelectedStudent(s); setIdCardOpen(true); };
  const openLeftDialog = (s) => { setSelectedStudent(s); setLeftDialog(true); };

  // ── Bulk Upload Functions ──
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkErrors([]); setBulkData([]); setBulkSuccess("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (raw.length === 0) {
          setBulkErrors(["Excel file is empty or has no data rows."]);
          return;
        }
        const errors = [];
        const cleaned = raw.map((row, idx) => {
          const r = {
            admissionNo: String(row.admissionNo || "").trim(),
            name:        String(row.name || "").trim(),
            grade:       Number(row.grade) || 6,
            section:     String(row.section || "A").trim().toUpperCase(),
            gender:      String(row.gender || "Male").trim(),
            dob:         String(row.dob || "").trim(),
            phone:       String(row.phone || "").trim(),
            parentName:  String(row.parentName || "").trim(),
            parentPhone: String(row.parentPhone || "").trim(),
            address:     String(row.address || "").trim(),
            religion:    String(row.religion || "Hindu").trim(),
            aesthetic:   String(row.aesthetic || "None").trim(),
            status:      "active",
          };
          if (!r.name) errors.push(`Row ${idx + 2}: Name is missing`);
          if (!r.admissionNo) errors.push(`Row ${idx + 2}: Admission No is missing`);
          if (!GRADES.includes(r.grade))
            errors.push(`Row ${idx + 2}: Invalid grade "${r.grade}"`);
          if (!SECTIONS.includes(r.section))
            errors.push(`Row ${idx + 2}: Invalid section "${r.section}"`);
          return r;
        });
        setBulkErrors(errors);
        setBulkData(cleaned);
      } catch (err) {
        setBulkErrors(["Failed to read file. Make sure it's a valid .xlsx file."]);
      }
    };
    reader.readAsBinaryString(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleBulkUpload = async () => {
    if (bulkErrors.length > 0 || bulkData.length === 0) return;
    setBulkUploading(true);
    let count = 0;
    try {
      for (const student of bulkData) {
        await addDoc(collection(db, "students"), {
          ...student,
          createdAt: new Date().toISOString(),
        });
        count++;
      }
      setBulkSuccess(`✅ ${count} students uploaded successfully!`);
      setBulkData([]); setBulkErrors([]);
      fetchStudents();
    } catch (err) {
      setBulkErrors([`Upload failed: ${err.message}`]);
    }
    setBulkUploading(false);
  };

  const downloadTemplate = () => {
    const template = [
      {
        admissionNo: "2024001", name: "Kajendran Mayuran",
        grade: 6, section: "A", gender: "Male",
        dob: "2012-05-14", phone: "0771234567",
        parentName: "Kajendran Kumar", parentPhone: "0777654321",
        address: "12, Main St, Kilinochchi",
        religion: "Hindu", aesthetic: "Music"
      },
      {
        admissionNo: "2024002", name: "Thamilini Priya",
        grade: 7, section: "B", gender: "Female",
        dob: "2011-08-20", phone: "0769876543",
        parentName: "Thamilini Rajan", parentPhone: "0761234567",
        address: "45, North Rd, Kilinochchi",
        religion: "Roman Catholic", aesthetic: "Dance"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    // Set column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 22 }, { wch: 6 }, { wch: 8 }, { wch: 8 },
      { wch: 12 }, { wch: 13 }, { wch: 22 }, { wch: 13 },
      { wch: 28 }, { wch: 14 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_template.xlsx");
  };

  const getStatusColor = (status) => {
    if (status === "left") return "error";
    if (status === "completed") return "success";
    return "default";
  };

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const statusCounts = {
    all: students.length,
    active: students.filter(s => (s.status || "active") === "active").length,
    left: students.filter(s => s.status === "left").length,
    completed: students.filter(s => s.status === "completed").length,
  };

  const printIdCard = () => {
    const content = document.getElementById("id-card-print").innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Student ID - ${selectedStudent?.name}</title>
      <style>
        body { font-family: Arial, sans-serif; display:flex;
               justify-content:center; padding:20px; }
        .card { border: 2px solid #1a237e; border-radius: 12px;
                padding: 20px; width: 320px; text-align: center; }
        .school { color: #1a237e; font-weight: bold; font-size: 16px; }
        .name { font-size: 18px; font-weight: bold; margin: 8px 0; }
        .info { font-size: 13px; color: #333; margin: 4px 0; }
        .chip { background: #1a237e; color: white; padding: 3px 10px;
                border-radius: 20px; font-size: 12px;
                display:inline-block; margin:4px; }
        hr { border-color: #1a237e; }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close(); win.print();
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Students
          </Typography>
          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            <Chip label={`Active: ${statusCounts.active}`} size="small" color="success" />
            <Chip label={`Left: ${statusCounts.left}`} size="small" color="error" />
            <Chip label={`Total: ${statusCounts.all}`} size="small" color="primary" />
          </Box>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
          <Button variant="outlined" startIcon={<UploadFileIcon />}
            onClick={() => {
              setBulkOpen(true); setBulkData([]);
              setBulkErrors([]); setBulkSuccess("");
            }}
            size={isMobile ? "small" : "medium"}
            sx={{ borderColor: "#1a237e", color: "#1a237e" }}>
            {isMobile ? "Bulk" : "Bulk Upload"}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setForm(empty); setEditId(null);
              setError(""); setFormTab(0); setOpen(true); }}
            sx={{ bgcolor: "#1a237e" }} size={isMobile ? "small" : "medium"}>
            {isMobile ? "Add" : "Add Student"}
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth size="small"
            placeholder="Search name, adm no, phone..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }} />
        </Grid>
        <Grid item xs={4} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Grade</InputLabel>
            <Select value={filterGrade} label="Grade"
              onChange={e => setFilterGrade(e.target.value)}>
              <MenuItem value="All">All</MenuItem>
              {GRADES.map(g => <MenuItem key={g} value={g}>G{g}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Section</InputLabel>
            <Select value={filterSection} label="Section"
              onChange={e => setFilterSection(e.target.value)}>
              <MenuItem value="All">All</MenuItem>
              {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} label="Status"
              onChange={e => setFilterStatus(e.target.value)}>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <Button fullWidth variant="outlined" size="small"
            onClick={() => navigate("/students/by-subject")}
            sx={{ height: "40px" }}>
            By Subject
          </Button>
        </Grid>
      </Grid>

      {loading ? <CircularProgress /> : (
        <>
          {isMobile ? (
            <Box>
              {paginated.map(s => (
                <Card key={s.id} sx={{
                  mb: 1.5, boxShadow: 2,
                  opacity: s.status === "left" ? 0.7 : 1,
                  border: s.status === "left"
                    ? "1px solid #ef9a9a" : "1px solid #e0e0e0"
                }}>
                  <CardContent sx={{ pb: 0 }}>
                    <Box display="flex" justifyContent="space-between"
                      alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adm: {s.admissionNo} • {s.gender}
                        </Typography>
                        {s.phone && (
                          <Typography variant="caption" color="text.secondary"
                            display="block">
                            📞 {s.phone}
                          </Typography>
                        )}
                      </Box>
                      <Box display="flex" flexDirection="column"
                        alignItems="flex-end" gap={0.5}>
                        <Chip label={`G${s.grade}-${s.section}`}
                          size="small" color="primary" />
                        {s.status && s.status !== "active" && (
                          <Chip label={s.status} size="small"
                            color={getStatusColor(s.status)} />
                        )}
                      </Box>
                    </Box>
                    {s.status === "left" && s.leftDate && (
                      <Typography variant="caption" color="error">
                        Left: {s.leftDate}{s.leftReason ? ` — ${s.leftReason}` : ""}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 0.5, flexWrap: "wrap" }}>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />}
                      onClick={() => handleEdit(s)}>Edit</Button>
                    <Button size="small" variant="outlined" color="info"
                      startIcon={<BadgeIcon />}
                      onClick={() => openIdCard(s)}>ID</Button>
                    <Button size="small" variant="outlined" color="success"
                      startIcon={<AssessmentIcon />}
                      onClick={() => navigate(`/report/${s.id}`)}>Report</Button>
                    {s.status === "active" && (
                      <Button size="small" variant="outlined" color="warning"
                        startIcon={<ExitToAppIcon />}
                        onClick={() => openLeftDialog(s)}>Left</Button>
                    )}
                    {s.status === "left" && (
                      <Button size="small" variant="outlined" color="success"
                        onClick={() => handleRestoreStudent(s)}>Restore</Button>
                    )}
                    <IconButton size="small" color="error"
                      onClick={() => handleDelete(s.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              ))}
              {filtered.length === 0 && (
                <Typography align="center" color="text.secondary" mt={3}>
                  No students found.
                </Typography>
              )}
            </Box>
          ) : (
            <Paper sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1a237e" }}>
                  <TableRow>
                    {["#", "Adm No", "Name", "Grade", "Phone",
                      "Parent", "Religion", "Status", "Actions"].map(h => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginated.map((s, idx) => (
                    <TableRow key={s.id} hover sx={{
                      opacity: s.status === "left" ? 0.65 : 1,
                      bgcolor: s.status === "left" ? "#fff8f8" : "inherit"
                    }}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{s.admissionNo}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {s.name}
                        </Typography>
                        {s.address && (
                          <Typography variant="caption" color="text.secondary">
                            {s.address}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={`G${s.grade}-${s.section}`}
                          size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{s.phone || "—"}</Typography>
                        {s.parentPhone && (
                          <Typography variant="caption" color="text.secondary">
                            P: {s.parentPhone}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{s.parentName || "—"}</TableCell>
                      <TableCell>{s.religion || "—"}</TableCell>
                      <TableCell>
                        <Chip label={s.status || "active"} size="small"
                          color={getStatusColor(s.status || "active")} />
                        {s.status === "left" && s.leftDate && (
                          <Typography variant="caption" display="block" color="error">
                            {s.leftDate}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Edit">
                          <IconButton size="small" color="primary"
                            onClick={() => handleEdit(s)}><EditIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="ID Card">
                          <IconButton size="small" color="info"
                            onClick={() => openIdCard(s)}><BadgeIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="Report Card">
                          <IconButton size="small" color="success"
                            onClick={() => navigate(`/report/${s.id}`)}>
                            <AssessmentIcon /></IconButton>
                        </Tooltip>
                        {s.status === "active" && (
                          <Tooltip title="Mark as Left">
                            <IconButton size="small" color="warning"
                              onClick={() => openLeftDialog(s)}>
                              <ExitToAppIcon /></IconButton>
                          </Tooltip>
                        )}
                        {s.status === "left" && (
                          <Tooltip title="Restore Student">
                            <Button size="small" variant="text" color="success"
                              onClick={() => handleRestoreStudent(s)}>
                              Restore
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error"
                            onClick={() => handleDelete(s.id)}>
                            <DeleteIcon /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        No students found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          <TablePagination
            component="div" count={filtered.length} page={page}
            onPageChange={(e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => {
              setRowsPerPage(+e.target.value); setPage(0);
            }}
            rowsPerPageOptions={isMobile ? [5, 10] : [10, 25, 50]} />
        </>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)}
        maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          {editId ? "Edit Student" : "Add New Student"}
        </DialogTitle>
        <Tabs value={formTab} onChange={(e, v) => setFormTab(v)} sx={{ px: 2 }}>
          <Tab label="Basic Info" />
          <Tab label="Contact" />
          <Tab label="Subjects" />
        </Tabs>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

          {formTab === 0 && (
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12}>
                <TextField fullWidth label="Full Name *" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Admission Number *"
                  value={form.admissionNo}
                  onChange={e => setForm({ ...form, admissionNo: e.target.value })} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Grade</InputLabel>
                  <Select value={form.grade} label="Grade"
                    onChange={e => setForm({ ...form, grade: e.target.value })}>
                    {GRADES.map(g => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Section</InputLabel>
                  <Select value={form.section} label="Section"
                    onChange={e => setForm({ ...form, section: e.target.value })}>
                    {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Gender</InputLabel>
                  <Select value={form.gender} label="Gender"
                    onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Date of Birth" type="date"
                  value={form.dob}
                  onChange={e => setForm({ ...form, dob: e.target.value })}
                  InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>
          )}

          {formTab === 1 && (
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Student Phone" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Parent/Guardian Name"
                  value={form.parentName}
                  onChange={e => setForm({ ...form, parentName: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Parent Phone" value={form.parentPhone}
                  onChange={e => setForm({ ...form, parentPhone: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" multiline rows={2}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })} />
              </Grid>
            </Grid>
          )}

          {formTab === 2 && (
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Religion Subject</InputLabel>
                  <Select value={form.religion} label="Religion Subject"
                    onChange={e => setForm({ ...form, religion: e.target.value })}>
                    {RELIGIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Aesthetic Subject</InputLabel>
                  <Select value={form.aesthetic} label="Aesthetic Subject"
                    onChange={e => setForm({ ...form, aesthetic: e.target.value })}>
                    {AESTHETICS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  Religion and Aesthetic subjects will appear in
                  Marks Entry for this student.
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, flexWrap: "wrap", gap: 1 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>Cancel</Button>
          {formTab > 0 && (
            <Button onClick={() => setFormTab(f => f - 1)}
              fullWidth={isMobile}>← Back</Button>
          )}
          {formTab < 2 ? (
            <Button variant="contained" onClick={() => setFormTab(f => f + 1)}
              fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
              Next →
            </Button>
          ) : (
            <Button onClick={handleSave} variant="contained" disabled={saving}
              fullWidth={isMobile} sx={{ bgcolor: "#1a237e" }}>
              {saving ? <CircularProgress size={20} /> : editId ? "Update" : "Add Student"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Mark as Left Dialog ── */}
      <Dialog open={leftDialog} onClose={() => setLeftDialog(false)}
        maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#e65100", color: "white" }}>
          Mark Student as Left
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            <strong>{selectedStudent?.name}</strong> will be excluded from
            future marks entry and promotions. Records will be kept.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Left Date *" type="date"
                value={leftDate}
                onChange={e => setLeftDate(e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reason (optional)" multiline rows={2}
                value={leftReason}
                onChange={e => setLeftReason(e.target.value)}
                placeholder="e.g. Transferred to another school..." />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLeftDialog(false)}
            fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleMarkLeft} variant="contained" color="warning"
            disabled={!leftDate} fullWidth={isMobile}>
            Confirm Left
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── ID Card Dialog ── */}
      <Dialog open={idCardOpen} onClose={() => setIdCardOpen(false)}
        maxWidth="xs" fullWidth>
        <DialogTitle>
          Student ID Card
          <IconButton onClick={printIdCard} sx={{ float: "right" }}>
            <PrintIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box id="id-card-print">
            <Box sx={{
              border: "3px solid #1a237e", borderRadius: 3, p: 2.5,
              textAlign: "center", maxWidth: 320, mx: "auto"
            }}>
              <Typography variant="subtitle2" fontWeight={700} color="#1a237e">
                Kilinochchi Marks System
              </Typography>
              <Divider sx={{ my: 1, borderColor: "#1a237e" }} />
              <Box sx={{
                width: 70, height: 70, borderRadius: "50%",
                bgcolor: "#1a237e", mx: "auto", mb: 1,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Typography variant="h4" color="white" fontWeight={700}>
                  {selectedStudent?.name?.charAt(0)}
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={700}>
                {selectedStudent?.name}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1} textAlign="left">
                {[
                  ["Adm No",  selectedStudent?.admissionNo],
                  ["Grade",   `${selectedStudent?.grade}-${selectedStudent?.section}`],
                  ["Gender",  selectedStudent?.gender],
                  ["DOB",     selectedStudent?.dob || "—"],
                  ["Religion",selectedStudent?.religion || "—"],
                  ["Phone",   selectedStudent?.phone || "—"],
                  ["Parent",  selectedStudent?.parentName || "—"],
                  ["P.Phone", selectedStudent?.parentPhone || "—"],
                ].map(([label, value]) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ bgcolor: "#1a237e", borderRadius: 1, py: 0.5 }}>
                <Typography variant="caption" color="white">
                  Academic Year 2026
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIdCardOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />}
            onClick={printIdCard} sx={{ bgcolor: "#1a237e" }}>
            Print ID Card
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk Upload Dialog ── */}
      <Dialog open={bulkOpen} onClose={() => {
        setBulkOpen(false); setBulkData([]);
        setBulkErrors([]); setBulkSuccess("");
      }} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white" }}>
          <UploadFileIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Bulk Upload Students
        </DialogTitle>
        <DialogContent>
          <Box mt={2}>

            {/* Download Template */}
            <Alert severity="info" sx={{ mb: 2 }}
              action={
                <Button size="small" color="inherit" variant="outlined"
                  onClick={downloadTemplate}>
                  ⬇ Template
                </Button>
              }>
              Download the Excel template, fill student details, then upload here.
            </Alert>

            {/* File Drop Zone */}
            <Box sx={{
              border: "2px dashed #1a237e", borderRadius: 2,
              p: 3, textAlign: "center", bgcolor: "#f8f9ff", mb: 2
            }}>
              <UploadFileIcon sx={{ fontSize: 40, color: "#1a237e", mb: 1 }} />
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Select your filled Excel file (.xlsx / .xls)
              </Typography>
              <Button variant="contained" component="label"
                sx={{ bgcolor: "#1a237e" }}>
                Choose File
                <input type="file" hidden accept=".xlsx,.xls"
                  onChange={handleFileUpload} />
              </Button>
            </Box>

            {/* Errors */}
            {bulkErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                  ❌ Fix these errors before uploading:
                </Typography>
                {bulkErrors.map((e, i) => (
                  <Typography key={i} variant="caption" display="block">
                    • {e}
                  </Typography>
                ))}
              </Alert>
            )}

            {/* Success */}
            {bulkSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>{bulkSuccess}</Alert>
            )}

            {/* Preview Table */}
            {bulkData.length > 0 && bulkErrors.length === 0 && (
              <>
                <Alert severity="success" sx={{ mb: 1 }}>
                  ✅ <strong>{bulkData.length} students</strong> ready to upload.
                  Review below before confirming.
                </Alert>
                <Paper sx={{ maxHeight: 280, overflow: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#1a237e" }}>
                        {["#", "Adm No", "Name", "Grade",
                          "Section", "Gender", "Religion", "Aesthetic"].map(h => (
                          <TableCell key={h} sx={{
                            bgcolor: "#1a237e", color: "white",
                            fontWeight: 600, fontSize: 12
                          }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bulkData.map((s, i) => (
                        <TableRow key={i} hover
                          sx={{ bgcolor: i % 2 === 0 ? "white" : "#f8f9ff" }}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{s.admissionNo}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {s.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{s.grade}</TableCell>
                          <TableCell>{s.section}</TableCell>
                          <TableCell>{s.gender}</TableCell>
                          <TableCell>{s.religion}</TableCell>
                          <TableCell>{s.aesthetic}</TableCell>
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
          <Button onClick={() => {
            setBulkOpen(false); setBulkData([]);
            setBulkErrors([]); setBulkSuccess("");
          }} fullWidth={isMobile}>
            Close
          </Button>
          <Button variant="contained"
            onClick={handleBulkUpload}
            disabled={bulkData.length === 0 ||
              bulkErrors.length > 0 || bulkUploading}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}>
            {bulkUploading
              ? <CircularProgress size={20} color="inherit" />
              : `Upload ${bulkData.length} Students`}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}