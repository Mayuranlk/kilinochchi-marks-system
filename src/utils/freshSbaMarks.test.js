import { isValidSbaMark, matchesSbaRecord, sbaClassKey, sbaRecordId } from "./freshSbaMarks";

test("SBA accepts only numeric marks from zero through twenty", () => {
  ["0", "12.5", "20"].forEach((mark) => expect(isValidSbaMark(mark)).toBe(true));
  ["", "-1", "20.1", "Infinity", "1e1", "abc"].forEach((mark) => expect(isValidSbaMark(mark)).toBe(false));
});

test("class keys remain compatible with the deployed term-mark prerequisite", () => {
  expect(sbaClassKey(10, "a", "", 0)).toBe("10|A|");
  expect(sbaClassKey(12, "a", "Commerce", 2028)).toBe("12|A|commerce|2028");
});

test("existing SBA records match only the same term, student and subject", () => {
  const record = { termId: "t1", studentId: "s1", subjectId: "maths" };
  expect(matchesSbaRecord(record, "t1", "s1", "maths")).toBe(true);
  expect(matchesSbaRecord(record, "t2", "s1", "maths")).toBe(false);
  expect(matchesSbaRecord(record, "t1", "s1", "science")).toBe(false);
});

test("SBA record IDs match the existing term, student and subject format", () => {
  expect(sbaRecordId("t1", "s1", "maths")).toBe("t1~s1~maths");
  expect(() => sbaRecordId("t1", "s/1", "maths")).toThrow();
});
