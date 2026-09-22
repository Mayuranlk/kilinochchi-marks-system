import * as XLSX from "xlsx";
import { createClassSheetPdf, MONTHS, parseClassWorkbook } from "./classSheetPdf";

test("imports repeated form rosters once and preserves admission numbers", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["G11-A"], ["No", "Index No", "Student Name"], [1, "0012", "Student One"],
    ["G11-A", "Attendance"], ["No", "Index No", "Student Name"], [1, "0012", "Student One"],
    ["G11-B"], ["No", "Index No", "Student Name"], [1, "0013", "Student Two"],
  ]), "Forms");
  const classes = parseClassWorkbook(workbook);
  expect(classes.map((room) => [room.className, room.students.length])).toEqual([["11A", 1], ["11B", 1]]);
  expect(classes[0].students[0].indexNo).toBe("0012");
});

test("creates exactly three portrait A4 pages per class with manual labels", () => {
  const classes = ["11A", "11B"].map((className) => ({ className, students: Array.from({ length: 55 }, (_, i) => ({ name: `Student ${i}`, indexNo: String(i) })) }));
  const pdf = createClassSheetPdf({ classes, year: "2026", term: "III", months: MONTHS });
  expect(pdf.getNumberOfPages()).toBe(6);
  expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
  expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
});

test("keeps month columns on attendance, date on parents meeting and signatures on every page", () => {
  const pdf = createClassSheetPdf({ classes: [{ className: "11A", students: [{ name: "Student", indexNo: "001" }] }], year: "2027", term: "I", months: ["January", "March"], meetingDate: "2027-03-15" });
  expect(pdf.getNumberOfPages()).toBe(3);
  const pages = pdf.internal.pages.slice(1).map((commands) => commands.join("\n"));
  expect(pages[0]).not.toMatch(/Term:|January|March|Date:/);
  expect(pages[1]).toContain("January");
  expect(pages[1]).toContain("March");
  expect(pages[1]).toContain("Term: I");
  expect(pages[2]).toContain("Date: 15 / 03 / 2027");
  expect(pages[2]).not.toMatch(/Term:|January|March/);
  pages.forEach((page) => {
    expect(page).toContain("Class teacher signature");
    expect(page).toContain("Verified by / signature");
  });
});

test("requires manual term and months and rejects oversized classes", () => {
  const classes = [{ className: "11A", students: [{ name: "Student", indexNo: "1" }] }];
  expect(() => createClassSheetPdf({ classes, year: "2026", term: "", months: [] })).toThrow(/Select a valid/);
  expect(() => createClassSheetPdf({ classes: [{ ...classes[0], students: Array(56).fill(classes[0].students[0]) }], year: "2026", term: "II", months: ["August"] })).toThrow(/55 students/);
});
