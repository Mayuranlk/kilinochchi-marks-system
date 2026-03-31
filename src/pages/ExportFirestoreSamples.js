import React, { useState } from "react";
import { Box, Button, Card, CardContent, Stack, Typography, Alert } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { exportFirestoreSamples } from "../utils/exportFirestoreSamples";

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
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={700}>
              Export Firestore Samples
            </Typography>

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
    </Box>
  );
}