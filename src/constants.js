export const SCHOOL_NAME = "Kilinochchi Central College";
export const SCHOOL_SUBTITLE =
  "Provincial Department of Education - Northern Province";

export const GRADES = [6, 7, 8, 9, 10, 11, 12, 13];

export const SECTIONS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P",
  "Q","R","S","T","U","V","W","X","Y","Z",
];

export const TERMS = ["Term 1", "Term 2", "Term 3"];
export const ACADEMIC_YEARS = ["2024", "2025", "2026", "2027"];

/* -------------------------------------------------------------------------- */
/* Religion                                                                    */
/* -------------------------------------------------------------------------- */

export const RELIGIONS = [
  "Buddhism",
  "Hinduism",
  "Islam",
  "Catholicism",
  "Christianity",
];

/* -------------------------------------------------------------------------- */
/* Grade 6-9 Aesthetic                                                         */
/* -------------------------------------------------------------------------- */

export const AESTHETIC_SUBJECTS = [
  "Art",
  "Music",
  "Dancing",
  "Drama & Theatre",
];

/* -------------------------------------------------------------------------- */
/* Grade 10-11 Basket Subjects (FINAL SCHOOL VERSION)                          */
/* -------------------------------------------------------------------------- */

export const BASKET_A = [
  "Business & Accounting Studies",
  "Geography",
  "Civic Education",
  "Entrepreneurship Studies",
];

export const BASKET_B = [
  "Music (Carnatic)",
  "Art",
  "Dancing (Bharata)",
  "Drama and Theatre (Tamil)",
  "Appreciation of English Literary Texts",
  "Appreciation of Tamil Literary Texts",
];

export const BASKET_C = [
  "Information & Communication Technology",
  "Agriculture & Food Technology",
  "Home Economics",
  "Health & Physical Education",
  "Communication & Media Studies",
  "Design & Construction Technology",
  "Design & Mechanical Technology",
  "Design, Electrical & Electronic Technology",
];

/* -------------------------------------------------------------------------- */
/* Backward-compatible aliases                                                 */
/* -------------------------------------------------------------------------- */

export const BASKET_1 = BASKET_A;
export const BASKET_2 = BASKET_B;
export const BASKET_3 = BASKET_C;

/* -------------------------------------------------------------------------- */
/* Basket metadata helpers                                                     */
/* -------------------------------------------------------------------------- */

export const BASKET_LABELS = {
  A: "Basket A",
  B: "Basket B",
  C: "Basket C",
};

export const BASKET_PREFIXES = {
  A: "B1",
  B: "B2",
  C: "B3",
};

export const BASKET_OPTIONS = {
  A: BASKET_A,
  B: BASKET_B,
  C: BASKET_C,
};

/* -------------------------------------------------------------------------- */
/* Core Subjects                                                               */
/* -------------------------------------------------------------------------- */

export const COMPULSORY_CORE_6_9 = [
  "Tamil",
  "Mathematics",
  "Science",
  "History",
  "English",
  "Geography",
  "Civics",
  "Health & Physical Education",
  "ICT",
  "Sinhala",
  "PTS",
];

export const COMPULSORY_CORE_10_11 = [
  "Tamil",
  "Mathematics",
  "Science",
  "History",
  "English",
];

/* -------------------------------------------------------------------------- */
/* Backward compatibility                                                      */
/* -------------------------------------------------------------------------- */

export const COMPULSORY_SUBJECTS_6_9 = [
  ...COMPULSORY_CORE_6_9,
  "Religion",
];

export const COMPULSORY_SUBJECTS_10_11 = [
  ...COMPULSORY_CORE_10_11,
  "Religion",
];

/* -------------------------------------------------------------------------- */
/* Subject catalog (UI fallback only)                                          */
/* -------------------------------------------------------------------------- */

export const LOWER_GRADE_SUBJECT_CATALOG = [
  ...COMPULSORY_CORE_6_9,
  ...RELIGIONS,
  ...AESTHETIC_SUBJECTS,
];

export const GRADE_10_11_SUBJECT_CATALOG = [
  ...COMPULSORY_CORE_10_11,
  ...RELIGIONS,
  ...BASKET_A,
  ...BASKET_B,
  ...BASKET_C,
];

