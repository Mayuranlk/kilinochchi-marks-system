import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import BackupRoundedIcon from "@mui/icons-material/BackupRounded";
import CloudDoneRoundedIcon from "@mui/icons-material/CloudDoneRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { PageContainer } from "../components/ui";
import {
  SYSTEM_COLLECTIONS,
  createSystemBackup,
  downloadBackupFile,
  readBackupFile,
  restoreSystemBackup,
} from "../services/systemBackupService";

const formatNumber = (value) => Number(value || 0).toLocaleString("en-LK");

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const friendlyCollectionName = (name) =>
  name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export default function ExportFirestoreSamples() {
  const fileInputRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(null);

  const sortedCollectionCounts = useMemo(() => {
    if (!selectedBackup) return [];
    return Object.entries(selectedBackup.validation.counts).sort(([first], [second]) =>
      first.localeCompare(second)
    );
  }, [selectedBackup]);

  const handleBackup = async () => {
    setBackupBusy(true);
    setBackupProgress(null);
    setNotice(null);

    try {
      const backup = await createSystemBackup({ onProgress: setBackupProgress });
      downloadBackupFile(backup);
      setLastBackup(backup);
      setNotice({
        severity: "success",
        text: `Backup downloaded successfully with ${formatNumber(
          backup.summary.documentCount
        )} documents. Keep this file in a secure location.`,
      });
    } catch (error) {
      console.error(error);
      setNotice({
        severity: "error",
        text: `Backup failed before a complete file could be created: ${error.message}`,
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    setSelectedBackup(null);
    setRestoreConfirmation("");
    setRestoreProgress(null);
    setNotice(null);

    if (!file) return;

    try {
      const result = await readBackupFile(file);
      setSelectedBackup({ file, ...result });
      setNotice({
        severity: "info",
        text: "Backup checked successfully. Review the details before restoring.",
      });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup || restoreConfirmation !== "RESTORE") return;
    const approved = window.confirm(
      "Restore all documents contained in this backup? Existing matching documents will be overwritten."
    );
    if (!approved) return;

    setRestoreBusy(true);
    setRestoreProgress({ restoredCount: 0, documentCount: selectedBackup.validation.documentCount });
    setNotice(null);

    try {
      const result = await restoreSystemBackup(selectedBackup.payload, {
        onProgress: setRestoreProgress,
      });
      setNotice({
        severity: "success",
        text: `${formatNumber(
          result.restoredCount
        )} documents were restored. Refresh any open dashboards before continuing work.`,
      });
      setRestoreConfirmation("");
    } catch (error) {
      console.error(error);
      setNotice({
        severity: "error",
        text: `Restore stopped after ${formatNumber(
          restoreProgress?.restoredCount
        )} documents: ${error.message}`,
      });
    } finally {
      setRestoreBusy(false);
    }
  };

  const backupPercent = backupProgress
    ? Math.round((backupProgress.completedCollections / backupProgress.totalCollections) * 100)
    : 0;
  const restorePercent = restoreProgress?.documentCount
    ? Math.round((restoreProgress.restoredCount / restoreProgress.documentCount) * 100)
    : 0;

  return (
    <PageContainer
      title="Backup & Restore"
      subtitle="Protect the school's marks and administration data with a complete, versioned backup file."
    >
      <Stack spacing={2.5}>
        {notice ? (
          <Alert severity={notice.severity} onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}

        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    bgcolor: "primary.main",
                    backgroundColor: (theme) => `${theme.palette.primary.main}18`,
                  }}
                >
                  <SecurityRoundedIcon />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    School data protection
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {SYSTEM_COLLECTIONS.length} Firestore collections are included in every backup.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip icon={<CloudDoneRoundedIcon />} color="success" label="Firestore included" />
                <Chip variant="outlined" label="Admin only" />
                <Chip variant="outlined" label="Validated before restore" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2.5} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent sx={{ p: { xs: 2, md: 3 }, height: "100%" }}>
                <Stack spacing={2.25} height="100%">
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <BackupRoundedIcon color="primary" />
                    <Box>
                      <Typography variant="h6" fontWeight={800}>
                        Download full backup
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Creates one JSON file containing every document used by the school system.
                      </Typography>
                    </Box>
                  </Stack>

                  <Alert severity="info" variant="outlined">
                    Store the downloaded file in a restricted school Drive folder or another secure location.
                  </Alert>

                  {backupBusy ? (
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          Reading {friendlyCollectionName(backupProgress?.collectionName || "data")}…
                        </Typography>
                        <Typography variant="caption" fontWeight={700}>
                          {backupPercent}%
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={backupPercent} />
                    </Box>
                  ) : null}

                  {lastBackup ? (
                    <Typography variant="body2" color="text.secondary">
                      Last downloaded in this session: {new Date(lastBackup.createdAt).toLocaleString("en-LK")} ·{" "}
                      {formatNumber(lastBackup.summary.documentCount)} documents
                    </Typography>
                  ) : null}

                  <Box sx={{ mt: "auto !important" }}>
                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      startIcon={<DownloadRoundedIcon />}
                      onClick={handleBackup}
                      disabled={backupBusy || restoreBusy}
                    >
                      {backupBusy ? "Creating complete backup…" : "Create & Download Backup"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent sx={{ p: { xs: 2, md: 3 }, height: "100%" }}>
                <Stack spacing={2.25} height="100%">
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <RestoreRoundedIcon color="warning" />
                    <Box>
                      <Typography variant="h6" fontWeight={800}>
                        Restore from backup
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Upload a backup from this Firebase project and restore its saved documents.
                      </Typography>
                    </Box>
                  </Stack>

                  <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
                    Matching live documents will be replaced. Newer documents not present in the backup will remain.
                  </Alert>

                  <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept="application/json,.json"
                    onChange={handleFileSelected}
                  />
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<UploadFileRoundedIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={backupBusy || restoreBusy}
                  >
                    Choose Backup File
                  </Button>

                  {selectedBackup ? (
                    <Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                      <Typography fontWeight={750} noWrap title={selectedBackup.file.name}>
                        {selectedBackup.file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {new Date(selectedBackup.payload.createdAt).toLocaleString("en-LK")} ·{" "}
                        {formatFileSize(selectedBackup.file.size)} ·{" "}
                        {formatNumber(selectedBackup.validation.documentCount)} documents
                      </Typography>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {sortedCollectionCounts.map(([name, count]) => (
                          <Chip
                            key={name}
                            size="small"
                            variant="outlined"
                            label={`${friendlyCollectionName(name)}: ${formatNumber(count)}`}
                          />
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  {selectedBackup ? (
                    <TextField
                      label='Type "RESTORE" to confirm'
                      value={restoreConfirmation}
                      onChange={(event) => setRestoreConfirmation(event.target.value.toUpperCase())}
                      disabled={restoreBusy}
                      autoComplete="off"
                    />
                  ) : null}

                  {restoreBusy ? (
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          Restored {formatNumber(restoreProgress?.restoredCount)} of{" "}
                          {formatNumber(restoreProgress?.documentCount)}
                        </Typography>
                        <Typography variant="caption" fontWeight={700}>
                          {restorePercent}%
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={restorePercent} color="warning" />
                    </Box>
                  ) : null}

                  {selectedBackup ? (
                    <Box sx={{ mt: "auto !important" }}>
                      <Button
                        fullWidth
                        size="large"
                        color="warning"
                        variant="contained"
                        startIcon={<RestoreRoundedIcon />}
                        onClick={handleRestore}
                        disabled={restoreBusy || backupBusy || restoreConfirmation !== "RESTORE"}
                      >
                        {restoreBusy ? "Restoring school data…" : "Restore This Backup"}
                      </Button>
                    </Box>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}>
            <Grid container spacing={2.5} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <CloudOffRoundedIcon color="disabled" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Automatic backup to Google Drive
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
                      A browser cannot run scheduled backups after it is closed. This option needs a secure Firebase
                      scheduled function, Drive API access, and a school Drive folder shared with that service. It is
                      kept off until those cloud services are configured.
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack alignItems={{ xs: "flex-start", md: "flex-end" }} spacing={0.5}>
                  <FormControlLabel
                    control={<Switch checked={false} disabled />}
                    label="Automatic Drive backup"
                    sx={{ mr: 0 }}
                  />
                  <Chip size="small" variant="outlined" label="Cloud setup required" />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Alert severity="info">
          This page backs up Firestore school data. Firebase Authentication passwords and account credentials are
          managed separately by Firebase and are not placed in the downloadable JSON file.
        </Alert>
      </Stack>
    </PageContainer>
  );
}
