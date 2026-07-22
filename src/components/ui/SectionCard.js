import React from "react";
import { Card, CardContent, Divider, Stack, Typography, Box } from "@mui/material";

const SectionCard = ({
  title,
  subtitle,
  action,
  children,
  contentSx = {},
  sx = {},
}) => {
  return (
    <Card sx={{ overflow: "hidden", boxShadow: "none", ...sx }}>
      {(title || subtitle || action) && (
        <>
          <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, bgcolor: "background.paper" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1.25}
            >
              <Box>
                {title ? (
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.25, fontWeight: 800 }}>
                    {title}
                  </Typography>
                ) : null}
                {subtitle ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {subtitle}
                  </Typography>
                ) : null}
              </Box>
              {action ? <Box sx={{ width: { xs: "100%", sm: "auto" } }}>{action}</Box> : null}
            </Stack>
          </Box>
          <Divider />
        </>
      )}

      <CardContent
        sx={{
          p: { xs: 1.5, sm: 2 },
          "&:last-child": { pb: { xs: 1.5, sm: 2 } },
          ...contentSx,
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
};

export default SectionCard;
