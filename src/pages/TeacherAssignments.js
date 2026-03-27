import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  GRADES, SECTIONS, getStudentSubjects,
  AESTHETIC_SUBJECTS, BASKET_1, BASKET_2, BASKET_3,
  COMPULSORY_SUBJECTS_10_11, SUBJECTS_BY_GRADE
} from "../constants";
import {
  Box, Typography, Button, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, IconButton,
  CircularProgress, Alert, Grid, Chip, Tooltip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Checkbox, FormGroup, FormControlLabel, Divider, Avatar,
  Accordion, AccordionSummary, AccordionDetails,
  useMediaQuery, useTheme, Badge
} from "@mui/material";
import AddIcon         from "@mui/icons-material/Add";
import DeleteIcon      from "@mui/icons-material/Delete";
import PersonIcon      from "@mui/icons-material/Person";
import EditIcon        from "@mui/icons-material/Edit";
import ExpandMoreIcon  from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon        from "@mui/icons-material/Save";

const getSubjectsForGrade = (g) => {
  if (g >= 6 && g <= 9) {
    const dummy = { grade: g, religion: "Hindu", aesthetic: "Art" };
    const compulsory = getStudentSubjects(dummy).slice(0, -1);
    return [...new Set([...compulsory, ...AESTHETIC_SUBJECTS])];
  }
  if (g >= 10 && g <= 11) {
    return [...COMPULSORY_SUBJECTS_10_11, ...BASKET_1, ...BASKET_2, ...BASKET_3];
  }
  return SUBJECTS_BY_GRADE[g] || [];
};

