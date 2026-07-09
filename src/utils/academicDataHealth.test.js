import { buildAcademicHealthReport } from "./academicDataHealth";

const grade10Student = {
  id: "student-1",
  name: "Test Student",
  admissionNo: "12000",
  grade: 10,
  section: "C",
  status: "Active",
};

const enrollment = (name) => ({
  id: `enrollment-${name}`,
  studentId: "student-1",
  studentName: "Test Student",
  subjectName: name,
  academicYear: "2026",
  status: "active",
});

describe("buildAcademicHealthReport", () => {
  test("reports missing Grade 10 compulsory subjects", () => {
    const report = buildAcademicHealthReport({
      students: [grade10Student],
      subjects: [],
      enrollments: [enrollment("Tamil")],
      marks: [],
      academicYear: "2026",
    });

    const missing = report.issues
      .filter((issue) => issue.type === "Missing compulsory enrollment")
      .map((issue) => issue.detail);

    expect(missing).toHaveLength(4);
    expect(missing.join(" ")).toContain("Mathematics");
    expect(missing.join(" ")).not.toContain("Tamil is missing");
  });

  test("accepts a complete Grade 10 compulsory enrollment set", () => {
    const names = ["Tamil", "Mathematics", "Science", "History", "English"];
    const report = buildAcademicHealthReport({
      students: [grade10Student],
      subjects: [],
      enrollments: names.map(enrollment),
      marks: [],
      academicYear: "2026",
    });

    expect(report.issues.filter(
      (issue) => issue.type === "Missing compulsory enrollment"
    )).toHaveLength(0);
  });

  test("finds duplicate subject documents by canonical identity", () => {
    const report = buildAcademicHealthReport({
      students: [],
      subjects: [
        { id: "tamil-1", name: "Tamil", category: "core", status: "active" },
        { id: "tamil-2", subjectName: " Tamil ", category: "core", status: "active" },
      ],
      enrollments: [],
      marks: [],
      academicYear: "2026",
    });

    expect(report.byType["Duplicate subject definition"]).toBe(1);
  });
});
