const GROUPS = [
  ["Overview", ["/"]],
  ["Students & Attendance", ["/students", "/students/by-subject", "/students/classwise-list", "/attendance-register", "/text-book-request"]],
  ["Teaching & Staff", ["/teachers", "/assignments", "/class-teachers"]],
  ["Marks & Assessments", ["/marks", "/sba-marks", "/sba-register", "/sba", "/marks-upload", "/teacher-mark-sheets", "/practice-exams"]],
  ["Reports & Analysis", ["/grade-result-sheet", "/class-marks-reports", "/class-completion-report", "/marks-status-live", "/subject-analysis"]],
  ["Academic Setup", ["/classrooms", "/subjects", "/terms", "/student-subject-enrollments", "/manual-student-subject-enrollments", "/promotion", "/class-shuffle"]],
  ["Administration", ["/setup-school-defaults", "/academic-data-health", "/backup-restore", "/migrate-student-subjects", "/class-data-management"]],
  ["Events", ["/election-count"]],
];

// Only reorganize supplied links: authorization remains with the caller.
export function groupNavigationItems(items) {
  const remaining = new Map(items.map((item) => [item.path, item]));
  const groups = GROUPS.map(([section, paths]) => ({
    section,
    items: paths.flatMap((path) => {
      const item = remaining.get(path);
      remaining.delete(path);
      return item ? [item] : [];
    }),
  })).filter((group) => group.items.length);
  if (remaining.size) groups.push({ section: "Other Tools", items: [...remaining.values()] });
  return groups;
}
