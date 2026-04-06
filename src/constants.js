export const SCHOOL_NAME = "Kilinochchi Central College";
export const SCHOOL_SUBTITLE =
  "Provincial Department of Education - Northern Province";

export const GRADES = [6, 7, 8, 9, 10, 11, 12, 13];

export const SECTIONS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

export const TERMS = ["Term 1", "Term 2", "Term 3"];
export const ACADEMIC_YEARS = ["2024", "2025", "2026", "2027"];

export const MEDIUM_OPTIONS = ["Tamil", "English", "Sinhala"];

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

/* -------------------------------------------------------------------------- */
/* Subject helpers needed early                                                */
/* -------------------------------------------------------------------------- */

export function uniqueBySubjectNumber(subjects = []) {
  const seen = new Set();
  const result = [];

  for (const subject of subjects) {
    if (!subject || typeof subject !== "object") continue;

    const key =
      normalizeText(subject.subjectNumber) ||
      normalizeLower(subject.subjectCode) ||
      normalizeLower(subject.subjectName);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(subject);
  }

  return result;
}

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
/* A/L Streams + Subject Numbers                                               */
/* -------------------------------------------------------------------------- */

export const AL_STREAMS = [
  "Physical Science",
  "Biological Science",
  "Engineering Technology",
  "Bio Systems Technology",
  "Commerce",
  "Arts",
];

export const AL_STREAM_CODES = {
  "Physical Science": "MATHS",
  "Biological Science": "BIO",
  "Engineering Technology": "ENG_TECH",
  "Bio Systems Technology": "BIO_SYS_TECH",
  Commerce: "COMMERCE",
  Arts: "ARTS",
};

export const AL_STREAM_SHORT_NAMES = {
  "Physical Science": "Maths",
  "Biological Science": "Bio",
  "Engineering Technology": "Eng Tech",
  "Bio Systems Technology": "Bio Sys Tech",
  Commerce: "Commerce",
  Arts: "Arts",
};

