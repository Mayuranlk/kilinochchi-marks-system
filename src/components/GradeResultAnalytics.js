import { academicDisplay } from "../utils/academicDisplay";
import React from "react";
import { Alert, Box, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { formatRate } from "../utils/gradeResultLogic";

function RateBar({ value, label }) {
  return <Box role="img" aria-label={academicDisplay(`${label}: ${formatRate(value)}`)} sx={{ width: "100%", minWidth: 90, height: 9, borderRadius: 5, bgcolor: "action.hover", overflow: "hidden" }}><Box sx={{ width: `${value || 0}%`, height: "100%", bgcolor: "primary.main" }} /></Box>;
}

export default function GradeResultAnalytics({ analytics }) {
  return <Stack spacing={2}>
    <Typography variant="h6" fontWeight={800}>Performance analysis</Typography>
    <Typography variant="body2" color="text.secondary">Full selected class / grade, independent of the student result filter. Percentages are shown to one decimal place.</Typography>
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography fontWeight={800} sx={{ mb: 2 }}>Category distribution</Typography>
      <Stack spacing={2}>{analytics.categories.map((category, index) => <Box key={category.id}>
        <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 0.7 }}><Typography variant="body2">{index + 1}. {academicDisplay(category.label)}</Typography><Typography variant="body2" fontWeight={800} sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{category.count.toLocaleString()} / {analytics.total.toLocaleString()} ({formatRate(category.rate)})</Typography></Stack>
        <RateBar value={category.rate} label={academicDisplay(category.label)} />
      </Box>)}</Stack>
      <Typography variant="body2" sx={{ mt: 2 }}>Total: {analytics.categories.reduce((sum, category) => sum + category.count, 0)} / {analytics.total} students. Each student is counted once.</Typography>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography fontWeight={800}>A/L eligibility checks</Typography>
      <Typography sx={{ mt: 1, fontVariantNumeric: "tabular-nums" }}>Categories 1-3: <strong>{analytics.grouped} / {analytics.total} = {formatRate(analytics.groupedRate)}</strong></Typography>
      <Typography sx={{ mt: 1, fontVariantNumeric: "tabular-nums" }}>Verified A/L eligibility: <strong>{analytics.verified} / {analytics.total} = {formatRate(analytics.verifiedRate)}</strong></Typography>
      <Alert severity="info" sx={{ mt: 2 }}>4-8 A grades alone do not guarantee Tamil and Maths passes or six total passes. Verified eligibility checks both core subjects, the credit/pass threshold and complete results for every student. Pending / review: {analytics.pending}.</Alert>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography fontWeight={800}>Subject pass rates</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>Passed / sat x 100. A*, A, B, C and S pass; absentees and pending marks are excluded from sat. N/A means no recorded sitting.</Typography>
      <TableContainer><Table size="small" aria-label="Subject pass rates" sx={{ "& td:not(:first-of-type)": { fontVariantNumeric: "tabular-nums" } }}>
        <TableHead><TableRow>{["Subject", "Enrolled", "Sat", "Passed", "Failed", "Absent", "Pending", "Pass rate", "0-100%"].map((label, index) => <TableCell key={label} align={index ? "right" : "left"}>{academicDisplay(label)}</TableCell>)}</TableRow></TableHead>
        <TableBody>{analytics.subjects.map((subject) => <TableRow key={subject.key}><TableCell>{academicDisplay(subject.label)}</TableCell>{[subject.enrolled, subject.sat, subject.passed, subject.failed, subject.absent, subject.pending, formatRate(subject.rate)].map((value, index) => <TableCell align="right" key={index}>{academicDisplay(value)}</TableCell>)}<TableCell><RateBar value={subject.rate} label={academicDisplay(subject.label)} /></TableCell></TableRow>)}</TableBody>
      </Table></TableContainer>
      {!analytics.subjects.length && <Typography sx={{ py: 2 }}>No subject results in the selected class / grade.</Typography>}
    </Paper>
  </Stack>;
}
