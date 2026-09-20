import { RESULT_CATEGORIES, resultAnalytics } from "./gradeResultLogic";
import { createGradeResultPdf } from "./gradeResultPdf";
import { REPORT_SCHEMA_10_TO_11 as schema, flattenSchemaColumns } from "./reportSchemas";

test("multipage exports keep every student, repeat context, and do not mutate results", () => {
  const rows = Array.from({ length: 35 }, (_, index) => ({
    rowNo: index + 1, student: { id: `s${index}`, grade: 11 }, division: "A",
    studentName: `PDF STUDENT ${index + 1}`, total: 600, summary: "3A 3B 3C",
    grades: { REL_SAIVAM: "A", TAMIL: "A", MATHS: "A", ENGLISH: "B", SCIENCE: "B", HISTORY: "B", B1_GEO: "C", B2_ART: "C", B3_ICT_T: "C" },
    eligibility: { complete: true, qualified: true },
    category: { id: "eligible", label: "A/L Eligible", color: "success", notes: [] },
  }));
  const before = JSON.stringify(rows);
  const pdf = createGradeResultPdf({ schoolName: "TEST SCHOOL", reportLabel: "11A", year: "2026", term: "Term 2", resultFilter: "all", schema, grade: 11, rows, totalStudents: 35,
    analytics: resultAnalytics(rows, flattenSchemaColumns(schema)),
    summaryStats: [...RESULT_CATEGORIES.map((category) => ({ ...category, value: category.id === "eligible" ? 35 : 0, percentage: category.id === "eligible" ? "100.0" : "0.0" }))],
    tamilMathsFailureRows: [], belowThreeCThreeSRows: [],
  });
  const pages = pdf.internal.pages.slice(1).map((commands) => commands.join("\n"));
  expect(pages.length).toBeGreaterThan(3);
  pages.forEach((commands) => {
    expect(commands).toContain("TEST SCHOOL");
    expect(commands).toContain("Term 2");
  });
  rows.forEach((row) => expect(pages.join("\n")).toContain(row.studentName));
  expect(pages.join("\n")).not.toContain("(Total)");
  expect(pages.join("\n")).toContain("A/L Eligible");
  expect(pages.join("\n")).toContain("Category total: 35 / 35 students");
  expect(pages.join("\n")).toContain("Subject pass rates");
  expect(pages.join("\n")).toContain("Verified A/L eligibility: 35 / 35 = 100.0%");
  expect(JSON.stringify(rows)).toBe(before);
});
