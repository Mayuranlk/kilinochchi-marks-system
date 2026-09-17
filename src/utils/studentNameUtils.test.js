import {
  hasInterleavedAmpersandCorruption,
  normalizeStudentName,
  studentNameNeedsNormalization,
} from "./studentNameUtils";

describe("student name normalization", () => {
  test("repairs the interleaved ampersands produced by the damaged Excel upload", () => {
    expect(normalizeStudentName("&&R&A&M&A&N&E&N&T&H&I&")).toBe("RAMANENTHI");
    expect(hasInterleavedAmpersandCorruption("&&S&H&I&Y&A&N&I")).toBe(true);
  });

  test("preserves legitimate ampersands and the original letter case", () => {
    expect(normalizeStudentName("A. Kumar & B. Kumar")).toBe("A. Kumar & B. Kumar");
    expect(hasInterleavedAmpersandCorruption("A. Kumar & B. Kumar")).toBe(false);
  });

  test("preserves Tamil Unicode while removing invisible and repeated spacing", () => {
    expect(normalizeStudentName("  அருள்\u200B   குமார்  ")).toBe("அருள் குமார்");
    expect(studentNameNeedsNormalization("  அருள்\u200B   குமார்  ")).toBe(true);
  });

  test("leaves an already clean name unchanged", () => {
    expect(normalizeStudentName("SALAIXSHANA")).toBe("SALAIXSHANA");
    expect(studentNameNeedsNormalization("SALAIXSHANA")).toBe(false);
  });
});
