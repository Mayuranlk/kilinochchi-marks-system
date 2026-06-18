import {
  AESTHETIC_SUBJECTS,
  BASKET_OPTIONS,
  RELIGIONS,
  SECTIONS,
  normalizeLoose,
  normalizeText,
} from "../constants";

const RARE_RELIGIONS = ["Catholicism", "Christianity"];

const canonicalFromList = (value, options = []) => {
  const clean = normalizeText(value);
  if (!clean) return "";
  return options.find((item) => normalizeLoose(item) === normalizeLoose(clean)) || clean;
};

export const normalizeShuffleSection = (value) => {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
};

export const parseShuffleGrade = (value) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};

export const getShuffleStudentName = (student = {}) =>
  normalizeText(student.name || student.fullName || student.studentName || "Unnamed Student");

export const getShuffleAdmissionNo = (student = {}) =>
  normalizeText(
    student.admissionNo ||
      student.admissionNumber ||
      student.admNo ||
      student.indexNumber ||
      student.rollNo ||
      ""
  );

export const isShuffleStudentActive = (student = {}) => {
  if (typeof student.isActive === "boolean") return student.isActive;
  const status = normalizeText(student.status || "active").toLowerCase();
  return status === "active";
};

export const getShuffleStudentGrade = (student = {}) => parseShuffleGrade(student.grade);

export const getShuffleStudentSection = (student = {}) =>
  normalizeShuffleSection(student.section || student.className || "");

export const getShuffleReligion = (student = {}) =>
  canonicalFromList(student.religion, RELIGIONS);

export const getShuffleAesthetic = (student = {}) =>
  canonicalFromList(student.aestheticChoice || student.aesthetic, AESTHETIC_SUBJECTS);

export const getShuffleBasketChoice = (student = {}, bucket) =>
  canonicalFromList(
    bucket === "A"
      ? student.basketAChoice || student.basket1
      : bucket === "B"
      ? student.basketBChoice || student.basket2
      : student.basketCChoice || student.basket3,
    BASKET_OPTIONS[bucket] || []
  );

export const getShuffleBand = (grade) => {
  const parsed = parseShuffleGrade(grade);
  if (parsed >= 6 && parsed <= 9) return "junior";
  if (parsed >= 10 && parsed <= 11) return "ol";
  return "";
};

const makeHash = (value) => {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getProfileKey = (student, grade) => {
  const band = getShuffleBand(grade);
  if (band === "junior") {
    return getShuffleAesthetic(student) || "Missing Aesthetic";
  }

  if (band === "ol") {
    return [
      getShuffleBasketChoice(student, "A") || "Missing Basket A",
      getShuffleBasketChoice(student, "B") || "Missing Basket B",
      getShuffleBasketChoice(student, "C") || "Missing Basket C",
    ].join(" | ");
  }

  return "";
};

const countBy = (items, getKey) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Missing";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
};

const increment = (map, key) => {
  const cleanKey = key || "Missing";
  map.set(cleanKey, (map.get(cleanKey) || 0) + 1);
};

const getCount = (map, key) => map.get(key || "Missing") || 0;

const buildEmptyClass = (section) => ({
  section,
  className: "",
  students: [],
  religionCounts: new Map(),
  profileCounts: new Map(),
  genderCounts: new Map(),
  mediumCounts: new Map(),
});

const buildStudentProfile = (student, grade) => {
  const band = getShuffleBand(grade);
  const religion = getShuffleReligion(student);
  const rareReligion = RARE_RELIGIONS.some(
    (item) => normalizeLoose(item) === normalizeLoose(religion)
  );
  const profileKey = getProfileKey(student, grade);

  return {
    religion,
    rareReligion,
    profileKey,
    aesthetic: band === "junior" ? getShuffleAesthetic(student) : "",
    basketAChoice: band === "ol" ? getShuffleBasketChoice(student, "A") : "",
    basketBChoice: band === "ol" ? getShuffleBasketChoice(student, "B") : "",
    basketCChoice: band === "ol" ? getShuffleBasketChoice(student, "C") : "",
    gender: normalizeText(student.gender),
    medium: normalizeText(student.medium),
  };
};

