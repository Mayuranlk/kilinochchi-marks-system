import React from "react";
import { Box } from "@mui/material";

const ResponsiveTableWrapper = ({ children, minWidth = 760, sx = {} }) => {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        borderRadius: 2,
        "& table": {
          minWidth,
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default ResponsiveTableWrapper;
