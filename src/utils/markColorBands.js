export const MARK_COLOR_BANDS = Object.freeze([
  Object.freeze({
    min: 0,
    max: 40,
    key: "critical",
    label: "0–40",
    colorName: "Red",
    background: "#F4CCCC",
    textColor: "#1F1F1F",
    pdfFillColor: Object.freeze([244, 204, 204]),
    excelFillColor: "FFF4CCCC",
    excelTextColor: "FF1F1F1F",
  }),
  Object.freeze({
    min: 41,
    max: 54,
    key: "low",
    label: "41–54",
    colorName: "Light Orange",
    background: "#FCE5CD",
    textColor: "#1F1F1F",
    pdfFillColor: Object.freeze([252, 229, 205]),
    excelFillColor: "FFFCE5CD",
    excelTextColor: "FF1F1F1F",
  }),
  Object.freeze({
    min: 55,
    max: 64,
    key: "moderate",
    label: "55–64",
    colorName: "Yellow",
    background: "#FFF2CC",
    textColor: "#1F1F1F",
    pdfFillColor: Object.freeze([255, 242, 204]),
    excelFillColor: "FFFFF2CC",
    excelTextColor: "FF1F1F1F",
  }),
  Object.freeze({
    min: 65,
    max: 74,
    key: "good",
    label: "65–74",
    colorName: "Light Green",
    background: "#D9EAD3",
    textColor: "#1F1F1F",
    pdfFillColor: Object.freeze([217, 234, 211]),
    excelFillColor: "FFD9EAD3",
    excelTextColor: "FF1F1F1F",
  }),
  Object.freeze({
    min: 75,
    max: 100,
    key: "excellent",
    label: "75–100",
    colorName: "Dark Green",
    background: "#38761D",
    textColor: "#FFFFFF",
    pdfFillColor: Object.freeze([56, 118, 29]),
    excelFillColor: "FF38761D",
    excelTextColor: "FFFFFFFF",
  }),
]);

export function getMarkColorBand(value) {
  if (value === null || value === undefined || value === "") return null;

  const mark = Number(value);
  if (!Number.isFinite(mark)) return null;

  return MARK_COLOR_BANDS.find((band) => mark >= band.min && mark <= band.max) || null;
}

export function getMarkColorStyle(value) {
  const band = getMarkColorBand(value);
  if (!band) return null;

  return {
    background: band.background,
    color: band.textColor,
  };
}
