import React from "react";
import { Box, Stack } from "@mui/material";

const ActionBar = ({ children, sticky = false, sx = {} }) => {
  return (
    <Box
      sx={(theme) => ({
        position: sticky ? "sticky" : "relative",
        bottom: sticky ? { xs: 86, sm: 12 } : "auto",
        zIndex: sticky ? theme.zIndex.appBar - 1 : "auto",
        mt: 2,
        ...sx,
      })}
    >
      <Box
        sx={{
          p: { xs: 0.85, sm: 1 },
          borderRadius: 1.5,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          boxShadow: sticky ? "0px 12px 24px rgba(15, 23, 42, 0.10)" : "none",
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
