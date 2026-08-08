const normalize = (value) => String(value ?? "").trim();
const lower = (value) => normalize(value).toLowerCase();

export function normalizeGender(student = {}) {
  const value = lower(student.gender || student.sex);
  if (["male", "m", "boy"].includes(value)) return "male";
  if (["female", "f", "girl"].includes(value)) return "female";
  return "unknown";
}

export function isActiveTextBookStudent(student = {}) {
  return lower(student.status || "active") === "active";
}

export function isActiveTextBookEnrollment(enrollment = {}) {
  return lower(enrollment.status || "active") === "active";
}

function parseGrade(value) {
  const match = normalize(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getYear(row = {}) {
  return Number(row.academicYear || row.year || row.academicYearKey || 0) || 0;
}

function getMedium(row = {}) {
  return normalize(row.medium || row.teachingMedium || row.rankingMedium);
}

function getStream(row = {}) {
  return normalize(row.stream || row.alStream || row.studyStream);
}

function getSubjectName(row = {}) {
  return normalize(row.subjectName || row.name || row.shortName);
}

function normalizeIdentity(value) {
  return lower(value).replace(/[^a-z0-9]/g, "");
}

function getClassName(row = {}) {
  return normalize(
    row.displayClassName ||
      row.fullClassName ||
      row.alClassName ||
      row.className ||
      row.class ||
      `${parseGrade(row.grade)}${normalize(row.section)}`
  );
}

function subjectOrder(subject = {}, sourceIndex = 0) {
  const explicit = Number(
    subject.displayOrder ?? subject.order ?? subject.sortOrder ?? subject.subjectOrder
  );
  if (Number.isFinite(explicit)) return explicit;

  const number = normalize(subject.subjectNumber || subject.subjectCode || subject.code);
  const numeric = Number(number);
  if (number && Number.isFinite(numeric)) return numeric;
  return 10000 + sourceIndex;
}

function matchesOptionalValue(actual, required) {
  if (!normalize(required)) return true;
  return lower(actual) === lower(required);
}

function countGender(students) {
  const counts = { male: 0, female: 0, unknown: 0, total: students.length };
  students.forEach((student) => {
    counts[normalizeGender(student)] += 1;
  });
  return counts;
}

export function buildTextBookRequestIndex({
  students = [],
  enrollments = [],
  subjects = [],
  classrooms = [],
  academicYear,
} = {}) {
  const year = Number(academicYear);
  const classroomList = classrooms
    .filter((row) => lower(row.status || "active") === "active")
    .filter((row) => !getYear(row) || getYear(row) === year)
    .map((row) => ({
      ...row,
      id: normalize(row.id),
      grade: parseGrade(row.grade),
      className: getClassName(row),
      medium: getMedium(row),
      stream: getStream(row),
    }))
    .filter((row) => row.id && row.grade && row.className)
    .sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className, undefined, { numeric: true }));

  const classroomById = new Map(classroomList.map((row) => [row.id, row]));
  const classroomByIdentity = new Map();
  classroomList.forEach((row) => {
    const identities = [
      row.className,
      row.displayClassName,
      row.fullClassName,
      row.alClassName,
      row.className,
      `${row.grade}${normalize(row.section)}`,
    ];
    identities.forEach((value) => {
      const key = `${row.grade}|${normalizeIdentity(value)}`;
      if (normalizeIdentity(value) && !classroomByIdentity.has(key)) classroomByIdentity.set(key, row);
    });
  });

  function resolveClassroom(row = {}) {
    const explicitId = normalize(row.classroomId || row.classId || row.classKey);
    if (explicitId && classroomById.has(explicitId)) return classroomById.get(explicitId);
    const grade = parseGrade(row.grade);
    const identity = getClassName(row);
    return classroomByIdentity.get(`${grade}|${normalizeIdentity(identity)}`) || null;
  }

  const activeStudents = [];
  const studentById = new Map();
  const studentsByClass = new Map(classroomList.map((row) => [row.id, []]));

  students.forEach((student) => {
    if (!isActiveTextBookStudent(student)) return;
    const studentYear = getYear(student);
    if (studentYear && studentYear !== year) return;
    const classroom = resolveClassroom(student);
    if (!classroom) return;

    const normalizedStudent = {
      ...student,
      id: normalize(student.id),
      classroomId: classroom.id,
      grade: classroom.grade,
      className: classroom.className,
      medium: getMedium(student) || classroom.medium,
      stream: getStream(student) || classroom.stream,
    };
    if (!normalizedStudent.id || studentById.has(normalizedStudent.id)) return;
    activeStudents.push(normalizedStudent);
    studentById.set(normalizedStudent.id, normalizedStudent);
    studentsByClass.get(classroom.id).push(normalizedStudent);
  });

  const subjectList = subjects
    .map((subject, sourceIndex) => ({
      ...subject,
      id: normalize(subject.id),
      name: getSubjectName(subject),
      order: subjectOrder(subject, sourceIndex),
    }))
    .filter((subject) => lower(subject.status || "active") === "active" && subject.name)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const subjectById = new Map(subjectList.filter((row) => row.id).map((row) => [row.id, row]));
  const subjectByName = new Map(subjectList.map((row) => [normalizeIdentity(row.name), row]));
  const subjectStudentsByClass = new Map(classroomList.map((row) => [row.id, new Map()]));

  enrollments.forEach((enrollment) => {
    if (!isActiveTextBookEnrollment(enrollment)) return;
    const enrollmentYear = getYear(enrollment);
    if (enrollmentYear && enrollmentYear !== year) return;
    const student = studentById.get(normalize(enrollment.studentId));
    if (!student) return;

    const enrollmentClassroom = resolveClassroom(enrollment);
    if (enrollmentClassroom && enrollmentClassroom.id !== student.classroomId) return;
    if (parseGrade(enrollment.grade) && parseGrade(enrollment.grade) !== student.grade) return;
    if (getMedium(enrollment) && !matchesOptionalValue(student.medium, getMedium(enrollment))) return;
    if (getStream(enrollment) && !matchesOptionalValue(student.stream, getStream(enrollment))) return;

    const subject =
      subjectById.get(normalize(enrollment.subjectId)) ||
      subjectByName.get(normalizeIdentity(getSubjectName(enrollment)));
    if (!subject) return;

    const classMap = subjectStudentsByClass.get(student.classroomId);
    if (!classMap.has(subject.id || subject.name)) classMap.set(subject.id || subject.name, new Set());
    classMap.get(subject.id || subject.name).add(student.id);
  });

  return {
    academicYear: year,
    classrooms: classroomList,
    students: activeStudents,
    studentsByClass,
    subjects: subjectList,
    subjectStudentsByClass,
  };
}

