import React from "react";
import { Box } from "@mui/material";

const ResponsiveTableWrapper = ({ children, minWidth = 760, sx = {} }) => {
  return (
    <Box
      sx={{
        width: "100%",
        overflowX: "auto",
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