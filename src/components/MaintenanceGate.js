import React, { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

export const DEFAULT_MAINTENANCE_MESSAGE = "We are updating the school marks system. Please try again later. Thank you for your patience.";

// One document listener per teacher session, outside the route tree. Protected
// pages never mount until the setting is verified, avoiding their data reads.
export default function MaintenanceGate({ children }) {
  const { user, loading, isAdmin, isTeacher, isSectionalHead, logout } = useAuth();
  const uid = !loading && !isAdmin && (isTeacher || isSectionalHead) ? user?.uid : "";
  const [state, setState] = useState({ uid: "", ready: false });
  const [retry, setRetry] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    if (!uid) return undefined;
    let active = true;
    setState({ uid, ready: false });
    const unsubscribe = onSnapshot(doc(db, "systemSettings", "maintenance"), { includeMetadataChanges: true }, (snapshot) => {
      if (!active || snapshot.metadata.fromCache) return;
      const data = snapshot.data() || {};
      setState({ uid, ready: true, enabled: data.enabled === true, message: typeof data.message === "string" ? data.message.trim() : "" });
    }, () => {
      if (active) setState({ uid, ready: false, error: true });
    });
    return () => { active = false; unsubscribe(); };
  }, [uid, retry]);
  if (!loading && (!uid || (state.uid === uid && state.ready && !state.enabled))) return children;
  const current = state.uid === uid ? state : {};
  const maintenance = !loading && current.ready && current.enabled;
  return <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", bgcolor: "background.default", p: { xs: 2, sm: 4 } }}>
    <Paper variant="outlined" sx={{ width: "100%", maxWidth: 620, boxSizing: "border-box", p: { xs: 3, sm: 6 }, borderRadius: 4, textAlign: "center" }}>
      <Stack spacing={3} alignItems="center" role="status" aria-live="polite">
        <Typography variant="overline" color="text.secondary">Kilinochchi Marks System</Typography>
        {maintenance ? <Box sx={{ borderRadius: "50%", p: 3, bgcolor: "action.hover", color: "primary.main" }}><ConstructionRoundedIcon sx={{ fontSize: { xs: 64, sm: 96 } }} /></Box> : !current.error && <CircularProgress aria-label="Checking website availability" />}
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: "1.65rem", sm: "2.1rem" }, fontWeight: 800 }}>{maintenance ? "We'll be back soon" : current.error ? "Unable to check website availability" : "Checking website availability"}</Typography>
        <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{maintenance ? current.message || DEFAULT_MAINTENANCE_MESSAGE : current.error ? "Please check your connection and try again." : "Please wait while we prepare your workspace."}</Typography>
        {maintenance && <Typography variant="body2" color="text.secondary">Your workspace will reopen automatically when maintenance is complete.</Typography>}
        {current.error && <Button variant="contained" onClick={() => setRetry((value) => value + 1)}>Try again</Button>}
        {user && <Button variant="outlined" onClick={async () => { try { await logout(); } catch { setLogoutError("Could not sign out. Please try again."); } }}>Sign out</Button>}
        {logoutError && <Alert severity="error">{logoutError}</Alert>}
      </Stack>
    </Paper>
  </Box>;
}
