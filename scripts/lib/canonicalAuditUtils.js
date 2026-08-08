"use strict";

const crypto = require("crypto");
const canonical = require("../../src/shared/firestoreCanonicalCore");

const COLLECTION_SPECS = {
  students: {
    required: ["schemaVersion", "academicYearKey", "gradeNumber", "classKey"],
    identity: "studentId",
  },
  studentSubjectEnrollments: {
    required: ["schemaVersion", "academicYearKey", "gradeNumber", "classKey", "subjectKey", "enrollmentKey"],
    identity: "enrollmentKey",
  },
  marks: {
    required: ["schemaVersion", "academicYearKey", "termKey", "gradeNumber", "classKey", "subjectKey", "assessmentKey", "markKey"],
    identity: "markKey",
  },
  classrooms: {
    required: ["schemaVersion", "academicYearKey", "gradeNumber", "classKey"],
    identity: "classKey",
  },
  subjects: {
    required: ["schemaVersion", "subjectKey"],
    identity: "subjectKey",
  },
  academicTerms: {
    required: ["schemaVersion", "academicYearKey", "termKey"],
    identity: "termIdentity",
  },
  teacherAssignments: {
    required: ["schemaVersion", "academicYearKey", "classKey", "subjectKey"],
    identity: "assignmentIdentity",
  },
  classTeacherAssignments: {
    required: ["schemaVersion", "academicYearKey", "classKey"],
    identity: "classTeacherIdentity",
  },
};

const READ_COLLECTIONS = Object.keys(COLLECTION_SPECS).filter(
  (name) => name !== "classTeacherAssignments"
);

const LEGACY_ALIASES = {
  academicYearKey: ["academicYear", "year"],
  termKey: ["termId", "term", "termName"],
  gradeNumber: ["grade"],
  classKey: ["classId", "alClassName", "fullClassName", "className", "section"],
  subjectKey: ["subjectId", "subjectNumber", "subjectCode", "subjectName", "subject"],
  assessmentKey: ["assessmentId", "practiceExamId", "assessmentName", "assessmentType"],
  markKey: ["studentId", "academicYear", "year", "term", "termName", "subjectId", "subjectName"],
  enrollmentKey: ["studentId", "academicYear", "year", "subjectId", "subjectName"],
};

// Only aliases that encode the same semantic representation are safe to
// compare directly. IDs, codes, names, full class labels, and sections are
// intentionally heterogeneous inputs to the canonical precedence rules.
const COMPARABLE_AMBIGUITY_ALIASES = {
  academicYearKey: ["academicYear", "year"],
  termKey: ["term", "termName"],
};

const AUDIT_FIELDS = new Set([
  "schemaVersion", "academicYearKey", "termKey", "gradeNumber", "classKey", "subjectKey",
  "assessmentKey", "markKey", "enrollmentKey", "studentId", "subjectId", "classId",
  "teacherId", "teacherUid", "userId", "academicYear", "year", "termId", "term", "termName",
  "classTeacherId", "classTeacherUid",
  "grade", "section", "stream", "className", "fullClassName", "alClassName", "subjectNumber",
  "subjectCode", "subjectName", "subject", "assessmentId", "practiceExamId", "assessmentName",
  "assessmentType", "mark", "marks", "score", "absent", "isAbsent", "status",
]);

function sanitizeAuditRow(row) {
  const sanitized = { id: row.id };
  for (const field of AUDIT_FIELDS) {
    if (row[field] !== undefined) sanitized[field] = row[field];
  }
  return sanitized;
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value && typeof value.toDate === "function") return "timestamp";
  return typeof value;
}

function blank(value) {
  return typeof value === "string" && value.trim() === "";
}

function expectedType(field) {
  if (field === "schemaVersion" || field === "gradeNumber") return "number";
  return "string";
}

function comparableDerivedValue(field, value) {
  if (value === undefined || value === null || value === "") return false;
  if (field === "markKey" || field === "enrollmentKey") {
    return !String(value).split("__").some((part) => part === "");
  }
  return true;
}

function canonicalFor(collectionName, row) {
  const academic = canonical.buildCanonicalAcademicFields(row);
  if (collectionName === "students") return canonical.buildCanonicalStudentFields(row);
  if (collectionName === "marks") return canonical.buildCanonicalMarkFields(row);
  if (collectionName === "studentSubjectEnrollments") return canonical.buildCanonicalEnrollmentFields(row);
  if (collectionName === "subjects") return { schemaVersion: 2, subjectKey: academic.subjectKey };
  if (collectionName === "academicTerms") {
    return { schemaVersion: 2, academicYearKey: academic.academicYearKey, termKey: academic.termKey };
  }
  return academic;
}

