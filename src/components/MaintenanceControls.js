import React, { useEffect, useState } from "react";
import { Alert, Button, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_MAINTENANCE_MESSAGE } from "./MaintenanceGate";

export default function MaintenanceControls() {
  const { user, isAdmin } = useAuth();
  const [draft, setDraft] = useState({ enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE });
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (!isAdmin) return undefined;
    return onSnapshot(doc(db, "systemSettings", "maintenance"), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const data = snapshot.data() || {};
      setDraft({ enabled: data.enabled === true, message: typeof data.message === "string" ? data.message : DEFAULT_MAINTENANCE_MESSAGE });
      setReady(true); setDirty(false); setError("");
    }, () => { setReady(false); setError("Could not load maintenance settings. Reload the page to retry."); });
  }, [isAdmin]);
  if (!isAdmin) return null;
  async function save() {
    setSaving(true); setError(""); setSuccess("");
    try {
      await setDoc(doc(db, "systemSettings", "maintenance"), { enabled: draft.enabled, message: draft.message.trim() || DEFAULT_MAINTENANCE_MESSAGE, updatedBy: user.uid, updatedAt: serverTimestamp() }, { merge: true });
      setDirty(false); setSuccess(draft.enabled ? "Maintenance enabled for teachers." : "Maintenance disabled. Teachers can access their workspace.");
    } catch { setError("Could not save maintenance settings. Please try again."); }
    finally { setSaving(false); }
  }
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
    <Stack spacing={2}>
      <Typography component="h2" variant="h6">Website maintenance</Typography>
      <Typography variant="body2" color="text.secondary">Pause teacher and sectional-head access while updates are in progress. Administrators retain access. This takes effect for signed-in teachers too; ask them to save their work before enabling it.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <FormControlLabel control={<Switch checked={draft.enabled} disabled={!ready || saving} onChange={(event) => { setDraft({ ...draft, enabled: event.target.checked }); setDirty(true); setSuccess(""); }} />} label="Enable maintenance mode" />
      <TextField label="Message for teachers" multiline minRows={3} fullWidth value={draft.message} disabled={!ready || saving} inputProps={{ maxLength: 1000 }} helperText="Shown after login on phones, tablets and computers." onChange={(event) => { setDraft({ ...draft, message: event.target.value }); setDirty(true); setSuccess(""); }} />
      <Button variant="contained" disabled={!ready || saving || !dirty} onClick={save} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>{saving ? "Saving..." : "Save maintenance settings"}</Button>
    </Stack>
  </Paper>;
}
