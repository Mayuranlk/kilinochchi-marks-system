import { getOlGradeLetter } from "./gradeUtils";

const PASS = ["A*", "A", "B", "C", "S"];
const ORDER = ["A*", "A", "B", "C", "S", "W"];

export const RESULT_CATEGORIES = [
  { id: "excellent", label: "Excellent (9A)", color: "success" },
  { id: "best", label: "Best (4A - 8A)", color: "success" },
  { id: "eligible", label: "A/L Eligible", color: "success" },
  { id: "core-risk", label: "At Risk: Core Subject Failure", color: "warning" },
  { id: "threshold-risk", label: "At Risk: Below Threshold", color: "warning" },
  { id: "support", label: "Needs Focused Support", color: "error" },
];

export function classifyResult(grades, eligibility, validSubjectSelection = true) {
  const aCount = eligibility.counts.A || 0;
  const id = validSubjectSelection && eligibility.complete && aCount === 9 ? "excellent"
    : validSubjectSelection && aCount >= 4 && aCount <= 8 ? "best"
    : eligibility.complete && eligibility.hasThreeCThreeS && eligibility.tamilMathsMinimumMet ? "eligible"
    : eligibility.complete && eligibility.hasThreeCThreeS ? "core-risk"
    : eligibility.complete && eligibility.tamilMathsMinimumMet ? "threshold-risk" : "support";
  const notes = [];
  const failedMath = grades.MATHS === "W";
  const failedTamil = grades.TAMIL === "W";
  if (failedMath || failedTamil) notes.push(failedMath && failedTamil ? "Failed both" : failedMath ? "Failed Math only" : "Failed Tamil only");
  if (grades.MATHS === "AB") notes.push("Maths absent");
  if (grades.TAMIL === "AB") notes.push("Tamil absent");
  if (id === "best" && !eligibility.qualified) notes.push("A/L conditions not confirmed");
  if (!eligibility.complete) notes.push("Pending results / review");
  return { ...RESULT_CATEGORIES.find((category) => category.id === id), notes, provisional: !eligibility.complete };
}