function normalizeAlias(field, value) {
  if (field === "gradeNumber") return canonical.gradeNumber(value);
  if (field === "academicYearKey") return canonical.academicYearKey(value);
  return canonical.slug(value);
}

function findAmbiguities(row) {
  const ambiguous = [];
  for (const [field, aliases] of Object.entries(COMPARABLE_AMBIGUITY_ALIASES)) {
    const values = aliases
      .filter((alias) => row[alias] !== undefined && row[alias] !== null && !blank(row[alias]))
      .map((alias) => normalizeAlias(field, row[alias]))
      .filter((value) => value !== "" && value !== null);
    if (new Set(values.map(String)).size > 1) ambiguous.push(field);
  }
  return ambiguous;
}

function logicalIdentity(collectionName, row, derived) {
  if (collectionName === "marks") return canonical.text(row.markKey) || derived.markKey;
  if (collectionName === "studentSubjectEnrollments") return canonical.text(row.enrollmentKey) || derived.enrollmentKey;
  if (collectionName === "students") return row.id;
  if (collectionName === "academicTerms") return [derived.academicYearKey, derived.termKey].join("__");
  if (collectionName === "teacherAssignments") {
    return [row.teacherId || row.teacherUid || row.userId, derived.academicYearKey, derived.classKey, derived.subjectKey]
      .map(canonical.text).join("__");
  }
  if (collectionName === "classTeacherAssignments") {
    return [row.teacherId || row.teacherUid || row.userId, derived.academicYearKey, derived.classKey]
      .map(canonical.text).join("__");
  }
  return derived[COLLECTION_SPECS[collectionName]?.identity] || row.id;
}

