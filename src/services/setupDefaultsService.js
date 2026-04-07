import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  RELIGIONS,
  AESTHETIC_SUBJECTS,
  BASKET_A,
  BASKET_B,
  BASKET_C,
  AL_ALL_SUBJECTS,
  AL_GENERAL_SUBJECTS,
  AL_STREAM_RULES,
} from "../constants";

const SUBJECTS_COLLECTION = "subjects";
const STUDENTS_COLLECTION = "students";

const BATCH_LIMIT = 400;

const RELIGION_ALIASES = {
  catholic: "Catholicism",
  catholicism: "Catholicism",
  christian: "Christianity",
  christianity: "Christianity",
  hindu: "Hinduism",
  hinduism: "Hinduism",
  islam: "Islam",
  islamic: "Islam",
  buddhist: "Buddhism",
  buddhism: "Buddhism",
};

const AESTHETIC_ALIASES = {
  music: "Music",
  art: "Art",
  arts: "Art",
  dance: "Dancing",
  dancing: "Dancing",
  drama: "Drama & Theatre",
  theatre: "Drama & Theatre",
  "drama & theatre": "Drama & Theatre",
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeLoose(value) {
  return normalizeLower(value).replace(/[^a-z0-9]/g, "");
}

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeSection(value) {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeSubjectId(subject) {
  const codePart = normalizeText(subject.code || subject.subjectCode);
  if (codePart) {
    return `${normalizeLower(subject.category)}_${slugify(codePart)}`;
  }

  return `${normalizeLower(subject.category)}_${slugify(
    subject.name || subject.subjectName
  )}`;
}

function nowIso() {
  return new Date().toISOString();
}

function uniqueByKey(items, getKey) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function getCore6to9Subjects() {
  return [
    {
      code: "TAM",
      name: "Tamil",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 1,
    },
    {
      code: "MAT",
      name: "Mathematics",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 2,
    },
    {
      code: "SCI",
      name: "Science",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 3,
    },
    {
      code: "HIS",
      name: "History",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 4,
    },
    {
      code: "ENG",
      name: "English",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 5,
    },
    {
      code: "GEO",
      name: "Geography",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 6,
    },
    {
      code: "CIV",
      name: "Civics",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 7,
    },
    {
      code: "HPE",
      name: "Health & Physical Education",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 8,
    },
    {
      code: "ICT",
      name: "ICT",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 9,
    },
    {
      code: "SIN",
      name: "Sinhala",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 10,
    },
    {
      code: "PTS",
      name: "PTS",
      category: "core",
      minGrade: 6,
      maxGrade: 9,
      displayOrder: 11,
    },
  ];
}

function getCore10to11Subjects() {
  return [
    {
      code: "TAM",
      name: "Tamil",
      category: "core",
      minGrade: 10,
      maxGrade: 11,
      displayOrder: 1,
    },
    {
      code: "MAT",
      name: "Mathematics",
      category: "core",
      minGrade: 10,
      maxGrade: 11,
      displayOrder: 2,
    },
    {
      code: "SCI",
      name: "Science",
      category: "core",
      minGrade: 10,
      maxGrade: 11,
      displayOrder: 3,
    },
    {
      code: "HIS",
      name: "History",
      category: "core",
      minGrade: 10,
      maxGrade: 11,
      displayOrder: 4,
    },
    {
      code: "ENG",
      name: "English",
      category: "core",
      minGrade: 10,
      maxGrade: 11,
      displayOrder: 5,
    },
  ];
}

function getReligionSubjects() {
  return RELIGIONS.map((religion, index) => ({
    code: `REL_${slugify(religion).toUpperCase()}`,
    name: religion,
    category: "religion",
    religion,
    minGrade: 6,
    maxGrade: 11,
    displayOrder: 20 + index,
  }));
}

function getAestheticSubjects() {
  return AESTHETIC_SUBJECTS.map((name, index) => ({
    code: `AES_${slugify(name).toUpperCase()}`,
    name,
    category: "aesthetic",
    minGrade: 6,
    maxGrade: 9,
    displayOrder: 30 + index,
  }));
}

function buildBasketSubjects(subjectNames, basketLabel, startOrder) {
  return subjectNames.map((name, index) => ({
    code: `BKT_${basketLabel}_${String(index + 1).padStart(2, "0")}`,
    name,
    category: "basket",
    basketGroup: `BASKET_${basketLabel}`,
    basketLabel,
    minGrade: 10,
    maxGrade: 11,
    displayOrder: startOrder + index,
  }));
}

function getBasketSubjects() {
  return [
    ...buildBasketSubjects(BASKET_A, "A", 40),
    ...buildBasketSubjects(BASKET_B, "B", 50),
    ...buildBasketSubjects(BASKET_C, "C", 60),
  ];
}

function getALStreamNamesForSubject(subjectName) {
  const subjectKey = normalizeLoose(subjectName);

  return Object.entries(AL_STREAM_RULES)
    .filter(([, rule]) => {
      const allStreamSubjects = [
        ...(rule.compulsory || []),
        ...(rule.optionalGroups || []).flat(),
      ];

      return allStreamSubjects.some(
        (subject) => normalizeLoose(subject.subjectName) === subjectKey
      );
    })
    .map(([streamName]) => streamName);
}

function getALSubjects() {
  const mainSubjects = AL_ALL_SUBJECTS.map((subject, index) => {
    const streamNames = getALStreamNamesForSubject(subject.subjectName);

    return {
      code: subject.subjectCode || `AL_${subject.subjectNumber}`,
      name: subject.subjectName,
      shortName: subject.shortName || subject.subjectName,
      subjectNumber: subject.subjectNumber || "",
      category: "al",
      minGrade: 12,
      maxGrade: 13,
      displayOrder: 100 + index,
      streamOptions: streamNames,
      isOptional: false,
    };
  });

  const generalSubjects = AL_GENERAL_SUBJECTS.map((subject, index) => ({
    code: subject.subjectCode || `AL_${subject.subjectNumber}`,
    name: subject.subjectName,
    shortName: subject.shortName || subject.subjectName,
    subjectNumber: subject.subjectNumber || "",
    category: "al_general",
    minGrade: 12,
    maxGrade: 13,
    displayOrder: 200 + index,
    streamOptions: Object.keys(AL_STREAM_RULES),
    isOptional: false,
  }));

  return [...mainSubjects, ...generalSubjects];
}

function getDefaultSubjects() {
  const defaults = [
    ...getCore6to9Subjects(),
    ...getCore10to11Subjects(),
    ...getReligionSubjects(),
    ...getAestheticSubjects(),
    ...getBasketSubjects(),
    ...getALSubjects(),
  ].map((subject) => ({
    ...subject,
    shortName: subject.shortName || subject.name,
    status: "active",
    isOptional:
      typeof subject.isOptional === "boolean"
        ? subject.isOptional
        : subject.category === "aesthetic" || subject.category === "basket",
  }));

  return uniqueByKey(
    defaults,
    (subject) =>
      `${normalizeLower(subject.category)}__${normalizeLower(
        subject.code || subject.subjectCode || subject.name || subject.subjectName
      )}`
  );
}

async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    chunk.forEach((op) => op(batch));
    await batch.commit();
  }
}

