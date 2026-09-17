import {
  getRankingMedium,
  isMediumSplitSubject,
  matchesAcademicMedium,
  normalizeAcademicMedium,
  usesSeparateMediumRanking,
} from "./academicMediumUtils";
import { assignRanks } from "./reportAnalysisUtils";

describe("academic medium helpers", () => {
  test("normalizes only supported school ranking mediums", () => {
    expect(normalizeAcademicMedium(" english ")).toBe("English");
    expect(normalizeAcademicMedium("TAMIL")).toBe("Tamil");
    expect(normalizeAcademicMedium("Sinhala")).toBe("");
  });

  test("splits Mathematics and Science only in Grades 6 to 11", () => {
    expect(isMediumSplitSubject("Mathematics", 6)).toBe(true);
    expect(isMediumSplitSubject("Science - English Medium", 11)).toBe(true);
    expect(isMediumSplitSubject("History", 6)).toBe(false);
    expect(isMediumSplitSubject("Science", 12)).toBe(false);
  });

  test("uses enrollment medium when an older student record has no medium", () => {
    expect(getRankingMedium({}, [{ medium: "English" }])).toBe("English");
    expect(matchesAcademicMedium({ medium: "Tamil" }, "English")).toBe(false);
    expect(usesSeparateMediumRanking(11)).toBe(true);
    expect(usesSeparateMediumRanking(12)).toBe(false);
  });
});

describe("medium-group ranking", () => {
  test("assigns independent competition ranks for Tamil and English", () => {
    const rows = [
      { studentName: "Tamil A", rankingMedium: "Tamil", total: 90 },
      { studentName: "English A", rankingMedium: "English", total: 80 },
      { studentName: "Tamil B", rankingMedium: "Tamil", total: 70 },
      { studentName: "English B", rankingMedium: "English", total: 80 },
      { studentName: "English C", rankingMedium: "English", total: 60 },
    ];

    const ranked = assignRanks(rows, {
      getGroupKey: (row) => row.rankingMedium,
    });
    const ranks = Object.fromEntries(
      ranked.map((row) => [row.studentName, row.rank])
    );

    expect(ranks).toEqual({
      "English A": 1,
      "English B": 1,
      "English C": 3,
      "Tamil A": 1,
      "Tamil B": 2,
    });
  });
});
