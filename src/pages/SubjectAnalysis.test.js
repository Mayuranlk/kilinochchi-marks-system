import { addToStats, createEmptyStats, finishStats } from "./SubjectAnalysis";

test("subject range uses 40 while other analysis retains grade-based passes", () => {
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
    enrolled: 5, appeared: 3, absent: 1, pending: 1, passCount: 3, passAtLeast40: 2,
  });
  expect(result.passPercentage).toBe(100);
  expect(result.passPercentageAtLeast40).toBeCloseTo(200 / 3);
});