export async function createDefaultSubjects(profile) {
  const existingSnap = await getDocs(collection(db, SUBJECTS_COLLECTION));
  const existing = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const existingKeys = new Set(
    existing.flatMap((subject) => {
      const code = normalizeLower(subject.code || subject.subjectCode);
      const name = normalizeLower(subject.name || subject.subjectName);
      const category = normalizeLower(subject.category);

      return [`${category}__${code}`, `${category}__${name}`].filter(
        (key) => !key.endsWith("__")
      );
    })
  );

  const defaults = getDefaultSubjects();
  let created = 0;
  let skipped = 0;

  for (const subject of defaults) {
    const codeValue = normalizeText(subject.code || subject.subjectCode);
    const nameValue = normalizeText(subject.name || subject.subjectName);
    const categoryValue = normalizeText(subject.category);

    const codeKey = `${normalizeLower(categoryValue)}__${normalizeLower(codeValue)}`;
    const nameKey = `${normalizeLower(categoryValue)}__${normalizeLower(nameValue)}`;

    if (existingKeys.has(codeKey) || existingKeys.has(nameKey)) {
      skipped += 1;
      continue;
    }

    const ref = doc(db, SUBJECTS_COLLECTION, makeSubjectId(subject));
    const timestamp = nowIso();

    await setDoc(ref, {
      ...subject,
      code: codeValue,
      name: nameValue,
      subjectCode: codeValue,
      subjectName: nameValue,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdById: profile?.uid || "",
      createdByName:
        profile?.name || profile?.displayName || profile?.email || "",
      updatedById: profile?.uid || "",
      updatedByName:
        profile?.name || profile?.displayName || profile?.email || "",
    });

    existingKeys.add(codeKey);
    existingKeys.add(nameKey);
    created += 1;
  }

  return { created, skipped, totalDefaults: defaults.length };
}