const scoreCandidateClass = ({
  classItem,
  targetSize,
  profile,
  profileTotalCount,
  rareProfileLimit,
  classIndex,
}) => {
  let score = classItem.students.length * 12;

  if (classItem.students.length >= targetSize) score += 22;

  if (profile.rareReligion) {
    const sameReligionCount = getCount(classItem.religionCounts, profile.religion);
    score -= sameReligionCount * 8;
  } else {
    score += getCount(classItem.religionCounts, profile.religion) * 1.5;
  }

  if (profile.profileKey) {
    const sameProfileCount = getCount(classItem.profileCounts, profile.profileKey);
    const isRareProfile = profileTotalCount > 0 && profileTotalCount <= rareProfileLimit;

    if (isRareProfile) {
      score -= sameProfileCount * 6;
      if (!sameProfileCount) score += 8;
    } else {
      score += sameProfileCount * 2;
    }
  }

  if (profile.gender) score += getCount(classItem.genderCounts, profile.gender) * 0.75;
  if (profile.medium) score += getCount(classItem.mediumCounts, profile.medium) * 0.75;

  score += classIndex * 0.01;
  return score;
};

export function buildClassShufflePlan({
  students = [],
  grade,
  targetClassCount = 3,
  rareReligionClassCount = 1,
  seed = "class-shuffle",
}) {
  const parsedGrade = parseShuffleGrade(grade);
  const band = getShuffleBand(parsedGrade);

  if (!band) {
    throw new Error("Class shuffle supports Grades 6 to 11.");
  }

  const activeStudents = students
    .filter(isShuffleStudentActive)
    .filter((student) => getShuffleStudentGrade(student) === parsedGrade);

  const safeTargetClassCount = Math.max(1, Math.min(Number(targetClassCount) || 1, SECTIONS.length));
  const targetSections = SECTIONS.slice(0, safeTargetClassCount);
  const safeRareClassCount = Math.max(
    1,
    Math.min(Number(rareReligionClassCount) || 1, safeTargetClassCount)
  );
  const rareSections = targetSections.slice(0, safeRareClassCount);
  const targetSize = Math.ceil(activeStudents.length / safeTargetClassCount);
  const rareProfileLimit = Math.max(3, safeTargetClassCount);

  const profileCounts = countBy(activeStudents, (student) => getProfileKey(student, parsedGrade));
  const religionCounts = countBy(activeStudents, getShuffleReligion);

  const classes = targetSections.map((section) => ({
    ...buildEmptyClass(section),
    className: `${parsedGrade}${section}`,
  }));

  const classBySection = new Map(classes.map((item) => [item.section, item]));

  const sortedStudents = [...activeStudents].sort((a, b) => {
    const aProfile = buildStudentProfile(a, parsedGrade);
    const bProfile = buildStudentProfile(b, parsedGrade);

    if (aProfile.rareReligion !== bProfile.rareReligion) {
      return aProfile.rareReligion ? -1 : 1;
    }

    const aProfileCount = getCount(profileCounts, aProfile.profileKey);
    const bProfileCount = getCount(profileCounts, bProfile.profileKey);
    if (aProfileCount !== bProfileCount) return aProfileCount - bProfileCount;

    const aReligionCount = getCount(religionCounts, aProfile.religion);
    const bReligionCount = getCount(religionCounts, bProfile.religion);
    if (aReligionCount !== bReligionCount) return aReligionCount - bReligionCount;

    return (
      makeHash(`${seed}-${getShuffleAdmissionNo(a)}-${getShuffleStudentName(a)}-${a.id}`) -
      makeHash(`${seed}-${getShuffleAdmissionNo(b)}-${getShuffleStudentName(b)}-${b.id}`)
    );
  });

  sortedStudents.forEach((student) => {
    const profile = buildStudentProfile(student, parsedGrade);
    const candidateSections = profile.rareReligion ? rareSections : targetSections;
    const candidates = candidateSections.map((section) => classBySection.get(section)).filter(Boolean);

    let bestClass = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;

    candidates.forEach((classItem) => {
      const classIndex = targetSections.indexOf(classItem.section);
      const score = scoreCandidateClass({
        classItem,
        targetSize,
        profile,
        profileTotalCount: getCount(profileCounts, profile.profileKey),
        rareProfileLimit,
        classIndex,
      });

      if (score < bestScore) {
        bestScore = score;
        bestClass = classItem;
      }
    });

    bestClass.students.push({
      ...student,
      shuffleProfile: profile,
      newSection: bestClass.section,
      newClassName: bestClass.className,
      oldSection: getShuffleStudentSection(student),
      oldClassName: `${parsedGrade}${getShuffleStudentSection(student)}`,
    });
    increment(bestClass.religionCounts, profile.religion);
    increment(bestClass.profileCounts, profile.profileKey);
    increment(bestClass.genderCounts, profile.gender);
    increment(bestClass.mediumCounts, profile.medium);
  });

  const warnings = [];
  const missingReligion = activeStudents.filter((student) => !getShuffleReligion(student));
  if (missingReligion.length) {
    warnings.push(`${missingReligion.length} active student(s) have no religion value.`);
  }

  if (band === "junior") {
    const missingAesthetic = activeStudents.filter((student) => !getShuffleAesthetic(student));
    if (missingAesthetic.length) {
      warnings.push(`${missingAesthetic.length} active student(s) have no aesthetic choice.`);
    }
  }

  if (band === "ol") {
    const missingBasket = activeStudents.filter(
      (student) =>
        !getShuffleBasketChoice(student, "A") ||
        !getShuffleBasketChoice(student, "B") ||
        !getShuffleBasketChoice(student, "C")
    );
    if (missingBasket.length) {
      warnings.push(`${missingBasket.length} active student(s) have incomplete basket choices.`);
    }
  }

  RARE_RELIGIONS.forEach((religion) => {
    const spread = classes.filter((classItem) => getCount(classItem.religionCounts, religion) > 0).length;
    const total = getCount(religionCounts, religion);
    if (total > 0 && spread > safeRareClassCount) {
      warnings.push(`${religion} appears in ${spread} classes. Target was ${safeRareClassCount}.`);
    }
  });

  const sizes = classes.map((classItem) => classItem.students.length);
  const maxSize = Math.max(0, ...sizes);
  const minSize = sizes.length ? Math.min(...sizes) : 0;
  if (maxSize - minSize > 1) {
    warnings.push(`Class sizes differ by ${maxSize - minSize} students.`);
  }

  return {
    grade: parsedGrade,
    band,
    totalStudents: activeStudents.length,
    targetClassCount: safeTargetClassCount,
    rareReligionClassCount: safeRareClassCount,
    targetSections,
    rareSections,
    targetSize,
    warnings,
    classes,
    summary: {
      religions: Object.fromEntries(religionCounts),
      profiles: Object.fromEntries(profileCounts),
      maxSize,
      minSize,
    },
  };
}

export function makeClassShuffleExportRows(plan) {
  if (!plan) return [];

  return plan.classes.flatMap((classItem) =>
    classItem.students.map((student, index) => ({
      "New Class": classItem.className,
      "#": index + 1,
      "Admission No": getShuffleAdmissionNo(student),
      Name: getShuffleStudentName(student),
      "Old Section": student.oldSection,
      "New Section": student.newSection,
      Religion: student.shuffleProfile.religion,
      Aesthetic: student.shuffleProfile.aesthetic,
      "Basket A": student.shuffleProfile.basketAChoice,
      "Basket B": student.shuffleProfile.basketBChoice,
      "Basket C": student.shuffleProfile.basketCChoice,
      Gender: student.shuffleProfile.gender,
      Medium: student.shuffleProfile.medium,
    }))
  );
}

export function mapClassShuffleCounts(countMap) {
  return Object.fromEntries(Array.from(countMap.entries()).sort(([a], [b]) => a.localeCompare(b)));
}
