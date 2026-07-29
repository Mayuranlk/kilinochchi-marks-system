import React from "react";
import { Box, Grid, Skeleton, Stack } from "@mui/material";

export default function LoadingState({ cards = 4, rows = 5, compact = false, sx = {} }) {
  return (
    <Stack spacing={compact ? 1.5 : 2.25} aria-label="Loading content" aria-busy="true" sx={sx}>
      <Box>
        <Skeleton variant="text" width="min(42%, 320px)" height={34} />
        <Skeleton variant="text" width="min(68%, 560px)" height={22} />
      </Box>

      {cards > 0 ? (
        <Grid container spacing={1.5}>
          {Array.from({ length: cards }).map((_, index) => (
            <Grid size={{ xs: 6, md: 12 / Math.min(cards, 4) }} key={index}>
              <Skeleton variant="rounded" height={compact ? 96 : 118} />
            </Grid>
          ))}
        </Grid>
      ) : null}

      {rows > 0 ? (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: { xs: 1.5, sm: 2 } }}>
          <Skeleton variant="text" width="32%" height={28} sx={{ mb: 1 }} />
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={44} sx={{ mb: index === rows - 1 ? 0 : 0.75 }} />
          ))}
        </Box>
      ) : null}
    </Stack>
  );
}
