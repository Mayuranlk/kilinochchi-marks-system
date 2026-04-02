import React from "react";
import { Box, Stack, Typography } from "@mui/material";

const PageContainer = ({
  title,
  subtitle,
  actions,
  children,
  maxWidth = "xl",
  sx = {},
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth:
          maxWidth === "xl"
            ? 1600
            : maxWidth === "lg"
            ? 1280
            : maxWidth === "md"
            ? 960
            : 720,
        mx: "auto",
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 2, sm: 2.5, md: 3 },
        ...sx,
      }}
    >
      {(title || subtitle || actions) && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2.5 }}
        >
          <Box>
            {title ? (
              <Typography variant="h5" sx={{ mb: subtitle ? 0.5 : 0 }}>
                {title}
              </Typography>
            ) : null}
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>

          {actions ? (
            <Box
              sx={{
                width: { xs: "100%", md: "auto" },
                display: "flex",
                justifyContent: { xs: "stretch", md: "flex-end" },
              }}
            >
              {actions}
            </Box>
          ) : null}
        </Stack>
      )}

      {children}
    </Box>
  );
};

export default PageContainer;