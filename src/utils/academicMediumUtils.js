export const TEACHING_MEDIUMS = ["Tamil", "English"];

export function normalizeAcademicMedium(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "english") return "English";
  if (normalized === "tamil") return "Tamil";
  return "";
}

export function getAcademicMedium(row = {}, fallback = {}) {
  return normalizeAcademicMedium(
    row.medium || row.teachingMedium || row.rankingMedium || fallback.medium
  );
}

export function isMediumSplitSubject(subjectName, grade) {
  const numericGrade = Number(String(grade ?? "").match(/\d+/)?.[0] || 0);
  if (numericGrade < 6 || numericGrade > 11) return false;

  const normalized = String(subjectName || "")
    .toLowerCase()
    .replace(/english\s*medium|tamil\s*medium/g, "")
    .replace(/[^a-z]/g, "");

  return ["science", "mathematics", "maths", "math"].includes(normalized);
}

export function matchesAcademicMedium(row = {}, requiredMedium = "", fallback = {}) {
  const required = normalizeAcademicMedium(requiredMedium);
  if (!required) return true;
  return getAcademicMedium(row, fallback) === required;
}

export function getRankingMedium(row = {}, enrollments = []) {
  const direct = getAcademicMedium(row);
  if (direct) return direct;

  for (const enrollment of enrollments) {
    const enrollmentMedium = getAcademicMedium(enrollment);
    if (enrollmentMedium) return enrollmentMedium;
  }

  return "";
}

export function usesSeparateMediumRanking(grade) {
  const numericGrade = Number(String(grade ?? "").match(/\d+/)?.[0] || 0);
  return numericGrade >= 6 && numericGrade <= 11;
}
