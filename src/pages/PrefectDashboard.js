import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  arrayUnion, collection, doc, getDocs, orderBy, query, serverTimestamp,
  setDoc, Timestamp, updateDoc,
} from "firebase/firestore";
import {
  Alert, AppBar, Avatar, Box, Button, Card, CardContent, Checkbox, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
  Stack, Tab, Tabs, TextField, Toolbar, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const REASONS = [
  "Transport delay", "Overslept", "Medical reason", "Family reason",
  "Weather", "School activity", "No reason given", "Other",
];

const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const studentName = (s) => clean(s.name || s.fullName) || "Unnamed student";
const studentClass = (s) => {
  if (s.alClassName) return clean(s.alClassName);
  const grade = clean(s.grade);
  const section = clean(s.section || s.className);
  return [grade && `Grade ${grade}`, section].filter(Boolean).join(" - ") || "Class not set";
};
const toDate = (value) => value?.toDate ? value.toDate() : value ? new Date(value) : null;
const dayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const formatDateTime = (value) => {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Pending server time";
};
const actor = (profile, user) => ({
  uid: user?.uid || "",
  name: clean(profile?.name || profile?.fullName || profile?.displayName || user?.email) || "Prefect",
  email: clean(user?.email),
});
const friendlyFirestoreError = (error, fallback) => {
  if (error?.code === "resource-exhausted" || /quota exceeded/i.test(error?.message || "")) {
    return "Firebase quota is temporarily exhausted. Please try again after the quota resets or ask the administrator to upgrade the Firebase plan.";
  }
  if (error?.code === "permission-denied") {
    return "Your account does not have permission to update prefect records.";
  }
  return error?.message || fallback;
};

function StudentSummary({ student, count, onSelect, onDetails }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", fontWeight: 800 }}>{studentName(student).charAt(0)}</Avatar>
          <Box flex={1} minWidth={0}>
            <Typography fontWeight={800} noWrap>{studentName(student)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {studentClass(student)} · Index {clean(student.admissionNo || student.emisStudentId) || "—"}
            </Typography>
          </Box>
          <Chip label={`${count} late`} color={count >= 3 ? "warning" : "default"} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={2}>
          <Button fullWidth variant="contained" onClick={() => onSelect(student)}>Record late arrival</Button>
          <Button fullWidth variant="outlined" onClick={() => onDetails(student)}>More details</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PrefectDashboard() {
  const { user, profile, logout } = useAuth();
  const [tab, setTab] = useState(0);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailStudent, setDetailStudent] = useState(null);
  const [returnRecord, setReturnRecord] = useState(null);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [bookReceived, setBookReceived] = useState(true);
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [fromDate, setFromDate] = useState(dayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toDateFilter, setToDateFilter] = useState(dayKey());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentSnap, recordSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(query(collection(db, "lateArrivalRecords"), orderBy("arrivalTime", "desc"))),
      ]);
      setStudents(studentSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setRecords(recordSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error(error);
      setMessage({ severity: "error", text: "Could not load prefect records. Check Firestore access rules." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => records.reduce((map, record) => {
    map[record.studentId] = (map[record.studentId] || 0) + 1;
    return map;
  }, {}), [records]);

  const results = useMemo(() => {
    const term = lower(search);
    if (term.length < 2) return [];
    return students.filter((s) => {
      if (lower(s.status || "active") !== "active") return false;
      return [
        studentName(s), s.admissionNo, s.emisStudentId, s.grade, s.section,
        s.className, s.alClassName, studentClass(s),
      ].some((value) => lower(value).includes(term));
    }).slice(0, 30);
  }, [students, search]);

  const todayRecords = useMemo(() => records.filter((r) => r.dateKey === dayKey()), [records]);
  const pending = useMemo(() => todayRecords.filter((r) => r.recordBookReceived && r.bookStatus !== "returned"), [todayRecords]);
  const filteredReport = useMemo(() => records.filter((r) =>
    (!fromDate || r.dateKey >= fromDate) && (!toDateFilter || r.dateKey <= toDateFilter)
  ), [records, fromDate, toDateFilter]);

  const saveLate = async () => {
    const finalReason = reason === "Other" ? clean(otherReason) : reason;
    if (!finalReason) return setMessage({ severity: "warning", text: "Select or enter a reason." });
    if (records.some((r) => r.studentId === selected.id && r.dateKey === dayKey())) {
      return setMessage({ severity: "warning", text: "This student already has a late record today." });
    }
    setSaving(true);
    try {
      const who = actor(profile, user);
      const recordRef = doc(db, "lateArrivalRecords", `${dayKey()}_${selected.id}`);
      const localTime = Timestamp.now();
      const newRecord = {
        studentId: selected.id,
        studentName: studentName(selected),
        admissionNo: clean(selected.admissionNo || selected.emisStudentId),
        grade: clean(selected.grade),
        section: clean(selected.section || selected.className),
        classLabel: studentClass(selected),
        dateKey: dayKey(),
        arrivalTime: serverTimestamp(),
        reason: finalReason,
        recordBookReceived: bookReceived,
        bookStatus: bookReceived ? "held" : "not_received",
        recordedBy: who,
        recordedAt: serverTimestamp(),
        handoverHistory: [],
      };
      await setDoc(recordRef, newRecord);
      setRecords((current) => [
        { ...newRecord, id: recordRef.id, arrivalTime: localTime, recordedAt: localTime },
        ...current.filter((record) => record.id !== recordRef.id),
      ]);
      setSelected(null); setReason(""); setOtherReason(""); setBookReceived(true);
      setMessage({ severity: "success", text: "Late arrival recorded." });
      setTab(0);
    } catch (error) {
      console.error(error);
      setMessage({
        severity: "error",
        text: friendlyFirestoreError(error, "Could not save the late record."),
      });
    } finally { setSaving(false); }
  };

  const markReturned = async () => {
    if (!returnConfirmed) return;
    setSaving(true);
    try {
      const ref = doc(db, "lateArrivalRecords", returnRecord.id);
      const who = actor(profile, user);
      const localTime = Timestamp.now();
      const historyItem = { action: "returned_to_student", by: who, at: localTime };
      await updateDoc(ref, {
        bookStatus: "returned",
        returnedAt: serverTimestamp(),
        handedOverBy: who,
        handoverHistory: arrayUnion(historyItem),
      });
      setRecords((current) => current.map((record) =>
        record.id === returnRecord.id
          ? {
              ...record,
              bookStatus: "returned",
              returnedAt: localTime,
              handedOverBy: who,
              handoverHistory: [...(record.handoverHistory || []), historyItem],
            }
          : record
      ));
      setReturnRecord(null); setReturnConfirmed(false);
      setMessage({ severity: "success", text: "Record book handover confirmed." });
    } catch (error) {
      setMessage({
        severity: "error",
        text: friendlyFirestoreError(error, "Could not update the handover."),
      });
    } finally { setSaving(false); }
  };

  const exportCsv = () => {
    const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const rows = filteredReport.map((r) => [
      r.dateKey, formatDateTime(r.arrivalTime), r.admissionNo, r.studentName, r.classLabel,
      r.reason, r.bookStatus, r.recordedBy?.name, r.handedOverBy?.name || "", formatDateTime(r.returnedAt),
    ]);
    const csv = [
      ["Date", "Arrival time", "Index No", "Student", "Class", "Reason", "Book status", "Recorded by", "Handed over by", "Returned time"],
      ...rows,
    ].map((row) => row.map(escape).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `late-arrivals-${fromDate}-to-${toDateFilter}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const details = detailStudent ? records.filter((r) => r.studentId === detailStudent.id) : [];

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f5f7fb", pb: 5 }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "#0f3d63" }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <MenuBookRoundedIcon />
          <Box flex={1}>
            <Typography fontWeight={900} lineHeight={1.15}>Late Arrival Desk</Typography>
            <Typography variant="caption" sx={{ opacity: .8 }}>{actor(profile, user).name}</Typography>
          </Box>
          <Button color="inherit" startIcon={<LogoutRoundedIcon />} onClick={logout}>Sign out</Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 1.5, sm: 3 }, py: 2.5 }}>
        {message && <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}
        <Stack direction="row" spacing={1.5} mb={2} sx={{ overflowX: "auto" }}>
          <Chip icon={<AccessTimeRoundedIcon />} label={`${todayRecords.length} late today`} />
          <Chip icon={<MenuBookRoundedIcon />} color={pending.length ? "warning" : "success"} label={`${pending.length} books pending`} />
          <Chip icon={<CheckCircleRoundedIcon />} label={`${todayRecords.length - pending.length} completed`} />
        </Stack>
        <Card sx={{ borderRadius: 3, mb: 2 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
            <Tab label="Today" /><Tab label="Find student" /><Tab label="Reports" />
          </Tabs>
        </Card>
        {loading ? <Box textAlign="center" py={8}><CircularProgress /></Box> : <>
          {tab === 0 && <Stack spacing={2}>
            <Typography variant="h5" fontWeight={900}>Books to hand over</Typography>
            {!pending.length && <Alert severity="success">No record books are waiting for handover.</Alert>}
            {pending.map((r) => <Card key={r.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "center" }}>
                  <Box flex={1}>
                    <Typography fontWeight={900}>{r.studentName}</Typography>
                    <Typography color="text.secondary">{r.classLabel} · Index {r.admissionNo || "—"}</Typography>
                    <Typography variant="body2" mt={1}>Arrived {formatDateTime(r.arrivalTime)} · {r.reason}</Typography>
                  </Box>
                  <Button variant="contained" color="success" onClick={() => setReturnRecord(r)}>Hand over book</Button>
                </Stack>
              </CardContent>
            </Card>)}
            <Typography variant="h6" fontWeight={800} pt={1}>All arrivals today</Typography>
            {!todayRecords.length && <Typography color="text.secondary">No late arrivals recorded today.</Typography>}
            {todayRecords.map((r) => <Card key={r.id} variant="outlined"><CardContent>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Box><Typography fontWeight={800}>{r.studentName}</Typography><Typography variant="body2" color="text.secondary">{r.classLabel} · {formatDateTime(r.arrivalTime)}</Typography></Box>
                <Chip size="small" color={r.bookStatus === "returned" ? "success" : r.bookStatus === "held" ? "warning" : "default"}
                  label={r.bookStatus === "returned" ? "Returned" : r.bookStatus === "held" ? "Book held" : "No book"} />
              </Stack>
            </CardContent></Card>)}
          </Stack>}
          {tab === 1 && <Stack spacing={2}>
            <Typography variant="h5" fontWeight={900}>Find a student</Typography>
            <TextField fullWidth autoFocus placeholder="Name, index number, grade or class…" value={search}
              onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchRoundedIcon sx={{ mr: 1, color: "text.secondary" }} /> }} />
            {search.trim().length < 2 && <Typography color="text.secondary">Type at least 2 characters to search active students.</Typography>}
            {search.trim().length >= 2 && !results.length && <Alert severity="info">No matching active student found.</Alert>}
            {results.map((s) => <StudentSummary key={s.id} student={s} count={counts[s.id] || 0} onSelect={setSelected} onDetails={setDetailStudent} />)}
          </Stack>}
          {tab === 2 && <Stack spacing={2}>
            <Typography variant="h5" fontWeight={900}>Late arrival report</Typography>
            <Card variant="outlined"><CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth type="date" label="From" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField fullWidth type="date" label="To" value={toDateFilter} onChange={(e) => setToDateFilter(e.target.value)} InputLabelProps={{ shrink: true }} />
                <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={exportCsv} disabled={!filteredReport.length}>Export CSV</Button>
              </Stack>
            </CardContent></Card>
            <Typography color="text.secondary">{filteredReport.length} records in this period</Typography>
            {filteredReport.map((r) => <Card key={r.id} variant="outlined"><CardContent>
              <Typography fontWeight={800}>{r.studentName} · {r.classLabel}</Typography>
              <Typography variant="body2">{formatDateTime(r.arrivalTime)} — {r.reason}</Typography>
              <Typography variant="caption" color="text.secondary">Recorded by {r.recordedBy?.name || "Unknown"} · Book: {r.bookStatus?.replace("_", " ")}</Typography>
            </CardContent></Card>)}
          </Stack>}
        </>}
      </Box>

      <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Record late arrival</DialogTitle>
        <DialogContent>
          {selected && <><Typography fontWeight={900}>{studentName(selected)}</Typography>
            <Typography color="text.secondary" mb={2}>{studentClass(selected)} · Index {clean(selected.admissionNo || selected.emisStudentId) || "—"} · {counts[selected.id] || 0} previous late records</Typography></>}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Reason for late arrival</InputLabel>
            <Select value={reason} label="Reason for late arrival" onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </Select>
          </FormControl>
          {reason === "Other" && <TextField fullWidth label="Enter reason" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} sx={{ mt: 2 }} />}
          <FormControlLabel sx={{ mt: 1.5 }} control={<Checkbox checked={bookReceived} onChange={(e) => setBookReceived(e.target.checked)} />}
            label="Student record book received and held at the desk" />
          <Alert severity="info" sx={{ mt: 1 }}>Date and arrival time will be recorded automatically by the server.</Alert>
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Cancel</Button><Button variant="contained" onClick={saveLate} disabled={saving}>{saving ? "Saving…" : "Save late record"}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(returnRecord)} onClose={() => !saving && setReturnRecord(null)} fullWidth maxWidth="sm">
        <DialogTitle>Confirm record book handover</DialogTitle>
        <DialogContent>
          <Typography fontWeight={800}>{returnRecord?.studentName}</Typography>
          <Typography color="text.secondary" mb={2}>{returnRecord?.classLabel}</Typography>
          <Alert severity="warning">Confirm only after the after-school class is complete and the book is physically handed to the student.</Alert>
          <FormControlLabel sx={{ mt: 1.5 }} control={<Checkbox checked={returnConfirmed} onChange={(e) => setReturnConfirmed(e.target.checked)} />}
            label="I handed this record book to the student" />
          <Typography variant="caption" color="text.secondary">Your account name and the server handover time will be stored.</Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setReturnRecord(null)}>Cancel</Button><Button color="success" variant="contained" disabled={!returnConfirmed || saving} onClick={markReturned}>Confirm handover</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailStudent)} onClose={() => setDetailStudent(null)} fullWidth maxWidth="sm">
        <DialogTitle>Late arrival history</DialogTitle>
        <DialogContent>
          <Typography fontWeight={900}>{detailStudent && studentName(detailStudent)}</Typography>
          <Typography color="text.secondary">{detailStudent && studentClass(detailStudent)} · {details.length} late days</Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5}>
            {!details.length && <Typography color="text.secondary">No late records found.</Typography>}
            {details.map((r) => <Box key={r.id}>
              <Typography fontWeight={700}>{formatDateTime(r.arrivalTime)}</Typography>
              <Typography variant="body2">{r.reason}</Typography>
              <Typography variant="caption" color="text.secondary">Book {r.bookStatus?.replace("_", " ")}{r.handedOverBy?.name ? ` by ${r.handedOverBy.name}` : ""}</Typography>
            </Box>)}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailStudent(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
