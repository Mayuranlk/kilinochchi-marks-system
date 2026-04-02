import React from "react";
import { Card, CardContent, Stack, Typography, Box } from "@mui/material";

const StatCard = ({ title, value, icon, helperText, color = "primary", sx = {} }) => {
  return (
    <Card sx={{ height: "100%", ...sx }}>
      <CardContent sx={{ p: 2.25 }}>
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {icon ? (
              <Box
                sx={(theme) => ({
                  height: 40,
                  width: 40,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  color: theme.palette[color].main,
                  bgcolor: theme.palette[color].light
                    ? `${theme.palette[color].light}33`
                    : `${theme.palette[color].main}14`,
                })}
              >
                {icon}
              </Box>
            ) : null}
          </Stack>

          <Typography variant="h5" sx={{ fontWeight: 800 }}>
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