export const AL_SUBJECTS = {
  PHYSICS: {
    subjectNumber: "01",
    subjectCode: "AL_01",
    subjectName: "Physics",
    shortName: "Physics",
  },
  CHEMISTRY: {
    subjectNumber: "02",
    subjectCode: "AL_02",
    subjectName: "Chemistry",
    shortName: "Chemistry",
  },
  AGRICULTURAL_SCIENCE: {
    subjectNumber: "08",
    subjectCode: "AL_08",
    subjectName: "Agricultural Science",
    shortName: "Agricultural Science",
  },
  BIOLOGY: {
    subjectNumber: "09",
    subjectCode: "AL_09",
    subjectName: "Biology",
    shortName: "Biology",
  },
  COMBINED_MATHEMATICS: {
    subjectNumber: "10",
    subjectCode: "AL_10",
    subjectName: "Combined Mathematics",
    shortName: "Combined Mathematics",
  },
  GENERAL_ENGLISH: {
    subjectNumber: "13",
    subjectCode: "AL_13",
    subjectName: "General English",
    shortName: "General English",
  },
  ICT: {
    subjectNumber: "20",
    subjectCode: "AL_20",
    subjectName: "Information & Communication Technology",
    shortName: "ICT",
  },
  ECONOMICS: {
    subjectNumber: "21",
    subjectCode: "AL_21",
    subjectName: "Economics",
    shortName: "Economics",
  },
  GEOGRAPHY: {
    subjectNumber: "22",
    subjectCode: "AL_22",
    subjectName: "Geography",
    shortName: "Geography",
  },
  HISTORY_25A: {
    subjectNumber: "25A",
    subjectCode: "AL_25A",
    subjectName: "History of Sri Lanka & India",
    shortName: "History (25A)",
  },
  HISTORY_25B: {
    subjectNumber: "25B",
    subjectCode: "AL_25B",
    subjectName: "History of Sri Lanka & Europe",
    shortName: "History (25B)",
  },
  HISTORY_25C: {
    subjectNumber: "25C",
    subjectCode: "AL_25C",
    subjectName: "History of Sri Lanka & Modern World",
    shortName: "History (25C)",
  },
  HOME_ECONOMICS: {
    subjectNumber: "28",
    subjectCode: "AL_28",
    subjectName: "Home Economics",
    shortName: "Home Economics",
  },
  COMMUNICATION_MEDIA_STUDIES: {
    subjectNumber: "29",
    subjectCode: "AL_29",
    subjectName: "Communication & Media Studies",
    shortName: "Communication & Media Studies",
  },
  BUSINESS_STUDIES: {
    subjectNumber: "32",
    subjectCode: "AL_32",
    subjectName: "Business Studies",
    shortName: "Business Studies",
  },
  ACCOUNTING: {
    subjectNumber: "33",
    subjectCode: "AL_33",
    subjectName: "Accounting",
    shortName: "Accounting",
  },
  HINDU_CIVILIZATION: {
    subjectNumber: "46",
    subjectCode: "AL_46",
    subjectName: "Hindu Civilization",
    shortName: "Hindu Civilization",
  },
  CHRISTIAN_CIVILIZATION: {
    subjectNumber: "49",
    subjectCode: "AL_49",
    subjectName: "Christian Civilization",
    shortName: "Christian Civilization",
  },
  DANCING_BHARATHA: {
    subjectNumber: "53",
    subjectCode: "AL_53",
    subjectName: "Dancing (Bharatha)",
    shortName: "Dancing (Bharatha)",
  },
  CARNATIC_MUSIC: {
    subjectNumber: "55",
    subjectCode: "AL_55",
    subjectName: "Carnatic Music",
    shortName: "Carnatic Music",
  },
  DRAMA_TAMIL: {
    subjectNumber: "58",
    subjectCode: "AL_58",
    subjectName: "Drama and Theatre (Tamil)",
    shortName: "Drama and Theatre (Tamil)",
  },
  ENGINEERING_TECHNOLOGY: {
    subjectNumber: "65",
    subjectCode: "AL_65",
    subjectName: "Engineering Technology",
    shortName: "Engineering Technology",
  },
  BIO_SYSTEMS_TECHNOLOGY: {
    subjectNumber: "66",
    subjectCode: "AL_66",
    subjectName: "Bio Systems Technology",
    shortName: "Bio Systems Technology",
  },
  SCIENCE_FOR_TECHNOLOGY: {
    subjectNumber: "67",
    subjectCode: "AL_67",
    subjectName: "Science for Technology",
    shortName: "Science for Technology",
  },
  TAMIL: {
    subjectNumber: "72",
    subjectCode: "AL_72",
    subjectName: "Tamil",
    shortName: "Tamil",
  },
};

export const AL_ARTS_HISTORY_OPTIONS = [
  AL_SUBJECTS.HISTORY_25A,
  AL_SUBJECTS.HISTORY_25B,
  AL_SUBJECTS.HISTORY_25C,
];

