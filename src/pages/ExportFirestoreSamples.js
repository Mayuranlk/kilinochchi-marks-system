import React, { useState } from "react";
import { Button, Card, CardContent, Stack, Typography, Alert } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { exportFirestoreSamples } from "../utils/exportFirestoreSamples";
import { PageContainer } from "../components/ui";

export default function ExportFirestoreSamples() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleExport = async () => {
    try {
      setLoading(true);
      setMessage("");
      await exportFirestoreSamples();
      setMessage("Export completed. Check your Downloads folder for firestore-samples.json");
    } catch (error) {
      console.error(error);
      setMessage(`Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer title="Export Firestore Samples">
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              This will export sample documents from the main Firestore collections into a JSON file.
            </Typography>

            {message && <Alert severity="info">{message}</Alert>}

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={loading}
            >
              {loading ? "Exporting..." : "Export Sample Data"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
