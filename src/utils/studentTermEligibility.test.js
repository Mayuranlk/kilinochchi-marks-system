import { findAcademicTerm, schoolDate, studentWasEnrolledDuringTerm } from "./studentTermEligibility";

const term1 = { term: "Term 1", year: 2026, startDate: "2026-01-05", endDate: "2026-04-10" };
const term2 = { term: "Term 2", year: 2026, startDate: "2026-05-01", endDate: "2026-08-15" };
const term3 = { term: "Term 3", year: 2026, startDate: "2026-09-01", endDate: "2026-12-10" };

test("admission and leaving dates include overlapping terms and exclude other terms", () => {
  const student = { joinDate: "2026-05-20", leftDate: "2026-07-10", status: "Left" };
  expect(studentWasEnrolledDuringTerm(student, term1)).toBe(false);
  expect(studentWasEnrolledDuringTerm(student, term2)).toBe(true);
  expect(studentWasEnrolledDuringTerm(student, term3)).toBe(false);
  expect(studentWasEnrolledDuringTerm({ joinDate: term1.endDate }, term1)).toBe(true);
  expect(studentWasEnrolledDuringTerm({ leftDate: term1.startDate }, term1)).toBe(true);
});

test("missing dates and terms do not silently exclude legacy students", () => {
  expect(studentWasEnrolledDuringTerm({}, term1)).toBe(true);
  expect(studentWasEnrolledDuringTerm({ joinDate: "2026-05-20" }, null)).toBe(true);
  expect(findAcademicTerm([term1, term2], "2026", "term 2")).toBe(term2);
  expect(schoolDate("2026-02-30")).toBe("");
  expect(studentWasEnrolledDuringTerm({ leftDate: "2025-06-01" }, findAcademicTerm([], 2026, "All"))).toBe(false);
});
