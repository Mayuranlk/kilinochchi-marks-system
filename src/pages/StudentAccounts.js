import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AddCardRoundedIcon from "@mui/icons-material/AddCardRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FamilyRestroomRoundedIcon from "@mui/icons-material/FamilyRestroomRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import TableViewRoundedIcon from "@mui/icons-material/TableViewRounded";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ResponsiveTableWrapper, StatCard } from "../components/ui";

const FEE_HEADS = [
  { key: "facilities", label: "Facilities Fees", shortLabel: "Facilities", amount: 60 },
  { key: "development", label: "School Development Fees", shortLabel: "Development", amount: 1800 },
  { key: "membership", label: "School Membership Fee", shortLabel: "Membership", amount: 600 },
];

const PAYMENT_METHODS = ["Cash", "Bank", "Card", "Cheque", "Other"];

const currentAcademicYear = () => String(new Date().getFullYear());
const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const parseGrade = (value) => Number(String(value ?? "").match(/\d+/)?.[0] || 0);
const section = (value) => clean(value).toUpperCase().match(/[A-Z]+/)?.[0] || clean(value).toUpperCase();
const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const studentName = (student = {}) => clean(student.name || student.fullName || "Unnamed Student");
const studentIndex = (student = {}) => clean(student.admissionNo || student.indexNo || student.studentIndex || student.emisStudentId);
const studentClass = (student = {}) => `G${parseGrade(student.grade) || "-"}-${section(student.section || student.className) || "-"}`;
const accountDocId = (year, studentId) => `${year}_${studentId}`;
const isActiveStudent = (student = {}) => !["left", "inactive", "graduated", "suspended"].includes(lower(student.status || "active"));

function feeStatus(due, paid) {
  if (due <= 0) return "Covered";
  if (paid >= due) return "Paid";
  if (paid > 0) return "Part Paid";
  return "Not Paid";
}

function statusColor(status) {
  if (status === "Paid" || status === "Covered") return "success";
  if (status === "Part Paid") return "warning";
  return "error";
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const gradeDiff = parseGrade(a.student.grade) - parseGrade(b.student.grade);
    if (gradeDiff) return gradeDiff;
    const sectionDiff = section(a.student.section || a.student.className).localeCompare(section(b.student.section || b.student.className));
    if (sectionDiff) return sectionDiff;
    return studentName(a.student).localeCompare(studentName(b.student), undefined, { numeric: true, sensitivity: "base" });
  });
}

function normalizeAccountPayments(account = {}) {
  return Array.isArray(account.payments)
    ? account.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount || 0),
        feeType: clean(payment.feeType || payment.feeHead || ""),
      }))
    : [];
}

