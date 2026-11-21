import { studentClassLabel } from "./studentClassLabel";

test("uses the linked classroom's full A/L name", () => {
  const rooms = new Map([["c1", { fullClassName: "2028 Commerce A" }]]);
  expect(studentClassLabel({ grade: 12, section: "A", classroomId: "c1", alClassName: "12 Commerce A" }, rooms)).toBe("2028 Commerce A");
});

test("uses recorded or explicit batch names without inventing a batch", () => {
  expect(studentClassLabel({ grade: 12, fullClassName: "12 Arts A" })).toBe("12 Arts A");
  expect(studentClassLabel({ grade: 12, batchYear: 2028, stream: "Commerce", section: "" })).toBe("2028 Commerce");
  expect(studentClassLabel({ grade: 12, section: "A" })).toBe("G12-A");
  expect(studentClassLabel({ grade: 10, section: "A" })).toBe("G10-A");
});

test("matches an unlinked A/L student only when the batch and class identify one room", () => {
  const student = { grade: 12, batchYear: 2028, stream: "Commerce", section: "A", fullClassName: "12 Commerce A" };
  const room = { grade: 12, batchYear: 2028, stream: "Commerce", section: "A", fullClassName: "2028 Commerce A" };
  expect(studentClassLabel(student, new Map([["c1", room]]))).toBe("2028 Commerce A");
  expect(studentClassLabel(student, new Map([["c1", room], ["c2", room]]))).toBe("12 Commerce A");
});
