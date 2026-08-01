import {
  buildCanonicalAcademicFields,
  buildCanonicalEnrollmentFields,
  buildCanonicalMarkFields,
  buildCanonicalStudentFields,
} from "./firestoreCanonical";

const legacyRow = {
  studentId: "student/1",
  year: "Academic Year 2026",
  termName: "Term 1",
  grade: "Grade 10",
  fullClassName: "10 A",
  subjectName: "Mathematics",
};

test("builds stable query fields without removing legacy aliases", () => {
  expect(buildCanonicalAcademicFields(legacyRow)).toEqual({
    schemaVersion: 2,
    academicYearKey: "2026",
    termKey: "term-1",
    gradeNumber: 10,
    classKey: "10-a",
    subjectKey: "mathematics",
    assessmentKey: "term",
  });

});

test("builds stable student query fields without removing legacy fields", () => {
  expect(
    buildCanonicalStudentFields({
      academicYear: "2026 Academic Year",
      grade: "Grade 10",
      section: "A",
    })
  ).toEqual({
    schemaVersion: 2,
    academicYearKey: "2026",
    gradeNumber: 10,
    classKey: "10-a",
  });
});

test("builds deterministic logical identities without changing document IDs", () => {
  expect(buildCanonicalMarkFields(legacyRow).markKey).toBe(
    "student%2F1__2026__term-1__term__mathematics"
  );
  expect(buildCanonicalEnrollmentFields(legacyRow).enrollmentKey).toBe(
    "student%2F1__2026__mathematics"
  );
});
