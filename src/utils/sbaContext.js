import {
  buildALClassName,
  buildALDisplayClassName,
  isALGrade,
  normalizeSection,
  normalizeText,
  parseGrade,
} from "../constants";

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalize = (value) => String(value || "").trim().toLowerCase();

const normalizeAcademicYear = (value) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  return match ? match[0] : raw;
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const safeNormalizedEquals = (left, right) => {
  if (!hasValue(left) || !hasValue(right)) return false;
  return normalize(left) === normalize(right);
};

const buildSubjectIdentity = (item = {}, fallback = {}) => ({
  subjectId: pick(item.subjectId, fallback.subjectId, ""),
  subjectName: pick(
    item.subjectName,
    item.subject,
    fallback.subjectName,
    fallback.subject,
    ""
  ),
  subjectNumber: pick(item.subjectNumber, fallback.subjectNumber, ""),
});

const matchesSubjectIdentity = (item = {}, target = {}, fallback = {}) => {
  const itemSubject = buildSubjectIdentity(item, fallback);
  const targetSubject = buildSubjectIdentity(target);

  return (
    safeNormalizedEquals(itemSubject.subjectId, targetSubject.subjectId) ||
    safeNormalizedEquals(itemSubject.subjectName, targetSubject.subjectName) ||
    safeNormalizedEquals(itemSubject.subjectNumber, targetSubject.subjectNumber)
  );
};

const getClassIdentity = (item = {}) =>
  pick(item.alClassName, item.fullClassName, item.className, "");

const getResolvedStream = (item = {}, fallback = {}) =>
  normalizeText(pick(item.stream, fallback.stream, ""));

const getResolvedSection = (item = {}, fallback = {}) =>
  normalizeSection(
    pick(item.section, item.className, fallback.section, fallback.className, "")
  );

const getResolvedGrade = (item = {}, fallback = {}) =>
  parseGrade(pick(item.grade, fallback.grade, ""));

