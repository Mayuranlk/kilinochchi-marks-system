import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AddCardRoundedIcon from "@mui/icons-material/AddCardRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FamilyRestroomRoundedIcon from "@mui/icons-material/FamilyRestroomRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  EmptyState,
  PageContainer,
  ResponsiveTableWrapper,
  SectionCard,
  StatCard,
} from "../components/ui";

const FEES = {
  facilities: 60,
  development: 1800,
  membership: 600,
};

const PAYMENT_METHODS = ["Cash", "Bank", "Card", "Cheque", "Other"];

const currentAcademicYear = () => String(new Date().getFullYear());

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

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
}

function getStudentName(student = {}) {
  return normalizeText(student.name || student.fullName || "Unnamed Student");
}

function getStudentIndex(student = {}) {
  return normalizeText(student.admissionNo || student.indexNo || student.studentIndex || student.emisStudentId);
}

function isActiveStudent(student = {}) {
  const status = normalizeLower(student.status || "active");
  return !status || status === "active";
}

function accountDocId(year, studentId) {
  return `${year}_${studentId}`;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const gradeDiff = parseGrade(a.student.grade) - parseGrade(b.student.grade);
    if (gradeDiff) return gradeDiff;

    const sectionDiff = normalizeSection(a.student.section || a.student.className).localeCompare(
      normalizeSection(b.student.section || b.student.className)
    );
    if (sectionDiff) return sectionDiff;

    return getStudentName(a.student).localeCompare(getStudentName(b.student), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function buildAccountRow(student, account = {}, academicYear) {
  const payments = Array.isArray(account.payments) ? account.payments : [];
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const membershipCoveredByStudentId = normalizeText(account.membershipCoveredByStudentId);
  const membershipCoveredByAdmissionNo = normalizeText(account.membershipCoveredByAdmissionNo);
  const membershipRequired = !membershipCoveredByStudentId;
  const membershipFee = membershipRequired ? FEES.membership : 0;
  const totalDue = FEES.facilities + FEES.development + membershipFee;
  const balance = Math.max(totalDue - totalPaid, 0);
  const status = balance <= 0 && totalPaid > 0 ? "Paid" : totalPaid > 0 ? "Part Paid" : "Not Paid";

  return {
    id: accountDocId(academicYear, student.id),
    student,
    account,
    academicYear,
    facilitiesFee: FEES.facilities,
    developmentFee: FEES.development,
    membershipFee,
    membershipRequired,
    membershipCoveredByStudentId,
    membershipCoveredByAdmissionNo,
    membershipCoveredByName: normalizeText(account.membershipCoveredByName),
    totalDue,
    totalPaid,
    balance,
    status,
    payments,
  };
}

function statusColor(status) {
  if (status === "Paid") return "success";
  if (status === "Part Paid") return "warning";
  return "error";
}

export default function StudentAccounts() {
  const { profile } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [students, setStudents] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [paymentRow, setPaymentRow] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", note: "" });

  const [membershipRow, setMembershipRow] = useState(null);
  const [siblingSearch, setSiblingSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [studentsSnap, accountsSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "studentFeeAccounts")),
      ]);

      setStudents(studentsSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setAccounts(accountsSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (err) {
      console.error("Student accounts load error:", err);
      setError(`Failed to load account data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accountById = useMemo(() => {
    const map = new Map();
    accounts
      .filter((account) => normalizeText(account.academicYear) === normalizeText(academicYear))
      .forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts, academicYear]);

  const activeStudents = useMemo(
    () => students.filter((student) => isActiveStudent(student)),
    [students]
  );

  const rows = useMemo(() => {
    return sortRows(
      activeStudents.map((student) =>
        buildAccountRow(student, accountById.get(accountDocId(academicYear, student.id)), academicYear)
      )
    );
  }, [accountById, activeStudents, academicYear]);

  const gradeOptions = useMemo(() => {
    return [...new Set(rows.map((row) => parseGrade(row.student.grade)).filter(Boolean))].sort(
      (a, b) => a - b
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = normalizeLower(search);

    return rows.filter((row) => {
      const grade = parseGrade(row.student.grade);
      if (gradeFilter && grade !== Number(gradeFilter)) return false;
      if (statusFilter && row.status !== statusFilter) return false;

      if (!q) return true;

      return [
        getStudentIndex(row.student),
        getStudentName(row.student),
        row.membershipCoveredByAdmissionNo,
        row.membershipCoveredByName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [gradeFilter, rows, search, statusFilter]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.expected += row.totalDue;
        acc.paid += row.totalPaid;
        acc.balance += row.balance;
        acc[row.status] += 1;
        return acc;
      },
      { expected: 0, paid: 0, balance: 0, Paid: 0, "Part Paid": 0, "Not Paid": 0 }
    );
  }, [rows]);

  const siblingCandidates = useMemo(() => {
    if (!membershipRow) return [];
    const q = normalizeLower(siblingSearch);

    return activeStudents
      .filter((student) => student.id !== membershipRow.student.id)
      .filter((student) => {
        if (!q) return true;
        return `${getStudentIndex(student)} ${getStudentName(student)}`.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [activeStudents, membershipRow, siblingSearch]);

  const buildPersistedAccount = (row, overrides = {}) => ({
    academicYear,
    studentId: row.student.id,
    admissionNo: getStudentIndex(row.student),
    studentName: getStudentName(row.student),
    grade: parseGrade(row.student.grade),
    section: normalizeSection(row.student.section || row.student.className),
    facilitiesFee: FEES.facilities,
    developmentFee: FEES.development,
    membershipFee: FEES.membership,
    payments: row.payments,
    updatedAt: serverTimestamp(),
    ...overrides,
  });

  const saveAccount = async (row, overrides = {}) => {
    await setDoc(
      doc(db, "studentFeeAccounts", row.id),
      buildPersistedAccount(row, overrides),
      { merge: true }
    );
  };

  const openPayment = (row) => {
    setPaymentRow(row);
    setPaymentForm({ amount: row.balance ? String(row.balance) : "", method: "Cash", note: "" });
    setError("");
    setSuccess("");
  };

  const handleAddPayment = async () => {
    const amount = Number(paymentForm.amount);
    if (!paymentRow || !amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payment = {
        amount,
        method: paymentForm.method,
        note: normalizeText(paymentForm.note),
        paidAt: new Date().toISOString(),
        recordedByUid: profile?.uid || "",
        recordedByName: profile?.name || profile?.email || "User",
      };

      await saveAccount(paymentRow, {
        payments: [...paymentRow.payments, payment],
      });

      setSuccess(`Payment saved for ${getStudentName(paymentRow.student)}.`);
      setPaymentRow(null);
      await fetchData();
    } catch (err) {
      setError(`Failed to save payment: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const openMembership = (row) => {
    setMembershipRow(row);
    setSiblingSearch(row.membershipCoveredByAdmissionNo || "");
    setError("");
    setSuccess("");
  };

  const handleLinkSibling = async (sibling) => {
    if (!membershipRow || !sibling || sibling.id === membershipRow.student.id) return;

    setSaving(true);
    setError("");

    try {
      await saveAccount(membershipRow, {
        membershipCoveredByStudentId: sibling.id,
        membershipCoveredByAdmissionNo: getStudentIndex(sibling),
        membershipCoveredByName: getStudentName(sibling),
      });

      setSuccess(`${getStudentName(membershipRow.student)} membership linked to ${getStudentName(sibling)}.`);
      setMembershipRow(null);
      await fetchData();
    } catch (err) {
      setError(`Failed to link membership: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearMembership = async () => {
    if (!membershipRow) return;

    setSaving(true);
    setError("");

    try {
      await saveAccount(membershipRow, {
        membershipCoveredByStudentId: "",
        membershipCoveredByAdmissionNo: "",
        membershipCoveredByName: "",
      });

      setSuccess(`Membership fee restored for ${getStudentName(membershipRow.student)}.`);
      setMembershipRow(null);
      await fetchData();
    } catch (err) {
      setError(`Failed to clear membership link: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const exportAccounts = () => {
    const exportRows = filteredRows.map((row) => ({
      "Academic Year": academicYear,
      "Admission / Index No": getStudentIndex(row.student),
      "Student Name": getStudentName(row.student),
      Grade: parseGrade(row.student.grade),
      Section: normalizeSection(row.student.section || row.student.className),
      "Facilities Fee": row.facilitiesFee,
      "Development Fee": row.developmentFee,
      "Membership Fee": row.membershipFee,
      "Membership Covered By": row.membershipCoveredByAdmissionNo
        ? `${row.membershipCoveredByAdmissionNo} - ${row.membershipCoveredByName}`
        : "",
      "Total To Be Paid": row.totalDue,
      "Total Paid": row.totalPaid,
      Balance: row.balance,
      Status: row.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accounts");
    XLSX.writeFile(wb, `student_accounts_${academicYear}.xlsx`);
  };

  if (loading) {
    return (
      <PageContainer maxWidth="lg">
        <SectionCard>
          <Stack alignItems="center" spacing={2} py={6}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading student accounts...
            </Typography>
          </Stack>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" sx={{ pb: { xs: 10, md: 3 } }}>
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <SectionCard
          title="Student Accounts"
          subtitle="Facilities, development, and one-family membership fee tracking."
          action={
            <Button
              variant="contained"
              startIcon={<DownloadRoundedIcon />}
              onClick={exportAccounts}
              disabled={filteredRows.length === 0}
              fullWidth={isMobile}
            >
              Export
            </Button>
          }
        >
          <Grid container spacing={1.25}>
            <Grid item xs={6} md={3}>
              <StatCard
                title="Expected"
                value={money(totals.expected)}
                icon={<AccountBalanceWalletRoundedIcon />}
                color="primary"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Paid" value={money(totals.paid)} icon={<AddCardRoundedIcon />} color="success" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="To Be Paid" value={money(totals.balance)} color="warning" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                title="Not Paid"
                value={totals["Not Paid"]}
                helperText={`${totals["Part Paid"]} part paid, ${totals.Paid} paid`}
                color="error"
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard>
          <Grid container spacing={1.25} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search student or index no"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                select
                fullWidth
                label="Grade"
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {gradeOptions.map((grade) => (
                  <MenuItem key={grade} value={grade}>
                    Grade {grade}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                select
                fullWidth
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Paid">Paid</MenuItem>
                <MenuItem value="Part Paid">Part Paid</MenuItem>
                <MenuItem value="Not Paid">Not Paid</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Academic Year"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setSearch("");
                  setGradeFilter("");
                  setStatusFilter("");
                }}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard title="Full Account Sheet" subtitle={`${filteredRows.length} student account rows`}>
          {filteredRows.length === 0 ? (
            <EmptyState title="No account rows found" description="Try changing the filters or student search." />
          ) : (
            <ResponsiveTableWrapper minWidth={1180}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Index No</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell align="right">Facilities</TableCell>
                    <TableCell align="right">Development</TableCell>
                    <TableCell align="right">Membership</TableCell>
                    <TableCell align="right">To Be Paid</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Membership</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{getStudentIndex(row.student) || "-"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {getStudentName(row.student)}
                        </Typography>
                      </TableCell>
                      <TableCell>{`G${parseGrade(row.student.grade)}-${normalizeSection(
                        row.student.section || row.student.className
                      ) || "-"}`}</TableCell>
                      <TableCell align="right">{money(row.facilitiesFee)}</TableCell>
                      <TableCell align="right">{money(row.developmentFee)}</TableCell>
                      <TableCell align="right">{money(row.membershipFee)}</TableCell>
                      <TableCell align="right">{money(row.totalDue)}</TableCell>
                      <TableCell align="right">{money(row.totalPaid)}</TableCell>
                      <TableCell align="right">{money(row.balance)}</TableCell>
                      <TableCell>
                        <Chip size="small" color={statusColor(row.status)} label={row.status} sx={{ fontWeight: 800 }} />
                      </TableCell>
                      <TableCell>
                        {row.membershipRequired ? (
                          <Chip size="small" variant="outlined" label="Own fee" />
                        ) : (
                          <Chip
                            size="small"
                            color="info"
                            label={`${row.membershipCoveredByAdmissionNo || "-"} covered`}
                            sx={{ fontWeight: 800 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                          <Button size="small" variant="contained" onClick={() => openPayment(row)}>
                            Pay
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FamilyRestroomRoundedIcon />}
                            onClick={() => openMembership(row)}
                          >
                            Family
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableWrapper>
          )}
        </SectionCard>
      </Stack>

      <Dialog open={Boolean(paymentRow)} onClose={() => setPaymentRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              {paymentRow ? `${getStudentName(paymentRow.student)} balance: ${money(paymentRow.balance)}` : ""}
            </Alert>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
            />
            <TextField
              select
              fullWidth
              label="Method"
              value={paymentForm.method}
              onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}
            >
              {PAYMENT_METHODS.map((method) => (
                <MenuItem key={method} value={method}>
                  {method}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Note"
              multiline
              minRows={2}
              value={paymentForm.note}
              onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentRow(null)}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={handleAddPayment}>
            {saving ? <CircularProgress size={20} /> : "Save Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(membershipRow)} onClose={() => setMembershipRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Family Membership Link</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Search the brother or sister who pays the family membership fee, then select them.
            </Alert>
            <TextField
              fullWidth
              label="Search by index no or name"
              value={siblingSearch}
              onChange={(event) => setSiblingSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
              }}
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
                    <Typography variant="subtitle2" sx={{ fontWeight: 850 }} noWrap>
                      {getStudentName(student)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getStudentIndex(student) || "-"} | G{parseGrade(student.grade)}-
                      {normalizeSection(student.section || student.className) || "-"}
                    </Typography>
                  </Box>
                  <Button size="small" variant="contained" disabled={saving} onClick={() => handleLinkSibling(student)}>
                    Select
                  </Button>
                </Box>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearMembership} color="warning" disabled={saving || !membershipRow?.membershipCoveredByStudentId}>
            Remove Link
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setMembershipRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
