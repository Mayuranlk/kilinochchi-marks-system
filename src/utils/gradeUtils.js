export const OL_GRADE_BANDS = [
  { min: 75, max: 100, label: "A", desc: "Distinction" },
  { min: 65, max: 74, label: "B", desc: "Very Good Pass" },
  { min: 50, max: 64, label: "C", desc: "Credit Pass" },
  { min: 35, max: 49, label: "S", desc: "Ordinary Pass" },
  { min: 0, max: 34, label: "W", desc: "Weak" },
];

export function getOlGradeBand(value) {
  if (value === null || value === undefined || value === "") return null;
  if (String(value).trim().toUpperCase() === "AB") {
    return { label: "AB", desc: "Absent" };
  }

  const mark = Number(value);
  if (!Number.isFinite(mark)) return null;
  return OL_GRADE_BANDS.find((band) => mark >= band.min && mark <= band.max) || OL_GRADE_BANDS[OL_GRADE_BANDS.length - 1];
}

export function getOlGradeLetter(value) {
  return getOlGradeBand(value)?.label || "";
}