const getComparableALClassName = (item = {}, fallback = {}) => {
  const explicit = getClassIdentity(item);
  if (explicit) return explicit;

  const grade = getResolvedGrade(item, fallback);
  const section = getResolvedSection(item, fallback);
  const stream = getResolvedStream(item, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return "";
};

const getClassFallback = (item = {}, fallback = {}) => {
  const grade = getResolvedGrade(item, fallback);
  const section = getResolvedSection(item, fallback);
  const stream = getResolvedStream(item, fallback);

  if (isALGrade(grade) && stream && section) {
    return buildALClassName(grade, stream, section);
  }

  return pick(
    item.className,
    fallback.className,
    `${pick(item.grade, fallback.grade, "")}${pick(
      item.section,
      fallback.section,
      ""
    )}`.trim()
  );
};

const getDisplayClassName = (item = {}, fallback = {}) => {
  const explicit = pick(
    item.alClassName,
    item.fullClassName,
    fallback.alClassName,
    fallback.fullClassName,
    ""
  );

  if (explicit) {
    const grade = getResolvedGrade(item, fallback);
    const section = getResolvedSection(item, fallback);
    const stream = getResolvedStream(item, fallback);

    if (isALGrade(grade) && stream && section) {
      return buildALDisplayClassName(grade, stream, section) || explicit;
    }

    return explicit;
  }

  return getClassFallback(item, fallback);
};

const getClassContext = (item = {}, fallback = {}) => ({
  grade: getResolvedGrade(item, fallback),
  section: getResolvedSection(item, fallback),
  stream: getResolvedStream(item, fallback),
  fullClassName:
    getComparableALClassName(item, fallback) ||
    getClassIdentity(item) ||
    getClassFallback(item, fallback),
  className: pick(item.className, fallback.className, ""),
  alClassName: pick(item.alClassName, fallback.alClassName, ""),
});

const matchesClassContext = (item = {}, target = {}, fallback = {}) => {
  const itemGrade = getResolvedGrade(item, fallback);
  const itemSection = getResolvedSection(item, fallback);
  const itemStream = normalize(getResolvedStream(item, fallback));

  const targetGrade = parseGrade(target.grade);
  const targetSection = normalizeSection(target.section);
  const targetStream = normalize(target.stream);

  const itemIdentity = normalize(
    getComparableALClassName(item, fallback) ||
      getClassIdentity(item) ||
      getClassFallback(item, fallback)
  );

  const targetIdentity = normalize(
    pick(target.fullClassName, target.alClassName, target.className, "")
  );

  if (isALGrade(targetGrade)) {
    if (itemIdentity && targetIdentity && itemIdentity === targetIdentity) {
      return true;
    }

    if (itemGrade !== targetGrade || itemSection !== targetSection) {
      return false;
    }

    if (!targetStream) return true;
    if (itemStream) return itemStream === targetStream;
    return false;
  }

  if (itemIdentity && targetIdentity) {
    return itemIdentity === targetIdentity;
  }

  return itemGrade === targetGrade && itemSection === targetSection;
};

const buildEnrollmentDedupKey = (item = {}, fallback = {}) => {
  const classContext = getClassContext(item, fallback);
  const subject = buildSubjectIdentity(item, fallback);
  const academicYear = normalizeAcademicYear(
    pick(item.academicYear, item.year, fallback.academicYear, fallback.year, "")
  );

  return [
    String(pick(item.studentId, fallback.studentId, "")).trim(),
    normalize(classContext.fullClassName || classContext.className || ""),
    normalize(subject.subjectId),
    normalize(subject.subjectName),
    normalize(subject.subjectNumber),
    normalize(academicYear),
  ].join("__");
};

const buildTermKey = (term = {}) =>
  `${pick(term.term, term.termName, "")}__${pick(term.year, term.academicYear, "")}`;

const buildTermLabel = (term = {}) => {
  const termName = pick(term.term, term.termName, term.name, "Term");
  const year = pick(term.year, term.academicYear, "");
  return year ? `${termName} - ${year}` : termName;
};

const isActiveTerm = (term = {}) => {
  const raw = pick(term.isActive, term.active, term.status);
  if (typeof raw === "boolean") return raw;
  return normalize(raw) === "active" || normalize(raw) === "true";
};

const isSameTeacher = (item = {}, user) => {
  const itemTeacherId = normalize(pick(item.teacherId, item.teacherUid, item.userId));
  const itemTeacherEmail = normalize(pick(item.teacherEmail, item.email));

  return (
    (Boolean(itemTeacherId) && itemTeacherId === normalize(user?.uid)) ||
    (Boolean(itemTeacherEmail) && itemTeacherEmail === normalize(user?.email))
  );
};

const getStudentSortIndex = (row = {}) =>
  String(row.indexNo || row.admissionNo || "").trim();

const sortRowsInTeacherMarkSheetOrder = (rows = []) =>
  [...rows].sort((a, b) => {
    const aIndex = getStudentSortIndex(a);
    const bIndex = getStudentSortIndex(b);

    if (aIndex && bIndex) {
      const byIndex = aIndex.localeCompare(bIndex, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byIndex !== 0) return byIndex;
    } else if (aIndex && !bIndex) {
      return -1;
    } else if (!aIndex && bIndex) {
      return 1;
    }

    return String(a.studentName || "").localeCompare(
      String(b.studentName || ""),
      undefined,
      { sensitivity: "base" }
    );
  });


export { pick, normalize, normalizeAcademicYear, hasValue, buildSubjectIdentity, matchesSubjectIdentity, getClassIdentity, getResolvedStream, getResolvedSection, getResolvedGrade, getComparableALClassName, getClassFallback, getDisplayClassName, getClassContext, matchesClassContext, buildEnrollmentDedupKey, buildTermKey, buildTermLabel, isActiveTerm, isSameTeacher, getStudentSortIndex, sortRowsInTeacherMarkSheetOrder };
