import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PageContainer from "../components/ui/PageContainer";
import StatCard from "../components/ui/StatCard";
import {
  ELECTION_ID,
  ELECTION_LOCAL_KEY,
  ELECTION_ORGANIZER,
  ELECTION_POWERED_BY,
  ELECTION_TITLE,
  applyVoteEntry,
  applyManualElectionCounts,
  createInitialElectionState,
  electionToCsv,
  formatCandidateNumber,
  getElectionTotals,
  makeEntry,
  normalizeElectionState,
  parseManualCountRows,
  parseVoteInput,
  undoLastEntry,
  updateCandidateLabels,
} from "../utils/electionUtils";

const electionDocRef = doc(db, "elections", ELECTION_ID);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readLocalElectionState() {
  try {
    const raw = localStorage.getItem(ELECTION_LOCAL_KEY);
    return raw ? normalizeElectionState(JSON.parse(raw)) : createInitialElectionState();
  } catch (error) {
    console.error("Election local state read error:", error);
    return createInitialElectionState();
  }
}

function saveLocalElectionState(state) {
  try {
    localStorage.setItem(ELECTION_LOCAL_KEY, JSON.stringify(normalizeElectionState(state)));
  } catch (error) {
    console.error("Election local state save error:", error);
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function makeManualVoteInputs(state) {
  const normalized = normalizeElectionState(state);
  return normalized.candidates.reduce((inputs, candidate) => {
    inputs[candidate.number] = String(Number(candidate.votes || 0));
    return inputs;
  }, {});
}

function normalizeVoteInputValue(value) {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  if (!cleaned) return "";
  return String(Math.max(0, Number(cleaned)));
}

function OfficialHeader({ compact = false }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: compact ? 1.5 : 2, md: compact ? 2 : 2.5 },
        borderRadius: 2,
        background: "linear-gradient(135deg, rgba(29,78,216,0.10), rgba(15,118,110,0.08))",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            component="img"
            src="/kcc-logo.png"
            alt="Kilinochchi Central College"
            sx={{ width: compact ? 54 : 68, height: compact ? 54 : 68, objectFit: "contain", flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant={compact ? "h6" : "h5"} sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              {ELECTION_TITLE}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {ELECTION_POWERED_BY}
            </Typography>
          </Box>
        </Stack>

        <Box
          component="img"
          src="/board-prefects-logo.png"
          alt="Board of Prefects"
          sx={{ width: compact ? 62 : 84, height: compact ? 62 : 84, objectFit: "contain" }}
        />
      </Stack>
    </Paper>
  );
}

function CandidateResultTable({ candidates, dense = false, limit }) {
  const visibleCandidates = limit ? candidates.slice(0, limit) : candidates;

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size={dense ? "small" : "medium"}>
        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Candidate</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Votes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleCandidates.map((candidate, index) => (
            <TableRow key={candidate.number}>
              <TableCell sx={{ fontWeight: 800 }}>{index + 1}</TableCell>
              <TableCell>
                <Chip label={formatCandidateNumber(candidate.number)} size="small" color={index === 0 ? "primary" : "default"} />
              </TableCell>
              <TableCell sx={{ fontWeight: index < 3 ? 800 : 600 }}>{candidate.label}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 900, fontSize: dense ? 14 : 16 }}>
                {candidate.votes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ElectionCount() {
  const { profile } = useAuth();
  const inputRef = useRef(null);
  const manualInputRefs = useRef({});
  const registeredVotersInputRef = useRef(null);
  const votedVotersInputRef = useRef(null);
  const rejectedInputRef = useRef(null);
  const [state, setState] = useState(() => readLocalElectionState());
  const [entryValue, setEntryValue] = useState("");
  const [manualVoteInputs, setManualVoteInputs] = useState({});
  const [hasManualDraft, setHasManualDraft] = useState(false);
  const [manualCountText, setManualCountText] = useState("");
  const [manualRegisteredVoters, setManualRegisteredVoters] = useState("");
  const [manualVotedVoters, setManualVotedVoters] = useState("");
  const [manualRejectedVotes, setManualRejectedVotes] = useState("");
  const [candidateLabels, setCandidateLabels] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState({ severity: "info", message: "Ready for vote entry." });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const totals = useMemo(() => getElectionTotals(state), [state]);
  const manualPreview = useMemo(() => {
    const counts = new Map();
    const errors = [];

    state.candidates.forEach((candidate) => {
      const rawValue = manualVoteInputs[candidate.number] ?? "";
      if (rawValue === "") {
        counts.set(candidate.number, 0);
        return;
      }

      const votes = Number(rawValue);
      if (!Number.isInteger(votes) || votes < 0) {
        errors.push(`Candidate ${formatCandidateNumber(candidate.number)}: votes must be 0 or more.`);
        counts.set(candidate.number, 0);
        return;
      }

      counts.set(candidate.number, votes);
    });

    const rejectedInputText = manualRejectedVotes.trim();
    const rejectedFromInput = Number(rejectedInputText || 0);
    const rejectedInputValid = !rejectedInputText || (Number.isInteger(rejectedFromInput) && rejectedFromInput >= 0);
    const rejectedVotes = rejectedInputValid ? rejectedFromInput : 0;
    const registeredInputText = manualRegisteredVoters.trim();
    const registeredFromInput = Number(registeredInputText || 0);
    const registeredInputValid = !registeredInputText || (Number.isInteger(registeredFromInput) && registeredFromInput >= 0);
    const registeredVoters = registeredInputValid ? registeredFromInput : 0;
    const votedInputText = manualVotedVoters.trim();
    const votedFromInput = Number(votedInputText || 0);
    const votedInputValid = !votedInputText || (Number.isInteger(votedFromInput) && votedFromInput >= 0);
    const votedVoters = votedInputValid ? votedFromInput : 0;
    const voterCountValid = !registeredInputValid || !votedInputValid || registeredVoters === 0 || votedVoters <= registeredVoters;
    const validVotes = Array.from(counts.values()).reduce((sum, votes) => sum + votes, 0);

    return {
      counts,
      errors,
      registeredInputValid,
      votedInputValid,
      voterCountValid,
      registeredVoters,
      votedVoters,
      rejectedInputValid,
      rejectedVotes,
      validVotes,
      totalVotes: validVotes + rejectedVotes,
    };
  }, [manualRegisteredVoters, manualRejectedVotes, manualVoteInputs, manualVotedVoters, state.candidates]);
  const filteredCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();
    if (!query) return totals.rankedCandidates;
    return totals.rankedCandidates.filter(
      (candidate) =>
        String(candidate.number).includes(query) ||
        candidate.label.toLowerCase().includes(query) ||
        formatCandidateNumber(candidate.number).includes(query)
    );
  }, [candidateSearch, totals.rankedCandidates]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      electionDocRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const remoteState = normalizeElectionState(snapshot.data());
        setState(remoteState);
        saveLocalElectionState(remoteState);
      },
      (error) => {
        console.error("Election live sync error:", error);
        setStatus({
          severity: "warning",
          message: "Could not read live Firebase data. Local backup is still active on this browser.",
        });
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    if (hasManualDraft) return;
    setManualVoteInputs(makeManualVoteInputs(state));
    setManualRegisteredVoters(String(Number(state.registeredVoters || 0)));
    setManualVotedVoters(String(Number(state.votedVoters || 0)));
    setManualRejectedVotes(String(Number(state.rejectedVotes || 0)));
  }, [hasManualDraft, state]);

  const persistState = async (nextState) => {
    const normalized = normalizeElectionState(nextState);
    setState(normalized);
    saveLocalElectionState(normalized);
    setIsSyncing(true);

    try {
      await setDoc(
        electionDocRef,
        {
          ...normalized,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setStatus({ severity: "success", message: "Saved online and backed up locally." });
    } catch (error) {
      console.error("Election save error:", error);
      setStatus({
        severity: "warning",
        message: "Saved locally, but online sync failed. Check internet/Firebase rules before public live display.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const recordEntry = async (entry) => {
    const optimisticState = applyVoteEntry(state, entry);
    setState(optimisticState);
    saveLocalElectionState(optimisticState);
    setIsSyncing(true);

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(electionDocRef);
        const baseState = snapshot.exists() ? normalizeElectionState(snapshot.data()) : createInitialElectionState();
        const nextState = applyVoteEntry(baseState, entry);
        transaction.set(electionDocRef, { ...nextState, updatedAt: serverTimestamp() }, { merge: true });
      });
      setStatus({
        severity: "success",
        message:
          entry.type === "rejected"
            ? "Rejected vote recorded."
            : `Vote recorded for Candidate ${formatCandidateNumber(entry.candidateNumber)}.`,
      });
    } catch (error) {
      console.error("Election vote transaction error:", error);
      setStatus({
        severity: "warning",
        message: "Vote was kept in local backup, but Firebase did not accept the update.",
      });
    } finally {
      setIsSyncing(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmitEntry = async (event) => {
    event.preventDefault();
    const parsed = parseVoteInput(entryValue);
    setEntryValue("");

    if (parsed.type === "empty") return;
    if (parsed.type === "invalid") {
      setStatus({ severity: "error", message: parsed.message });
      return;
    }
    if (parsed.type === "undo") {
      await handleUndo();
      return;
    }

    const candidate = state.candidates.find((item) => item.number === parsed.number);
    const entry = makeEntry({
      type: parsed.type,
      candidateNumber: parsed.number || null,
      label: parsed.type === "rejected" ? "Rejected vote" : candidate?.label || "",
      operatorName: profile?.name || profile?.email || "",
    });

    await recordEntry(entry);
  };

  const handleUndo = async () => {
    const result = undoLastEntry(state);
    if (!result.undone) {
      setStatus({ severity: "info", message: "No recent entry is available to undo." });
      inputRef.current?.focus();
      return;
    }

    await persistState(result.state);
    setStatus({
      severity: "success",
      message:
        result.undone.type === "rejected"
          ? "Last rejected vote was undone."
          : `Last vote for Candidate ${formatCandidateNumber(result.undone.candidateNumber)} was undone.`,
    });
  };

  const handleSaveCandidateLabels = async () => {
    const nextState = updateCandidateLabels(state, candidateLabels);
    await persistState(nextState);
    setCandidateLabels("");
  };

  const handleInitializeOnline = async () => {
    await persistState(normalizeElectionState(state));
  };

  const handleResetCounts = async () => {
    const confirmed = window.confirm("Reset all candidate votes, rejected votes, and recent entries for this election?");
    if (!confirmed) return;
    await persistState(createInitialElectionState());
    setHasManualDraft(false);
  };

  const handleManualVoteChange = (candidateNumber, value) => {
    setHasManualDraft(true);
    setManualVoteInputs((current) => ({
      ...current,
      [candidateNumber]: normalizeVoteInputValue(value),
    }));
  };

  const handleRejectedVoteChange = (value) => {
    setHasManualDraft(true);
    setManualRejectedVotes(normalizeVoteInputValue(value));
  };

  const handleRegisteredVotersChange = (value) => {
    setHasManualDraft(true);
    setManualRegisteredVoters(normalizeVoteInputValue(value));
  };

  const handleVotedVotersChange = (value) => {
    setHasManualDraft(true);
    setManualVotedVoters(normalizeVoteInputValue(value));
  };

  const handleManualVoteKeyDown = (event, candidateNumber) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const currentIndex = state.candidates.findIndex((candidate) => candidate.number === candidateNumber);
    const nextCandidate = state.candidates[currentIndex + 1];

    if (nextCandidate) {
      manualInputRefs.current[nextCandidate.number]?.focus();
    } else {
      registeredVotersInputRef.current?.focus();
    }
  };

  const handleRegisteredVotersKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    votedVotersInputRef.current?.focus();
  };

  const handleVotedVotersKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    rejectedInputRef.current?.focus();
  };

  const handleRejectedVoteKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handlePublishManualCounts();
  };

  const handleLoadCurrentCounts = () => {
    setManualVoteInputs(makeManualVoteInputs(state));
    setManualRegisteredVoters(String(Number(state.registeredVoters || 0)));
    setManualVotedVoters(String(Number(state.votedVoters || 0)));
    setManualRejectedVotes(String(Number(state.rejectedVotes || 0)));
    setManualCountText("");
    setHasManualDraft(false);
    setStatus({ severity: "info", message: "Manual entry boxes were filled with the current online/local count." });
  };

  const handleApplyPastedCounts = () => {
    const parsed = parseManualCountRows(manualCountText);
    if (parsed.errors.length) {
      setStatus({ severity: "error", message: parsed.errors.slice(0, 3).join(" ") });
      return;
    }
    if (!manualCountText.trim()) {
      setStatus({ severity: "error", message: "Paste candidate totals before filling the manual boxes." });
      return;
    }

    setManualVoteInputs((current) => {
      const next = { ...current };
      parsed.counts.forEach((votes, candidateNumber) => {
        next[candidateNumber] = String(votes);
      });
      return next;
    });
    if (parsed.rejectedVotes !== null) {
      setManualRejectedVotes(String(parsed.rejectedVotes));
    }
    setHasManualDraft(true);
    setStatus({ severity: "success", message: "Pasted result sheet was loaded into the manual vote boxes." });
  };

  const handlePublishManualCounts = async () => {
    if (manualPreview.errors.length) {
      setStatus({ severity: "error", message: manualPreview.errors.slice(0, 3).join(" ") });
      return;
    }
    if (!manualPreview.rejectedInputValid) {
      setStatus({ severity: "error", message: "Rejected votes must be 0 or more." });
      return;
    }
    if (!manualPreview.registeredInputValid) {
      setStatus({ severity: "error", message: "Registered voters must be 0 or more." });
      return;
    }
    if (!manualPreview.votedInputValid) {
      setStatus({ severity: "error", message: "Voters who voted must be 0 or more." });
      return;
    }
    if (!manualPreview.voterCountValid) {
      setStatus({ severity: "error", message: "Voters who voted cannot be more than registered voters." });
      return;
    }

    const confirmed = window.confirm(
      `Replace the full election count with these manual totals?\n\nRegistered voters: ${manualPreview.registeredVoters}\nVoters who voted: ${manualPreview.votedVoters}\nValid votes: ${manualPreview.validVotes}\nRejected votes: ${manualPreview.rejectedVotes}\nTotal votes cast: ${manualPreview.totalVotes}`
    );
    if (!confirmed) return;

    const nextState = applyManualElectionCounts(state, manualPreview.counts, manualPreview.rejectedVotes, {
      registeredVoters: manualPreview.registeredVoters,
      votedVoters: manualPreview.votedVoters,
    });
    await persistState(nextState);
    setHasManualDraft(false);
    setStatus({
      severity: "success",
      message: "Manual count was saved locally and published online for the live page and reports.",
    });
  };

  const handlePrintNoticeBoard = () => {
    const rows = totals.rankedCandidates
      .map(
        (candidate, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatCandidateNumber(candidate.number)}</td>
            <td>${escapeHtml(candidate.label)}</td>
            <td>${Number(candidate.votes || 0)}</td>
          </tr>`
      )
      .join("");
    const generatedAt = new Date().toLocaleString();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setStatus({ severity: "error", message: "Unable to open print window. Please allow pop-ups for this site." });
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(ELECTION_TITLE)} - Notice Board Results</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; }
            .sheet { width: 100%; }
            .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid #111827; padding-bottom: 12px; }
            .logo { width: 78px; height: 78px; object-fit: contain; }
            .title { text-align: center; flex: 1; }
            h1 { margin: 0; font-size: 22px; letter-spacing: 0; text-transform: uppercase; }
            h2 { margin: 6px 0 0; font-size: 17px; letter-spacing: 0; }
            .meta { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0; }
            .stat { border: 1px solid #111827; padding: 9px 10px; text-align: center; }
            .stat-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .stat-value { display: block; margin-top: 3px; font-size: 21px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #111827; padding: 5px 6px; }
            th { text-transform: uppercase; font-size: 10px; background: #e5e7eb; }
            td:nth-child(1), td:nth-child(2), td:nth-child(4) { text-align: center; font-weight: 800; }
            td:nth-child(4) { font-size: 12px; }
            .footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 28px; font-size: 11px; text-align: center; }
            .signature { border-top: 1px solid #111827; padding-top: 6px; }
            .generated { margin-top: 10px; text-align: right; font-size: 9px; color: #374151; }
          </style>
        </head>
        <body>
          <main class="sheet">
            <section class="header">
              <img class="logo" src="${window.location.origin}/kcc-logo.png" alt="">
              <div class="title">
                <h1>${escapeHtml(ELECTION_TITLE)}</h1>
                <h2>Official Notice Board Result Sheet</h2>
                <div>${escapeHtml(ELECTION_ORGANIZER)}</div>
              </div>
              <img class="logo" src="${window.location.origin}/board-prefects-logo.png" alt="">
            </section>
            <section class="meta">
              <div class="stat"><span class="stat-label">Registered Voters</span><span class="stat-value">${totals.registeredVoters}</span></div>
              <div class="stat"><span class="stat-label">Voters Who Voted</span><span class="stat-value">${totals.votedVoters}</span></div>
              <div class="stat"><span class="stat-label">Valid Votes</span><span class="stat-value">${totals.validVotes}</span></div>
              <div class="stat"><span class="stat-label">Rejected Votes</span><span class="stat-value">${totals.rejectedVotes}</span></div>
              <div class="stat"><span class="stat-label">Votes Cast</span><span class="stat-value">${totals.totalVotes}</span></div>
            </section>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate No.</th>
                  <th>Candidate Name</th>
                  <th>Votes</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <section class="footer">
              <div class="signature">Prepared By</div>
              <div class="signature">Election Committee</div>
              <div class="signature">Principal</div>
            </section>
            <div class="generated">Generated: ${escapeHtml(generatedAt)}</div>
          </main>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleExport = () => {
    downloadText("student-parliament-election-2026-results.csv", electionToCsv(state));
  };

  const lastEntry = state.entries?.[0];
  const liveUrl = `${window.location.origin}/election-live`;

  return (
    <PageContainer
      title="Election Counting Console"
      subtitle={ELECTION_ORGANIZER}
      actions={
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={<PublicRoundedIcon />} href="/election-live" target="_blank">
            Live Page
          </Button>
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleExport}>
            Export CSV
          </Button>
          <Button variant="contained" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
            Print Report
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2.25}>
        <OfficialHeader />

        {isSyncing ? <LinearProgress /> : null}

        <Alert severity={status.severity} icon={status.severity === "warning" ? <WarningAmberRoundedIcon /> : undefined}>
          {status.message} {isOnline ? "Online connection detected." : "This browser is offline; local backup is active."}
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <StatCard title="Registered Voters" value={totals.registeredVoters} icon={<HowToVoteRoundedIcon />} helperText="Manual entry" />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <StatCard title="Voters Voted" value={totals.votedVoters} icon={<HowToVoteRoundedIcon />} helperText="Manual entry" />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <StatCard title="Votes Cast" value={totals.totalVotes} icon={<HowToVoteRoundedIcon />} helperText="Valid and rejected votes" />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <StatCard title="Valid Votes" value={totals.validVotes} icon={<AddCircleRoundedIcon />} color="success" />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <StatCard title="Rejected Votes" value={totals.rejectedVotes} icon={<WarningAmberRoundedIcon />} color="warning" />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <StatCard
              title={totals.leaders.length > 1 ? "Current Tie" : "Current Leader"}
              value={
                totals.leaders.length
                  ? totals.leaders.map((candidate) => formatCandidateNumber(candidate.number)).join(", ")
                  : "-"
              }
              icon={<AssessmentRoundedIcon />}
              helperText={totals.leaderVotes ? `${totals.leaderVotes} votes` : "No votes yet"}
            />
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ borderRadius: 2 }}>
          <Tabs value={tab} onChange={(event, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
            <Tab label="Count" />
            <Tab label="Manual Count" />
            <Tab label="Results" />
            <Tab label="Report" />
            <Tab label="Notice Board" />
            <Tab label="Candidates" />
          </Tabs>
        </Paper>

        {tab === 0 ? (
          <>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <Card>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={2.25}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        Fast Vote Entry
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Type candidate number and press Enter. Use R for rejected vote, U for undo.
                      </Typography>
                    </Box>

                    <Box component="form" onSubmit={handleSubmitEntry}>
                      <TextField
                        inputRef={inputRef}
                        value={entryValue}
                        onChange={(event) => setEntryValue(event.target.value)}
                        placeholder="Example: 20, 150, R, U"
                        autoComplete="off"
                        inputProps={{
                          inputMode: "text",
                          style: {
                            fontSize: 42,
                            fontWeight: 900,
                            textAlign: "center",
                            letterSpacing: 0,
                            paddingTop: 22,
                            paddingBottom: 22,
                          },
                        }}
                      />
                    </Box>

                    <Grid container spacing={1.25}>
                      <Grid item xs={12} sm={4}>
                        <Button fullWidth variant="contained" startIcon={<AddCircleRoundedIcon />} onClick={() => inputRef.current?.focus()}>
                          Ready
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="warning"
                          startIcon={<WarningAmberRoundedIcon />}
                          onClick={() =>
                            recordEntry(
                              makeEntry({
                                type: "rejected",
                                label: "Rejected vote",
                                operatorName: profile?.name || profile?.email || "",
                              })
                            )
                          }
                        >
                          Rejected Vote
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button fullWidth variant="outlined" startIcon={<UndoRoundedIcon />} onClick={handleUndo}>
                          Undo Last
                        </Button>
                      </Grid>
                    </Grid>

                    <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                        Last Entry
                      </Typography>
                      <Typography variant="h6" sx={{ mt: 0.5 }}>
                        {lastEntry
                          ? lastEntry.type === "rejected"
                            ? "Rejected vote"
                            : `Candidate ${formatCandidateNumber(lastEntry.candidateNumber)} - ${lastEntry.label}`
                          : "No entries yet"}
                      </Typography>
                    </Paper>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Card>
                <CardContent sx={{ p: 2.25 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Recent Entries
                  </Typography>
                  <Stack spacing={1} sx={{ maxHeight: 460, overflowY: "auto", pr: 0.5 }}>
                    {(state.entries || []).slice(0, 30).map((entry, index) => (
                      <Paper key={entry.id || index} elevation={0} sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                              {entry.type === "rejected"
                                ? "Rejected vote"
                                : `Candidate ${formatCandidateNumber(entry.candidateNumber)}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {entry.label || "-"}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(entry.createdAtText).toLocaleTimeString()}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                    {!state.entries?.length ? (
                      <Typography variant="body2" color="text.secondary">
                        Entries will appear here as counting starts.
                      </Typography>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          </>
        ) : null}

        {tab === 1 ? (
          <Grid container spacing={2}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={1.75}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        Enter Candidate Vote Totals
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Type each candidate's final vote count. Valid votes are calculated from these boxes. Registered voters, voters who voted, and rejected votes are entered separately.
                      </Typography>
                    </Box>

                    <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 560 }}>
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Candidate</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell align="right">Votes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {state.candidates.map((candidate) => (
                            <TableRow key={candidate.number}>
                              <TableCell sx={{ width: 130, fontWeight: 900 }}>
                                {formatCandidateNumber(candidate.number)}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{candidate.label}</TableCell>
                              <TableCell align="right" sx={{ width: 150 }}>
                                <TextField
                                  inputRef={(element) => {
                                    if (element) {
                                      manualInputRefs.current[candidate.number] = element;
                                    } else {
                                      delete manualInputRefs.current[candidate.number];
                                    }
                                  }}
                                  value={manualVoteInputs[candidate.number] ?? ""}
                                  onChange={(event) => handleManualVoteChange(candidate.number, event.target.value)}
                                  onKeyDown={(event) => handleManualVoteKeyDown(event, candidate.number)}
                                  size="small"
                                  inputProps={{
                                    inputMode: "numeric",
                                    style: { textAlign: "right", fontWeight: 900 },
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Stack spacing={2}>
                <Card>
                  <CardContent sx={{ p: 2.25 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        Manual Total
                      </Typography>
                      <TextField
                        inputRef={registeredVotersInputRef}
                        label="Registered Voters"
                        value={manualRegisteredVoters}
                        onChange={(event) => handleRegisteredVotersChange(event.target.value)}
                        onKeyDown={handleRegisteredVotersKeyDown}
                        error={!manualPreview.registeredInputValid}
                        helperText={manualPreview.registeredInputValid ? "Total students registered to vote." : "Registered voters must be 0 or more."}
                        inputProps={{ inputMode: "numeric" }}
                      />
                      <TextField
                        inputRef={votedVotersInputRef}
                        label="Voters Who Voted"
                        value={manualVotedVoters}
                        onChange={(event) => handleVotedVotersChange(event.target.value)}
                        onKeyDown={handleVotedVotersKeyDown}
                        error={!manualPreview.votedInputValid || !manualPreview.voterCountValid}
                        helperText={
                          !manualPreview.votedInputValid
                            ? "Voters who voted must be 0 or more."
                            : manualPreview.voterCountValid
                              ? "Students who actually voted."
                              : "Cannot be more than registered voters."
                        }
                        inputProps={{ inputMode: "numeric" }}
                      />
                      <TextField
                        inputRef={rejectedInputRef}
                        label="Rejected Votes"
                        value={manualRejectedVotes}
                        onChange={(event) => handleRejectedVoteChange(event.target.value)}
                        onKeyDown={handleRejectedVoteKeyDown}
                        error={!manualPreview.rejectedInputValid}
                        helperText={manualPreview.rejectedInputValid ? "Enter rejected ballots here." : "Rejected votes must be 0 or more."}
                        inputProps={{ inputMode: "numeric" }}
                      />
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <StatCard title="Registered" value={manualPreview.registeredVoters} />
                        </Grid>
                        <Grid item xs={6}>
                          <StatCard title="Voted" value={manualPreview.votedVoters} />
                        </Grid>
                        <Grid item xs={4}>
                          <StatCard title="Valid" value={manualPreview.validVotes} color="success" />
                        </Grid>
                        <Grid item xs={4}>
                          <StatCard title="Rejected" value={manualPreview.rejectedVotes} color="warning" />
                        </Grid>
                        <Grid item xs={4}>
                          <StatCard title="Total" value={manualPreview.totalVotes} />
                        </Grid>
                      </Grid>
                      {manualPreview.errors.length ? (
                        <Alert severity="error">{manualPreview.errors.slice(0, 4).join(" ")}</Alert>
                      ) : null}
                      <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={handlePublishManualCounts}>
                        Publish Manual Count Online
                      </Button>
                      <Button variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={handleLoadCurrentCounts}>
                        Load Current Counts
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent sx={{ p: 2.25 }}>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                          Paste Result Sheet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Format: candidate number, votes. Add R, votes for rejected ballots if needed.
                        </Typography>
                      </Box>
                      <TextField
                        value={manualCountText}
                        onChange={(event) => setManualCountText(event.target.value)}
                        multiline
                        minRows={7}
                        placeholder={"1, 12\n2, 8\n20, 31\nR, 4"}
                      />
                      <Button variant="outlined" startIcon={<AddCircleRoundedIcon />} onClick={handleApplyPastedCounts}>
                        Fill Boxes From Paste
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        ) : null}

        {tab === 2 ? (
          <Stack spacing={2}>
            <TextField
              value={candidateSearch}
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder="Search candidate number or name"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
              }}
            />
            <CandidateResultTable candidates={filteredCandidates} />
          </Stack>
        ) : null}

        {tab === 3 ? (
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box className="election-report-print">
                <OfficialHeader compact />
                <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
                  <Grid item xs={12} sm={6} md={2}>
                    <StatCard title="Registered Voters" value={totals.registeredVoters} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <StatCard title="Voters Voted" value={totals.votedVoters} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <StatCard title="Votes Cast" value={totals.totalVotes} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <StatCard title="Valid Votes" value={totals.validVotes} color="success" />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <StatCard title="Rejected Votes" value={totals.rejectedVotes} color="warning" />
                  </Grid>
                </Grid>

                <Stack spacing={1.25} sx={{ mb: 2 }}>
                  <Typography variant="h6">Official Result Summary</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generated at {new Date().toLocaleString()} from the live election count document. Public live page: {liveUrl}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Voters and votes are recorded separately because one voter may cast more than one vote.
                  </Typography>
                </Stack>

                <CandidateResultTable candidates={totals.rankedCandidates} dense />
              </Box>
            </CardContent>
          </Card>
        ) : null}

        {tab === 4 ? (
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent="space-between">
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      Notice Board Result Sheet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Print this official sheet and paste it on the school notice board after publishing final totals.
                    </Typography>
                  </Box>
                  <Button variant="contained" startIcon={<PrintRoundedIcon />} onClick={handlePrintNoticeBoard}>
                    Print Notice Sheet
                  </Button>
                </Stack>

                <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <OfficialHeader compact />
                  <Typography variant="h5" sx={{ fontWeight: 900, textAlign: "center", mt: 2 }}>
                    Official Notice Board Result Sheet
                  </Typography>
                  <Grid container spacing={2} sx={{ my: 2 }}>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard title="Registered Voters" value={totals.registeredVoters} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard title="Voters Voted" value={totals.votedVoters} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard title="Valid Votes" value={totals.validVotes} color="success" />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard title="Rejected Votes" value={totals.rejectedVotes} color="warning" />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard title="Votes Cast" value={totals.totalVotes} />
                    </Grid>
                  </Grid>
                  <CandidateResultTable candidates={totals.rankedCandidates} dense />
                </Paper>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {tab === 5 ? (
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Card>
                <CardContent sx={{ p: 2.25 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Candidate Names</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Optional format: one candidate per line as number,name. Example: 20,Arun Kumar
                    </Typography>
                    <TextField
                      value={candidateLabels}
                      onChange={(event) => setCandidateLabels(event.target.value)}
                      multiline
                      minRows={10}
                      placeholder={"1,Student Name\n2,Student Name\n150,Student Name"}
                    />
                    <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={handleSaveCandidateLabels}>
                      Save Candidate Names
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card>
                <CardContent sx={{ p: 2.25 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Election Controls</Typography>
                    <Alert severity="info">Initialize creates or refreshes the online Firebase document using the current local data.</Alert>
                    <Button variant="outlined" startIcon={<PublicRoundedIcon />} onClick={handleInitializeOnline}>
                      Initialize Online Count
                    </Button>
                    <Divider />
                    <Tooltip title="Use only before counting starts or if the election committee requests a complete reset.">
                      <Button color="error" variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={handleResetCounts}>
                        Reset Election Count
                      </Button>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Stack>
    </PageContainer>
  );
}
