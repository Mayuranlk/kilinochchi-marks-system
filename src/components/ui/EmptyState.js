import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";

const EmptyState = ({
  title = "No data found",
  description = "There is nothing to show right now.",
  icon,
  action,
}) => {
  return (
    <Box
      role="status"
      sx={{
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
        px: { xs: 2, sm: 3 },
        py: { xs: 3.5, sm: 4.5 },
        textAlign: "center",
        bgcolor: "background.default",
        backgroundImage: (theme) =>
          `radial-gradient(circle at 50% 0%, ${theme.palette.action.selected}, transparent 58%)`,
      }}
    >
      <Stack spacing={1.25} alignItems="center">
        <Box
          sx={{
            height: 52,
            width: 52,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {icon || <InboxRoundedIcon color="action" />}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
          {description}
        </Typography>

        {action ? (
          <Box sx={{ pt: 0.5 }}>
            {typeof action === "string" ? <Button variant="contained">{action}</Button> : action}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
};

export default EmptyState;
