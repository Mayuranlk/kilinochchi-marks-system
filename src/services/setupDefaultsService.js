import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

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

function parseGrade(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeSection(value) {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

function makeSubjectId(subject) {
  return `${subject.category}_${subject.code}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
}

function nowIso() {
  return new Date().toISOString();
}

function getDefaultSubjects() {
  const core6to9 = [
    { code: "TAM", name: "Tamil", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 1 },
    { code: "MAT", name: "Mathematics", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 2 },
    { code: "SCI", name: "Science", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 3 },
    { code: "HIS", name: "History", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 4 },
    { code: "ENG", name: "English", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 5 },
    { code: "GEO", name: "Geography", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 6 },
    { code: "CIV", name: "Civics", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 7 },
    { code: "HPE", name: "Health & Physical Education", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 8 },
    { code: "ICT", name: "ICT", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 9 },
    { code: "SIN", name: "Sinhala", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 10 },
    { code: "PTS", name: "PTS", category: "core", minGrade: 6, maxGrade: 9, displayOrder: 11 },
  ];

  const core10to11 = [
    { code: "TAM", name: "Tamil", category: "core", minGrade: 10, maxGrade: 11, displayOrder: 1 },
    { code: "MAT", name: "Mathematics", category: "core", minGrade: 10, maxGrade: 11, displayOrder: 2 },
    { code: "SCI", name: "Science", category: "core", minGrade: 10, maxGrade: 11, displayOrder: 3 },
    { code: "HIS", name: "History", category: "core", minGrade: 10, maxGrade: 11, displayOrder: 4 },
    { code: "ENG", name: "English", category: "core", minGrade: 10, maxGrade: 11, displayOrder: 5 },
  ];

  const religions = [
    { code: "REL_BUDD", name: "Buddhism", category: "religion", religion: "Buddhism", minGrade: 6, maxGrade: 11, displayOrder: 20 },
    { code: "REL_HIND", name: "Hinduism", category: "religion", religion: "Hinduism", minGrade: 6, maxGrade: 11, displayOrder: 21 },
    { code: "REL_ISLAM", name: "Islam", category: "religion", religion: "Islam", minGrade: 6, maxGrade: 11, displayOrder: 22 },
    { code: "REL_CATH", name: "Catholicism", category: "religion", religion: "Catholicism", minGrade: 6, maxGrade: 11, displayOrder: 23 },
    { code: "REL_CHRIS", name: "Christianity", category: "religion", religion: "Christianity", minGrade: 6, maxGrade: 11, displayOrder: 24 },
  ];

  const aesthetics = [
    { code: "AES_ART", name: "Art", category: "aesthetic", minGrade: 6, maxGrade: 9, displayOrder: 30 },
    { code: "AES_MUSIC", name: "Music", category: "aesthetic", minGrade: 6, maxGrade: 9, displayOrder: 31 },
    { code: "AES_DANCING", name: "Dancing", category: "aesthetic", minGrade: 6, maxGrade: 9, displayOrder: 32 },
    { code: "AES_DRAMA", name: "Drama & Theatre", category: "aesthetic", minGrade: 6, maxGrade: 9, displayOrder: 33 },
  ];

  const basketSubjects = [
    { code: "B1_ART", name: "Art", category: "basket", basketGroup: "BASKET_1", minGrade: 10, maxGrade: 11, displayOrder: 40 },
    { code: "B1_MUS_OR", name: "Music (Oriental)", category: "basket", basketGroup: "BASKET_1", minGrade: 10, maxGrade: 11, displayOrder: 41 },
    { code: "B1_MUS_WE", name: "Music (Western)", category: "basket", basketGroup: "BASKET_1", minGrade: 10, maxGrade: 11, displayOrder: 42 },
    { code: "B1_DANCING", name: "Dancing", category: "basket", basketGroup: "BASKET_1", minGrade: 10, maxGrade: 11, displayOrder: 43 },
    { code: "B1_DRAMA", name: "Drama & Theatre", category: "basket", basketGroup: "BASKET_1", minGrade: 10, maxGrade: 11, displayOrder: 44 },

    { code: "B2_ICT", name: "ICT", category: "basket", basketGroup: "BASKET_2", minGrade: 10, maxGrade: 11, displayOrder: 50 },
    { code: "B2_DTECH", name: "Design & Technology", category: "basket", basketGroup: "BASKET_2", minGrade: 10, maxGrade: 11, displayOrder: 51 },
    { code: "B2_HOME", name: "Home Economics", category: "basket", basketGroup: "BASKET_2", minGrade: 10, maxGrade: 11, displayOrder: 52 },
    { code: "B2_AGRI", name: "Agriculture", category: "basket", basketGroup: "BASKET_2", minGrade: 10, maxGrade: 11, displayOrder: 53 },

    { code: "B3_BAS", name: "Business & Accounting Studies", category: "basket", basketGroup: "BASKET_3", minGrade: 10, maxGrade: 11, displayOrder: 60 },
    { code: "B3_GEO", name: "Geography", category: "basket", basketGroup: "BASKET_3", minGrade: 10, maxGrade: 11, displayOrder: 61 },
    { code: "B3_CIV", name: "Civics Education", category: "basket", basketGroup: "BASKET_3", minGrade: 10, maxGrade: 11, displayOrder: 62 },
    { code: "B3_ENT", name: "Entrepreneurship Studies", category: "basket", basketGroup: "BASKET_3", minGrade: 10, maxGrade: 11, displayOrder: 63 },
    { code: "B3_MEDIA", name: "Communication & Media Studies", category: "basket", basketGroup: "BASKET_3", minGrade: 10, maxGrade: 11, displayOrder: 64 },
  ];

  return [...core6to9, ...core10to11, ...religions, ...aesthetics, ...basketSubjects].map(
    (subject) => ({
      ...subject,
      shortName: subject.name,
      status: "active",
      isOptional: subject.category === "aesthetic" || subject.category === "basket",
    })
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
    const codeKey = `${subject.category}__${normalizeLower(subject.code)}`;
    const nameKey = `${subject.category}__${normalizeLower(subject.name)}`;

    if (existingKeys.has(codeKey) || existingKeys.has(nameKey)) {
      skipped += 1;
      continue;
    }

    const ref = doc(db, SUBJECTS_COLLECTION, makeSubjectId(subject));
    await setDoc(ref, {
      ...subject,
      subjectCode: subject.code,
      subjectName: subject.name,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdById: profile?.uid || "",
      createdByName: profile?.name || profile?.displayName || profile?.email || "",
      updatedById: profile?.uid || "",
      updatedByName: profile?.name || profile?.displayName || profile?.email || "",
    });

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

    const currentSection = normalizeSection(student.section || student.className || "");
    const currentClassName = normalizeText(student.className);
    const currentName = normalizeText(student.name);
    const currentFullName = normalizeText(student.fullName);

    const religionRaw = normalizeLower(student.religion);
    const aestheticRaw = normalizeLower(student.aesthetic || student.aestheticChoice);

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

    // Keep students.className compatible with live schema: section only
    if (!currentClassName && currentSection) {
      patch.className = currentSection;
    } else if (currentClassName && normalizeSection(currentClassName) !== currentSection && currentSection) {
      patch.className = currentSection;
    }

    if (!currentFullName && currentName) {
      patch.fullName = currentName;
    }

    if (!currentName && currentFullName) {
      patch.name = currentFullName;
    }

    if (religionRaw && RELIGION_ALIASES[religionRaw] && student.religion !== RELIGION_ALIASES[religionRaw]) {
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
        if (normalizeText(student.aesthetic) && !normalizeText(student.aestheticChoice)) {
          patch.aestheticChoice = normalizeText(student.aesthetic);
        }
        if (normalizeText(student.aestheticChoice) && !normalizeText(student.aesthetic)) {
          patch.aesthetic = normalizeText(student.aestheticChoice);
        }
      }
    }

    if (grade >= 10 && grade <= 11) {
      if (basket1 && normalizeText(student.basket1) !== basket1) patch.basket1 = basket1;
      if (basket1 && normalizeText(student.basketAChoice) !== basket1) patch.basketAChoice = basket1;

      if (basket2 && normalizeText(student.basket2) !== basket2) patch.basket2 = basket2;
      if (basket2 && normalizeText(student.basketBChoice) !== basket2) patch.basketBChoice = basket2;

      if (basket3 && normalizeText(student.basket3) !== basket3) patch.basket3 = basket3;
      if (basket3 && normalizeText(student.basketCChoice) !== basket3) patch.basketCChoice = basket3;
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
    patch.updatedByName = profile?.name || profile?.displayName || profile?.email || "";

    const ref = doc(db, STUDENTS_COLLECTION, student.id);
    ops.push((batch) => batch.update(ref, patch));
    updated += 1;
  }

  await commitInChunks(ops);

  return { updated, unchanged, total: students.length };
}