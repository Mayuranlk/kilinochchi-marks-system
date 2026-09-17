import React from "react";
import { Box } from "@mui/material";

const ResponsiveTableWrapper = ({ children, minWidth = 760, stickyFirstColumn = false, label = "Data table", sx = {} }) => {
  return (
    <Box
      role="region"
      aria-label={label}
      tabIndex={0}
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        scrollbarGutter: "stable",
        "& table": {
          minWidth,
        },
        "& .MuiTableCell-head": {
          position: "sticky",
          top: 0,
          zIndex: 2,
        },
        ...(stickyFirstColumn
          ? {
              "& .MuiTableRow-root > .MuiTableCell-root:first-of-type": {
                position: "sticky",
                left: 0,
                zIndex: 1,
                bgcolor: "background.paper",
                boxShadow: "1px 0 0 0",
                color: "text.primary",
              },
              "& .MuiTableHead-root .MuiTableCell-root:first-of-type": {
                zIndex: 3,
                bgcolor: "action.hover",
              },
            }
          : {}),
        "&:focus-visible": {
          outlineOffset: 2,
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default ResponsiveTableWrapper;
