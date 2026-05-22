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
  const [state, setState] = useState(() => readLocalElectionState());
  const [entryValue, setEntryValue] = useState("");
  const [manualCountText, setManualCountText] = useState("");
  const [manualRejectedVotes, setManualRejectedVotes] = useState("");
  const [candidateLabels, setCandidateLabels] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState({ severity: "info", message: "Ready for vote entry." });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const totals = useMemo(() => getElectionTotals(state), [state]);
  const manualPreview = useMemo(() => {
    const parsed = parseManualCountRows(manualCountText);
    const rejectedFromText = parsed.rejectedVotes;
    const rejectedInputText = manualRejectedVotes.trim();
    const rejectedFromInput = Number(rejectedInputText || 0);
    const rejectedInputValid = !rejectedInputText || (Number.isInteger(rejectedFromInput) && rejectedFromInput >= 0);
    const rejectedVotes = rejectedFromText !== null ? rejectedFromText : rejectedInputValid ? rejectedFromInput : 0;
    const validVotes = Array.from(parsed.counts.values()).reduce((sum, votes) => sum + votes, 0);

    return {
      ...parsed,
      rejectedInputValid,
      rejectedVotes,
      validVotes,
      totalVotes: validVotes + rejectedVotes,
    };
  }, [manualCountText, manualRejectedVotes]);
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
  };

  const handlePublishManualCounts = async () => {
    if (manualPreview.errors.length) {
      setStatus({ severity: "error", message: manualPreview.errors.slice(0, 3).join(" ") });
      return;
    }
    if (!manualCountText.trim()) {
      setStatus({ severity: "error", message: "Enter manual candidate totals before publishing." });
      return;
    }
    if (!manualPreview.rejectedInputValid) {
      setStatus({ severity: "error", message: "Rejected votes must be 0 or more." });
      return;
    }

    const confirmed = window.confirm(
      `Replace the full election count with these manual totals?\n\nValid: ${manualPreview.validVotes}\nRejected: ${manualPreview.rejectedVotes}\nTotal: ${manualPreview.totalVotes}`
    );
    if (!confirmed) return;

    const nextState = applyManualElectionCounts(state, manualPreview.counts, manualPreview.rejectedVotes);
    await persistState(nextState);
    setStatus({
      severity: "success",
      message: "Manual count was saved locally and published online for the live page and reports.",
    });
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
          <Grid item xs={12} md={3}>
            <StatCard title="Total Counted" value={totals.totalVotes} icon={<HowToVoteRoundedIcon />} helperText="Valid and rejected ballots" />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard title="Valid Votes" value={totals.validVotes} icon={<AddCircleRoundedIcon />} color="success" />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard title="Rejected Votes" value={totals.rejectedVotes} icon={<WarningAmberRoundedIcon />} color="warning" />
          </Grid>
          <Grid item xs={12} md={3}>
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
            <Tab label="Results" />
            <Tab label="Report" />
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

          <Card>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Grid container spacing={2.25}>
                <Grid item xs={12} md={7}>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        Manual Recovery Entry
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Enter final totals from paper/counting sheets, one line per candidate. This replaces the full online count.
                      </Typography>
                    </Box>
                    <TextField
                      value={manualCountText}
                      onChange={(event) => setManualCountText(event.target.value)}
                      multiline
                      minRows={8}
                      placeholder={"1, 12\n2, 8\n20, 31\nR, 4"}
                    />
                  </Stack>
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack spacing={1.5}>
                    <Alert severity="info">
                      Use this when Firebase rejected live updates. After publishing, the live page, CSV, and print report use these manual totals.
                    </Alert>
                    <TextField
                      label="Rejected Votes"
                      value={manualRejectedVotes}
                      onChange={(event) => setManualRejectedVotes(event.target.value)}
                      error={!manualPreview.rejectedInputValid}
                      helperText={
                        manualPreview.rejectedInputValid
                          ? "Optional if you entered R, votes in the manual list."
                          : "Rejected votes must be 0 or more."
                      }
                      inputProps={{ inputMode: "numeric" }}
                    />
                    <Grid container spacing={1}>
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
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          </>
        ) : null}

        {tab === 1 ? (
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

        {tab === 2 ? (
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box className="election-report-print">
                <OfficialHeader compact />
                <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
                  <Grid item xs={12} md={4}>
                    <StatCard title="Total Votes" value={totals.totalVotes} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <StatCard title="Valid Votes" value={totals.validVotes} color="success" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <StatCard title="Rejected Votes" value={totals.rejectedVotes} color="warning" />
                  </Grid>
                </Grid>

                <Stack spacing={1.25} sx={{ mb: 2 }}>
                  <Typography variant="h6">Official Result Summary</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generated at {new Date().toLocaleString()} from the live election count document. Public live page: {liveUrl}
                  </Typography>
                </Stack>

                <CandidateResultTable candidates={totals.rankedCandidates} dense />
              </Box>
            </CardContent>
          </Card>
        ) : null}

        {tab === 3 ? (
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