export async function fixStudentData(profile) {
  const snap = await getDocs(collection(db, STUDENTS_COLLECTION));
  const students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const ops = [];
  let updated = 0;
  let unchanged = 0;

  for (const student of students) {
    const patch = {};

    const grade = parseGrade(student.grade);

    const currentSection = normalizeSection(
      student.section || student.className || ""
    );
    const currentClassName = normalizeText(student.className);
    const currentName = normalizeText(student.name);
    const currentFullName = normalizeText(student.fullName);

    const religionRaw = normalizeLower(student.religion);
    const aestheticRaw = normalizeLower(
      student.aesthetic || student.aestheticChoice
    );

    const basket1 = normalizeText(student.basket1 || student.basketAChoice);
    const basket2 = normalizeText(student.basket2 || student.basketBChoice);
    const basket3 = normalizeText(student.basket3 || student.basketCChoice);

    if (!normalizeText(student.status)) {
      patch.status = "active";
    }

    if (!currentSection && normalizeText(student.class || student.classSection)) {
      patch.section = normalizeSection(student.class || student.classSection);
    } else if (currentSection && normalizeText(student.section) !== currentSection) {
      patch.section = currentSection;
    }

    if (!currentClassName && currentSection) {
      patch.className = currentSection;
    } else if (
      currentClassName &&
      normalizeSection(currentClassName) !== currentSection &&
      currentSection
    ) {
      patch.className = currentSection;
    }

    if (!currentFullName && currentName) {
      patch.fullName = currentName;
    }

    if (!currentName && currentFullName) {
      patch.name = currentFullName;
    }

    if (
      religionRaw &&
      RELIGION_ALIASES[religionRaw] &&
      student.religion !== RELIGION_ALIASES[religionRaw]
    ) {
      patch.religion = RELIGION_ALIASES[religionRaw];
    }

    if (grade >= 6 && grade <= 9) {
      if (aestheticRaw && AESTHETIC_ALIASES[aestheticRaw]) {
        const normalizedAesthetic = AESTHETIC_ALIASES[aestheticRaw];

        if (normalizeText(student.aesthetic) !== normalizedAesthetic) {
          patch.aesthetic = normalizedAesthetic;
        }
        if (normalizeText(student.aestheticChoice) !== normalizedAesthetic) {
          patch.aestheticChoice = normalizedAesthetic;
        }
      } else {
        if (
          normalizeText(student.aesthetic) &&
          !normalizeText(student.aestheticChoice)
        ) {
          patch.aestheticChoice = normalizeText(student.aesthetic);
        }
        if (
          normalizeText(student.aestheticChoice) &&
          !normalizeText(student.aesthetic)
        ) {
          patch.aesthetic = normalizeText(student.aestheticChoice);
        }
      }
    }

    if (grade >= 10 && grade <= 11) {
      if (basket1 && normalizeText(student.basket1) !== basket1) {
        patch.basket1 = basket1;
      }
      if (basket1 && normalizeText(student.basketAChoice) !== basket1) {
        patch.basketAChoice = basket1;
      }

      if (basket2 && normalizeText(student.basket2) !== basket2) {
        patch.basket2 = basket2;
      }
      if (basket2 && normalizeText(student.basketBChoice) !== basket2) {
        patch.basketBChoice = basket2;
      }

      if (basket3 && normalizeText(student.basket3) !== basket3) {
        patch.basket3 = basket3;
      }
      if (basket3 && normalizeText(student.basketCChoice) !== basket3) {
        patch.basketCChoice = basket3;
      }
    }

    if (!normalizeText(student.admissionNo) && normalizeText(student.indexNumber)) {
      patch.admissionNo = normalizeText(student.indexNumber);
    }

    if (!normalizeText(student.grade) && grade !== null) {
      patch.grade = grade;
    }

    if (Object.keys(patch).length === 0) {
      unchanged += 1;
      continue;
    }

    patch.updatedAt = nowIso();
    patch.updatedById = profile?.uid || "";
    patch.updatedByName =
      profile?.name || profile?.displayName || profile?.email || "";

    const ref = doc(db, STUDENTS_COLLECTION, student.id);
    ops.push((batch) => batch.update(ref, patch));
    updated += 1;
  }

  await commitInChunks(ops);

  return { updated, unchanged, total: students.length };
}