export function createTextBookRequestReport(index, filters = {}) {
  const scope = filters.scope || "school";
  const grade = Number(filters.grade || 0);
  const classId = normalize(filters.classId);
  const medium = normalize(filters.medium);
  const stream = normalize(filters.stream);

  const classes = index.classrooms.filter((classroom) => {
    if (scope !== "school" && grade && classroom.grade !== grade) return false;
    if (scope === "class" && classId && classroom.id !== classId) return false;
    if (!matchesOptionalValue(classroom.medium, medium) && classroom.medium) return false;
    if (!matchesOptionalValue(classroom.stream, stream) && classroom.stream) return false;
    return true;
  });

  const selectedStudentsByClass = new Map();
  const selectedStudents = [];
  classes.forEach((classroom) => {
    const rows = (index.studentsByClass.get(classroom.id) || []).filter(
      (student) =>
        matchesOptionalValue(student.medium, medium) && matchesOptionalValue(student.stream, stream)
    );
    selectedStudentsByClass.set(classroom.id, rows);
    selectedStudents.push(...rows);
  });
  const selectedStudentIds = new Set(selectedStudents.map((student) => student.id));

  const classBreakdown = classes.map((classroom) => ({
    id: classroom.id,
    grade: classroom.grade,
    className: classroom.className,
    ...countGender(selectedStudentsByClass.get(classroom.id) || []),
  }));

  const gradeMap = new Map();
  classBreakdown.forEach((row) => {
    if (!gradeMap.has(row.grade)) gradeMap.set(row.grade, { grade: row.grade, male: 0, female: 0, unknown: 0, total: 0 });
    const target = gradeMap.get(row.grade);
    ["male", "female", "unknown", "total"].forEach((key) => { target[key] += row[key]; });
  });

  const subjectRows = index.subjects
    .map((subject) => {
      const key = subject.id || subject.name;
      const byClass = {};
      let total = 0;
      classes.forEach((classroom) => {
        const enrolled = index.subjectStudentsByClass.get(classroom.id)?.get(key) || new Set();
        let count = 0;
        enrolled.forEach((studentId) => {
          if (selectedStudentIds.has(studentId)) count += 1;
        });
        byClass[classroom.id] = count;
        total += count;
      });
      return { id: key, name: subject.name, order: subject.order, byClass, total, booksRequired: total };
    })
    .filter((row) => row.total > 0);

  const summary = countGender(selectedStudents);
  if (summary.total !== summary.male + summary.female + summary.unknown && process.env.NODE_ENV !== "production") {
    console.warn("Text Book Request gender totals are inconsistent.");
  }
  subjectRows.forEach((row) => {
    if (row.total > summary.total && process.env.NODE_ENV !== "production") {
      console.warn(`Text Book Request count for ${row.name} exceeds the selected student population.`);
    }
  });

  return {
    academicYear: index.academicYear,
    scope,
    grade,
    classId,
    medium,
    stream,
    classes,
    summary,
    gradeBreakdown: [...gradeMap.values()].sort((a, b) => a.grade - b.grade),
    classBreakdown,
    subjectRows,
  };
}
