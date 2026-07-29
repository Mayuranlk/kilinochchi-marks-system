import React, { useId } from "react";
import { Card, CardContent, Divider, Stack, Typography, Box } from "@mui/material";

const SectionCard = ({
  title,
  subtitle,
  action,
  children,
  contentSx = {},
  sx = {},
}) => {
  const titleId = useId();
  return (
    <Card component="section" aria-labelledby={title ? titleId : undefined} sx={{ overflow: "hidden", ...sx }}>
      {(title || subtitle || action) && (
        <>
          <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: { xs: 1.5, sm: 1.75 }, bgcolor: "background.paper" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1.25}
            >
              <Box sx={{ minWidth: 0 }}>
                {title ? (
                    <Typography id={titleId} component="h2" variant="subtitle1" sx={{ lineHeight: 1.25, fontWeight: 800, letterSpacing: "-0.01em" }}>
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
          p: { xs: 1.75, sm: 2.25 },
          "&:last-child": { pb: { xs: 1.75, sm: 2.25 } },
          ...contentSx,
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
};

export default SectionCard;
