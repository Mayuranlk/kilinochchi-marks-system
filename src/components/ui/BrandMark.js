import React from "react";
import { Box } from "@mui/material";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";

export default function BrandMark({ size = 40, compact = false, sx = {} }) {
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        position: "relative",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: compact ? theme.custom.radii.md : theme.custom.radii.lg,
        color: theme.palette.primary.contrastText,
        background: `linear-gradient(145deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        boxShadow: theme.custom.highContrast
          ? "none"
          : `0 8px 20px ${theme.palette.primary.main}35`,
        "&::after": {
          content: '""',
          position: "absolute",
          width: "75%",
          height: "75%",
          top: "-38%",
          right: "-28%",
          borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.2)",
        },
        ...sx,
      })}
    >
      <SchoolRoundedIcon sx={{ fontSize: size * 0.56, position: "relative", zIndex: 1 }} />
    </Box>
  );
}
