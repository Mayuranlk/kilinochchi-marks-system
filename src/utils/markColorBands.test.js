import { getMarkColorBand, getMarkColorStyle, MARK_COLOR_BANDS } from "./markColorBands";

describe("mark color bands", () => {
  test.each([
    [0, "critical"],
    [40, "critical"],
    [41, "low"],
    [54, "low"],
    [55, "moderate"],
    [64, "moderate"],
    [65, "good"],
    [74, "good"],
    [75, "excellent"],
    [100, "excellent"],
  ])("maps %s to %s", (mark, expectedKey) => {
    expect(getMarkColorBand(mark)?.key).toBe(expectedKey);
  });

  test.each([null, undefined, "", "AB", -1, 101, Number.NaN])(
    "does not color non-mark value %s",
    (value) => {
      expect(getMarkColorBand(value)).toBeNull();
      expect(getMarkColorStyle(value)).toBeNull();
    }
  );

  test("bands are central, ordered, and non-overlapping", () => {
    expect(MARK_COLOR_BANDS).toHaveLength(5);
    MARK_COLOR_BANDS.slice(1).forEach((band, index) => {
      expect(band.min).toBe(MARK_COLOR_BANDS[index].max + 1);
    });
  });
});
