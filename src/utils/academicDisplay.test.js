import { academicDisplay, academicExport, academicSearch, storedReligion, academicWorksheet } from "./academicDisplay";
import { RELIGIONS } from "../constants";
import { resolveReligionColumnFromStudent } from "./reportMappingUtils";
import { getReportSchemaByGrade } from "./reportSchemas";
import { sbaSubjectLabel } from "./sbaRegisterPrint";
test("display aliases change without changing stored options or records", () => {
  const record = Object.freeze({ subjectId: "hinduism", subjectName: "Hinduism", religion: "Hinduism" });
  expect(academicDisplay(record.subjectName)).toBe("Saivanery");
  expect(academicDisplay("Grade 6 - Hinduism / Saivam")).toBe("Grade 6 - Saivanery / Saivanery");
  expect(academicDisplay("REL_SAIVAM")).toBe("REL_SAIVAM");
  expect(record.subjectName).toBe("Hinduism");
  expect(RELIGIONS).toContain("Hinduism");
  expect(academicExport(record)).toEqual({ subjectId: "hinduism", subjectName: "Saivanery", religion: "Saivanery" });
  expect(storedReligion("Saivanery")).toBe("Hinduism");
});
test("exports are copied; numeric marks, identifiers, dates and functions are preserved", () => {
  const date = new Date(), fn = () => {};
  const input = { head: [["Hinduism"]], body: [[0, "AB", "Saivam"]], column: { dataKey: "hinduism" }, date, didDrawCell: fn };
  const result = academicExport(input);
  expect(result.head).toEqual([["Saivanery"]]);
  expect(result.body).toEqual([[0, "AB", "Saivanery"]]);
  expect(result.column.dataKey).toBe("hinduism");
  expect(result.date).toBe(date); expect(result.didDrawCell).toBe(fn);
  expect(input.head[0][0]).toBe("Hinduism");
});
test("old and new names remain searchable and map to the original religion column", () => {
  expect(academicSearch("Hinduism", "saivanery")).toBe(true);
  expect(academicSearch("Hinduism", "hindu")).toBe(true);
  expect(academicSearch("Saivanery", "Hinduism")).toBe(true);
  for (const name of ["Hinduism", "Saivam", "Saivanery"]) {
    expect(resolveReligionColumnFromStudent({ religion: name })).toBe("REL_SAIVAM");
    expect(sbaSubjectLabel(name)).toBe("Saivanery");
  }
  expect(getReportSchemaByGrade(10)).toBeTruthy();
});


test("dynamic subject column keys remain aligned with PDF data keys and spreadsheet numeric marks", () => {
  const input = { columns: [{ header: "Hinduism", dataKey: "Hinduism" }], body: [{ Hinduism: 19 }] };
  const result = academicExport(input);
  expect(result.columns[0]).toEqual({ header: "Saivanery", dataKey: "Hinduism" });
  expect(result.body[0][result.columns[0].dataKey]).toBe(19);
  const sheet = { A1: { t: "s", v: "Hinduism" }, A2: { t: "n", v: 19 }, "!ref": "A1:A2" };
  expect(academicWorksheet(sheet)).toEqual({ ...sheet, A1: { t: "s", v: "Saivanery" } });
  expect(sheet.A1.v).toBe("Hinduism");
});


test("spreadsheet identifier columns retain raw values", () => {
  const sheet = { A1: { t: "s", v: "Subject ID" }, A2: { t: "s", v: "Hinduism" }, B1: { t: "s", v: "Subject" }, B2: { t: "s", v: "Hinduism" } };
  expect(academicWorksheet(sheet).A2.v).toBe("Hinduism");
  expect(academicWorksheet(sheet).B2.v).toBe("Saivanery");
});
