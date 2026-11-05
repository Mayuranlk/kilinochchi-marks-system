// Presentation only: never recompute grades, eligibility, totals, or ordering here.
export const RESULT_VIEWS = {
  all: "All students",
  excellent: "Excellent (9A)", best: "Best (4A - 8A)", eligible: "A/L Eligible",
  "core-risk": "At Risk: Core Subject Failure",
  "threshold-risk": "At Risk: Below Threshold", support: "Needs Focused Support",
  incomplete: "Pending results / review",
};

const SUBJECT_LABELS = {
  REL_SAIVAM: "Saivanery", REL_NRC: "NRC", REL_RC: "RC", REL_ISLAM: "Islam",
  TAMIL: "Tamil", MATHS: "Maths", ENGLISH: "English", SCIENCE: "Science", HISTORY: "History",
  B1_CIV_GOV: "Civics", B1_GEO: "Geo", B1_BAS: "Business", B1_ENT: "Entrepr.",
  B2_ART: "Art", B2_DANCE: "Dance", B2_MUSIC: "Music", B2_DRAMA: "Drama",
  B2_TAM_LIT: "Tamil Lit", B2_ENG_LIT: "Eng Lit", B3_AGRI: "Agri",
  B3_HPE: "HPE", B3_HOME: "Home Eco", B3_ICT_T: "ICT-T", B3_ICT_E: "ICT-E",
  B3_MEDIA: "Media", B3_DCT: "DCT", B3_DMT: "DMT", B3_DEET: "DEET",
};

export const subjectLabel = (column) => SUBJECT_LABELS[column.key] || column.label;
export const resultClassLabel = (row, reportGrade) => {
  const value = String(row.student?.grade || reportGrade || "").match(/\d+/)?.[0] || "";
  return row.division && row.division !== "-" ? `${value}${row.division}` : value || "-";
};

export function resultStatus(row) {
  if (row.category) return { ...row.category, label: [row.category.label, ...row.category.notes].join("; "), ink: row.category.color === "success" ? [24, 109, 88] : [139, 93, 18], fill: row.category.color === "success" ? [233, 246, 241] : [255, 247, 225] };
  if (!row.eligibility.complete) return { label: "Review subjects", color: "warning", ink: [139, 93, 18], fill: [255, 247, 225] };
  if (row.eligibility.qualified) return { label: "Qualified", color: "success", ink: [24, 109, 88], fill: [233, 246, 241] };
  return { label: "Not qualified", color: "error", ink: [160, 53, 65], fill: [253, 238, 240] };
}

export function resultSlots(schema) {
  return (schema?.groups || []).flatMap((group) => group.key === "core"
    ? group.columns.map((column) => ({ key: column.key, label: column.label, columns: [column], elective: false }))
    : [{ key: group.key, label: { religion: "Religion", basket1: "Basket I", basket2: "Basket II", basket3: "Basket III" }[group.key] || group.label, columns: group.columns, elective: true }]);
}

export function slotEntries(row, slot) {
  return slot.columns.filter((column) => Object.prototype.hasOwnProperty.call(row.grades, column.key))
    .map((column) => ({ key: column.key, subject: subjectLabel(column), fullSubject: column.label, grade: row.grades[column.key] || "-", mark: row.category?.id === "excellent" ? row.marksByColumn?.[column.key] : undefined }));
}

export function slotText(row, slot) {
  const entries = slotEntries(row, slot);
  return entries.length ? entries.map((entry) => slot.elective ? `${entry.subject}\n${entry.grade}${entry.mark !== undefined ? ` (${entry.mark})` : ""}` : `${entry.grade}${entry.mark !== undefined ? ` (${entry.mark})` : ""}`).join("\n") : "-";
}

export function failedCoreSubjects(row) {
  if (row.category) return row.category.notes.join("; ") || "-";
  return ["TAMIL", "MATHS"].filter((key) => !["A", "B", "C", "S"].includes(row.grades[key]))
    .map((key) => SUBJECT_LABELS[key]).join(" & ");
}