const getAvatarColor = (name) => {
  const colors = ["#1a237e","#1565c0","#0277bd","#00695c",
                  "#2e7d32","#6a1b9a","#880e4f","#e65100"];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function TeacherAssignments() {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [teachers, setTeachers]       = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");

  // ── Dialog state ──
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Selected combos: Set of "grade-section-subject" strings
  const [selectedCombos, setSelectedCombos] = useState(new Set());

  // Filter inside dialog
  const [filterGrade, setFilterGrade]     = useState("all");
  const [filterSection, setFilterSection] = useState("all");

  const fetchAll = async () => {
    setLoading(true);
    const [tSnap, aSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "assignments"))
    ]);
    setTeachers(
      tSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "teacher" && (u.status || "active") === "active")
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Open dialog for a teacher ──
  const openDialog = (teacher) => {
    setSelectedTeacher(teacher);
    setError(""); setSuccess("");
    setFilterGrade("all"); setFilterSection("all");

    // Pre-select their existing assignments
    const existing = assignments
      .filter(a => a.teacherId === teacher.id)
      .map(a => `${a.grade}-${a.section}-${a.subject}`);
    setSelectedCombos(new Set(existing));
    setDialogOpen(true);
  };

  // ── Toggle a single combo ──
  const toggleCombo = (key) => {
    setSelectedCombos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Select/deselect all for a grade-section ──
  const toggleAll = (grade, section) => {
    const subs = getSubjectsForGrade(grade);
    const keys = subs.map(s => `${grade}-${section}-${s}`);
    const allSelected = keys.every(k => selectedCombos.has(k));
    setSelectedCombos(prev => {
      const next = new Set(prev);
      if (allSelected) keys.forEach(k => next.delete(k));
      else             keys.forEach(k => next.add(k));
      return next;
    });
  };

  // ── Save: add new + remove deleted ──
  const handleSave = async () => {
    if (!selectedTeacher) return;
    setSaving(true); setError("");
    try {
      const existing = assignments.filter(a => a.teacherId === selectedTeacher.id);
      const existingKeys = existing.map(a => `${a.grade}-${a.section}-${a.subject}`);

      // Keys to add (in selectedCombos but not in existing)
      const toAdd = [...selectedCombos].filter(k => !existingKeys.includes(k));

      // Keys to remove (in existing but not in selectedCombos)
      const toRemove = existing.filter(
        a => !selectedCombos.has(`${a.grade}-${a.section}-${a.subject}`)
      );

      // Check conflicts: another teacher already has this combo
      const conflicts = [];
      for (const key of toAdd) {
        const [g, s, ...subParts] = key.split("-");
        const sub = subParts.join("-");
        const conflict = assignments.find(a =>
          a.grade   === Number(g) &&
          a.section === s &&
          a.subject === sub &&
          a.teacherId !== selectedTeacher.id
        );
        if (conflict) {
          const ct = teachers.find(t => t.id === conflict.teacherId);
          conflicts.push(`${sub} (G${g}-${s}) already assigned to ${ct?.name || "another teacher"}`);
        }
      }

      if (conflicts.length > 0) {
        setError("⚠️ Conflicts:\n" + conflicts.join("\n"));
        setSaving(false);
        return;
      }

      // Add new assignments
      await Promise.all(toAdd.map(key => {
        const [g, s, ...subParts] = key.split("-");
        const sub = subParts.join("-");
        return addDoc(collection(db, "assignments"), {
          teacherId:   selectedTeacher.id,
          teacherName: selectedTeacher.name,
          grade:       Number(g),
          section:     s,
          subject:     sub,
          createdAt:   new Date().toISOString(),
        });
      }));

      // Remove deleted assignments
      await Promise.all(toRemove.map(a => deleteDoc(doc(db, "assignments", a.id))));

      setSuccess(
        `✅ ${selectedTeacher.name}: +${toAdd.length} added, -${toRemove.length} removed`
      );
      setDialogOpen(false);
      fetchAll();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleDeleteSingle = async (id) => {
    if (!window.confirm("Remove this assignment?")) return;
    await deleteDoc(doc(db, "assignments", id));
    fetchAll();
  };

  // ── Grouped for display ──
  const groupedByTeacher = teachers.map(t => ({
    ...t,
    assignments: assignments
      .filter(a => a.teacherId === t.id)
      .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
  }));

  // All combos for unassigned count
  const allCombos = [];
  GRADES.forEach(g => SECTIONS.forEach(s =>
    getSubjectsForGrade(g).forEach(sub => allCombos.push({ grade: g, section: s, subject: sub }))
  ));
  const assignedKeys = assignments.map(a => `${a.grade}-${a.section}-${a.subject}`);
  const unassignedCount = allCombos.filter(
    c => !assignedKeys.includes(`${c.grade}-${c.section}-${c.subject}`)
  ).length;

  // ── Dialog: build visible combos based on filter ──
  const visibleGrades   = filterGrade   === "all" ? GRADES   : [Number(filterGrade)];
  const visibleSections = filterSection === "all" ? SECTIONS : [filterSection];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} color="#1a237e">
            Teacher Assignments
          </Typography>
          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            <Chip label={`${assignments.length} Assignments`} size="small" color="primary" />
            <Chip label={`${teachers.length} Teachers`}       size="small" color="success" />
            <Chip label={`${unassignedCount} Unassigned`}     size="small"
              color={unassignedCount > 0 ? "warning" : "default"} />
          </Box>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* ── Teacher Cards — Click to Assign ── */}
      <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1}>
        👆 Click a teacher to manage their assignments
      </Typography>

      {loading ? <CircularProgress /> : (
        <>
          <Grid container spacing={1.5} mb={3}>
            {teachers.map(t => {
              const count = assignments.filter(a => a.teacherId === t.id).length;
              return (
                <Grid item xs={12} sm={6} md={4} key={t.id}>
                  <Card onClick={() => openDialog(t)} sx={{
                    cursor: "pointer", borderRadius: 3,
                    border: count > 0 ? "2px solid #1a237e" : "2px dashed #bdbdbd",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
                    transition: "all 0.2s",
                    "&:hover": {
                      boxShadow: "0 4px 20px rgba(26,35,126,0.18)",
                      transform: "translateY(-2px)"
                    }
                  }}>
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Badge badgeContent={count} color="primary"
                          max={99}
                          anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                          <Avatar sx={{
                            bgcolor: getAvatarColor(t.name),
                            width: 44, height: 44, fontSize: 18, fontWeight: 700
                          }}>
                            {t.name?.charAt(0)}
                          </Avatar>
                        </Badge>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="subtitle2" fontWeight={700} noWrap>
                            {t.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {t.email}
                          </Typography>
                          <Box mt={0.5}>
                            {count > 0 ? (
                              <Chip label={`${count} subjects assigned`}
                                size="small" color="primary" variant="outlined"
                                sx={{ fontSize: 10 }} />
                            ) : (
                              <Chip label="No assignments yet"
                                size="small" color="warning" variant="outlined"
                                sx={{ fontSize: 10 }} />
                            )}
                          </Box>
                        </Box>
                        <EditIcon sx={{ color: "#1a237e", opacity: 0.5 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* ── Current Assignments Table ── */}
          {assignments.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="#1a237e" mb={1.5}>
                📋 All Assignments
              </Typography>
              {isMobile ? (
                groupedByTeacher.filter(t => t.assignments.length > 0).map(t => (
                  <Card key={t.id} sx={{
                    mb: 1.5, borderRadius: 3,
                    border: "1px solid #e8eaf6",
                    boxShadow: "0 2px 8px rgba(26,35,126,0.08)"
                  }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Box display="flex" justifyContent="space-between"
                        alignItems="center" mb={1}>
                        <Typography variant="subtitle2" fontWeight={700} color="#1a237e">
                          👤 {t.name}
                        </Typography>
                        <Button size="small" variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => openDialog(t)}>
                          Edit
                        </Button>
                      </Box>
                      {t.assignments.map(a => (
                        <Box key={a.id}
                          display="flex" justifyContent="space-between"
                          alignItems="center" py={0.5}
                          sx={{ borderBottom: "1px solid #f0f0f0" }}>
                          <Box display="flex" gap={0.8} flexWrap="wrap"
                            alignItems="center">
                            <Chip label={`G${a.grade}-${a.section}`}
                              size="small" color="primary" />
                            <Typography variant="body2">{a.subject}</Typography>
                          </Box>
                          <IconButton size="small" color="error"
                            onClick={() => handleDeleteSingle(a.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Paper sx={{ borderRadius: 3, overflow: "hidden",
                  boxShadow: "0 2px 12px rgba(26,35,126,0.08)" }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#1a237e" }}>
                      <TableRow>
                        {["#","Teacher","Grade","Section","Subject","Action"].map(h => (
                          <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assignments
                        .sort((a, b) => a.grade - b.grade ||
                          a.section.localeCompare(b.section))
                        .map((a, idx) => (
                        <TableRow key={a.id} hover
                          sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {a.teacherName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={`Grade ${a.grade}`}
                              size="small" color="primary" />
                          </TableCell>
                          <TableCell>{a.section}</TableCell>
                          <TableCell>{a.subject}</TableCell>
                          <TableCell>
                            <Tooltip title="Remove">
                              <IconButton size="small" color="error"
                                onClick={() => handleDeleteSingle(a.id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Box>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
          MULTI-SELECT ASSIGNMENT DIALOG
      ══════════════════════════════════════ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}
        maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", pb: 1.5 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{
              bgcolor: selectedTeacher ? getAvatarColor(selectedTeacher.name) : "#fff",
              width: 36, height: 36, fontSize: 16, fontWeight: 700,
              border: "2px solid white"
            }}>
              {selectedTeacher?.name?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {selectedTeacher?.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Select subjects to assign — tick/untick freely
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>

          {/* Filter Bar */}
          <Box sx={{ p: 2, bgcolor: "#f5f5f5",
            borderBottom: "1px solid #e0e0e0",
            display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="body2" fontWeight={700} color="#1a237e">
              Filter:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Grade</InputLabel>
              <Select value={filterGrade} label="Grade"
                onChange={e => setFilterGrade(e.target.value)}>
                <MenuItem value="all">All Grades</MenuItem>
                {GRADES.map(g => (
                  <MenuItem key={g} value={g}>Grade {g}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Section</InputLabel>
              <Select value={filterSection} label="Section"
                onChange={e => setFilterSection(e.target.value)}>
                <MenuItem value="all">All Sections</MenuItem>
                {SECTIONS.map(s => (
                  <MenuItem key={s} value={s}>Section {s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip
              icon={<CheckCircleIcon />}
              label={`${selectedCombos.size} selected`}
              color="primary" size="small" />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mx: 2, mt: 1 }}
              onClose={() => setError("")}>
              {error.split("\n").map((line, i) => (
                <Typography key={i} variant="caption" display="block">
                  {line}
                </Typography>
              ))}
            </Alert>
          )}

          {/* Grade-Section Accordions */}
          <Box sx={{ maxHeight: isMobile ? "60vh" : 480,
            overflowY: "auto", p: 1 }}>
            {visibleGrades.map(g => (
              visibleSections.map(s => {
                const subs = getSubjectsForGrade(g);
                const keys = subs.map(sub => `${g}-${s}-${sub}`);
                const selectedCount = keys.filter(k => selectedCombos.has(k)).length;
                const allSel = selectedCount === subs.length;
                const someSel = selectedCount > 0 && !allSel;

                // Check which are taken by OTHER teachers
                const takenMap = {};
                subs.forEach(sub => {
                  const taken = assignments.find(a =>
                    a.grade   === g &&
                    a.section === s &&
                    a.subject === sub &&
                    a.teacherId !== selectedTeacher?.id
                  );
                  if (taken) takenMap[sub] = taken.teacherName;
                });

                return (
                  <Accordion key={`${g}-${s}`} defaultExpanded={
                    filterGrade !== "all" || filterSection !== "all"
                  }
                    sx={{ mb: 0.5, borderRadius: "8px !important",
                      "&:before": { display: "none" },
                      border: selectedCount > 0
                        ? "1px solid #1a237e" : "1px solid #e0e0e0"
                    }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}
                      sx={{
                        bgcolor: selectedCount > 0 ? "#e8eaf6" : "#fafafa",
                        borderRadius: 2, minHeight: 48,
                        "& .MuiAccordionSummary-content": { my: 0.5 }
                      }}>
                      <Box display="flex" alignItems="center"
                        gap={1} width="100%">
                        <Checkbox
                          checked={allSel}
                          indeterminate={someSel}
                          onChange={() => toggleAll(g, s)}
                          onClick={e => e.stopPropagation()}
                          size="small"
                          sx={{ p: 0.5, color: "#1a237e",
                            "&.Mui-checked": { color: "#1a237e" } }}
                        />
                        <Typography variant="body2" fontWeight={700}>
                          Grade {g} — Section {s}
                        </Typography>
                        {selectedCount > 0 && (
                          <Chip label={`${selectedCount}/${subs.length}`}
                            size="small" color="primary"
                            sx={{ ml: "auto", mr: 1 }} />
                        )}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0.5, pb: 1.5, px: 2 }}>
                      <FormGroup>
                        <Grid container>
                          {subs.map(sub => {
                            const key    = `${g}-${s}-${sub}`;
                            const isSelected = selectedCombos.has(key);
                            const takenBy    = takenMap[sub];
                            return (
                              <Grid item xs={12} sm={6} key={sub}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={() => !takenBy && toggleCombo(key)}
                                      size="small"
                                      disabled={!!takenBy}
                                      sx={{
                                        color: "#1a237e",
                                        "&.Mui-checked": { color: "#1a237e" }
                                      }}
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography variant="body2"
                                        sx={{
                                          color: takenBy ? "#bdbdbd" : "inherit",
                                          fontWeight: isSelected ? 600 : 400
                                        }}>
                                        {sub}
                                      </Typography>
                                      {takenBy && (
                                        <Typography variant="caption"
                                          color="error" sx={{ fontSize: 10 }}>
                                          ⛔ Taken by {takenBy}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                  sx={{ mb: 0.3 }}
                                />
                              </Grid>
                            );
                          })}
                        </Grid>
                      </FormGroup>
                    </AccordionDetails>
                  </Accordion>
                );
              })
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: "#fafafa",
          borderTop: "1px solid #e0e0e0", gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}
            fullWidth={isMobile}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
          }
            onClick={handleSave} disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e" }}>
            {saving ? "Saving..." : `Save ${selectedCombos.size} Assignments`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}