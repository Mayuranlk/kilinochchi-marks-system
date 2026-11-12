import { academicDisplay } from "../utils/academicDisplay";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { PageContainer, EmptyState } from "../components/ui";
import { getCollectionRows } from "../services/firestoreReadCache";
import { loadSbaRecords, loadSbaRosterData, loadSbaSettings, saveSbaChanges, saveSbaSettings } from "../services/sbaService";
import { activeSbaRow, buildSbaRegister, buildSbaRoster, indexSbaRosterData, parseSbaValue, sbaClassKey, sbaEntryLocked, sbaRecordId, sbaScopeKey, sbaYear } from "../utils/sbaLogic";
import { buildTermLabel, getDisplayClassName, isActiveTerm, isSameTeacher } from "../utils/sbaContext";
import { buildSbaRegisterHtml, printSbaRegister } from "../utils/sbaRegisterPrint";

import { createSbaRegisterPdf, canShareSbaPdf, downloadSbaPdf } from "../utils/sbaRegisterPdf";

const emptyData = { assignments: [], terms: [], enrollments: [], students: [] };
const valueOf = (record) => ({ mark: record?.mark ?? "", absent: record?.absent === true });
const sameValue = (left, right) => String(left.mark) === String(right.mark) && left.absent === right.absent;

