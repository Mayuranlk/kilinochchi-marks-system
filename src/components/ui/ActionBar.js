import React from "react";
import { Box, Stack } from "@mui/material";

const ActionBar = ({ children, sticky = false, sx = {} }) => {
  return (
    <Box
      sx={(theme) => ({
        position: sticky ? "sticky" : "relative",
        bottom: sticky ? { xs: 80, sm: 12 } : "auto",
        zIndex: sticky ? theme.zIndex.appBar - 1 : "auto",
        mt: 2,
        ...sx,
      })}
    >
      <Box
        sx={{
          p: 1.25,
          borderRadius: 16,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          boxShadow: sticky ? "0px 12px 32px rgba(15, 23, 42, 0.1)" : "none",
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
