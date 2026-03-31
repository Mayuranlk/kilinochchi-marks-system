export const SCHOOL_NAME = "Kilinochchi Central College";
export const SCHOOL_SUBTITLE = "Provincial Department of Education - Northern Province";

export const GRADES = [6, 7, 8, 9, 10, 11, 12, 13];

export const SECTIONS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

export const TERMS = ["Term 1", "Term 2", "Term 3"];
export const ACADEMIC_YEARS = ["2024", "2025", "2026", "2027"];

// ── Religion ──
export const RELIGIONS = [
  "Buddhism",
  "Hinduism",
  "Islam",
  "Catholicism",
  "Christianity",
];

// ── Grade 6-9 Aesthetic ──
export const AESTHETIC_SUBJECTS = [
  "Art",
  "Music",
  "Dancing",
  "Drama & Theatre",
];

// ── Grade 10-11 Baskets ──
export const BASKET_1 = [
  "Art",
  "Music (Oriental)",
  "Music (Western)",
  "Dancing",
  "Drama & Theatre",
];

export const BASKET_2 = [
  "ICT",
  "Design & Technology",
  "Home Economics",
  "Agriculture",
];

export const BASKET_3 = [
  "Business & Accounting Studies",
  "Geography",
  "Civics Education",
  "Entrepreneurship Studies",
  "Communication & Media Studies",
];

// ── Compulsory core ──
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

// ── Backward compatibility placeholders ──
export const COMPULSORY_SUBJECTS_6_9 = [
  ...COMPULSORY_CORE_6_9,
  "Religion",
];

export const COMPULSORY_SUBJECTS_10_11 = [
  ...COMPULSORY_CORE_10_11,
  "Religion",
];

// ── Subject catalog by grade ──
// UI fallback / catalog only.
// Do NOT treat this as canonical student enrollment truth.
export const SUBJECTS_BY_GRADE = {
  6: [
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
    "Buddhism",
    "Hinduism",
    "Islam",
    "Catholicism",
    "Christianity",
    "Art",
    "Music",
    "Dancing",
    "Drama & Theatre",
  ],
  7: [
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
    "Buddhism",
    "Hinduism",
    "Islam",
    "Catholicism",
    "Christianity",
    "Art",
    "Music",
    "Dancing",
    "Drama & Theatre",
  ],
  8: [
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
    "Buddhism",
    "Hinduism",
    "Islam",
    "Catholicism",
    "Christianity",
    "Art",
    "Music",
    "Dancing",
    "Drama & Theatre",
  ],
  9: [
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
    "Buddhism",
    "Hinduism",
    "Islam",
    "Catholicism",
    "Christianity",
    "Art",
    "Music",
    "Dancing",
    "Drama & Theatre",
  ],
  10: [
    "Tamil",
    "Mathematics",
    "Science",
    "History",
    "English",
    "Buddhism",
    "Hinduism",
    "Islam",
    "Catholicism",
    "Christianity",
    ...BASKET_1,
    ...BASKET_2,
    ...BASKET_3,
  ],
  11: [
    "Tamil",
    "Mathematics",
    "Science",
    "History",
    "English",
    "Buddhism",
    "Hinduism",
    "Islam",
    "Catholicism",
    "Christianity",
    ...BASKET_1,
    ...BASKET_2,
    ...BASKET_3,
  ],
  12: [
    "Tamil",
    "English",
    "General English",
    "Subject 1",
    "Subject 2",
    "Subject 3",
  ],
  13: [
    "Tamil",
    "English",
    "General English",
    "Subject 1",
    "Subject 2",
    "Subject 3",
  ],
};

export const ASSESSMENT_TYPES = [
  "Class Test",
  "Mid-Term Exam",
  "Final Exam",
];

export const normalizeText = (value) => String(value || "").trim();

export const normalizeLower = (value) => normalizeText(value).toLowerCase();

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

export const getStudentName = (student) =>
  normalizeText(student?.name || student?.fullName || "Unnamed Student");

export const getStudentAdmissionNo = (student) =>
  normalizeText(student?.admissionNo || student?.admissionNumber || student?.admNo || "");

export const getStudentGrade = (student) => parseGrade(student?.grade);

export const getStudentSection = (student) =>
  normalizeSection(student?.section || student?.className || "");

export const getStudentClassName = (student) =>
  buildFullClassName(getStudentGrade(student), getStudentSection(student));

export const isActiveStatus = (value) =>
  normalizeLower(value || "active") === "active";

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

// ── Legacy helper kept only for backward compatibility ──
// Important:
// This is now a UI fallback only.
// Canonical subject membership must come from studentSubjectEnrollments.
export const getStudentSubjects = (student) => {
  const grade = getStudentGrade(student);

  if (grade >= 6 && grade <= 9) {
    const subjects = [
      ...COMPULSORY_CORE_6_9,
      normalizeText(student?.religion),
      normalizeText(student?.aesthetic || student?.aestheticChoice),
    ].filter(Boolean);

    return [...new Set(subjects)];
  }

  if (grade >= 10 && grade <= 11) {
    const subjects = [
      ...COMPULSORY_CORE_10_11,
      normalizeText(student?.religion),
      normalizeText(student?.basket1),
      normalizeText(student?.basket2),
      normalizeText(student?.basket3),
      normalizeText(student?.basketAChoice),
      normalizeText(student?.basketBChoice),
      normalizeText(student?.basketCChoice),
    ].filter(Boolean);

    return [...new Set(subjects)];
  }

  return SUBJECTS_BY_GRADE[grade] || [];
};