export default function SBAMarks({ registerMode = false }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [base, setBase] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [baseError, setBaseError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [termId, setTermId] = useState("");
  const [classKey, setClassKey] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [loaded, setLoaded] = useState({ key: "", records: [], error: "" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [pdfDialog, setPdfDialog] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const loadVersion = useRef(0);
  const forceRosterRefresh = useRef(false);
  const inputRefs = useRef({});
  const dirty = Object.keys(drafts).length > 0;
  const busy = loading || saving;
  const settingsDirty = settings && settingsDraft && JSON.stringify(settings) !== JSON.stringify(settingsDraft);

  const loadBase = useCallback(async (forceRefresh = false) => {
    const version = ++loadVersion.current;
    forceRosterRefresh.current = forceRefresh;
    setLoading(true); setBaseError(""); setError("");
    try {
      const [assignments, terms, controls] = await Promise.all([
        getCollectionRows(db, "teacherAssignments", { forceRefresh }),
        getCollectionRows(db, "academicTerms", { forceRefresh }),
        loadSbaSettings(),
      ]);
      if (version !== loadVersion.current) return;
      const termOptions = terms.filter((term) => String(term.assessmentType || "").toLowerCase() !== "practice" && !/practice/i.test(term.term || term.termName || term.name || ""))
        .sort((a, b) => sbaYear(b).localeCompare(sbaYear(a)) || buildTermLabel(a).localeCompare(buildTermLabel(b), undefined, { numeric: true }));
      setBase({ assignments: assignments.filter(activeSbaRow), terms: termOptions, enrollments: [], students: [] });
      setSettings(controls); setSettingsDraft(controls);
      setTermId((previous) => termOptions.some((term) => term.id === previous) ? previous : (termOptions.find(isActiveTerm) || termOptions[0])?.id || "");
      setRefreshVersion((value) => value + 1);
    } catch (failure) {
      if (version === loadVersion.current) { setBaseError(`Could not load SBA: ${failure.message}`); setSettings(null); }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => { loadBase(); return () => { loadVersion.current += 1; }; }, [loadBase]);

  const term = useMemo(() => base.terms.find((item) => item.id === termId), [base.terms, termId]);
  const yearAssignments = useMemo(() => base.assignments.filter((item) => !sbaYear(item) || sbaYear(item) === sbaYear(term || {})), [base.assignments, term]);
  const mine = useMemo(() => yearAssignments.filter((item) => isAdmin || isSameTeacher(item, user)), [yearAssignments, isAdmin, user]);
  const classes = useMemo(() => [...new Map(mine.map((item) => [sbaClassKey(item), item])).entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })), [mine]);
  useEffect(() => { if (!classes.some(([key]) => key === classKey)) setClassKey(classes[0]?.[0] || ""); }, [classes, classKey]);
  const classAssignment = classes.find(([key]) => key === classKey)?.[1];
  const options = useMemo(() => mine.filter((item) => sbaClassKey(item) === classKey && item.subjectId), [mine, classKey]);
  const classAssignments = useMemo(() => yearAssignments.filter((item) => sbaClassKey(item) === classKey), [yearAssignments, classKey]);
  useEffect(() => { if (!options.some((item) => item.id === assignmentId)) setAssignmentId(options[0]?.id || ""); }, [options, assignmentId]);
  const assignment = options.find((item) => item.id === assignmentId);
  const scopeKey = term && classAssignment ? sbaScopeKey(term, classAssignment) : "";
  const rosterSubjects = JSON.stringify([...new Set((registerMode ? classAssignments : [assignment]).filter(Boolean).map((item) => item.subjectId).filter(Boolean))].sort());
  const readKey = scopeKey && rosterSubjects !== "[]" ? `${scopeKey}|${rosterSubjects}|${registerMode}` : "";
  useEffect(() => {
    let cancelled = false;
    setLoaded({ key: "", records: [], error: "" });
    if (readKey && !loading && !baseError) {
      const [selectedTerm, selectedClass] = [term, classAssignment];
      Promise.all([
        loadSbaRecords(selectedTerm, selectedClass, registerMode ? "" : assignment.subjectId),
        loadSbaRosterData(JSON.parse(rosterSubjects), selectedTerm, selectedClass, { forceRefresh: forceRosterRefresh.current }),
      ]).then(([records, rosterData]) => {
        if (!cancelled) forceRosterRefresh.current = false;
        if (!cancelled) setLoaded({ key: readKey, records, ...rosterData, error: "" });
      }).catch((failure) => {
        if (!cancelled) setLoaded({ key: readKey, records: [], error: `Could not load SBA marks: ${failure.message}` });
      });
    }
    return () => { cancelled = true; };
    // term and classAssignment are represented by scopeKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readKey, refreshVersion, loading, baseError]);
  useEffect(() => { setDrafts({}); setError(""); setSuccess(""); }, [scopeKey, assignmentId, registerMode]);
  useEffect(() => { setSettingsDraft(settings); }, [settings, registerMode]);
  const ready = Boolean(readKey && loaded.key === readKey && !loaded.error && !baseError && !loading);
  const locked = !isAdmin && (!settings || sbaEntryLocked(settings));
  const canEdit = ready && !saving && !locked && !registerMode;
  const rosterIndex = useMemo(() => indexSbaRosterData(loaded.students || [], loaded.enrollments || []), [loaded.students, loaded.enrollments]);
  const roster = useMemo(() => buildSbaRoster({ assignment, term, index: rosterIndex }), [assignment, term, rosterIndex]);
  const recordsByStudent = useMemo(() => new Map(loaded.records.filter((record) => record.subjectId === assignment?.subjectId).map((record) => [record.studentId, record])), [loaded.records, assignment]);
  const register = useMemo(() => registerMode && term ? buildSbaRegister({ assignments: classAssignments, term, index: rosterIndex, records: loaded.records }) : { columns: [], rows: [] }, [registerMode, term, classAssignments, rosterIndex, loaded.records]);
  const registerHtml = useMemo(() => buildSbaRegisterHtml({ register, classLabel: classAssignment ? getDisplayClassName(classAssignment) : "", year: sbaYear(term || {}), termName: term?.term || term?.termName || term?.name || "", fontUrl: new URL(`${process.env.PUBLIC_URL || ""}/fonts/NotoSansTamil.ttf`, window.location.origin).href }), [register, classAssignment, term]);

  useEffect(() => {
    if (!dirty && !saving && !settingsDirty) return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (event) => {
      if (saving || !window.confirm(academicDisplay("Leave SBA and discard unsaved changes?"))) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("app:before-navigate", beforeNavigate);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("app:before-navigate", beforeNavigate); };
  }, [dirty, saving, settingsDirty]);

  function updateRow(studentId, patch) {
    if (!canEdit) return;
    setSuccess("");
    setDrafts((previous) => {
      const original = valueOf(recordsByStudent.get(studentId));
      const next = { ...previous, [studentId]: { ...(previous[studentId] || original), ...patch } };
      if (sameValue(next[studentId], original)) delete next[studentId];
      return next;
    });
  }
  async function saveRows(removeRow = null) {
    if (!canEdit || !assignment) return;
    setError(""); setSuccess("");
    let changes;
    try {
      changes = (removeRow ? [removeRow] : roster.filter((row) => drafts[row.studentId])).map((row) => ({
        row, value: parseSbaValue((drafts[row.studentId] || valueOf(recordsByStudent.get(row.studentId))).mark, (drafts[row.studentId] || valueOf(recordsByStudent.get(row.studentId))).absent),
        previous: recordsByStudent.get(row.studentId), remove: Boolean(removeRow),
      }));
    } catch (failure) { setError(failure.message); return; }
    setSaving(true);
    try {
      const result = await saveSbaChanges({ term, assignment, uid: user.uid, isAdmin }, changes);
      setLoaded((previous) => {
        const map = new Map(previous.records.map((record) => [record.id, record]));
        result.saved.forEach((record) => record.deleted ? map.delete(record.id) : map.set(record.id, record));
        return { ...previous, records: [...map.values()] };
      });
      const savedIds = new Set(result.saved.map((record) => record.id));
      setDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([studentId]) => !savedIds.has(sbaRecordId(term.id, studentId, assignment.subjectId)))));
      if (result.failed.length) setError(`${result.failed.length} SBA record(s) could not be saved. ${result.failed[0].message} Your remaining edits are retained; discard them and refresh to resolve a conflict.`);
      if (result.saved.length) setSuccess(`${result.saved.length} SBA record(s) ${removeRow ? "deleted" : "saved"}.`);
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); setDeleteRow(null); }
  }
  async function saveControls() {
    setSaving(true); setError(""); setSuccess("");
    try { const next = await saveSbaSettings(settingsDraft, user.uid); setSettings(next); setSettingsDraft(next); setSuccess("SBA entry controls saved."); }
    catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  }
  async function preparePdf(mode) {
    setPdfDialog(mode); setPdfFile(null); setPdfBusy(true); setError("");
    try {
      const label = getDisplayClassName(classAssignment);
      const blob = await createSbaRegisterPdf({ register, classLabel: label, year: sbaYear(term), termName: term.term || term.termName || term.name || "" });
      const name = `SBA-${label}-${sbaYear(term)}-${term.term || term.termName || term.name || "term"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
      setPdfFile(new File([blob], `${name}.pdf`, { type: "application/pdf" }));
    } catch (failure) { setError(`Could not create SBA PDF: ${failure.message}`); setPdfDialog(null); }
    finally { setPdfBusy(false); }
  }
  async function sharePdf() {
    setShareBusy(true);
    try { await navigator.share({ files: [pdfFile], title: "SBA Class Register" }); }
    catch (failure) { if (failure.name !== "AbortError") setError("Sharing is unavailable. Use Download PDF and attach the file manually."); }
    finally { setShareBusy(false); }
  }
  function openMode() {
    if (!window.dispatchEvent(new Event("app:before-navigate", { cancelable: true }))) return;
    navigate(`${isAdmin ? "" : "/teacher"}/${registerMode ? "sba-marks" : "sba-register"}`);
  }
  const selector = (label, value, onChange, items) => <FormControl size="small" sx={{ minWidth: 220, flex: 1 }} disabled={busy || dirty || settingsDirty}>
    <InputLabel>{academicDisplay(label)}</InputLabel><Select label={academicDisplay(label)} value={items.some((item) => item.value === value) ? value : ""} onChange={(event) => onChange(event.target.value)}>{items.map((item) => <MenuItem key={item.value} value={item.value}>{academicDisplay(item.label)}</MenuItem>)}</Select>
  </FormControl>;

  return <PageContainer title={academicDisplay(registerMode ? "SBA Class Register" : "SBA Marks Entry")} subtitle={academicDisplay(registerMode ? "A3 landscape register · Final school-based assessment marks out of 20" : "Enter final SBA marks for your assigned classes and subjects.")}>
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" onClick={openMode} disabled={saving}>{registerMode ? "Enter SBA marks" : "A3 class register"}</Button>
        <Button onClick={() => { if (window.dispatchEvent(new Event("app:before-navigate", { cancelable: true }))) navigate(`${isAdmin ? "" : "/teacher"}/sba`); }} disabled={saving}>Blank assessment sheet</Button>
        <Button onClick={() => loadBase(true)} disabled={busy || dirty || settingsDirty}>Refresh</Button>
      </Stack>
      {baseError && <Alert severity="error">{academicDisplay(baseError)}</Alert>}
      {loaded.error && <Alert severity="error">{academicDisplay(loaded.error)}</Alert>}
      {error && <Alert severity="error">{academicDisplay(error)}</Alert>}
      {success && <Alert severity="success">{academicDisplay(success)}</Alert>}
      {locked && !loading && <Alert severity="info">SBA entry is closed. You can view saved SBA marks and print the register.</Alert>}
      {isAdmin && settingsDraft && !registerMode && <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
        <Typography fontWeight={700}>SBA entry controls</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <FormControlLabel control={<Switch checked={settingsDraft.teacherEntryEnabled} onChange={(event) => setSettingsDraft({ ...settingsDraft, teacherEntryEnabled: event.target.checked })} disabled={saving || dirty} />} label="Teachers can enter SBA marks" />
          <TextField type="date" label="SBA deadline (Sri Lanka time)" size="small" slotProps={{ inputLabel: { shrink: true } }} value={settingsDraft.teacherEntryDeadline} onChange={(event) => setSettingsDraft({ ...settingsDraft, teacherEntryDeadline: event.target.value })} disabled={saving || dirty} />
          <Button onClick={saveControls} disabled={saving || dirty || !settingsDirty}>Save SBA controls</Button>
        </Stack>
      </Stack></Paper>}
      <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {selector("Academic term / year", termId, setTermId, base.terms.map((item) => ({ value: item.id, label: buildTermLabel(item) })))}
        {selector("Class", classKey, setClassKey, classes.map(([key, item]) => ({ value: key, label: getDisplayClassName(item) })))}
        {!registerMode && selector("Assigned subject", assignmentId, setAssignmentId, options.map((item) => ({ value: item.id, label: `${item.subjectName || item.subject}${item.medium ? ` · ${item.medium}` : ""}${isAdmin && item.teacherName ? ` · ${item.teacherName}` : ""}` })))}
      </Stack></Paper>
      {mine.some((item) => !item.subjectId) && <Alert severity="warning">Some legacy assignments have no subject ID. Update those assignments before entering their SBA marks.</Alert>}
      {(loading || (readKey && loaded.key !== readKey && !baseError)) && <Box role="status" sx={{ py: 3, textAlign: "center" }}><CircularProgress size={26} /><Typography>Loading SBA…</Typography></Box>}
      {!loading && !baseError && !classes.length && <EmptyState title="No assigned classes" description="Create teacher subject assignments to use SBA." />}
      {ready && registerMode && (register.rows.length ? <>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Chip label={academicDisplay(`${register.rows.length} students`)} /><Chip label={academicDisplay(`${register.columns.length} subjects`)} /><Button variant="contained" onClick={() => printSbaRegister(registerHtml).catch((failure) => setError(failure.message))}>Print / Save A3 PDF</Button><Button variant="outlined" disabled={pdfBusy} onClick={() => preparePdf("share")}>Share PDF</Button><Button variant="outlined" disabled={pdfBusy} onClick={() => preparePdf("whatsapp")}>WhatsApp</Button></Stack>
        <Typography variant="body2" color="text.secondary">Grey cells = no matching active subject enrollment. White blank cells = marks pending. AB = Absent. 35 rows per page. Select A3 landscape and disable browser headers and footers when printing.</Typography>
        <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 2 }}><iframe title="SBA A3 register preview" srcDoc={registerHtml} sandbox="allow-same-origin" style={{ width: "100%", minWidth: 760, height: 780, border: 0 }} /></Box>
      </> : <EmptyState title="No enrolled students" description="Check the selected year and subject enrollments." />)}
      {ready && !registerMode && (roster.length ? <>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip label={academicDisplay(`${roster.length} students`)} /><Chip label={academicDisplay(`${roster.filter((row) => { const value = valueOf(recordsByStudent.get(row.studentId)); return value.absent || value.mark !== ""; }).length} recorded`)} /><Chip label="Maximum 20" /></Stack>
        <Typography variant="body2" color="text.secondary">Enter 0–20, or tick Absent. Blank means pending. Press Enter to move to the next student.</Typography>
        {dirty && <Alert severity="warning">{Object.keys(drafts).length} unsaved change(s). Save or discard before changing selections.</Alert>}
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}><Table size="small" stickyHeader aria-label="SBA marks entry" sx={{ "& .MuiTableCell-root": { px: { xs: 1, sm: 2 } } }}><TableHead><TableRow><TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>No.</TableCell><TableCell>Student</TableCell><TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Admission no.</TableCell><TableCell>Mark / 20</TableCell><TableCell>Absent</TableCell>{isAdmin && <TableCell>Actions</TableCell>}</TableRow></TableHead><TableBody>
          {roster.map((row, index) => {
            const record = recordsByStudent.get(row.studentId);
            const value = drafts[row.studentId] || valueOf(record);
            let validation = ""; try { parseSbaValue(value.mark, value.absent); } catch (failure) { validation = failure.message; }
            return <TableRow key={row.studentId} selected={Boolean(drafts[row.studentId])}><TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{index + 1}</TableCell><TableCell sx={{ minWidth: 130 }}>{academicDisplay(row.studentName)}<Box component="span" sx={{ display: { xs: "block", sm: "none" }, color: "text.secondary", fontSize: 11 }}>{row.admissionNo}</Box></TableCell><TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{row.admissionNo}</TableCell><TableCell><TextField sx={{ width: 96 }} size="small" value={value.mark} disabled={!canEdit || value.absent} error={Boolean(validation)} helperText={academicDisplay(validation)} inputRef={(node) => { inputRefs.current[row.studentId] = node; }} slotProps={{ htmlInput: { inputMode: "decimal", "aria-label": `SBA mark for ${row.studentName}`, style: { width: 70 } } }} onChange={(event) => updateRow(row.studentId, { mark: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); for (let next = index + 1; next < roster.length; next++) { const input = inputRefs.current[roster[next].studentId]; if (input && !input.disabled) { input.focus(); input.select(); break; } } } }} /></TableCell><TableCell><Checkbox checked={value.absent} disabled={!canEdit} inputProps={{ "aria-label": `Absent: ${row.studentName}` }} onChange={(event) => updateRow(row.studentId, { absent: event.target.checked, mark: "" })} /></TableCell>{isAdmin && <TableCell><Button color="error" size="small" disabled={!canEdit || !record || dirty} onClick={() => setDeleteRow(row)}>Delete SBA</Button></TableCell>}</TableRow>;
          })}
        </TableBody></Table></TableContainer>
        <Stack direction="row" spacing={1}><Button variant="contained" onClick={() => saveRows()} disabled={!canEdit || !dirty || settingsDirty}>{saving ? "Saving…" : "Save SBA marks"}</Button><Button onClick={() => { setDrafts({}); setError(""); }} disabled={saving || !dirty}>Discard changes</Button></Stack>
      </> : <EmptyState title="No enrolled students" description="Check the subject assignment, teaching medium, and year-specific enrollments." />)}
    </Stack>
    <Dialog open={Boolean(pdfDialog)} onClose={() => !pdfBusy && !shareBusy && setPdfDialog(null)}>
      <DialogTitle>{pdfDialog === "whatsapp" ? "Share SBA PDF on WhatsApp" : "Share SBA PDF"}</DialogTitle>
      <DialogContent>{pdfBusy ? <Typography role="status">Preparing A3 PDF...</Typography> : <>
        <Typography>{academicDisplay(pdfFile?.name)}</Typography>
        <Typography sx={{ mt: 1 }}>{pdfFile && canShareSbaPdf(pdfFile) ? "Choose WhatsApp or another app from your device's share menu." : "Download the PDF, then attach it as a document in WhatsApp or another app. WhatsApp cannot attach a local PDF automatically from this browser."}</Typography>
      </>}</DialogContent>
      <DialogActions>
        <Button disabled={pdfBusy || shareBusy} onClick={() => setPdfDialog(null)}>Close</Button>
        <Button disabled={!pdfFile || shareBusy} onClick={() => downloadSbaPdf(pdfFile)}>Download PDF</Button>
        {pdfFile && canShareSbaPdf(pdfFile) ? <Button variant="contained" disabled={shareBusy} onClick={sharePdf}>Share PDF file</Button> : pdfDialog === "whatsapp" && <Button component="a" href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer" disabled={!pdfFile}>Open WhatsApp</Button>}
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(deleteRow)} onClose={() => !saving && setDeleteRow(null)}><DialogTitle>Delete this SBA mark?</DialogTitle><DialogContent>Delete the saved SBA result for {academicDisplay(deleteRow?.studentName)} in {academicDisplay(assignment?.subjectName)}, {academicDisplay(term && buildTermLabel(term))}?</DialogContent><DialogActions><Button onClick={() => setDeleteRow(null)} disabled={saving}>Cancel</Button><Button color="error" onClick={() => saveRows(deleteRow)} disabled={saving}>Delete SBA record</Button></DialogActions></Dialog>
  </PageContainer>;
}