export function buildEligibility(grades, validSubjectSelection = true) {
  const values = Object.values(grades);
  const counts = values.reduce((result, value) => {
    if (ORDER.includes(value)) result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  const complete = validSubjectSelection && values.length === 9 && values.every((value) => [...ORDER, "AB"].includes(value));
  const cOrBetterCount = ["A*", "A", "B", "C"].reduce((sum, letter) => sum + (counts[letter] || 0), 0);
  const sOrBetterCount = PASS.reduce((sum, letter) => sum + (counts[letter] || 0), 0);
  const hasThreeCThreeS = cOrBetterCount >= 3 && sOrBetterCount >= 6;
  const tamilMathsMinimumMet = [grades.TAMIL, grades.MATHS].every((value) => PASS.includes(value));
  const qualified = complete && hasThreeCThreeS && tamilMathsMinimumMet;
  return {
    counts, complete, cOrBetterCount, sOrBetterCount, hasThreeCThreeS,
    tamilMathsMinimumMet, qualified,
    failedTamilOrMaths: complete && hasThreeCThreeS && !tamilMathsMinimumMet,
    label: !complete ? "Incomplete / review subjects" : qualified ? "Qualified" : "Not Qualified",
  };
}

export function resultRows(reportData, columns) {
  return reportData.rows.map((row) => {
    const eligible = new Set(row.reportEligibleColumnKeys || row.eligibleColumnKeys || []);
    const grades = {};
    for (const column of columns) {
      if (!eligible.has(column.key)) continue;
      const mark = row.marksByColumn?.[column.key];
      const numeric = mark === null || mark === undefined || String(mark).trim() === "" ? NaN : Number(mark);
      grades[column.key] = row.absencesByColumn?.[column.key] || mark === "AB" ? "AB"
        : Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? getOlGradeLetter(Math.floor(numeric)) : "";
    }
    // Each O/L candidate needs five core subjects, one religion and one per basket.
    const validSubjectSelection = reportData.schema.groups.every((group) => {
      const count = group.columns.filter((column) => eligible.has(column.key)).length;
      return count === (group.key === "core" ? group.columns.length : 1);
    });
    const eligibility = buildEligibility(grades, validSubjectSelection);
    const category = classifyResult(grades, eligibility, validSubjectSelection);
    columns.filter((column) => !["TAMIL", "MATHS"].includes(column.key) && grades[column.key] === "AB").forEach((column) => category.notes.push(`${column.label} absent`));
    return {
      ...row,
      division: String(row.student.section || row.student.division || String(row.student.className || "").match(/[A-Za-z]+$/)?.[0] || "-").trim().toUpperCase(),
      grades,
      gradesSummary: eligibility.counts,
      summary: [...ORDER, "AB"].map((letter) => {
        const count = Object.values(grades).filter((value) => value === letter).length;
        return count ? `${count}${letter}` : "";
      }).filter(Boolean).join(" "),
      eligibility,
      category,
    };
  }).sort((left, right) => {
    const categoryOrder = RESULT_CATEGORIES.findIndex((item) => item.id === left.category.id) - RESULT_CATEGORIES.findIndex((item) => item.id === right.category.id);
    if (categoryOrder) return categoryOrder;
    for (const letter of ["A", "A*", "B", "C", "S"]) {
      const difference = (right.gradesSummary[letter] || 0) - (left.gradesSummary[letter] || 0);
      if (difference) return difference;
    }
    return right.total - left.total || left.studentName.localeCompare(right.studentName) || String(left.student.id).localeCompare(String(right.student.id));
  }).map((row, index) => ({ ...row, rowNo: index + 1 }));
}


export function resultAnalytics(rows, columns) {
  const total = rows.length;
  const percentage = (count, denominator) => denominator ? count * 100 / denominator : null;
  const categories = RESULT_CATEGORIES.map((category) => {
    const count = rows.filter((row) => row.category.id === category.id).length;
    return { ...category, count, rate: percentage(count, total) };
  });
  const grouped = rows.filter((row) => ["excellent", "best", "eligible"].includes(row.category.id)).length;
  const verified = rows.filter((row) => row.eligibility.qualified).length;
  const subjects = columns.map((column) => {
    const values = rows.filter((row) => Object.prototype.hasOwnProperty.call(row.grades, column.key)).map((row) => row.grades[column.key]);
    const passed = values.filter((value) => PASS.includes(value)).length;
    const failed = values.filter((value) => value === "W").length;
    const absent = values.filter((value) => value === "AB").length;
    const pending = values.length - passed - failed - absent;
    return { key: column.key, label: column.label, enrolled: values.length, passed, failed, absent, pending, sat: passed + failed, rate: percentage(passed, passed + failed) };
  }).filter((subject) => subject.enrolled);
  const pending = rows.filter((row) => !row.eligibility.complete).length;
  const absent = rows.filter((row) => Object.values(row.grades).includes("AB")).length;
  const overview = [
    { label: "Students", count: total, color: "primary" },
    { label: "9A results", count: categories.find((category) => category.id === "excellent").count, color: "success" },
    { label: "Verified eligible", count: verified, color: "success" },
    { label: "Not eligible", count: total - verified - pending, color: "error" },
    { label: "Pending review", count: pending, color: "warning" },
    { label: "Absent students", count: absent, color: "warning" },
  ].map((item) => ({ ...item, rate: percentage(item.count, total) }));
  return { total, overview, absent, categories, subjects, grouped, groupedRate: percentage(grouped, total), verified, verifiedRate: percentage(verified, total), pending: rows.filter((row) => !row.eligibility.complete).length };
}

export const formatRate = (value) => value === null || value === undefined ? "N/A" : `${value.toFixed(1)}%`;
