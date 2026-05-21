import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../firebase";
import StatCard from "../components/ui/StatCard";
import {
  ELECTION_ID,
  ELECTION_LOCAL_KEY,
  ELECTION_ORGANIZER,
  ELECTION_POWERED_BY,
  ELECTION_TITLE,
  createInitialElectionState,
  formatCandidateNumber,
  getElectionTotals,
  normalizeElectionState,
} from "../utils/electionUtils";

const electionDocRef = doc(db, "elections", ELECTION_ID);

function readLocalElectionState() {
  try {
    const raw = localStorage.getItem(ELECTION_LOCAL_KEY);
    return raw ? normalizeElectionState(JSON.parse(raw)) : createInitialElectionState();
  } catch (error) {
    console.error("Election live local read error:", error);
    return createInitialElectionState();
  }
}

function saveLocalElectionState(state) {
  try {
    localStorage.setItem(ELECTION_LOCAL_KEY, JSON.stringify(normalizeElectionState(state)));
  } catch (error) {
    console.error("Election live local save error:", error);
  }
}

export default function ElectionLiveResults() {
  const [state, setState] = useState(() => readLocalElectionState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const totals = useMemo(() => getElectionTotals(state), [state]);
  const topCandidates = totals.rankedCandidates.slice(0, 12);
  const updatedText = state.updatedAtText ? new Date(state.updatedAtText).toLocaleString() : "Not available";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      electionDocRef,
      (snapshot) => {
        setLoading(false);
        if (!snapshot.exists()) {
          setError("Live count has not been initialized yet.");
          return;
        }
        const nextState = normalizeElectionState(snapshot.data());
        setState(nextState);
        saveLocalElectionState(nextState);
        setError("");
      },
      (snapshotError) => {
        console.error("Election live results sync error:", snapshotError);
        setLoading(false);
        setError("Could not connect to the live count. Showing the latest data available on this device.");
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {loading ? <LinearProgress /> : null}

      <Box
        sx={{
          px: { xs: 1.5, sm: 2.5, md: 4 },
          py: { xs: 2, md: 3 },
          maxWidth: 1500,
          mx: "auto",
        }}
      >
        <Stack spacing={2.25}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 2,
              background: "linear-gradient(135deg, rgba(29,78,216,0.12), rgba(15,118,110,0.08))",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Box
                  component="img"
                  src="/kcc-logo.png"
                  alt="Kilinochchi Central College"
                  sx={{ width: { xs: 62, md: 82 }, height: { xs: 62, md: 82 }, objectFit: "contain" }}
                />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                    {ELECTION_TITLE}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 800, mt: 0.5 }}>
                    Live Result Board
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {ELECTION_POWERED_BY}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                  <Chip color="success" label="LIVE" sx={{ mb: 1, fontWeight: 900 }} />
                  <Typography variant="body2" color="text.secondary">
                    Last updated
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                    {updatedText}
                  </Typography>
                </Box>
                <Box
                  component="img"
                  src="/board-prefects-logo.png"
                  alt="Board of Prefects"
                  sx={{ width: { xs: 72, md: 96 }, height: { xs: 72, md: 96 }, objectFit: "contain" }}
                />
              </Stack>
            </Stack>
          </Paper>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <StatCard title="Total Counted" value={totals.totalVotes} icon={<HowToVoteRoundedIcon />} helperText="Including rejected votes" />
            </Grid>
            <Grid item xs={12} md={3}>
              <StatCard title="Valid Votes" value={totals.validVotes} icon={<LeaderboardRoundedIcon />} color="success" />
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
                helperText={totals.leaderVotes ? `${totals.leaderVotes} votes` : "Counting not started"}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={5}>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, height: "100%" }}>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
                  Leading Candidates
                </Typography>

                <Stack spacing={1.25}>
                  {topCandidates.slice(0, 5).map((candidate, index) => (
                    <Paper
                      key={candidate.number}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: index === 0 ? "rgba(29,78,216,0.08)" : "background.paper",
                        borderColor: index === 0 ? "primary.light" : "divider",
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                          <Chip label={`#${index + 1}`} color={index === 0 ? "primary" : "default"} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                              Candidate {formatCandidateNumber(candidate.number)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {candidate.label}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                          {candidate.votes}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={7}>
              <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>Candidate No.</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Votes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topCandidates.map((candidate, index) => (
                      <TableRow key={candidate.number}>
                        <TableCell sx={{ fontWeight: 900 }}>{index + 1}</TableCell>
                        <TableCell>
                          <Chip label={formatCandidateNumber(candidate.number)} color={index === 0 ? "primary" : "default"} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: index < 3 ? 900 : 700 }}>{candidate.label}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, fontSize: 18 }}>
                          {candidate.votes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", display: "block", py: 1 }}>
            {ELECTION_ORGANIZER}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
