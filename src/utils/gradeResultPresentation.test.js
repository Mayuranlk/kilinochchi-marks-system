import { resultClassLabel, resultSlots, slotEntries, slotText, subjectLabel } from "./gradeResultPresentation";
import { REPORT_SCHEMA_10_TO_11 } from "./reportSchemas";

test("compact slots retain every conflicting basket choice and missing grade", () => {
  const slots = resultSlots(REPORT_SCHEMA_10_TO_11);
  expect(slots).toHaveLength(9);
  const basket = slots.find((slot) => slot.key === "basket2");
  const row = { grades: { B2_ART: "A", B2_DRAMA: "AB", B2_TAM_LIT: "" } };
  expect(slotEntries(row, basket).map(({ grade }) => grade)).toEqual(["A", "AB", "-"]);
  expect(slotText(row, basket)).toBe("Art\nA\nDrama\nAB\nTamil Lit\n-");
  expect(row.grades.B2_TAM_LIT).toBe("");
});

test("class and subject labels use identities rather than ambiguous substrings", () => {
  expect(resultClassLabel({ student: { grade: 11 }, division: "A" }, 10)).toBe("11A");
  expect(resultClassLabel({ division: "C" }, 10)).toBe("10C");
  expect(subjectLabel({ key: "B2_DRAMA", label: "Drama & Theater" })).toBe("Drama");
  expect(["B3_DCT", "B3_DMT", "B3_DEET"].map((key) => subjectLabel({ key }))).toEqual(["DCT", "DMT", "DEET"]);
});
