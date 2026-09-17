import React from "react";
import { Card, CardContent, Stack, Typography, Box } from "@mui/material";

const StatCard = ({ title, value, icon, helperText, color = "primary", onClick, sx = {} }) => {
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(event);
        }
      }}
      sx={{
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        borderColor: "divider",
        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
        "&:hover": onClick
          ? {
              borderColor: "primary.light",
              boxShadow: 2,
              transform: "translateY(-2px)",
            }
          : undefined,
        ...sx,
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 1.875 }, "&:last-child": { pb: { xs: 1.5, sm: 1.875 } } }}>
        <Stack spacing={1.15}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {icon ? (
              <Box
                sx={(theme) => ({
                  height: 36,
                  width: 36,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  color: theme.palette[color].main,
                  bgcolor: theme.palette[color].lighter || theme.palette[color].light,
                })}
              >
                {icon}
              </Box>
            ) : null}
          </Stack>

          <Typography variant="h5" sx={{ fontWeight: 850, lineHeight: 1.1 }}>
            {value}
          </Typography>

          {helperText ? (
            <Typography variant="body2" color="text.secondary">
              {helperText}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default StatCard;
