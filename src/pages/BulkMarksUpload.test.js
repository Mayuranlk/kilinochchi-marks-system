import {
  buildClassSheetRows,
  validateLowerClassSheetRows,
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

describe("Grade 10-11 class workbook validation", () => {
  const headers = ["Student ID", "Grade", "GrDivision", "Term", "StudentName", "Religion", "First Language", "Maths", "English", "Science", "History", "FirstGroup", "SecondGroup", "ThirdGroup"];
  const students = [
    { id: "one", grade: 10, section: "B", religion: "Hinduism", basketAChoice: "Geography", basketBChoice: "Art", basketCChoice: "ICT" },
    { id: "two", grade: 10, section: "B", religion: "Christianity", basketAChoice: "Business Studies", basketBChoice: "Music", basketCChoice: "Agriculture" },
  ];
  const subjects = (student) => [student.religion, "Tamil", "Mathematics", "English", "Science", "History", student.basketAChoice, student.basketBChoice, student.basketCChoice];
  const classEnrollments = students.flatMap((student) => subjects(student).map((subjectName) => ({ studentId: student.id, subjectId: subjectName, subjectName, grade: 10, section: "B", academicYear: "2026" })));
  const row = (id = "one") => [id, 10, "B", "FirstTerm", "Example Student", 96, 94, 88, 87, 82, 86, 94, 96, 97];
  const validate = (rows, overrides = {}) => validateLowerClassSheetRows({ rows: [headers, ...rows], studentsByUploadId: new Map(students.map((student) => [student.id, student])), classEnrollments, selectedClass: "10B", selectedTerm: "Term 1", selectedYear: "2026", ...overrides });

  test("maps all nine marks separately for each student's religion and basket choices", () => {
    const result = validate([row(), row("two")]);
    expect(result.invalidRows).toEqual([]);
    expect(result.validRows).toHaveLength(18);
    students.forEach((student) => expect(result.validRows.filter((mark) => mark.studentId === student.id).map((mark) => mark.subjectName)).toEqual(subjects(student)));
    expect(result.validRows[1]).toMatchObject({ subjectName: "Tamil", marks: 94, className: "10B", academicYear: "2026", term: "Term 1" });
  });

  test("keeps absent marks, skips blanks, and rejects marks outside 0?100", () => {
    const values = row(); values[5] = "AB"; values[6] = ""; values[7] = 101; values[8] = -1; values[9] = 0;
    const result = validate([values]);
    expect(result.validRows).toHaveLength(6);
    expect(result.validRows[0]).toMatchObject({ absent: true, marks: null });
    expect(result.validRows).toContainEqual(expect.objectContaining({ subjectName: "Science", marks: 0 }));
    expect(result.invalidRows).toHaveLength(2);
  });

  test.each([[1, 11], [2, "A"], [3, "SecondTerm"], [0, "unknown"]])("rejects incompatible identity or context in column %s", (column, value) => {
    const values = row(); values[column] = value;
    const result = validate([values]);
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(9);
  });

  test("does not guess a missing basket choice", () => {
    const student = { ...students[0], basketAChoice: "" };
    const result = validate([row()], { studentsByUploadId: new Map([[student.id, student]]) });
    expect(result.invalidRows).toHaveLength(1);
    expect(result.validRows).toHaveLength(8);
  });

  test("flags duplicate student/subject marks", () => {
    const result = validate([row(), row()]);
    expect(result.validRows).toHaveLength(9);
    expect(result.invalidRows).toHaveLength(9);
  });

  test("supports Grade 11 and historical enrollment grades", () => {
    const values = row(); values[1] = 11;
    const result = validate([values], { selectedClass: "11B", classEnrollments: classEnrollments.map((enrollment) => ({ ...enrollment, grade: 11 })) });
    expect(result.invalidRows).toEqual([]);
    expect(result.validRows).toHaveLength(9);
  });
  test.each([10, 11])("imports all divisions in Grade %s with each student's subject choices", (grade) => {
    const gradeEnrollments = classEnrollments.map((enrollment) => ({ ...enrollment, grade, section: enrollment.studentId === "one" ? "A" : "B" }));
    const first = row(); first[1] = grade; first[2] = "A";
    const second = row("two"); second[1] = grade;
    const context = { selectedClass: "", selectedGrade: String(grade), wholeGrade: true, classEnrollments: gradeEnrollments };
    const result = validate([first, second], context);
    expect(result.invalidRows).toEqual([]);
    expect(result.validRows).toHaveLength(18);
    expect(result.validRows.filter((mark) => mark.studentId === "one").every((mark) => mark.className === `${grade}A`)).toBe(true);
    expect(result.validRows.filter((mark) => mark.studentId === "two").every((mark) => mark.className === `${grade}B`)).toBe(true);
    first[2] = "";
    expect(validate([first], context).invalidRows).toHaveLength(9);
    first[2] = "B";
    expect(validate([first], context).invalidRows).toHaveLength(9);

    const template = buildClassSheetRows({ classEnrollments: gradeEnrollments, studentsById: new Map(students.map((student) => [student.id, student])), className: `Grade ${grade}`, term: "Term 1", academicYear: "2026", includeClass: true });
    const classIndex = template.headers.indexOf("Class");
    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(template.rows.map((values) => values[classIndex]).sort()).toEqual([`${grade}A`, `${grade}B`]);
  });

});
