import { BASKET_C, getBasketForSubjectName } from "../constants";
import { flattenSchemaColumns, REPORT_SCHEMA_10_TO_11 } from "./reportSchemas";

describe("Grade 10-11 ICT basket configuration", () => {
  test("provides separate Tamil and English ICT choices", () => {
    expect(BASKET_C).toContain("Information & Communication Technology (T)");
    expect(BASKET_C).toContain("Information & Communication Technology (E)");
    expect(BASKET_C).not.toContain("Information & Communication Technology");
  });

  test("keeps the legacy ICT name mapped to Basket C", () => {
    expect(getBasketForSubjectName("Information & Communication Technology")).toBe("C");
  });

  test("reports have separate ICT Tamil and English columns", () => {
    const keys = flattenSchemaColumns(REPORT_SCHEMA_10_TO_11).map((column) => column.key);
    expect(keys).toEqual(expect.arrayContaining(["B3_ICT_T", "B3_ICT_E"]));
  });
});
