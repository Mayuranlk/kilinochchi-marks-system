import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

export default function ErrorState({
  title = "Something went wrong",
  description = "The page could not be displayed. Your saved school data has not been changed.",
  actionLabel = "Try again",
  onAction,
  icon,
  sx = {},
}) {
  return (
    <Box
      role="alert"
      sx={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 5,
        ...sx,
      }}
    >
      <Stack alignItems="center" spacing={1.5} textAlign="center" sx={{ maxWidth: 520 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            display: "grid",
            placeItems: "center",
            borderRadius: 3,
            color: "error.main",
            bgcolor: "error.lighter",
            border: 1,
            borderColor: "error.light",
          }}
        >
          {icon || <ErrorOutlineRoundedIcon fontSize="large" />}
        </Box>
        <Typography variant="h5">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {onAction ? (
          <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
