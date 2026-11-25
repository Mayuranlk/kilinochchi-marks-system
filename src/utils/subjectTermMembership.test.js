import { planSubjectTermChange, subjectEnrollmentInTerm } from "./subjectTermMembership";

test("uses explicit subject terms for both active and inactive enrollments", () => {
  const music = { status: "inactive", subjectTermIds: ["term-1", "term-2"] };
  const art = { status: "active", subjectTermIds: ["term-3"] };
  expect(subjectEnrollmentInTerm(music, { id: "term-2" })).toBe(true);
  expect(subjectEnrollmentInTerm(art, { id: "term-2" })).toBe(false);
  expect(subjectEnrollmentInTerm(art, { id: "term-3" })).toBe(true);
  expect(subjectEnrollmentInTerm(music, { id: "term-3" })).toBe(false);
});

test("a change in term 3 preserves earlier membership and supports changing back", () => {
  const termIds = ["t1", "t2", "t3"];
  expect(planSubjectTermChange({ termIds, effectiveTermId: "t3", oldTermIds: ["t1", "t2", "t3"] }))
    .toEqual({ oldTermIds: ["t1", "t2"], newTermIds: ["t3"] });
  expect(planSubjectTermChange({ termIds, effectiveTermId: "t3", oldTermIds: ["t2", "t3"], newTermIds: ["t1"] }))
    .toEqual({ oldTermIds: ["t2"], newTermIds: ["t1", "t3"] });
});

test("rejects incomplete or contradictory term history", () => {
  const termIds = ["t1", "t2", "t3"];
  expect(() => planSubjectTermChange({ termIds, effectiveTermId: "t3" })).toThrow(/history/);
  expect(() => planSubjectTermChange({ termIds, effectiveTermId: "t4", oldTermIds: [] })).toThrow(/effective/);
  expect(() => planSubjectTermChange({ termIds, effectiveTermId: "t3", oldTermIds: ["t1"], newTermIds: ["t1"] })).toThrow(/overlap/);
});

test("legacy or unidentifiable terms are not guessed", () => {
  expect(subjectEnrollmentInTerm({ status: "active" }, { id: "term-2" })).toBeNull();
  expect(subjectEnrollmentInTerm({ subjectTermIds: ["term-2"] })).toBeNull();
  expect(subjectEnrollmentInTerm({ subjectTermIds: ["Term 2"] }, null, "term 2")).toBe(true);
});
