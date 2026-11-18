import {
  getALStreamShortName,
  isALGrade,
  normalizeSection,
  normalizeText,
  parseGrade,
} from "../constants";

export const SCHOOL_TERM_SYSTEM = "school";
export const AL_TERM_SYSTEM = "al";
export const AL_TERM_COUNT = 6;

const toYear = (value) => {
  const match = String(value ?? "").match(/\d{4}/);
  return match ? Number(match[0]) : 0;
};

const toTermNumber = (value) => {
  const match = String(value ?? "").match(/[1-6]/);
  return match ? Number(match[0]) : 0;
};

export const ordinalTermLabel = (sequence) => {
  const number = Number(sequence);
  const suffix = number === 1 ? "st" : number === 2 ? "nd" : number === 3 ? "rd" : "th";
  return number >= 1 && number <= AL_TERM_COUNT ? `${number}${suffix} Term` : "Term";
};

export const deriveALBatchYear = (intakeYear) => {
  const year = toYear(intakeYear);
  return year ? year + 2 : 0;
};

export const deriveALIntakeYear = (batchYear) => {
  const year = toYear(batchYear);
  return year ? year - 2 : 0;
};

export const buildSchoolAcademicScopeKey = (year) => {
  const parsed = toYear(year);
  return parsed ? `school:${parsed}` : "";
};

export const buildALAcademicScopeKey = (batchYear) => {
  const parsed = toYear(batchYear);
  return parsed ? `al:${parsed}` : "";
};

export const buildCalendarSlotKey = (calendarYear, calendarTerm) => {
  const year = toYear(calendarYear);
  const term = toTermNumber(calendarTerm);
  return year && term ? `calendar:${year}:T${term}` : "";
};

export const buildALBatchClassName = (batchYear, stream, section, { shortStream = false } = {}) => {
  const year = toYear(batchYear);
  const streamName = shortStream ? getALStreamShortName(stream) : normalizeText(stream);
  const normalizedSection = normalizeSection(section);
  return [year || "", streamName, normalizedSection].filter(Boolean).join(" ");
};

export const getALTermSchedule = ({ batchYear, intakeYear } = {}) => {
  const resolvedBatchYear = toYear(batchYear) || deriveALBatchYear(intakeYear);
  const resolvedIntakeYear = toYear(intakeYear) || deriveALIntakeYear(resolvedBatchYear);
  if (!resolvedBatchYear || !resolvedIntakeYear) return [];

  const slots = [
    [resolvedIntakeYear, 3, 12],
    [resolvedIntakeYear + 1, 1, 12],
    [resolvedIntakeYear + 1, 2, 12],
    [resolvedIntakeYear + 1, 3, 13],
    [resolvedBatchYear, 1, 13],
    [resolvedBatchYear, 2, 13],
  ];

  return slots.map(([calendarYear, calendarTerm, phaseGrade], index) => {
    const termSequence = index + 1;
    return {
      termSystem: AL_TERM_SYSTEM,
      term: ordinalTermLabel(termSequence),
      termName: ordinalTermLabel(termSequence),
      termSequence,
      phaseGrade,
      batchYear: resolvedBatchYear,
      intakeYear: resolvedIntakeYear,
      year: resolvedBatchYear,
      academicYear: resolvedBatchYear,
      calendarYear,
      calendarTerm,
      academicScopeKey: buildALAcademicScopeKey(resolvedBatchYear),
      calendarSlotKey: buildCalendarSlotKey(calendarYear, calendarTerm),
      termScopeKey: `al:${resolvedBatchYear}:T${termSequence}`,
    };
  });
};

export const getTermSystem = (term = {}) =>
  term.termSystem === AL_TERM_SYSTEM || term.batchYear || Number(term.termSequence) > 3
    ? AL_TERM_SYSTEM
    : SCHOOL_TERM_SYSTEM;

export const isALAcademicTerm = (term = {}) => getTermSystem(term) === AL_TERM_SYSTEM;

export const getTermSequence = (term = {}) =>
  Number(term.termSequence) || toTermNumber(term.term || term.termName || term.name);

export const getTermCalendarYear = (term = {}) =>
  toYear(term.calendarYear) || toYear(term.year || term.academicYear);

export const getTermCalendarNumber = (term = {}) =>
  Number(term.calendarTerm) || toTermNumber(term.term || term.termName);

export const getCalendarSlotForTerm = (term = {}) =>
  term.calendarSlotKey || buildCalendarSlotKey(getTermCalendarYear(term), getTermCalendarNumber(term));

export const getAcademicTermKey = (term = {}) => {
  if (term.id) return term.id;
  if (term.termScopeKey) return term.termScopeKey;
  if (isALAcademicTerm(term)) {
    return `al:${toYear(term.batchYear || term.year)}:T${getTermSequence(term)}`;
  }
  return `school:${getTermCalendarYear(term)}:T${getTermCalendarNumber(term)}`;
};

export const getAcademicTermLabel = (term = {}) => {
  if (isALAcademicTerm(term)) {
    const batchYear = toYear(term.batchYear || term.year);
    return `${batchYear} Batch - ${ordinalTermLabel(getTermSequence(term))}`;
  }
  const year = getTermCalendarYear(term);
  const sequence = getTermCalendarNumber(term);
  return year ? `${year} - ${ordinalTermLabel(sequence)}` : ordinalTermLabel(sequence);
};

export const getClassBatchYear = (classroom = {}) =>
  toYear(classroom.batchYear) ||
  (isALGrade(parseGrade(classroom.grade)) ? toYear(classroom.academicYear || classroom.year) : 0);

export const termAppliesToClass = (term = {}, classroom = {}) => {
  const grade = parseGrade(classroom.grade);
  if (isALGrade(grade) || getClassBatchYear(classroom)) {
    return isALAcademicTerm(term) && getClassBatchYear(classroom) === toYear(term.batchYear || term.year);
  }
  return getTermSystem(term) === SCHOOL_TERM_SYSTEM;
};

export const buildSchoolTermPayload = ({ year, term, startDate = "", endDate = "" }) => {
  const calendarYear = toYear(year);
  const calendarTerm = toTermNumber(term);
  return {
    termSystem: SCHOOL_TERM_SYSTEM,
    term: `Term ${calendarTerm}`,
    termName: ordinalTermLabel(calendarTerm),
    termSequence: calendarTerm,
    year: calendarYear,
    academicYear: calendarYear,
    calendarYear,
    calendarTerm,
    academicScopeKey: buildSchoolAcademicScopeKey(calendarYear),
    calendarSlotKey: buildCalendarSlotKey(calendarYear, calendarTerm),
    termScopeKey: `school:${calendarYear}:T${calendarTerm}`,
    applicableGrades: [6, 7, 8, 9, 10, 11],
    startDate,
    endDate,
  };
};
