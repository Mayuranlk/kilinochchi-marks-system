import { markStudentId } from "./markStudentIdentity";

test("normalizes a student's ID to the string used in mark queries", () => {
  expect(markStudentId(" student-1 ")).toBe("student-1");
  expect(markStudentId(123)).toBe("123");
});

test("rejects missing IDs and document paths", () => {
  expect(() => markStudentId("  ")).toThrow(/student ID/);
  expect(() => markStudentId("students/student-1")).toThrow(/student ID/);
  expect(() => markStudentId({ id: "student-1" })).toThrow(/student ID/);
});
