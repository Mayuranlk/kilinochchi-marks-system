import { isALGrade, normalizeSection, normalizeText } from "../constants";

const buildALBatchClassName = (batchYear, stream, section) =>
  [String(batchYear ?? "").match(/\d{4}/)?.[0] || "", normalizeText(stream), normalizeSection(section)]
    .filter(Boolean).join(" ");

// Prefer the linked classroom, then the student's recorded A/L identity.
// Do not infer a batch from a calendar year for legacy records.
export function studentClassLabel(student, classroomsById = new Map()) {
  const grade = student.grade ?? "";
  const section = String(student.section || student.className || "").trim();
  if (!isALGrade(Number(grade))) return `G${grade}-${section}`;

  const classroom = student.classroomId && classroomsById.get(student.classroomId);
  const linkedName = classroom && (classroom.fullClassName || classroom.alClassName || classroom.className);
  if (linkedName) return String(linkedName).trim();
  // Only match an unlinked record when its batch, stream and section identify
  // exactly one classroom; multiple A/L batches may share a grade and section.
  if (student.batchYear && student.stream && student.section != null) {
    const normalize = (value) => String(value ?? "").trim().toLowerCase();
    const matches = [...classroomsById.values()].filter((room) =>
      Number(room.grade) === Number(grade) &&
      Number(room.batchYear || room.academicYear || room.year) === Number(student.batchYear) &&
      normalize(room.stream) === normalize(student.stream) &&
      normalize(room.section) === normalize(student.section)
    );
    if (matches.length === 1) {
      const name = matches[0].fullClassName || matches[0].alClassName || matches[0].className;
      if (name) return String(name).trim();
    }
  }
  const recorded = student.fullClassName || student.alClassName;
  if (recorded) return String(recorded).trim();
  if (student.batchYear && student.stream) {
    return buildALBatchClassName(student.batchYear, student.stream, student.section || "");
  }
  if (student.stream && student.section) return `${grade} ${student.stream} ${student.section}`;
  return `G${grade}-${section}`;
}
