"use strict";

const PAGE_GATES = {
  SubjectAnalysis: ["students", "studentSubjectEnrollments", "marks", "subjects", "classrooms", "academicTerms", "teacherAssignments"],
  MarksStatusLive: ["students", "studentSubjectEnrollments", "marks", "classrooms", "academicTerms", "teacherAssignments"],
  ClassReport: ["students", "studentSubjectEnrollments", "marks", "classrooms", "academicTerms"],
  ClassMarksReports: ["students", "studentSubjectEnrollments", "marks", "classrooms", "academicTerms"],
  ClassCompletionReport: ["students", "studentSubjectEnrollments", "marks", "classrooms", "academicTerms"],
  StudentsBySubject: ["students", "studentSubjectEnrollments", "marks", "academicTerms"],
  TeacherMarkSheets: ["students", "studentSubjectEnrollments", "academicTerms"],
};

function evaluatePageReadiness(pageName, auditReport, reconciliation = {}) {
  const required = PAGE_GATES[pageName];
  if (!required) throw new Error(`Unknown page gate: ${pageName}`);
  const failures = [];
  for (const collectionName of required) {
    const result = auditReport.collections?.[collectionName];
    if (!result) failures.push(`${collectionName}: audit result missing`);
    else {
      if (result.coveragePercentage !== 100) failures.push(`${collectionName}: canonical coverage is ${result.coveragePercentage}%`);
      if (result.duplicateCanonicalIdentities?.groups) failures.push(`${collectionName}: duplicate logical identities exist`);
      if (result.recordsUnsafeForAutomaticMigration) failures.push(`${collectionName}: unsafe records exist`);
    }
  }
  if (auditReport.partial) failures.push("coverage audit is partial");
  if (reconciliation[pageName]?.status !== "passed") failures.push("legacy/canonical output reconciliation has not passed");
  return { pageName, ready: failures.length === 0, failures };
}

function evaluateAllPages(auditReport, reconciliation = {}) {
  return Object.keys(PAGE_GATES).map((pageName) => evaluatePageReadiness(pageName, auditReport, reconciliation));
}

module.exports = { PAGE_GATES, evaluateAllPages, evaluatePageReadiness };