export const AL_STREAM_RULES = {
  "Physical Science": {
    streamCode: AL_STREAM_CODES["Physical Science"],
    compulsory: [
      AL_SUBJECTS.COMBINED_MATHEMATICS,
      AL_SUBJECTS.PHYSICS,
    ],
    optionalGroups: [[AL_SUBJECTS.CHEMISTRY, AL_SUBJECTS.ICT]],
    optionalPickCount: 1,
  },

  "Biological Science": {
    streamCode: AL_STREAM_CODES["Biological Science"],
    compulsory: [AL_SUBJECTS.BIOLOGY, AL_SUBJECTS.CHEMISTRY],
    optionalGroups: [[AL_SUBJECTS.PHYSICS, AL_SUBJECTS.AGRICULTURAL_SCIENCE]],
    optionalPickCount: 1,
  },

  "Engineering Technology": {
    streamCode: AL_STREAM_CODES["Engineering Technology"],
    compulsory: [
      AL_SUBJECTS.SCIENCE_FOR_TECHNOLOGY,
      AL_SUBJECTS.ENGINEERING_TECHNOLOGY,
    ],
    optionalGroups: [[AL_SUBJECTS.AGRICULTURAL_SCIENCE, AL_SUBJECTS.ICT]],
    optionalPickCount: 1,
  },

  "Bio Systems Technology": {
    streamCode: AL_STREAM_CODES["Bio Systems Technology"],
    compulsory: [
      AL_SUBJECTS.SCIENCE_FOR_TECHNOLOGY,
      AL_SUBJECTS.BIO_SYSTEMS_TECHNOLOGY,
    ],
    optionalGroups: [[AL_SUBJECTS.AGRICULTURAL_SCIENCE, AL_SUBJECTS.ICT]],
    optionalPickCount: 1,
  },

  Commerce: {
    streamCode: AL_STREAM_CODES.Commerce,
    compulsory: [AL_SUBJECTS.ACCOUNTING, AL_SUBJECTS.BUSINESS_STUDIES],
    optionalGroups: [[AL_SUBJECTS.ECONOMICS, AL_SUBJECTS.ICT]],
    optionalPickCount: 1,
  },

  Arts: {
    streamCode: AL_STREAM_CODES.Arts,
    compulsory: [AL_SUBJECTS.TAMIL],
    optionalGroups: [
      [
        AL_SUBJECTS.GEOGRAPHY,
        ...AL_ARTS_HISTORY_OPTIONS,
        AL_SUBJECTS.HINDU_CIVILIZATION,
        AL_SUBJECTS.HOME_ECONOMICS,
        AL_SUBJECTS.COMMUNICATION_MEDIA_STUDIES,
        AL_SUBJECTS.CHRISTIAN_CIVILIZATION,
        AL_SUBJECTS.DANCING_BHARATHA,
        AL_SUBJECTS.CARNATIC_MUSIC,
        AL_SUBJECTS.DRAMA_TAMIL,
      ],
    ],
    optionalPickCount: 2,
    noDuplicates: true,
  },
};

export const AL_STREAM_OPTIONS = Object.keys(AL_STREAM_RULES);

export const AL_OPTIONAL_SUBJECT_POOL_BY_STREAM = Object.fromEntries(
  Object.entries(AL_STREAM_RULES).map(([streamName, rule]) => [
    streamName,
    rule.optionalGroups.flat(),
  ])
);

export const AL_ALL_SUBJECTS = uniqueBySubjectNumber(
  Object.values(AL_STREAM_RULES).flatMap((rule) => [
    ...rule.compulsory,
    ...rule.optionalGroups.flat(),
  ])
);

export const AL_SUBJECTS_BY_NUMBER = Object.fromEntries(
  AL_ALL_SUBJECTS.map((subject) => [subject.subjectNumber, subject])
);

export const AL_SUBJECTS_BY_CODE = Object.fromEntries(
  AL_ALL_SUBJECTS.map((subject) => [subject.subjectCode, subject])
);

export const AL_SUBJECTS_BY_NAME = Object.fromEntries(
  AL_ALL_SUBJECTS.map((subject) => [normalizeLower(subject.subjectName), subject])
);

export const AL_GENERAL_SUBJECTS = [AL_SUBJECTS.GENERAL_ENGLISH];

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

export const GRADE_12_13_SUBJECT_CATALOG = [
  ...AL_ALL_SUBJECTS.map((subject) => subject.subjectName),
  ...AL_GENERAL_SUBJECTS.map((subject) => subject.subjectName),
];

export const SUBJECTS_BY_GRADE = {
  6: [...LOWER_GRADE_SUBJECT_CATALOG],
  7: [...LOWER_GRADE_SUBJECT_CATALOG],
  8: [...LOWER_GRADE_SUBJECT_CATALOG],
  9: [...LOWER_GRADE_SUBJECT_CATALOG],
  10: [...GRADE_10_11_SUBJECT_CATALOG],
  11: [...GRADE_10_11_SUBJECT_CATALOG],
  12: [...GRADE_12_13_SUBJECT_CATALOG],
  13: [...GRADE_12_13_SUBJECT_CATALOG],
};

