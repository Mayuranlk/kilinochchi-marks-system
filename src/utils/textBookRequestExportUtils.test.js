import { createTextBookRequestPdf, createTextBookRequestWorkbook } from "./textBookRequestExportUtils";

const report = {
  academicYear: 2026,
  scope: "grade",
  grade: 8,
  classId: "",
  medium: "",
  stream: "",
  summary: { total: 2, male: 1, female: 1, unknown: 0 },
  classes: [{ id: "8A", className: "8A" }],
  gradeBreakdown: [{ grade: 8, male: 1, female: 1, unknown: 0, total: 2 }],
  classBreakdown: [{ grade: 8, className: "8A", male: 1, female: 1, unknown: 0, total: 2 }],
  subjectRows: [{ name: "Tamil", total: 2, booksRequired: 2, byClass: { "8A": 2 } }],
};

test("creates a valid PDF without database access", () => {
  const { doc, fileName } = createTextBookRequestPdf(report);
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  expect(fileName).toMatch(/Text_Book_Request_2026_Grade_8\.pdf$/);
});

test("creates the expected Excel report sheets", () => {
  const workbook = createTextBookRequestWorkbook(report);
  expect(workbook.SheetNames).toEqual([
    "Summary",
    "Subject Requirements",
    "Division Breakdown",
  ]);
  expect(workbook.Sheets["Subject Requirements"].A2.v).toBe("Tamil");
  expect(workbook.Sheets["Subject Requirements"].D2.v).toBe(2);
});
