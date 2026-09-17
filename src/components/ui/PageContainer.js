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
      component="section"
      sx={(theme) => ({
        width: "100%",
        minWidth: 0,
        maxWidth:
          maxWidth === "xl"
            ? theme.custom.layout.contentMax
            : maxWidth === "lg"
            ? 1280
            : maxWidth === "md"
            ? 960
            : 720,
        mx: "auto",
        px: { xs: 1.5, sm: 2.5, md: 3, lg: 3.5, xl: 4.5, "2xl": 5 },
        py: { xs: 1.75, sm: 2.5, md: 3, xl: 3.5 },
        overflowX: "hidden",
        "& > *": {
          minWidth: 0,
          maxWidth: "100%",
        },
        ...sx,
      })}
    >
      {(title || subtitle || actions) && (
        <Stack
          component="header"
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mb: { xs: 2, md: 2.75 } }}
        >
          <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
            {title ? (
              <Typography
                variant="h5"
                component="h1"
                sx={{
                  mb: subtitle ? 0.5 : 0,
                  color: "text.primary",
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: "-0.018em",
                }}
              >
                {title}
              </Typography>
            ) : null}
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760, fontSize: { sm: "0.875rem" } }}>
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
                  gap: 1,
                  flexWrap: "wrap",
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