export const SUBJECTS_BY_GRADE = {
  6: [...LOWER_GRADE_SUBJECT_CATALOG],
  7: [...LOWER_GRADE_SUBJECT_CATALOG],
  8: [...LOWER_GRADE_SUBJECT_CATALOG],
  9: [...LOWER_GRADE_SUBJECT_CATALOG],
  10: [...GRADE_10_11_SUBJECT_CATALOG],
  11: [...GRADE_10_11_SUBJECT_CATALOG],
  12: ["Tamil", "English", "General English", "Subject 1", "Subject 2", "Subject 3"],
  13: ["Tamil", "English", "General English", "Subject 1", "Subject 2", "Subject 3"],
};

export const ASSESSMENT_TYPES = [
  "Class Test",
  "Mid-Term Exam",
  "Final Exam",
];

/* -------------------------------------------------------------------------- */
/* Text helpers                                                                */
/* -------------------------------------------------------------------------- */

export const normalizeText = (value) => String(value || "").trim();
export const normalizeLower = (value) => normalizeText(value).toLowerCase();
export const normalizeLoose = (value) =>
  normalizeLower(value).replace(/[^a-z0-9]/g, "");

export const parseGrade = (value) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};

export const normalizeSection = (value) => {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
};

export const buildFullClassName = (grade, section) => {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : "";
};

/* -------------------------------------------------------------------------- */
/* Student helpers                                                             */
/* -------------------------------------------------------------------------- */

export const getStudentName = (student) =>
  normalizeText(student?.name || student?.fullName || "Unnamed Student");

export const getStudentAdmissionNo = (student) =>
  normalizeText(
    student?.admissionNo ||
      student?.admissionNumber ||
      student?.admNo ||
      student?.indexNumber ||
      ""
  );

export const getStudentGrade = (student) => parseGrade(student?.grade);

export const getStudentSection = (student) =>
  normalizeSection(student?.section || student?.className || "");

export const getStudentClassName = (student) =>
  buildFullClassName(getStudentGrade(student), getStudentSection(student));

export const isActiveStatus = (value) =>
  normalizeLower(value || "active") === "active";

/* -------------------------------------------------------------------------- */
/* Subject helpers                                                             */
/* -------------------------------------------------------------------------- */

export const uniqueSubjects = (subjects = []) => {
  const seen = new Set();
  const result = [];

  for (const subject of subjects) {
    const value = normalizeText(subject);
    if (!value) continue;

    const key = normalizeLower(value);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
};

export const getBasketForSubjectName = (subjectName) => {
  const key = normalizeLoose(subjectName);

  if (BASKET_A.some((s) => normalizeLoose(s) === key)) return "A";
  if (BASKET_B.some((s) => normalizeLoose(s) === key)) return "B";
  if (BASKET_C.some((s) => normalizeLoose(s) === key)) return "C";

  return "";
};

export const getBasketChoiceFields = (student) => ({
  A: normalizeText(student?.basketAChoice || student?.basket1),
  B: normalizeText(student?.basketBChoice || student?.basket2),
  C: normalizeText(student?.basketCChoice || student?.basket3),
});

/* -------------------------------------------------------------------------- */
/* Marks grading                                                               */
/* -------------------------------------------------------------------------- */

export const getGradeLetter = (marks, grade) => {
  if (grade >= 10) {
    if (marks >= 75) return { letter: "A", desc: "Distinction" };
    if (marks >= 65) return { letter: "B", desc: "Very Good" };
    if (marks >= 55) return { letter: "C", desc: "Credit Pass" };
    if (marks >= 40) return { letter: "S", desc: "Simple Pass" };
    return { letter: "F", desc: "Failure" };
  }

  if (marks >= 75) return { letter: "A", desc: "Excellent" };
  if (marks >= 65) return { letter: "B", desc: "Good" };
  if (marks >= 55) return { letter: "C", desc: "Average" };
  if (marks >= 40) return { letter: "D", desc: "Below Average" };
  return { letter: "E", desc: "Fail" };
};

/* -------------------------------------------------------------------------- */
/* Legacy helper (UI fallback only)                                            */
/* -------------------------------------------------------------------------- */

export const getStudentSubjects = (student) => {
  const grade = getStudentGrade(student);

  if (grade >= 6 && grade <= 9) {
    return uniqueSubjects([
      ...COMPULSORY_CORE_6_9,
      normalizeText(student?.religion),
      normalizeText(student?.aesthetic || student?.aestheticChoice),
    ]);
  }

  if (grade >= 10 && grade <= 11) {
    const basket = getBasketChoiceFields(student);

    return uniqueSubjects([
      ...COMPULSORY_CORE_10_11,
      normalizeText(student?.religion),
      basket.A,
      basket.B,
      basket.C,
    ]);
  }

  return SUBJECTS_BY_GRADE[grade] || [];
};