function buildRow(student, account = {}, academicYear) {
  const payments = normalizeAccountPayments(account);
  const membershipLinked = Boolean(clean(account.membershipCoveredByStudentId));

  const feeHeads = FEE_HEADS.map((head) => {
    const due = head.key === "membership" && membershipLinked ? 0 : head.amount;
    const paid = payments
      .filter((payment) => payment.feeType === head.key)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balance = Math.max(due - paid, 0);
    return {
      ...head,
      due,
      paid,
      balance,
      status: feeStatus(due, paid),
    };
  });

  const legacyPaid = payments
    .filter((payment) => !payment.feeType)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalDue = feeHeads.reduce((sum, fee) => sum + fee.due, 0);
  const totalPaid = feeHeads.reduce((sum, fee) => sum + fee.paid, 0);
  const totalBalance = Math.max(totalDue - totalPaid, 0);
  const overallStatus = totalBalance <= 0 && totalDue > 0 ? "Paid" : totalPaid > 0 ? "Part Paid" : "Not Paid";

  return {
    id: accountDocId(academicYear, student.id),
    student,
    account,
    academicYear,
    feeHeads,
    payments,
    legacyPaid,
    totalDue,
    totalPaid,
    totalBalance,
    overallStatus,
    membershipLinked,
    membershipCoveredByStudentId: clean(account.membershipCoveredByStudentId),
    membershipCoveredByAdmissionNo: clean(account.membershipCoveredByAdmissionNo),
    membershipCoveredByName: clean(account.membershipCoveredByName),
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function buildReportRows(rows) {
  return rows.map((row) => {
    const fee = Object.fromEntries(row.feeHeads.map((head) => [head.key, head]));
    return [
      studentIndex(row.student) || "-",
      studentName(row.student),
      studentClass(row.student),
      fee.facilities.status,
      money(fee.facilities.paid),
      money(fee.facilities.balance),
      fee.development.status,
      money(fee.development.paid),
      money(fee.development.balance),
      fee.membership.status,
      money(fee.membership.paid),
      money(fee.membership.balance),
      money(row.totalBalance),
    ];
  });
}

function buildReportDoc(rows, academicYear) {
  const docPdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  docPdf.setFontSize(16);
  docPdf.text("Student Accounts Report", 40, 36);
  docPdf.setFontSize(10);
  docPdf.text(`Academic Year: ${academicYear}`, 40, 54);
  docPdf.text(`Generated: ${new Date().toLocaleString("en-LK")}`, 40, 70);

  autoTable(docPdf, {
    startY: 88,
    head: [[
      "Index No",
      "Student",
      "Class",
      "Facilities",
      "Fac. Paid",
      "Fac. Bal.",
      "Development",
      "Dev. Paid",
      "Dev. Bal.",
      "Membership",
      "Mem. Paid",
      "Mem. Bal.",
      "Total Bal.",
    ]],
    body: buildReportRows(rows),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [22, 101, 52] },
    margin: { left: 28, right: 28 },
  });

  return docPdf;
}

function buildStudentStatementDoc(row) {
  const docPdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  docPdf.setFontSize(16);
  docPdf.text("Student Fee Statement", 40, 42);
  docPdf.setFontSize(10);
  docPdf.text(`Academic Year: ${row.academicYear}`, 40, 62);
  docPdf.text(`Student: ${studentName(row.student)}`, 40, 82);
  docPdf.text(`Index No: ${studentIndex(row.student) || "-"}`, 40, 100);
  docPdf.text(`Class: ${studentClass(row.student)}`, 40, 118);

  if (row.membershipLinked) {
    docPdf.text(`Membership covered by: ${row.membershipCoveredByAdmissionNo} - ${row.membershipCoveredByName}`, 40, 136);
  }

  autoTable(docPdf, {
    startY: row.membershipLinked ? 156 : 142,
    head: [["Fee Head", "Due", "Paid", "Balance", "Status"]],
    body: row.feeHeads.map((fee) => [fee.label, money(fee.due), money(fee.paid), money(fee.balance), fee.status]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 101, 52] },
    margin: { left: 40, right: 40 },
  });

  autoTable(docPdf, {
    startY: docPdf.lastAutoTable.finalY + 18,
    head: [["Receipt No", "Date", "Fee Head", "Amount", "Method", "Note"]],
    body: row.payments.length
      ? row.payments.map((payment) => [
          payment.receiptNo || "-",
          formatDate(payment.paidAt),
          FEE_HEADS.find((head) => head.key === payment.feeType)?.shortLabel || "Legacy",
          money(payment.amount),
          payment.method || "-",
          payment.note || "",
        ])
      : [["-", "-", "No payments recorded", "-", "-", ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [21, 94, 117] },
    margin: { left: 40, right: 40 },
  });

  docPdf.setFontSize(11);
  docPdf.text(`Total Balance: ${money(row.totalBalance)}`, 40, docPdf.lastAutoTable.finalY + 28);
  return docPdf;
}

export default function StudentAccounts() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [students, setStudents] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [feeFilter, setFeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", note: "" });
  const [membershipRow, setMembershipRow] = useState(null);
  const [siblingSearch, setSiblingSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [studentSnap, accountSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentFeeAccounts")),
      ]);
      setStudents(studentSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setAccounts(accountSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error(error);
      setMessage({ severity: "error", text: "Could not load accounts. Check Firestore permissions for students and studentFeeAccounts." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const accountById = useMemo(() => {
    const map = new Map();
    accounts
      .filter((account) => clean(account.academicYear) === clean(academicYear))
      .forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts, academicYear]);

  const activeStudents = useMemo(() => students.filter(isActiveStudent), [students]);

  const rows = useMemo(
    () => sortRows(activeStudents.map((student) => buildRow(student, accountById.get(accountDocId(academicYear, student.id)), academicYear))),
    [activeStudents, accountById, academicYear]
  );

  const gradeOptions = useMemo(
    () => [...new Set(rows.map((row) => parseGrade(row.student.grade)).filter(Boolean))].sort((a, b) => a - b),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const term = lower(search);
    return rows.filter((row) => {
      if (gradeFilter && parseGrade(row.student.grade) !== Number(gradeFilter)) return false;
      if (statusFilter && row.overallStatus !== statusFilter) return false;
      if (feeFilter && row.feeHeads.find((fee) => fee.key === feeFilter)?.balance <= 0) return false;
      if (!term) return true;
      return [
        studentIndex(row.student),
        studentName(row.student),
        row.membershipCoveredByAdmissionNo,
        row.membershipCoveredByName,
      ].join(" ").toLowerCase().includes(term);
    });
  }, [rows, search, gradeFilter, statusFilter, feeFilter]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.expected += row.totalDue;
        acc.paid += row.totalPaid;
        acc.balance += row.totalBalance;
        row.feeHeads.forEach((fee) => {
          acc.byFee[fee.key].due += fee.due;
          acc.byFee[fee.key].paid += fee.paid;
          acc.byFee[fee.key].balance += fee.balance;
        });
        return acc;
      },
      {
        expected: 0,
        paid: 0,
        balance: 0,
        byFee: Object.fromEntries(FEE_HEADS.map((fee) => [fee.key, { due: 0, paid: 0, balance: 0 }])),
      }
    );
  }, [rows]);

  const siblingCandidates = useMemo(() => {
    if (!membershipRow) return [];
    const term = lower(siblingSearch);
    return activeStudents
      .filter((student) => student.id !== membershipRow.student.id)
      .filter((student) => !term || `${studentIndex(student)} ${studentName(student)}`.toLowerCase().includes(term))
      .slice(0, 10);
  }, [activeStudents, membershipRow, siblingSearch]);

  const saveAccount = async (row, overrides = {}) => {
    await setDoc(
      doc(db, "studentFeeAccounts", row.id),
      {
        academicYear,
        studentId: row.student.id,
        admissionNo: studentIndex(row.student),
        studentName: studentName(row.student),
        grade: parseGrade(row.student.grade),
        section: section(row.student.section || row.student.className),
        feeStructure: Object.fromEntries(FEE_HEADS.map((fee) => [fee.key, fee.amount])),
        payments: row.payments,
        updatedAt: serverTimestamp(),
        ...overrides,
      },
      { merge: true }
    );
  };

  const openPayment = (row, fee) => {
    setPaymentTarget({ row, fee });
    setPaymentForm({ amount: fee.balance ? String(fee.balance) : "", method: "Cash", note: "" });
    setMessage(null);
  };

  const handleAddPayment = async () => {
    if (!paymentTarget) return;

    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      setMessage({ severity: "error", text: "Enter a valid amount for this fee head." });
      return;
    }
    if (amount > paymentTarget.fee.balance) {
      setMessage({ severity: "error", text: `Amount is higher than the ${paymentTarget.fee.shortLabel} balance.` });
      return;
    }

    setSaving(true);
    try {
      const payment = {
        receiptNo: `ACC-${academicYear}-${Date.now()}`,
        feeType: paymentTarget.fee.key,
        feeLabel: paymentTarget.fee.label,
        amount,
        method: paymentForm.method,
        note: clean(paymentForm.note),
        paidAt: new Date().toISOString(),
        recordedByUid: user?.uid || "",
        recordedByName: clean(profile?.name || profile?.email || user?.email) || "Accounts",
      };
      await saveAccount(paymentTarget.row, { payments: [...paymentTarget.row.payments, payment] });
      setPaymentTarget(null);
      setMessage({ severity: "success", text: `Saved ${paymentTarget.fee.shortLabel} payment for ${studentName(paymentTarget.row.student)}.` });
      await load();
    } catch (error) {
      setMessage({ severity: "error", text: error.message || "Could not save payment." });
    } finally {
      setSaving(false);
    }
  };

  const openMembership = (row) => {
    setMembershipRow(row);
    setSiblingSearch(row.membershipCoveredByAdmissionNo || "");
    setMessage(null);
  };

  const handleLinkSibling = async (sibling) => {
    if (!membershipRow || !sibling) return;
    setSaving(true);
    try {
      await saveAccount(membershipRow, {
        membershipCoveredByStudentId: sibling.id,
        membershipCoveredByAdmissionNo: studentIndex(sibling),
        membershipCoveredByName: studentName(sibling),
      });
      setMembershipRow(null);
      setMessage({ severity: "success", text: `Membership linked to ${studentIndex(sibling)} - ${studentName(sibling)}.` });
      await load();
    } catch (error) {
      setMessage({ severity: "error", text: error.message || "Could not link family membership." });
    } finally {
      setSaving(false);
    }
  };

  const handleClearMembership = async () => {
    if (!membershipRow) return;
    setSaving(true);
    try {
      await saveAccount(membershipRow, {
        membershipCoveredByStudentId: "",
        membershipCoveredByAdmissionNo: "",
        membershipCoveredByName: "",
      });
      setMembershipRow(null);
      setMessage({ severity: "success", text: "Membership fee restored for this student." });
      await load();
    } catch (error) {
      setMessage({ severity: "error", text: error.message || "Could not remove membership link." });
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    const exportRows = filteredRows.map((row) => {
      const fee = Object.fromEntries(row.feeHeads.map((head) => [head.key, head]));
      return {
        "Academic Year": academicYear,
        "Index No": studentIndex(row.student),
        "Student Name": studentName(row.student),
        Class: studentClass(row.student),
        "Facilities Due": fee.facilities.due,
        "Facilities Paid": fee.facilities.paid,
        "Facilities Balance": fee.facilities.balance,
        "Development Due": fee.development.due,
        "Development Paid": fee.development.paid,
        "Development Balance": fee.development.balance,
        "Membership Due": fee.membership.due,
        "Membership Paid": fee.membership.paid,
        "Membership Balance": fee.membership.balance,
        "Membership Covered By": row.membershipCoveredByAdmissionNo
          ? `${row.membershipCoveredByAdmissionNo} - ${row.membershipCoveredByName}`
          : "",
        "Total Due": row.totalDue,
        "Total Paid": row.totalPaid,
        "Total Balance": row.totalBalance,
        Status: row.overallStatus,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accounts");
    XLSX.writeFile(wb, `student_accounts_${academicYear}.xlsx`);
  };

  const downloadPdf = () => {
    buildReportDoc(filteredRows, academicYear).save(`student_accounts_${academicYear}.pdf`);
  };

  const printPdf = () => {
    const pdf = buildReportDoc(filteredRows, academicYear);
    const url = URL.createObjectURL(pdf.output("blob"));
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
      win.addEventListener("load", () => win.print(), { once: true });
    }
  };

  const shareReport = async () => {
    const title = `Student Accounts ${academicYear}`;
    const text = `Student Accounts ${academicYear}: expected ${money(totals.expected)}, paid ${money(totals.paid)}, balance ${money(totals.balance)}.`;

    try {
      const pdf = buildReportDoc(filteredRows, academicYear);
      const file = new File([pdf.output("blob")], `student_accounts_${academicYear}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title, text });
      } else {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setMessage({ severity: "error", text: "Sharing is not available in this browser. PDF and Excel export are still available." });
      }
    }
  };

  const downloadStatement = (row) => {
    buildStudentStatementDoc(row).save(`${studentIndex(row.student) || "student"}_fee_statement_${academicYear}.pdf`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/accounts-login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "success.dark", color: "white" }}>
            <AccountBalanceWalletRoundedIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
              Kilinochchi Accounts Portal
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Uses student records from the marks database
            </Typography>
          </Box>
          <Tooltip title={profile?.name || user?.email || "Account user"}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: "success.dark", fontWeight: 800 }}>
              {clean(profile?.name || user?.email || "A").charAt(0).toUpperCase()}
            </Avatar>
          </Tooltip>
          <IconButton onClick={handleLogout} color="error">
            <LogoutRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 1440, mx: "auto", p: { xs: 1.5, md: 3 } }}>
        <Stack spacing={2}>
          {message ? <Alert severity={message.severity}>{message.text}</Alert> : null}

          <Grid container spacing={1.25}>
            <Grid item xs={6} md={3}>
              <StatCard title="Expected" value={money(totals.expected)} icon={<ArticleRoundedIcon />} color="primary" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Paid" value={money(totals.paid)} icon={<AddCardRoundedIcon />} color="success" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="To Be Paid" value={money(totals.balance)} icon={<AccountBalanceWalletRoundedIcon />} color="warning" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Students" value={rows.length} helperText={`${filteredRows.length} shown`} color="info" />
            </Grid>
          </Grid>

          <Grid container spacing={1.25}>
            {FEE_HEADS.map((fee) => (
              <Grid item xs={12} md={4} key={fee.key}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{fee.label}</Typography>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      <Chip label={`Due ${money(totals.byFee[fee.key].due)}`} />
                      <Chip color="success" label={`Paid ${money(totals.byFee[fee.key].paid)}`} />
                      <Chip color={totals.byFee[fee.key].balance > 0 ? "warning" : "success"} label={`Balance ${money(totals.byFee[fee.key].balance)}`} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Grid container spacing={1.25} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Search index no or student"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField select fullWidth label="Grade" value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {gradeOptions.map((grade) => <MenuItem key={grade} value={grade}>Grade {grade}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField select fullWidth label="Due Fee" value={feeFilter} onChange={(event) => setFeeFilter(event.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {FEE_HEADS.map((fee) => <MenuItem key={fee.key} value={fee.key}>{fee.shortLabel} due</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField select fullWidth label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="Paid">Paid</MenuItem>
                    <MenuItem value="Part Paid">Part Paid</MenuItem>
                    <MenuItem value="Not Paid">Not Paid</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6} md={1.5}>
                  <TextField fullWidth label="Year" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
                </Grid>
                <Grid item xs={12} md={1.5}>
                  <Button fullWidth variant="outlined" onClick={() => { setSearch(""); setGradeFilter(""); setFeeFilter(""); setStatusFilter(""); }}>
                    Clear
                  </Button>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="flex-end">
                <Button startIcon={<TableViewRoundedIcon />} variant="outlined" onClick={exportExcel} disabled={!filteredRows.length}>Excel</Button>
                <Button startIcon={<PictureAsPdfRoundedIcon />} variant="outlined" onClick={downloadPdf} disabled={!filteredRows.length}>PDF</Button>
                <Button startIcon={<PrintRoundedIcon />} variant="outlined" onClick={printPdf} disabled={!filteredRows.length}>Print A4</Button>
                <Button startIcon={<ShareRoundedIcon />} variant="contained" color="success" onClick={shareReport} disabled={!filteredRows.length}>Share</Button>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>Full Account Sheet</Typography>
                  <Typography variant="body2" color="text.secondary">{filteredRows.length} records, each fee head tracked separately.</Typography>
                </Box>
              </Stack>

              {loading ? (
                <Stack alignItems="center" spacing={2} py={6}>
                  <CircularProgress />
                  <Typography color="text.secondary">Loading accounts...</Typography>
                </Stack>
              ) : filteredRows.length === 0 ? (
                <EmptyState title="No account rows found" description="Try another search, grade, status, or fee filter." />
              ) : (
                <ResponsiveTableWrapper minWidth={1280}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Index No</TableCell>
                        <TableCell>Student</TableCell>
                        <TableCell>Class</TableCell>
                        {FEE_HEADS.map((fee) => <TableCell key={fee.key}>{fee.shortLabel}</TableCell>)}
                        <TableCell align="right">Total Balance</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Membership</TableCell>
                        <TableCell align="right">Statement</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{studentIndex(row.student) || "-"}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 850 }}>{studentName(row.student)}</Typography>
                          </TableCell>
                          <TableCell>{studentClass(row.student)}</TableCell>
                          {row.feeHeads.map((fee) => (
                            <TableCell key={fee.key} sx={{ minWidth: 172 }}>
                              <Stack spacing={0.75}>
                                <Chip size="small" color={statusColor(fee.status)} label={fee.status} sx={{ alignSelf: "flex-start", fontWeight: 800 }} />
                                <Typography variant="caption" color="text.secondary">
                                  Due {money(fee.due)} | Paid {money(fee.paid)} | Bal {money(fee.balance)}
                                </Typography>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color={fee.balance > 0 ? "success" : "inherit"}
                                  disabled={fee.balance <= 0}
                                  onClick={() => openPayment(row, fee)}
                                >
                                  Pay {fee.shortLabel}
                                </Button>
                              </Stack>
                            </TableCell>
                          ))}
                          <TableCell align="right">{money(row.totalBalance)}</TableCell>
                          <TableCell><Chip size="small" color={statusColor(row.overallStatus)} label={row.overallStatus} sx={{ fontWeight: 800 }} /></TableCell>
                          <TableCell>
                            <Stack spacing={0.75}>
                              <Chip
                                size="small"
                                variant={row.membershipLinked ? "filled" : "outlined"}
                                color={row.membershipLinked ? "info" : "default"}
                                label={row.membershipLinked ? `${row.membershipCoveredByAdmissionNo} covered` : "Own fee"}
                              />
                              <Button size="small" variant="outlined" startIcon={<FamilyRestroomRoundedIcon />} onClick={() => openMembership(row)}>
                                Family
                              </Button>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => downloadStatement(row)}>
                              PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableWrapper>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Dialog open={Boolean(paymentTarget)} onClose={() => setPaymentTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{paymentTarget ? `Pay ${paymentTarget.fee.label}` : "Record Payment"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              {paymentTarget
                ? `${studentName(paymentTarget.row.student)} | Balance for ${paymentTarget.fee.shortLabel}: ${money(paymentTarget.fee.balance)}`
                : ""}
            </Alert>
            <TextField fullWidth label="Amount" type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
            <TextField select fullWidth label="Method" value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}>
              {PAYMENT_METHODS.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="Note" multiline minRows={2} value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentTarget(null)}>Cancel</Button>
          <Button variant="contained" color="success" disabled={saving} onClick={handleAddPayment}>
            {saving ? <CircularProgress size={20} /> : "Save Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(membershipRow)} onClose={() => setMembershipRow(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Family Membership Link</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Membership fee is paid once per family. Select the brother or sister who covers the membership fee.
            </Alert>
            <TextField
              fullWidth
              label="Search by index no or name"
              value={siblingSearch}
              onChange={(event) => setSiblingSearch(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
            />
            <Stack spacing={1}>
              {siblingCandidates.map((student) => (
                <Box
                  key={student.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1.25,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 850 }} noWrap>{studentName(student)}</Typography>
                    <Typography variant="caption" color="text.secondary">{studentIndex(student) || "-"} | {studentClass(student)}</Typography>
                  </Box>
                  <Button size="small" variant="contained" color="success" disabled={saving} onClick={() => handleLinkSibling(student)}>
                    Select
                  </Button>
                </Box>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearMembership} color="warning" disabled={saving || !membershipRow?.membershipLinked}>Remove Link</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setMembershipRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
