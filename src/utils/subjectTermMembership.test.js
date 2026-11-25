import { subjectEnrollmentInTerm } from "./subjectTermMembership";

test("uses explicit subject terms for both active and inactive enrollments", () => {
  const music = { status: "inactive", subjectTermIds: ["term-1", "term-2"] };
  const art = { status: "active", subjectTermIds: ["term-3"] };
  expect(subjectEnrollmentInTerm(music, { id: "term-2" })).toBe(true);
  expect(subjectEnrollmentInTerm(art, { id: "term-2" })).toBe(false);
  expect(subjectEnrollmentInTerm(art, { id: "term-3" })).toBe(true);
  expect(subjectEnrollmentInTerm(music, { id: "term-3" })).toBe(false);
});

test("legacy or unidentifiable terms are not guessed", () => {
  expect(subjectEnrollmentInTerm({ status: "active" }, { id: "term-2" })).toBeNull();
  expect(subjectEnrollmentInTerm({ subjectTermIds: ["term-2"] })).toBeNull();
  expect(subjectEnrollmentInTerm({ subjectTermIds: ["Term 2"] }, null, "term 2")).toBe(true);
});
