import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, FormControl, FormControlLabel, FormGroup, FormLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { createClassSheetPdf, MONTHS, parseClassWorkbook } from "../utils/classSheetPdf";
import { matchesRegisterClass, text } from "../utils/registerContext";
import { getStudentDisplayName } from "../utils/reportMappingUtils";

export default function ClassSheetExport({ classrooms, students, year }) {
  const [uploaded, setUploaded] = useState(null);
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState("all");
  const [term, setTerm] = useState("");
  const [months, setMonths] = useState([]);
  const [meetingDate, setMeetingDate] = useState("");
  const [printYear, setPrintYear] = useState(String(year));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setPrintYear(String(year)); }, [year]);
  const classes = useMemo(() => uploaded || classrooms.map((room) => ({
    id: room.id, className: room.className,
    students: students.filter((student) => matchesRegisterClass(student, room, printYear))
      .map((student) => ({ name: getStudentDisplayName(student) || "Unnamed Student", indexNo: text(student.admissionNo || student.indexNo) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((room) => room.students.length), [uploaded, classrooms, students, printYear]);
  const effectiveSelected = classes.some((room) => room.id === selected) ? selected : "all";
  const chosen = classes.filter((room) => effectiveSelected === "all" || room.id === effectiveSelected);

  async function upload(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = parseClassWorkbook(XLSX.read(await file.arrayBuffer(), { type: "array" }));
      setUploaded(result);
      setFileName(file.name);
      setSelected("all");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function download() {
    setBusy(true);
    setError("");
    try {
      const pdf = createClassSheetPdf({ classes: chosen, year: printYear, term, months, meetingDate });
      saveAs(pdf.output("blob"), `Class_Sheets_${effectiveSelected === "all" ? "All_Classes" : chosen[0].className}_${printYear}_Term_${term}.pdf`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={2}>
      <Typography variant="h6">Class sheets — 3 A4 pages per class</Typography>
      <Typography variant="body2" color="text.secondary">Three sheets per class, with signatures on every page. Term and months appear only on attendance; the parents meeting sheet has a date field. Cells remain blank for handwriting.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        <Button component="label" variant="outlined" disabled={busy}>Upload class workbook<input hidden type="file" accept=".xlsx,.xls" onChange={upload} /></Button>
        {uploaded && <Button disabled={busy} onClick={() => { setUploaded(null); setFileName(""); setSelected("all"); }}>Use app class lists</Button>}
      </Stack>
      <Typography variant="body2">{uploaded ? `${fileName} — ${classes.length} classes. Upload is used only for this download; student records are not changed.` : "Using app class lists for the academic year selected above."}</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField select label="Classes to print" value={classes.some((room) => room.id === selected) ? selected : "all"} onChange={(e) => setSelected(e.target.value)} disabled={busy} fullWidth>
          <MenuItem value="all">All classes ({classes.length})</MenuItem>
          {classes.map((room) => <MenuItem key={room.id} value={room.id}>{room.className} ({room.students.length} students)</MenuItem>)}
        </TextField>
        <TextField label="Print year" type="number" value={printYear} onChange={(e) => setPrintYear(e.target.value)} disabled={busy} fullWidth />
        <TextField select label="Attendance term" value={term} onChange={(e) => setTerm(e.target.value)} disabled={busy} fullWidth>
          {["I", "II", "III"].map((value) => <MenuItem key={value} value={value}>Term {value}</MenuItem>)}
        </TextField>
        <TextField label="Parents meeting date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} InputLabelProps={{ shrink: true }} helperText="Optional — leave blank to write the date by hand." disabled={busy} fullWidth />
      </Stack>
      <FormControl component="fieldset" disabled={busy}>
        <FormLabel component="legend">Attendance months — select multiple</FormLabel>
        <FormGroup sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" } }}>
          {MONTHS.map((month) => <FormControlLabel key={month} label={month} control={<Checkbox checked={months.includes(month)} onChange={(e) => setMonths((current) => MONTHS.filter((value) => value === month ? e.target.checked : current.includes(value)))} />} />)}
        </FormGroup>
        <Typography variant="caption" color="text.secondary">{months.length ? `${months.length} selected: ${months.join(", ")}. Each month gets its own attendance column.` : "Select at least one month. You can select all 12 months."}</Typography>
      </FormControl>
      <Typography variant="body2">{chosen.length} classes · {chosen.reduce((sum, room) => sum + room.students.length, 0)} students · {chosen.length * 3} A4 portrait pages</Typography>
      <Button variant="contained" onClick={download} disabled={busy || !chosen.length || !term || !months.length || !/^[12]\d{3}$/.test(printYear)}>{busy ? "Preparing..." : "Download class sheets PDF"}</Button>
    </Stack>
  </Paper>;
}
