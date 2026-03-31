import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
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
  dance: "Dance",
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

function makeSubjectId(subject) {
  return `${subject.category}_${subject.code}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function nowIso() {
  return new Date().toISOString();
}

function getDefaultSubjects() {
  return [
    // Core
    {
      code: "ENG",
      name: "English",
      shortName: "English",
      category: "core",
      minGrade: 6,
      maxGrade: 11,
      status: "active",
      isOptional: false,
      displayOrder: 1,
    },

    // Religion
    {
      code: "REL_CATH",
      name: "Catholicism",
      shortName: "Catholicism",
      category: "religion",
      religion: "Catholicism",
      minGrade: 6,
      maxGrade: 11,
      status: "active",
      isOptional: false,
      displayOrder: 10,
    },
    {
      code: "REL_CHRIS",
      name: "Christianity",
      shortName: "Christianity",
      category: "religion",
      religion: "Christianity",
      minGrade: 6,
      maxGrade: 11,
      status: "active",
      isOptional: false,
      displayOrder: 11,
    },
    {
      code: "REL_HIND",
      name: "Hinduism",
      shortName: "Hinduism",
      category: "religion",
      religion: "Hinduism",
      minGrade: 6,
      maxGrade: 11,
      status: "active",
      isOptional: false,
      displayOrder: 12,
    },
    {
      code: "REL_ISLAM",
      name: "Islam",
      shortName: "Islam",
      category: "religion",
      religion: "Islam",
      minGrade: 6,
      maxGrade: 11,
      status: "active",
      isOptional: false,
      displayOrder: 13,
    },
    {
      code: "REL_BUDD",
      name: "Buddhism",
      shortName: "Buddhism",
      category: "religion",
      religion: "Buddhism",
      minGrade: 6,
      maxGrade: 11,
      status: "active",
      isOptional: false,
      displayOrder: 14,
    },

    // Aesthetic
    {
      code: "AES_MUSIC",
      name: "Music",
      shortName: "Music",
      category: "aesthetic",
      minGrade: 6,
      maxGrade: 9,
      status: "active",
      isOptional: true,
      displayOrder: 20,
    },
    {
      code: "AES_ART",
      name: "Art",
      shortName: "Art",
      category: "aesthetic",
      minGrade: 6,
      maxGrade: 9,
      status: "active",
      isOptional: true,
      displayOrder: 21,
    },
    {
      code: "AES_DANCE",
      name: "Dance",
      shortName: "Dance",
      category: "aesthetic",
      minGrade: 6,
      maxGrade: 9,
      status: "active",
      isOptional: true,
      displayOrder: 22,
    },
  ];
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
    existing.flatMap((s) => {
      const code = normalizeLower(s.code || s.subjectCode);
      const name = normalizeLower(s.name || s.subjectName);
      const category = normalizeLower(s.category);
      return [
        `${category}__${code}`,
        `${category}__${name}`,
      ].filter((x) => !x.endsWith("__"));
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
    const religionRaw = normalizeLower(student.religion);
    const aestheticRaw = normalizeLower(student.aestheticChoice);

    // Normalize className from existing section/class fields
    const currentClassName = normalizeText(student.className);
    const fallbackClassName = normalizeText(student.section || student.class || "");
    if (!currentClassName && fallbackClassName) {
      patch.className = fallbackClassName;
    }

    // Normalize status if missing
    if (!normalizeText(student.status)) {
      patch.status = "active";
    }

    // Normalize religion text
    if (religionRaw && RELIGION_ALIASES[religionRaw] && student.religion !== RELIGION_ALIASES[religionRaw]) {
      patch.religion = RELIGION_ALIASES[religionRaw];
    }

    // Grades 6-9: default missing aesthetic choice to Music
    if (grade >= 6 && grade <= 9) {
      if (!normalizeText(student.aestheticChoice)) {
        patch.aestheticChoice = "Music";
      } else if (AESTHETIC_ALIASES[aestheticRaw] && student.aestheticChoice !== AESTHETIC_ALIASES[aestheticRaw]) {
        patch.aestheticChoice = AESTHETIC_ALIASES[aestheticRaw];
      }
    }

    // Snapshot-friendly common name normalization
    if (!normalizeText(student.fullName) && normalizeText(student.name)) {
      patch.fullName = normalizeText(student.name);
    }

    // Admission number normalization fallback
    if (!normalizeText(student.admissionNo) && normalizeText(student.indexNumber)) {
      patch.admissionNo = normalizeText(student.indexNumber);
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