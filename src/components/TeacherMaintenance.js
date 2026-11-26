import React, { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Switch, FormControlLabel, Typography } from "@mui/material";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function useMaintenanceStatus(enabled) {
  const [state, setState] = useState({ status: "loading", enabled: false });
  useEffect(() => {
    if (!enabled) return undefined;
    setState({ status: "loading", enabled: false });
    return onSnapshot(doc(db, "systemSettings", "teacherMaintenance"), { includeMetadataChanges: true }, (snapshot) => {
      // A cached off value must not open the teacher pages during maintenance.
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      setState({ status: "ready", enabled: snapshot.exists() && snapshot.data().enabled === true });
    }, () => setState({ status: "error", enabled: false }));
  }, [enabled]);
  return state;
}

export function TeacherMaintenanceGate({ children }) {
  const { user, loading, isTeacher, isAdmin, logout } = useAuth();
  const applies = Boolean(user && !loading && isTeacher && !isAdmin);
  if (!applies) return children;
  return <TeacherMaintenanceCheck key={user.uid} logout={logout}>{children}</TeacherMaintenanceCheck>;
}

function TeacherMaintenanceCheck({ children, logout }) {
  const state = useMaintenanceStatus(true);
  if (state.status === "ready" && !state.enabled) return children;
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "background.default" }}>
      <Card sx={{ width: "100%", maxWidth: 520, p: 2 }}>
        <CardContent>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="overline" color="primary">Kilinochchi Central College</Typography>
            <Typography variant="h4" fontWeight={800}>{state.status === "ready" ? "Teacher portal under maintenance" : "Checking portal availability"}</Typography>
            {state.status === "loading" && <><CircularProgress size={24} /><Typography>Checking the current status. Please wait.</Typography></>}
            {state.status === "error" && <Alert severity="warning">The portal status could not be checked. Please check your connection and reload the page.</Alert>}
            {state.status === "ready" && <Typography color="text.secondary">The teacher portal is temporarily unavailable while the system is being updated. Please try again later.</Typography>}
            <Button variant="outlined" onClick={logout}>Sign out</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export function TeacherMaintenanceControl() {
  const state = useMaintenanceStatus(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function change(enabled) {
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "systemSettings", "teacherMaintenance"), {
        enabled, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || "",
      }, { merge: true });
    } catch (err) {
      setError(err.message || "Could not update teacher maintenance mode.");
    } finally { setSaving(false); }
  }
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={800}>Teacher portal maintenance</Typography>
          <Typography variant="body2" color="text.secondary">When enabled, teachers see a maintenance page instead of loading the portal. Administrators retain access.</Typography>
          <FormControlLabel control={<Switch checked={state.enabled} disabled={state.status !== "ready" || saving} onChange={(event) => change(event.target.checked)} />} label={state.status === "ready" ? (state.enabled ? "Maintenance enabled" : "Maintenance disabled") : "Checking status"} />
          {state.status === "error" && <Alert severity="error">Could not load the maintenance setting. Reload the page to try again.</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}
