import React from "react";
import { Grid } from "@mui/material";
import SectionCard from "./SectionCard";

const FilterCard = ({ title = "Filters", subtitle, children, action, sx = {} }) => {
  return (
    <SectionCard title={title} subtitle={subtitle} action={action} sx={sx}>
      <Grid container spacing={1.5}>
        {children}
      </Grid>
    </SectionCard>
  );
};

export default FilterCard;