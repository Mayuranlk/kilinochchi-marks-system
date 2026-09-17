import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import ContrastRoundedIcon from "@mui/icons-material/ContrastRounded";
import { useColorMode } from "../../theme/ColorModeContext";

export default function AppearanceToggle({ sx = {} }) {
  const { mode, cycleMode } = useColorMode();
  const label = mode === "dark" ? "Dark mode" : mode === "contrast" ? "High contrast" : "Light mode";
  const icon = mode === "dark" ? <DarkModeRoundedIcon /> : mode === "contrast" ? <ContrastRoundedIcon /> : <LightModeRoundedIcon />;

  return (
    <Tooltip title={`Appearance: ${label}`}>
      <IconButton
        onClick={cycleMode}
        aria-label={`Change appearance. Current: ${label}`}
        sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper", ...sx }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
