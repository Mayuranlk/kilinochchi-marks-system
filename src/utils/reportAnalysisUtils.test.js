import { calculateAnalysis } from "./reportAnalysisUtils";

test("counts 40 as a pass and keeps missing and absent results out of appeared", () => {
  const schema = { groups: [{ columns: [{ key: "MATHS" }] }] };
  const row = (mark, absent = false) => ({
    eligibleColumnKeys: ["MATHS"],
    marksByColumn: { MATHS: mark },
    absencesByColumn: { MATHS: absent },
  });
  const result = calculateAnalysis([row(39), row(40), row(75), row(null), row(null, true)], schema).MATHS;
  expect(result).toMatchObject({ total: 5, appeared: 3, passCount: 2, passPercentage: 66.67 });
});
