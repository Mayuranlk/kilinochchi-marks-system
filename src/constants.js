export const SCHOOL_NAME = "Kilinochchi Central College";
export const SCHOOL_SUBTITLE = "Provincial Department of Education - Northern Province";

export const GRADES = [6, 7, 8, 9, 10, 11, 12, 13];
export const SECTIONS = ["A", "B", "C", "D"];
export const TERMS = ["Term 1", "Term 2", "Term 3"];
export const ACADEMIC_YEARS = ["2024", "2025", "2026", "2027"];

// ── Religion ──
export const RELIGIONS = ["Hindu", "Roman Catholic", "Islam", "Buddhist", "Other"];

// ── Grade 6-9 Aesthetic ──
export const AESTHETIC_SUBJECTS = [
  "Art", "Music", "Dancing", "Drama & Theatre"
];

// ── Grade 10-11 Baskets ──
export const BASKET_1 = [
  "Art", "Music (Oriental)", "Music (Western)", "Dancing", "Drama & Theatre"
];

export const BASKET_2 = [
  "ICT", "Design & Technology", "Home Economics", "Agriculture"
];

export const BASKET_3 = [
  "Business & Accounting Studies", "Geography",
  "Civics Education", "Entrepreneurship Studies",
  "Communication & Media Studies"
];

// ── Compulsory Subjects ──
export const COMPULSORY_SUBJECTS_6_9 = [
  "Tamil", "Mathematics", "Science", "History", "English",
  "Religion", "Geography", "Civics",
  "Health & Physical Education", "ICT", "Sinhala", "PTS"
];

export const COMPULSORY_SUBJECTS_10_11 = [
  "Tamil", "Mathematics", "Science", "History", "English", "Religion"
];

// ── Subjects by Grade (for Marks Entry) ──
// Grade 6-9: compulsory + aesthetic (stored per student)
// Grade 10-11: compulsory + basket1, basket2, basket3 (stored per student)
// Grade 12-13: all compulsory (no extras)
export const SUBJECTS_BY_GRADE = {
  6:  [
    "Tamil", "Mathematics", "Science", "History", "English",
    "Religion", "Geography", "Civics",
    "Health & Physical Education", "ICT", "Sinhala", "PTS",
    "Aesthetic"
  ],
  7:  [
    "Tamil", "Mathematics", "Science", "History", "English",
    "Religion", "Geography", "Civics",
    "Health & Physical Education", "ICT", "Sinhala", "PTS",
    "Aesthetic"
  ],
  8:  [
    "Tamil", "Mathematics", "Science", "History", "English",
    "Religion", "Geography", "Civics",
    "Health & Physical Education", "ICT", "Sinhala", "PTS",
    "Aesthetic"
  ],
  9:  [
    "Tamil", "Mathematics", "Science", "History", "English",
    "Religion", "Geography", "Civics",
    "Health & Physical Education", "ICT", "Sinhala", "PTS",
    "Aesthetic"
  ],
  10: [
    "Tamil", "Mathematics", "Science", "History", "English",
    "Religion", "Basket 1", "Basket 2", "Basket 3"
  ],
  11: [
    "Tamil", "Mathematics", "Science", "History", "English",
    "Religion", "Basket 1", "Basket 2", "Basket 3"
  ],
  12: [
    "Tamil", "English", "General English",
    "Subject 1", "Subject 2", "Subject 3"
  ],
  13: [
    "Tamil", "English", "General English",
    "Subject 1", "Subject 2", "Subject 3"
  ],
};

export const ASSESSMENT_TYPES = ["Class Test", "Mid-Term Exam", "Final Exam"];

export const getGradeLetter = (marks, grade) => {
  if (grade >= 10) {
    if (marks >= 75) return { letter: "A", desc: "Distinction" };
    if (marks >= 65) return { letter: "B", desc: "Very Good" };
    if (marks >= 55) return { letter: "C", desc: "Credit Pass" };
    if (marks >= 40) return { letter: "S", desc: "Simple Pass" };
    return { letter: "F", desc: "Failure" };
  } else {
    if (marks >= 75) return { letter: "A", desc: "Excellent" };
    if (marks >= 65) return { letter: "B", desc: "Good" };
    if (marks >= 55) return { letter: "C", desc: "Average" };
    if (marks >= 40) return { letter: "D", desc: "Below Average" };
    return { letter: "E", desc: "Fail" };
  }
};

// ── Helper: get student's actual subjects for marks entry ──
export const getStudentSubjects = (student) => {
  const grade = student.grade;

  if (grade >= 6 && grade <= 9) {
    return [
      ...COMPULSORY_SUBJECTS_6_9.map(s =>
        s === "Religion" ? (student.religion || "Religion") : s
      ),
      student.aesthetic || "Aesthetic"
    ];
  }

  if (grade >= 10 && grade <= 11) {
    return [
      ...COMPULSORY_SUBJECTS_10_11.map(s =>
        s === "Religion" ? (student.religion || "Religion") : s
      ),
      student.basket1 || "Basket 1",
      student.basket2 || "Basket 2",
      student.basket3 || "Basket 3",
    ];
  }

  // Grade 12-13
  return SUBJECTS_BY_GRADE[grade] || [];
};