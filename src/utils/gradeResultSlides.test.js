import { buildGradeResultSlides } from "./gradeResultSlides";
import { RESULT_CATEGORIES } from "./gradeResultLogic";

const columns = ["TAMIL", "MATHS", "SCIENCE"].map((key) => ({ key, label: key }));
const rows = RESULT_CATEGORIES.flatMap((category, index) => Array.from({ length: 3 }, (_, number) => ({
  student: { id: `${index}-${number}`, grade: 11 }, division: number ? "B" : "A",
  studentName: number ? `Example ${index}-${number}` : "தமிழ் மாணவர்",
  grades: { TAMIL: "AB", MATHS: "C", SCIENCE: "A" }, marksByColumn: { MATHS: 55, SCIENCE: 90 },
  gradesSummary: { A: number + 4 }, summary: "4A 2C", category: { ...category, notes: ["Tamil absent"] }, eligibility: { complete: true, qualified: index < 3 },
})));
const input = { rows, columns, grade: 11, reportLabel: "Whole Grade 11", term: "Term 2", year: "2026" };

test.each(["en", "ta"])("%s deck preserves every student and keeps category groups exclusive", (language) => {
  const before = JSON.stringify(rows);
  const deck = buildGradeResultSlides({ ...input, language });
  expect(deck.slides.filter((slide) => slide.type === "category").map((slide) => slide.count)).toEqual([3, 3, 3, 3, 3, 3]);
  const cards = deck.slides.filter((slide) => slide.type === "students").flatMap((slide) => slide.entries);
  expect(cards).toHaveLength(18);
  expect(new Set(cards.map((card) => card.id)).size).toBe(18);
  expect(cards.slice(6, 9).every((card) => card.id.startsWith("2-"))).toBe(true);
  expect(cards[0].id).toBe("0-2");
  expect(cards[0].subjects[0]).toMatchObject({ grade: "AB", mark: "AB" });
  expect(JSON.stringify(rows)).toBe(before);
  expect(cards[0].notes).toEqual([language === "ta" ? "தமிழ்ப் பரீட்சைக்குச் சமுகமளிக்கவில்லை" : "Tamil absent"]);
  expect(cards[0].subjects[0].label).toBe(language === "ta" ? "தமிழ்" : "TAMIL");
  expect(deck.context).toContain(language === "ta" ? "2 ஆம் தவணை" : "Term 2");
});

test("empty categories retain an explanation slide, without invented students", () => {
  const deck = buildGradeResultSlides({ ...input, rows: [] });
  expect(deck.slides.filter((slide) => slide.type === "category")).toHaveLength(6);
  expect(deck.slides.filter((slide) => slide.type === "students")).toHaveLength(0);
  expect(deck.analytics.total).toBe(0);
});
