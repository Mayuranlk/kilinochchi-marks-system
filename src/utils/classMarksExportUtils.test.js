import { createColorClassMarksWorkbook } from "./classMarksExportUtils";

function makeReportData() {
  return {
    className: "6A",
    year: 2026,
    termName: "Term 1",
    separateMediumRanking: false,
    hasSeparateOverallTotal: false,
    schema: {
      groups: [
        {
          key: "subjects",
          label: "Subjects",
          columns: [
            { key: "MATHS", label: "Maths" },
            { key: "ENGLISH", label: "English" },
          ],
        },
      ],
    },
    rows: [
      {
        rowNo: 1,
        studentId: "S-1",
        studentIndexNo: "I-1",
        studentName: "Synthetic Student",
        marksByColumn: { MATHS: 40, ENGLISH: 75 },
        absencesByColumn: { ENGLISH: true },
        total: 40,
        average: 40,
        rank: 1,
      },
    ],
    analysis: {},
    optimiStudents: [],
  };
}

describe("Color Mark Schedule Excel", () => {
  test("colors numeric subject marks without changing values or coloring absences", async () => {
    const reportData = makeReportData();
    const original = JSON.parse(JSON.stringify(reportData));
    const { workbook } = await createColorClassMarksWorkbook(reportData);
    const sheet = workbook.Sheets["Color Mark Schedule"];

    expect(sheet.A1.v).toContain("Color Mark Schedule");
    expect(sheet.E5.v).toBe(40);
    expect(sheet.E5.s.fill.fgColor.rgb).toBe("FFF4CCCC");
    expect(sheet.F5.v).toBe("AB");
    expect(sheet.F5.s).toBeUndefined();
    expect(reportData).toEqual(original);
  });
});
