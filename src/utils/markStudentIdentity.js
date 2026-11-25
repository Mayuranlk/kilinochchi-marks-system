// Firestore's equality queries distinguish numbers, strings and whitespace.
// Store the same student document ID representation for every new mark.
export function markStudentId(value) {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) {
    throw new Error("A valid student ID is required to save marks.");
  }
  const id = String(value ?? "").trim();
  if (!id || id.includes("/")) throw new Error("A valid student ID is required to save marks.");
  return id;
}
