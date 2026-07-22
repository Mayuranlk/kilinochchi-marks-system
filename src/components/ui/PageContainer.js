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
        minWidth: 0,
        maxWidth:
          maxWidth === "xl"
            ? 1600
            : maxWidth === "lg"
            ? 1280
            : maxWidth === "md"
            ? 960
            : 720,
        mx: "auto",
        px: { xs: 1.25, sm: 2, md: 2.75 },
        py: { xs: 1.5, sm: 2, md: 2.5 },
        overflowX: "hidden",
        "& > *": {
          minWidth: 0,
          maxWidth: "100%",
        },
        ...sx,
      }}
    >
      {(title || subtitle || actions) && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
            {title ? (
              <Typography
                variant="h5"
                sx={{
                  mb: subtitle ? 0.35 : 0,
                  color: "text.primary",
                  lineHeight: 1.15,
                  fontWeight: 850,
                }}
              >
                {title}
              </Typography>
            ) : null}
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
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
                "& > *": {
                  width: { xs: "100%", md: "auto" },
                },
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
