import React from "react";
import { Chip } from "@mui/material";

const statusConfig = {
  completed: { label: "Completed", color: "success", variant: "filled" },
  pending: { label: "Pending", color: "warning", variant: "filled" },
  active: { label: "Active", color: "primary", variant: "filled" },
  inactive: { label: "Inactive", color: "default", variant: "outlined" },
  absent: { label: "Absent", color: "error", variant: "filled" },
  saved: { label: "Saved", color: "success", variant: "filled" },
  draft: { label: "Draft", color: "info", variant: "filled" },
  error: { label: "Error", color: "error", variant: "filled" },
};

const StatusChip = ({ status, label, sx = {} }) => {
  const key = String(status || "").toLowerCase();
  const config = statusConfig[key] || {
    label: label || status || "Unknown",
    color: "default",
    variant: "outlined",
  };

  return (
    <Chip
      size="small"
      label={label || config.label}
      color={config.color}
      variant={config.variant}
      sx={{ fontWeight: 800, ...sx }}
    />
  );
};

export default StatusChip;