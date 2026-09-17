import { buildMarksByStudentId } from "./subjectAnalysisIndex";

describe("buildMarksByStudentId", () => {
  test("groups only marks belonging to the requested student identity", () => {
    const first = { id: "m1", studentId: " s1 ", mark: 72 };
    const second = { id: "m2", studentId: "s2", mark: 65 };
    const third = { id: "m3", studentId: "s1", mark: 81 };

    const index = buildMarksByStudentId([first, second, third, { id: "legacy-without-id" }]);

    expect(index.get("s1")).toEqual([first, third]);
    expect(index.get("s2")).toEqual([second]);
    expect(index.has("")).toBe(false);
  });

  test("handles an empty input", () => {
    expect(buildMarksByStudentId()).toEqual(new Map());
  });
});