function hashIdentity(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function increment(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount;
}

function analyzeCanonicalCoverage(collectionDocuments) {
  const referenceSets = {
    students: new Set((collectionDocuments.students || []).map((row) => row.id)),
    subjects: new Set((collectionDocuments.subjects || []).map((row) => row.id)),
    classrooms: new Set((collectionDocuments.classrooms || []).map((row) => row.id)),
  };
  const report = {};

  for (const [collectionName, rows] of Object.entries(collectionDocuments)) {
    const spec = COLLECTION_SPECS[collectionName];
    if (!spec) continue;
    const summary = {
      totalDocuments: rows.length,
      canonicalReadyDocuments: 0,
      incompleteDocuments: 0,
      coverageStates: {
        canonicalReady: 0,
        partiallyCanonical: 0,
        legacyOnly: 0,
        malformed: 0,
      },
      coveragePercentage: 0,
      missingCanonicalFields: {},
      nullFields: {},
      blankFields: {},
      invalidFieldTypes: {},
      conflictingCanonicalFields: {},
      mixedFieldTypes: {},
      legacyAliasUsage: {},
      unresolvedReferences: {},
      ambiguousNormalization: {},
      duplicateCanonicalIdentities: { groups: 0, documents: 0, identityHashes: [] },
      recordsUnsafeForAutomaticMigration: 0,
      unsafeReasonCounts: {},
      generatedDocumentIds: collectionName === "marks" ? 0 : undefined,
      invalidNumericMarks: collectionName === "marks" ? 0 : undefined,
      attendanceInconsistencies: collectionName === "marks" ? 0 : undefined,
      fieldTypes: {},
    };
    const identities = new Map();
    const rowSafety = [];

    for (const row of rows) {
      const derived = canonicalFor(collectionName, row);
      const unsafeReasons = new Set();
      let ready = true;
      let malformed = false;
      let presentCanonicalFields = 0;

      for (const field of spec.required) {
        const value = row[field];
        if (value === undefined) {
          increment(summary.missingCanonicalFields, field);
          ready = false;
        } else if (value === null) {
          presentCanonicalFields += 1;
          increment(summary.nullFields, field);
          ready = false;
          malformed = true;
        } else if (blank(value)) {
          presentCanonicalFields += 1;
          increment(summary.blankFields, field);
          ready = false;
          malformed = true;
        } else if (valueType(value) !== expectedType(field)) {
          presentCanonicalFields += 1;
          increment(summary.invalidFieldTypes, field);
          ready = false;
          malformed = true;
        } else {
          presentCanonicalFields += 1;
          const expected = derived[field];
          if (comparableDerivedValue(field, expected) && value !== expected) {
            increment(summary.conflictingCanonicalFields, field);
            ready = false;
            malformed = true;
          }
        }
        if (!summary.fieldTypes[field]) summary.fieldTypes[field] = {};
        increment(summary.fieldTypes[field], valueType(value));
      }

      for (const [field, aliases] of Object.entries(LEGACY_ALIASES)) {
        if (row[field] === undefined && aliases.some((alias) => row[alias] !== undefined)) {
          increment(summary.legacyAliasUsage, field);
        }
      }

      const ambiguities = findAmbiguities(row);
      ambiguities.forEach((field) => increment(summary.ambiguousNormalization, field));
      if (ambiguities.length) unsafeReasons.add("ambiguous_normalization");

      if ((collectionName === "marks" || collectionName === "studentSubjectEnrollments") && !canonical.text(row.studentId)) {
        unsafeReasons.add("missing_student_identity");
      } else if (
        (collectionName === "marks" || collectionName === "studentSubjectEnrollments") &&
        referenceSets.students.size && !referenceSets.students.has(canonical.text(row.studentId))
      ) {
        increment(summary.unresolvedReferences, "studentId");
        unsafeReasons.add("unresolved_student_reference");
      }
      if (row.subjectId && referenceSets.subjects.size && !referenceSets.subjects.has(canonical.text(row.subjectId))) {
        increment(summary.unresolvedReferences, "subjectId");
        unsafeReasons.add("unresolved_subject_reference");
      }

      if (collectionName === "marks") {
        const absent = Boolean(row.absent ?? row.isAbsent);
        const rawMark = row.mark ?? row.marks ?? row.score;
        const hasMark = rawMark !== undefined && rawMark !== null && rawMark !== "";
        const numericMark = Number(rawMark);
        if (hasMark && (!Number.isFinite(numericMark) || numericMark < 0 || numericMark > 100)) {
          summary.invalidNumericMarks += 1;
          unsafeReasons.add("invalid_numeric_mark");
        }
        if (absent && hasMark) {
          summary.attendanceInconsistencies += 1;
          unsafeReasons.add("absent_with_mark");
        }
        if (row.id !== derived.markKey) summary.generatedDocumentIds += 1;
      }

      const identity = logicalIdentity(collectionName, row, derived);
      if (!identity || String(identity).split("__").some((part) => part === "")) {
        unsafeReasons.add("incomplete_logical_identity");
      } else {
        identities.set(identity, (identities.get(identity) || 0) + 1);
      }

      if (ready) summary.canonicalReadyDocuments += 1;
      else summary.incompleteDocuments += 1;
      if (ready) summary.coverageStates.canonicalReady += 1;
      else if (malformed) summary.coverageStates.malformed += 1;
      else if (presentCanonicalFields === 0) summary.coverageStates.legacyOnly += 1;
      else summary.coverageStates.partiallyCanonical += 1;
      if (!ready) unsafeReasons.add("canonical_fields_incomplete");
      rowSafety.push({ identity, unsafeReasons });
    }

    for (const [identity, count] of identities.entries()) {
      if (count <= 1) continue;
      summary.duplicateCanonicalIdentities.groups += 1;
      summary.duplicateCanonicalIdentities.documents += count;
      if (summary.duplicateCanonicalIdentities.identityHashes.length < 25) {
        summary.duplicateCanonicalIdentities.identityHashes.push({ identityHash: hashIdentity(identity), count });
      }
    }
    for (const row of rowSafety) {
      if (row.identity && identities.get(row.identity) > 1) {
        row.unsafeReasons.add("duplicate_logical_identity");
      }
      if (row.unsafeReasons.size) {
        summary.recordsUnsafeForAutomaticMigration += 1;
        row.unsafeReasons.forEach((reason) => increment(summary.unsafeReasonCounts, reason));
      }
    }
    for (const [field, types] of Object.entries(summary.fieldTypes)) {
      const presentTypes = Object.keys(types).filter((type) => type !== "undefined");
      if (presentTypes.length > 1) summary.mixedFieldTypes[field] = types;
    }
    summary.coveragePercentage = rows.length
      ? Number(((summary.canonicalReadyDocuments / rows.length) * 100).toFixed(2))
      : 100;
    report[collectionName] = summary;
  }

  return report;
}

module.exports = {
  COLLECTION_SPECS,
  READ_COLLECTIONS,
  analyzeCanonicalCoverage,
  canonicalFor,
  hashIdentity,
  sanitizeAuditRow,
};
