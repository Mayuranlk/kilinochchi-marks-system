import React from "react";
import { Card, Stack, Typography, Box } from "@mui/material";

const MobileListRow = ({
  title,
  subtitle,
  meta,
  right,
  actions,
  footer,
  children,
  compact = false,
  sx = {},
}) => {
  return (
    <Card sx={{ borderRadius: 3, overflow: "hidden", ...sx }}>
      <Box sx={{ p: compact ? 1.25 : 1.5 }}>
        <Stack spacing={compact ? 1 : 1.2}>
          <Stack
            direction="row"
            spacing={1.5}
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            {right ? <Box sx={{ flexShrink: 0 }}>{right}</Box> : null}
          </Stack>

          {meta ? <Box>{meta}</Box> : null}
          {children ? <Box>{children}</Box> : null}
          {actions ? <Box>{actions}</Box> : null}
          {footer ? <Box>{footer}</Box> : null}
        </Stack>
      </Box>
    </Card>
  );
};

export default MobileListRow;
