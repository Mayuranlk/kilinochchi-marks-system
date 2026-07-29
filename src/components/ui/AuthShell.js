import React from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import AppearanceToggle from "./AppearanceToggle";
import BrandMark from "./BrandMark";

export default function AuthShell({
  title,
  subtitle,
  badge,
  icon,
  accent = "primary",
  footer,
  children,
}) {
  return (
    <Box
      component="main"
      sx={(theme) => ({
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: { xs: 1.5, sm: 3, lg: 5 },
        bgcolor: "background.default",
        backgroundImage: `radial-gradient(circle at 12% 8%, ${theme.palette.primary.main}12, transparent 34%), radial-gradient(circle at 90% 92%, ${theme.palette.secondary.main}10, transparent 30%)`,
      })}
    >
      <AppearanceToggle sx={{ position: "fixed", top: { xs: 12, sm: 18 }, right: { xs: 12, sm: 18 }, zIndex: 2 }} />

      <Card
        sx={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(320px, .85fr) minmax(430px, 1.15fr)" },
          overflow: "hidden",
          borderRadius: { xs: 2.5, sm: 3 },
          boxShadow: { xs: 2, md: 4 },
        }}
      >
        <Box
          sx={(theme) => {
            const palette = theme.palette[accent] || theme.palette.primary;
            return {
              display: { xs: "none", md: "flex" },
              position: "relative",
              overflow: "hidden",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 600,
              p: 4,
              color: palette.contrastText,
              background: `linear-gradient(150deg, ${palette.dark} 0%, ${palette.main} 72%, ${theme.palette.secondary.dark} 140%)`,
              "&::before": {
                content: '""',
                position: "absolute",
                width: 280,
                height: 280,
                top: -100,
                right: -100,
                borderRadius: "50%",
                border: "56px solid rgba(255,255,255,0.08)",
              },
              "&::after": {
                content: '""',
                position: "absolute",
                width: 180,
                height: 180,
                bottom: -100,
                left: -60,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.07)",
              },
            };
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ position: "relative", zIndex: 1 }}>
            <BrandMark size={44} compact sx={{ bgcolor: "rgba(255,255,255,0.16)", boxShadow: "none" }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 850, color: "inherit" }}>
                Kilinochchi Central College
              </Typography>
              <Typography variant="caption" sx={{ color: "inherit", opacity: 0.78 }}>
                Education Management System
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Typography variant="h3" sx={{ color: "inherit", maxWidth: 360 }}>
              Academic operations, thoughtfully connected.
            </Typography>
            <Typography variant="body1" sx={{ color: "inherit", opacity: 0.82, mt: 1.5, maxWidth: 340 }}>
              A secure workspace for school records, assessments, reporting, and day-to-day administration.
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ position: "relative", zIndex: 1 }}>
            <Chip icon={<LockRoundedIcon />} label="Secure" sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "inherit" }} />
            <Chip icon={<VerifiedUserRoundedIcon />} label="Role based" sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "inherit" }} />
            <Chip icon={<CheckCircleRoundedIcon />} label="School managed" sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "inherit" }} />
          </Stack>
        </Box>

        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            p: { xs: 2.5, sm: 4, md: 5 },
            "&:last-child": { pb: { xs: 2.5, sm: 4, md: 5 } },
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ display: { xs: "flex", md: "none" }, mb: 3, pr: 5 }}>
            <BrandMark size={42} compact />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 850 }} noWrap>
                Kilinochchi Central College
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Education Management System
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={1} mb={3} alignItems="flex-start">
            <Box
              sx={(theme) => {
                const palette = theme.palette[accent] || theme.palette.primary;
                return {
                  width: 48,
                  height: 48,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 2,
                  color: palette.main,
                  bgcolor: palette.lighter || palette.light,
                };
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography component="h1" variant="h4" sx={{ fontWeight: 850 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            </Box>
            {badge ? <Chip label={badge} size="small" color={accent} variant="outlined" /> : null}
          </Stack>

          {children}

          {footer ? (
            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 3 }}>
              {footer}
            </Typography>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
