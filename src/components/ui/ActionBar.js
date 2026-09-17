import React from "react";
import { Box, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";

const ActionBar = ({ children, sticky = false, sx = {} }) => {
  return (
    <Box
      role="toolbar"
      aria-label="Page actions"
      sx={(theme) => ({
        position: sticky ? "sticky" : "relative",
        bottom: sticky ? { xs: 84, sm: 16 } : "auto",
        zIndex: sticky ? theme.zIndex.appBar - 1 : "auto",
        mt: 2,
        ...sx,
      })}
    >
      <Box
        sx={{
          p: { xs: 1, sm: 1.25 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
          backdropFilter: "blur(16px) saturate(140%)",
          boxShadow: sticky ? 3 : 0,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          {children}
        </Stack>
      </Box>
    </Box>
  );
};

export default ActionBar;
