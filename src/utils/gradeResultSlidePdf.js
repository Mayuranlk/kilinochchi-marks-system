import { buildGradeResultSlides } from "./gradeResultSlides";

let fontPromise;
async function loadPresentationFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const font = new FontFace("GradePresentation", `url("${process.env.PUBLIC_URL || ""}/fonts/NotoSansTamil.ttf")`, { weight: "100 900" });
      await font.load();
      document.fonts.add(font);
      await document.fonts.load('400 28px "GradePresentation"', "தமிழ் English");
    })().catch((error) => { fontPromise = undefined; throw new Error(`Presentation font could not be loaded. Please retry. ${error.message}`); });
  }
  await fontPromise;
}

// Browser shaping preserves Tamil combining characters. Each slide is flattened
// into the PDF, so viewers need no fonts; text is deliberately not selectable.
export async function createGradeResultSlidePdf(input, { onProgress = () => {}, signal } = {}) {
  await loadPresentationFont();
  const { jsPDF } = await import("jspdf");
  const deck = buildGradeResultSlides(input);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [338.667, 190.5], compress: true });
  pdf.setProperties({ title: `${deck.t.title} — ${deck.context}`, author: deck.t.school });
  const canvas = document.createElement("canvas");
  canvas.width = 2880; canvas.height = 1620;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot render presentation slides.");
  ctx.scale(1.5, 1.5);
  const C = { ink: "#192d45", muted: "#586d82", teal: "#147d78", pale: "#eff4f8", line: "#dbe4eb", red: "#b23f53" };
  const t = deck.t;
  const graphemes = new Intl.Segmenter(input.language, { granularity: "grapheme" });
  function lines(value, width) {
    const output = [];
    for (const paragraph of String(value).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (ctx.measureText(`${line}${line ? " " : ""}${word}`).width <= width) { line += `${line ? " " : ""}${word}`; continue; }
        if (line) output.push(line);
        line = "";
        for (const { segment } of graphemes.segment(word)) {
          if (line && ctx.measureText(line + segment).width > width) { output.push(line); line = ""; }
          line += segment;
        }
      }
      output.push(line);
    }
    return output;
  }
  function text(value, x, y, width, height, size = 28, bold = false, color = C.ink) {
    let wrapped;
    do {
      ctx.font = `${bold ? 700 : 400} ${size}px GradePresentation, sans-serif`;
      wrapped = lines(value, width);
      if (wrapped.length * size * 1.42 <= height || size <= 12) break;
      size -= 1;
    } while (true);
    if (wrapped.length * size * 1.42 > height) throw new Error("Presentation text is too long to fit. Please review the student name or notes.");
    ctx.fillStyle = color; ctx.textBaseline = "top";
    wrapped.forEach((line, index) => ctx.fillText(line, x, y + index * size * 1.42));
  }
  function rect(x, y, width, height, color = C.pale) { ctx.fillStyle = color; ctx.fillRect(x, y, width, height); }
  function bar(rate, x, y, width) { rect(x, y, width, 14, C.line); rect(x, y, width * (rate || 0) / 100, 14, C.teal); }
  function stat(label, count, detail, x, y, width = 560) {
    rect(x, y, width, 230);
    text(label, x + 24, y + 20, width - 48, 64, 28, true, C.muted);
    text(count, x + 24, y + 93, width - 48, 76, 56, true, C.teal);
    text(detail, x + 24, y + 181, width - 48, 43, 24, false, C.muted);
  }
  function studentCard(entry, x) {
    const width = 876;
    rect(x, 210, width, 790);
    text(`${entry.name}${entry.continuation ? " (…)" : ""}`, x + 24, 229, width - 48, 86, 33, true);
    text(`${t.class}: ${entry.division}    ${t.results}: ${entry.summary || "—"}`, x + 24, 320, width - 48, 46, 26, true, C.teal);
    text(t.subject, x + 24, 378, 510, 40, 24, true, C.muted);
    text(t.grade, x + 594, 378, 105, 40, 23, true, C.muted);
    text(t.marks, x + 715, 378, 135, 40, 23, true, C.muted);
    entry.subjects.forEach((subject, index) => {
      const y = 429 + index * 49;
      if (index % 2 === 0) rect(x + 16, y - 4, width - 32, 49, "#ffffff");
      text(subject.label, x + 24, y, 548, 47, 24);
      text(subject.grade, x + 610, y, 95, 45, 27, true, subject.grade === "W" || subject.grade === "AB" ? C.red : C.teal);
      text(subject.mark, x + 725, y, 110, 45, 26);
    });
    text(`${t.notes}: ${entry.notes.length ? entry.notes.join("; ") : "—"}`, x + 24, 885, width - 48, 100, 23, false, entry.notes.length ? C.red : C.muted);
  }
  try {
    for (let page = 0; page < deck.slides.length; page += 1) {
      if (signal?.aborted) throw new DOMException("Presentation cancelled", "AbortError");
      const slide = deck.slides[page];
      rect(0, 0, 1920, 1080, "#ffffff");
      rect(64, 38, 8, 45, C.teal);
      text(t.school, 91, 38, 1200, 47, 26, true);
      text(slide.title, 64, 101, 1792, 80, deck.language === "ta" ? 37 : 44, true);
      text(deck.context, 64, 180, 1792, 30, 21, false, C.muted);
      if (slide.type === "cover") {
        text(deck.context, 80, 296, 1720, 155, 61, true, C.teal);
        stat(t.students, deck.analytics.total, t.overview, 80, 490, 540);
        stat(t.verified, deck.formatRate(deck.analytics.verifiedRate), `${deck.analytics.verified} / ${deck.analytics.total}`, 665, 490, 540);
        stat(t.overviewLabels[5], deck.analytics.absent, `${deck.analytics.absent} / ${deck.analytics.total}`, 1250, 490, 540);
        text(t.names, 80, 784, 1700, 90, 28, false, C.muted);
      } else if (slide.type === "overview") {
        slide.analytics.overview.forEach((item, index) => stat(t.overviewLabels[index], item.count, `${deck.formatRate(item.rate)} (${item.count} / ${deck.analytics.total})`, 64 + (index % 3) * 606, 258 + Math.floor(index / 3) * 267, 578));
        text(t.legend, 64, 834, 1792, 151, 27, false, C.muted);
      } else if (slide.type === "categories") {
        slide.analytics.categories.forEach((category, index) => {
          const y = 240 + index * 113;
          text(`${index + 1}. ${t.categoryLabels[index]}`, 64, y, 850, 97, 30, true);
          bar(category.rate, 950, y + 27, 555);
          text(`${category.count} / ${deck.analytics.total} (${deck.formatRate(category.rate)})`, 1550, y + 11, 306, 78, 28, true);
        });
      } else if (slide.type === "category") {
        stat(t.students, slide.count, deck.formatRate(slide.rate), 64, 268, 580);
        text(slide.advice, 730, 280, 1100, 330, 40, true, C.teal);
        text(slide.count ? t.names : t.empty, 64, 730, 1760, 150, 32, false, C.muted);
      } else if (slide.type === "students") {
        slide.entries.forEach((entry, index) => studentCard(entry, 64 + index * 916));
      } else if (slide.type === "divisions") {
        [t.class, t.students, t.categoryLabels[0], t.categoryLabels[1], t.verified, t.absent].forEach((label, index) => text(label, 64 + index * 300, 243, 275, 91, 26, true));
        slide.entries.forEach((entry, index) => {
          const y = 350 + index * 74;
          if (index % 2 === 0) rect(64, y - 8, 1792, 74);
          [entry.division, entry.total, entry.categories[0].count, entry.categories[1].count, `${entry.verified} (${deck.formatRate(entry.verifiedRate)})`, entry.absent].forEach((value, col) => text(value, 64 + col * 300, y, 275, 62, 29));
        });
      } else if (slide.type === "subjects") {
        const xs = [64, 805, 990, 1175, 1360, 1545];
        const subjectHeaders = deck.language === "ta" ? ["பாடம்", "தோற்றியோர்", "சித்தி", "வரவில்லை", "நிலுவை", "சித்தி %"] : [t.subject, t.sat, t.passed, t.absent, t.pending, t.rate];
        subjectHeaders.forEach((label, index) => text(label, xs[index], 238, index ? 180 : 700, 50, 25, true));
        slide.entries.forEach((entry, index) => {
          const y = 320 + index * 94;
          [entry.label, entry.sat, entry.passed, entry.absent, entry.pending, deck.formatRate(entry.rate)].forEach((value, col) => text(value, xs[col], y, col ? 180 : 705, 62, 27));
          bar(entry.rate, 64, y + 65, 1740);
        });
        text(t.legend, 64, 925, 1792, 86, 22, false, C.muted);
      } else if (slide.type === "eligibility") {
        stat(t.grouped, deck.formatRate(deck.analytics.groupedRate), `${deck.analytics.grouped} / ${deck.analytics.total}`, 64, 280, 856);
        stat(t.verified, deck.formatRate(deck.analytics.verifiedRate), `${deck.analytics.verified} / ${deck.analytics.total}`, 980, 280, 856);
        text(t.note, 64, 575, 1792, 265, 38, true, C.teal);
        text(t.legend, 64, 875, 1792, 128, 25, false, C.muted);
      } else if (slide.type === "actions") {
        t.next.forEach((point, index) => text(`${index + 1}. ${point}`, 80, 258 + index * 142, 1740, 125, 35, true, index % 2 ? C.ink : C.teal));
      } else if (slide.type === "rules") {
        t.criteria.forEach((point, index) => text(`${index + 1}. ${point}`, 80, 258 + index * 183, 1740, 165, 32, true, index % 2 ? C.ink : C.teal));
      }
      text(`${page + 1} / ${deck.slides.length}`, 1740, 1035, 120, 35, 22, false, C.muted);
      if (page > 0) pdf.addPage([338.667, 190.5], "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 338.667, 190.5);
      onProgress(page + 1, deck.slides.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return pdf;
  } finally { canvas.width = 0; canvas.height = 0; }
}
