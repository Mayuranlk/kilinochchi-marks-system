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
      sx={{
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 3,
        px: 2,
        py: 4,
        textAlign: "center",
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={1.25} alignItems="center">
        <Box
          sx={{
            height: 56,
            width: 56,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {icon || <InboxRoundedIcon color="action" />}
        </Box>

        <Typography variant="h6">{title}</Typography>
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