import { resultRows, buildEligibility, classifyResult, RESULT_CATEGORIES, resultAnalytics, formatRate } from "./gradeResultLogic";
import { REPORT_SCHEMA_10_TO_11 as schema, flattenSchemaColumns } from "./reportSchemas";
const keys = schema.groups.flatMap((group) => group.key === "core" ? group.columns.map((column) => column.key) : [group.columns[0].key]);
const columns = flattenSchemaColumns(schema);
const build = (overrides = {}) => resultRows({ schema, rows: [{
  student: { id: "s1", section: "A" }, studentName: "Student", total: 675,
  eligibleColumnKeys: keys, marksByColumn: Object.fromEntries(keys.map((key) => [key, 75])), ...overrides,
}] }, columns)[0];

test("counts exactly nine selected subjects, not all class basket columns", () => {
  const row = build();
  expect(row.gradesSummary).toEqual({ A: 9 });
  expect(row.eligibility.qualified).toBe(true);
  expect(Object.keys(row.grades)).toHaveLength(9);
  expect(build({ student: { id: "legacy", className: "10A" } }).division).toBe("A");
});
test("missing results remain incomplete, but zero and absent are recorded failures", () => {
  const marks = Object.fromEntries(keys.map((key) => [key, 75]));
  expect(build({ marksByColumn: { ...marks, TAMIL: null } }).eligibility.label).toMatch(/Incomplete/);
  expect(build({ marksByColumn: { ...marks, TAMIL: 0 } }).eligibility.failedTamilOrMaths).toBe(true);
  const absent = build({ absencesByColumn: { TAMIL: true } });
  expect(absent.grades.TAMIL).toBe("AB");
  expect(absent.eligibility.complete).toBe(true);
  expect(absent.eligibility.qualified).toBe(false);
});
test("handles decimal band boundaries and rejects out-of-range marks", () => {
  const marks = Object.fromEntries(keys.map((key) => [key, 74.5]));
  expect(build({ marksByColumn: marks }).gradesSummary).toEqual({ B: 9 });
  expect(build({ marksByColumn: { ...marks, TAMIL: 101 } }).eligibility.complete).toBe(false);
});
test("conflicting basket choices require review rather than inflated qualification", () => {
  const duplicate = schema.groups.find((group) => group.key === "basket1").columns[1].key;
  expect(build({ eligibleColumnKeys: [...keys, duplicate] }).eligibility.complete).toBe(false);
  const wrongNine = [...keys.filter((key) => key !== "TAMIL"), duplicate];
  expect(build({ eligibleColumnKeys: wrongNine }).eligibility.complete).toBe(false);
});
test("three credits and six total passes are required", () => {
  const marks = Object.fromEntries(keys.map((key) => [key, 35]));
  expect(build({ marksByColumn: { ...marks, TAMIL: 50, MATHS: 50 } }).eligibility.qualified).toBe(false);
  expect(build({ marksByColumn: { ...marks, TAMIL: 50, MATHS: 50, ENGLISH: 50 } }).eligibility.qualified).toBe(true);
});

const classify = (values) => {
  const grades = Object.fromEntries(["TAMIL", "MATHS", "s3", "s4", "s5", "s6", "s7", "s8", "s9"].map((key, index) => [key, values[index]]));
  return classifyResult(grades, buildEligibility(grades));
};
test("six ordered categories reconcile with an exclusive 9A category", () => {
  const rows = [
    classify(Array(9).fill("A")),
    classify(["W", "W", "A", "A", "A", "A", "W", "W", "W"]),
    classify(["C", "C", "C", "S", "S", "S", "W", "W", "W"]),
    classify(["W", "C", "C", "C", "S", "S", "S", "W", "W"]),
    classify(["S", "S", "C", "C", "S", "S", "S", "S", "S"]),
    classify(["S", "W", "W", "W", "W", "W", "W", "W", "W"]),
  ];
  expect(rows.map((row) => row.id)).toEqual(RESULT_CATEGORIES.map((row) => row.id));
  expect(RESULT_CATEGORIES.reduce((sum, category) => sum + rows.filter((row) => row.id === category.id).length, 0)).toBe(rows.length);
  expect(build().category.id).toBe("excellent");
});
test("A* is a pass but does not inflate the explicitly A-only achievement categories", () => {
  expect(classify(["A*", "A", "A", "A", "W", "W", "W", "W", "W"]).id).toBe("threshold-risk");
});
test("core absence is explicitly separate from failure and pending results", () => {
  const absent = classify(["AB", "C", "C", "C", "S", "S", "S", "W", "W"]);
  expect(absent.id).toBe("core-risk");
  expect(absent.notes).toEqual(["Tamil absent"]);
  expect(classify(["W", "W", "C", "C", "C", "S", "S", "S", "W"]).notes).toContain("Failed both");
  const pending = classify(["", "S", "C", "C", "W", "W", "W", "W", "W"]);
  expect(pending.provisional).toBe(true);
  expect(pending.notes).toEqual(["Pending results / review"]);
});

test("subject rates exclude absences, pending marks and students not enrolled", () => {
  const rows = ["A*", "S", "W", "AB", ""].map((value) => ({ grades: { TAMIL: value }, category: { id: "support" }, eligibility: { qualified: false, complete: value !== "" } }));
  rows.push({ grades: {}, category: { id: "support" }, eligibility: { qualified: false, complete: false } });
  const analytics = resultAnalytics(rows, [{ key: "TAMIL", label: "Tamil" }]);
  expect(analytics.subjects[0]).toMatchObject({ enrolled: 5, sat: 3, passed: 2, failed: 1, absent: 1, pending: 1 });
  expect(formatRate(analytics.subjects[0].rate)).toBe("66.7%");
  expect(formatRate(resultAnalytics([], []).verifiedRate)).toBe("N/A");
});
test("Best achievers with core failures are not counted as verified eligible", () => {
  const grades = { TAMIL: "W", MATHS: "W", s3: "A", s4: "A", s5: "A", s6: "A", s7: "S", s8: "S", s9: "W" };
  const eligibility = buildEligibility(grades);
  const category = classifyResult(grades, eligibility);
  expect(category.id).toBe("best");
  const analytics = resultAnalytics([{ grades, eligibility, category }], []);
  expect(analytics.groupedRate).toBe(100);
  expect(analytics.verifiedRate).toBe(0);
});

test("overview absentees are unique students and eligibility totals reconcile", () => {
  const rows = [
    { grades: { TAMIL: "AB", MATHS: "AB" }, category: { id: "support" }, eligibility: { qualified: false, complete: true } },
    { grades: { TAMIL: "AB", MATHS: "" }, category: { id: "support" }, eligibility: { qualified: false, complete: false } },
    { grades: { TAMIL: "A", MATHS: "A" }, category: { id: "eligible" }, eligibility: { qualified: true, complete: true } },
  ];
  const result = resultAnalytics(rows, []);
  expect(result.absent).toBe(2);
  const measures = Object.fromEntries(result.overview.map((item) => [item.label, item.count]));
  expect(measures["Verified eligible"] + measures["Not eligible"] + measures["Pending review"]).toBe(3);
  expect(formatRate(result.overview.find((item) => item.label === "Absent students").rate)).toBe("66.7%");
});