export const ASSESSMENT_TYPES = [
  "Class Test",
  "Mid-Term Exam",
  "Final Exam",
];

export const buildFullClassName = (grade, section) => {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  return g && s ? `${g}${s}` : "";
};

export const isALGrade = (grade) => {
  const parsed = parseGrade(grade);
  return parsed === 12 || parsed === 13;
};

export const getALStreamCode = (stream) =>
  AL_STREAM_CODES[normalizeText(stream)] || "";

export const getALStreamShortName = (stream) =>
  AL_STREAM_SHORT_NAMES[normalizeText(stream)] || normalizeText(stream);

export const buildALClassName = (grade, stream, section) => {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  const st = normalizeText(stream);
  return g && st && s ? `${g} ${st} ${s}` : "";
};

export const buildALDisplayClassName = (grade, stream, section) => {
  const g = parseGrade(grade);
  const s = normalizeSection(section);
  const shortStream = getALStreamShortName(stream);
  return g && shortStream && s ? `${g} ${shortStream} ${s}` : "";
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

export const getStudentStream = (student) => normalizeText(student?.stream);

export const getStudentALClassName = (student) => {
  const explicit = normalizeText(student?.alClassName);
  if (explicit) return explicit;

  const grade = getStudentGrade(student);
  const stream = getStudentStream(student);
  const section = getStudentSection(student);

  if (!isALGrade(grade)) return "";
  return buildALClassName(grade, stream, section);
};

export const isActiveStatus = (value) =>
  normalizeLower(value || "active") === "active";

/* -------------------------------------------------------------------------- */
/* Subject helpers                                                             */
/* -------------------------------------------------------------------------- */

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

export const getALSubjectByNumber = (subjectNumber) =>
  AL_SUBJECTS_BY_NUMBER[normalizeText(subjectNumber)] || null;

export const getALSubjectByName = (subjectName) =>
  AL_SUBJECTS_BY_NAME[normalizeLower(subjectName)] || null;

export const getALRuleForStream = (stream) =>
  AL_STREAM_RULES[normalizeText(stream)] || null;

export const getALCompulsorySubjectsForStream = (stream) => {
  const rule = getALRuleForStream(stream);
  return rule ? [...rule.compulsory] : [];
};

export const getALOptionalSubjectsForStream = (stream) => {
  const rule = getALRuleForStream(stream);
  return rule ? rule.optionalGroups.flat() : [];
};

export const getALGeneralSubjects = () => [...AL_GENERAL_SUBJECTS];

export const getALMainSubjectCountForStream = (stream) => {
  const rule = getALRuleForStream(stream);
  if (!rule) return 0;
  return rule.compulsory.length + (rule.optionalPickCount || 0);
};

export const getALExpectedOptionalCountForStream = (stream) => {
  const rule = getALRuleForStream(stream);
  return rule?.optionalPickCount || 0;
};

export const getALArtsOptionalPool = () => [
  ...AL_OPTIONAL_SUBJECT_POOL_BY_STREAM.Arts,
];

export const normalizeALSubjectChoiceValues = (choices = []) => {
  return uniqueSubjects(
    (Array.isArray(choices) ? choices : [])
      .map((choice) => {
        if (!choice) return "";

        if (typeof choice === "string") return choice;

        return (
          choice.subjectName ||
          choice.name ||
          choice.subjectNumber ||
          choice.subjectCode ||
          ""
        );
      })
      .filter(Boolean)
  );
};

export const convertALChoiceNamesToSubjects = (choiceNames = []) => {
  const names = normalizeALSubjectChoiceValues(choiceNames);

  return uniqueBySubjectNumber(
    names.map((name) => getALSubjectByName(name)).filter(Boolean)
  );
};

export const convertALChoiceNumbersToSubjects = (choiceNumbers = []) => {
  const numbers = uniqueSubjects(choiceNumbers);

  return uniqueBySubjectNumber(
    numbers.map((number) => getALSubjectByNumber(number)).filter(Boolean)
  );
};

export const getALChosenOptionalSubjects = (student) => {
  const byNumbers = convertALChoiceNumbersToSubjects(
    student?.alSubjectChoiceNumbers || []
  );
  if (byNumbers.length) return byNumbers;

  return convertALChoiceNamesToSubjects(student?.alSubjectChoices || []);
};

export const validateALChoices = ({
  grade,
  stream,
  choiceNumbers = [],
  choiceNames = [],
}) => {
  const parsedGrade = parseGrade(grade);
  const normalizedStream = normalizeText(stream);
  const rule = getALRuleForStream(normalizedStream);

  if (!isALGrade(parsedGrade)) {
    return {
      valid: false,
      reason: "A/L validation applies only to grades 12 and 13.",
    };
  }

  if (!rule) {
    return { valid: false, reason: "Invalid A/L stream." };
  }

  const chosenSubjects = uniqueBySubjectNumber([
    ...convertALChoiceNumbersToSubjects(choiceNumbers),
    ...convertALChoiceNamesToSubjects(choiceNames),
  ]);

  const chosenNumbers = chosenSubjects.map((subject) => subject.subjectNumber);
  const uniqueChosenNumbers = new Set(chosenNumbers);

  if (uniqueChosenNumbers.size !== chosenNumbers.length) {
    return {
      valid: false,
      reason: "Duplicate A/L subject choices are not allowed.",
    };
  }

  const allowedOptionalNumbers = new Set(
    rule.optionalGroups.flat().map((subject) => subject.subjectNumber)
  );

  const allAreAllowed = chosenSubjects.every((subject) =>
    allowedOptionalNumbers.has(subject.subjectNumber)
  );

  if (!allAreAllowed) {
    return {
      valid: false,
      reason: "One or more selected subjects are not valid for this stream.",
    };
  }

  const expectedOptionalCount = rule.optionalPickCount || 0;
  if (chosenSubjects.length !== expectedOptionalCount) {
    return {
      valid: false,
      reason: `This stream requires exactly ${expectedOptionalCount} optional subject choice(s).`,
    };
  }

  if (normalizeText(stream) === "Arts") {
    const hasDuplicates = chosenSubjects.length !== uniqueChosenNumbers.size;
    if (hasDuplicates) {
      return {
        valid: false,
        reason: "Arts stream cannot contain duplicate subjects.",
      };
    }
  }

  return {
    valid: true,
    reason: "",
    compulsorySubjects: [...rule.compulsory],
    optionalSubjects: chosenSubjects,
    mainSubjects: [...rule.compulsory, ...chosenSubjects],
    generalSubjects: getALGeneralSubjects(),
  };
};

export const buildALSubjectPayloadFromStudent = (student) => {
  const stream = getStudentStream(student);
  const validation = validateALChoices({
    grade: getStudentGrade(student),
    stream,
    choiceNumbers: student?.alSubjectChoiceNumbers || [],
    choiceNames: student?.alSubjectChoices || [],
  });

  if (!validation.valid) {
    return {
      valid: false,
      reason: validation.reason,
      mainSubjects: [],
      generalSubjects: [],
      allSubjects: [],
    };
  }

  const allSubjects = uniqueBySubjectNumber([
    ...validation.mainSubjects,
    ...validation.generalSubjects,
  ]);

  return {
    valid: true,
    reason: "",
    mainSubjects: validation.mainSubjects,
    generalSubjects: validation.generalSubjects,
    allSubjects,
  };
};

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

  if (isALGrade(grade)) {
    const payload = buildALSubjectPayloadFromStudent(student);
    return payload.valid
      ? payload.allSubjects.map((subject) => subject.subjectName)
      : [];
  }

  return SUBJECTS_BY_GRADE[grade] || [];
};