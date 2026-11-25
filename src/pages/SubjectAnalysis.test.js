import { addToStats, createEmptyStats, finishStats } from "./SubjectAnalysis";

test("subject analysis distinguishes pending and absent and counts marks of 40 as passing", () => {
  const stats = createEmptyStats("Art");
  [
    { mark: 39, grade: 6 },
    { mark: 40, grade: 6 },
    { mark: 75, grade: 6 },
    { mark: null, grade: 6, absent: true },
    { mark: null, grade: 6 },
  ].forEach((record) => addToStats(stats, record));
  const result = finishStats(stats);
  expect(result).toMatchObject({
    enrolled: 5, appeared: 3, absent: 1, pending: 1, passCount: 2,
  });
  expect(result.passPercentage).toBeCloseTo(200 / 3);
});
