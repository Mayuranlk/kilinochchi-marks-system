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
    <Card sx={{ overflow: "hidden", ...sx }}>
      {(title || subtitle || action) && (
        <>
          <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Box>
                {title ? <Typography variant="h6">{title}</Typography> : null}
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
          p: { xs: 2, sm: 2.5 },
          "&:last-child": { pb: { xs: 2, sm: 2.5 } },
          ...contentSx,
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
};

export default SectionCard;