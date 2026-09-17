import {
  buildClassSheetRows,
  getLowerClassColumnPlan,
  parseMarksValue,
  resolveClassSheetSubject,
} from "./BulkMarksUpload";

const enrollments = [
  { subjectId: "rel-h", subjectName: "Hinduism", subjectNumber: "R1" },
  { subjectId: "music", subjectName: "Music", subjectNumber: "A2" },
  { subjectId: "civics", subjectName: "Civic Education", subjectNumber: "C1" },
  { subjectId: "sinhala", subjectName: "Sinhala", subjectNumber: "SL" },
  { subjectId: "geography", subjectName: "Geography", subjectNumber: "B1" },
];

describe("Bulk Marks Upload special subject mapping", () => {
  test("recognizes SchoolID, Grade, GrDivision, and Term as metadata", () => {
    const plan = getLowerClassColumnPlan([
      [
        "SchoolID",
        "Index No",
        "Student",
        "Grade",
        "GrDivision",
        "Term",
        "First Language",
        "Mathematics",
      ],
      ["101020002134", "12768", "S. Kanimoli", "8", "A", "FirstTerm", "90", "94"],
    ]);

    expect(plan.studentIdIndex).toBe(0);
    expect(plan.indexNoIndex).toBe(1);
    expect(plan.nameIndex).toBe(2);
    expect(plan.gradeIndex).toBe(3);
    expect(plan.classIndex).toBe(4);
    expect(plan.termIndex).toBe(5);
    expect(plan.subjectColumns.map((column) => column.rawSubject)).toEqual([
      "First Language",
      "Mathematics",
    ]);
  });

  test("treats AB as an absent mark", () => {
    expect(parseMarksValue("AB")).toEqual({ valid: true, value: null, absent: true });
    expect(parseMarksValue("Absent")).toEqual({ valid: true, value: null, absent: true });
    expect(parseMarksValue("75")).toEqual({ valid: true, value: 75, absent: false });
  });

  test("builds a class workbook shape with one row per student and enrolled subjects", () => {
    const template = buildClassSheetRows({
      classEnrollments: [
        { studentId: "s1", subjectId: "math", subjectName: "Mathematics", academicYear: "2026" },
        { studentId: "s1", subjectId: "eng", subjectName: "English", academicYear: "2026" },
        { studentId: "s2", subjectId: "math", subjectName: "Mathematics", academicYear: "2026" },
      ],
      studentsById: new Map([
        ["s1", { id: "s1", name: "One", indexNumber: "1" }],
        ["s2", { id: "s2", name: "Two", indexNumber: "2" }],
      ]),
      className: "6A",
      term: "Term 1",
      academicYear: "2026",
    });

    expect(template.headers).toEqual(["Student ID", "Index No", "Name", "English", "Mathematics"]);
    expect(template.rows).toHaveLength(2);
    expect(template.rows[0][0]).toBe("s1");
  });

  test("maps Religion using the student's profile religion", () => {
    expect(resolveClassSheetSubject("Religion", enrollments, { religion: "Hinduism" })).toEqual(
      expect.objectContaining({ subjectId: "rel-h", subjectName: "Hinduism" })
    );
  });

  test("maps Aesthetic using the student's profile choice", () => {
    expect(resolveClassSheetSubject("Aesthetic", enrollments, { aestheticChoice: "Music" })).toEqual(
      expect.objectContaining({ subjectId: "music", subjectName: "Music" })
    );
  });

  test("maps CitiEduGove to the configured Civics subject", () => {
    expect(resolveClassSheetSubject("CitiEduGove", enrollments)).toEqual(
      expect.objectContaining({ subjectId: "civics", subjectName: "Civic Education" })
    );
  });

  test("maps Second Language to Sinhala", () => {
    expect(resolveClassSheetSubject("Second Language", enrollments)).toEqual(
      expect.objectContaining({ subjectId: "sinhala", subjectName: "Sinhala" })
    );
  });

  test("maps Basket 1 using the student's selected basket subject", () => {
    expect(resolveClassSheetSubject("Basket 1", enrollments, { basketAChoice: "Geography" })).toEqual(
      expect.objectContaining({ subjectId: "geography", subjectName: "Geography" })
    );
  });

  test("maps Basket 2 and Basket 3 using the student's selected choices", () => {
    const basketEnrollments = [
      ...enrollments,
      { subjectId: "art", subjectName: "Art", subjectNumber: "B2" },
      { subjectId: "ict", subjectName: "Information & Communication Technology (T)", subjectNumber: "B3" },
    ];

    expect(resolveClassSheetSubject("Basket 2", basketEnrollments, { basketBChoice: "Art" })).toEqual(
      expect.objectContaining({ subjectId: "art", subjectName: "Art" })
    );
    expect(
      resolveClassSheetSubject("Basket 3", basketEnrollments, {
        basketCChoice: "Information & Communication Technology (T)",
      })
    ).toEqual(
      expect.objectContaining({ subjectId: "ict", subjectName: "Information & Communication Technology (T)" })
    );
  });
});