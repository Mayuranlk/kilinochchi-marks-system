import { formatRate } from "./gradeResultLogic";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { failedCoreSubjects, RESULT_VIEWS, resultClassLabel, resultSlots, resultStatus, slotText, subjectLabel } from "./gradeResultPresentation";

const INK = [27, 43, 64];
const MUTED = [98, 113, 130];
const LINE = [221, 228, 235];
const TEAL = [27, 119, 114];
const PALE = [245, 248, 251];
const MARGIN = 12;

export function createGradeResultPdf({
  schoolName, reportLabel, year, term, resultFilter, schema, grade,
  analytics, rows, totalStudents, summaryStats, tamilMathsFailureRows, belowThreeCThreeSRows,
}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: `${reportLabel} - ${term} ${year} - Grade Result Sheet`, author: schoolName, subject: "Term examination results" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const contentWidth = width - MARGIN * 2;
  const pageSections = new Map();

  function write(value, x, y, size = 9, color = INK, bold = false, options = {}) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(String(value), x, y, options);
  }

  function frame(section) {
    const page = pdf.internal.getCurrentPageInfo().pageNumber;
    if (pageSections.has(page)) return;
    pageSections.set(page, section);
    pdf.setFillColor(...TEAL);
    pdf.rect(MARGIN, 10, 1.3, 12, "F");
    write(schoolName, MARGIN + 4, 14, 11, INK, true);
    write(`${reportLabel}  /  ${term}  /  ${year}`, MARGIN + 4, 20, 8, MUTED);
    write("ACADEMIC REPORT", width - MARGIN, 14, 8, TEAL, true, { align: "right" });
    write(section, width - MARGIN, 20, 8, MUTED, false, { align: "right" });
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.25);
    pdf.line(MARGIN, 25, width - MARGIN, 25);
  }

  function heading(number, title, subtitle) {
    write(number, MARGIN, 36, 10, TEAL, true);
    write(title, MARGIN + 10, 36, 16, INK, true);
    write(subtitle, MARGIN, 43, 8.5, MUTED);
  }

  const tableBase = {
    theme: "plain",
    tableWidth: contentWidth,
    margin: { left: MARGIN, right: MARGIN, top: 32, bottom: 17 },
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: INK, valign: "middle", lineColor: LINE, lineWidth: { bottom: 0.15 }, overflow: "linebreak" },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, minCellHeight: 9 },
    alternateRowStyles: { fillColor: PALE },
  };

  const slots = resultSlots(schema);
  frame("Overview");
  heading("01", "Grade result sheet", "Ordered categories: 9A, then 4-8 A grades; then three credits / six passes with Tamil and Maths at least S.");
  const overview = analytics?.overview || [];
  const cardGap = 2.5;
  const cardWidth = (contentWidth - cardGap * (overview.length - 1)) / (overview.length || 1);
  overview.forEach((item, index) => {
    const x = MARGIN + index * (cardWidth + cardGap);
    const ink = item.color === "success" ? TEAL : item.color === "error" ? [160, 53, 65] : item.color === "warning" ? [139, 93, 18] : INK;
    pdf.setFillColor(...PALE); pdf.roundedRect(x, 50, cardWidth, 31, 2, 2, "F");
    write(item.label.toUpperCase(), x + 3, 57, 6.6, MUTED, true);
    write(item.count, x + 3, 70, 23, ink, true);
    write(`${formatRate(item.rate)} of ${totalStudents} students`, x + 3, 77, 6.3, MUTED);
  });
  write("Absent = absent in at least one subject, counted once. 9A and absent counts overlap the eligibility groups.", MARGIN, 87, 7.5, MUTED);
  const distribution = summaryStats;
  autoTable(pdf, {
    ...tableBase, startY: 93,
    styles: { ...tableBase.styles, cellPadding: 1.5 },
    head: [["Category", "Students", "% of selected class / grade"]],
    body: distribution.map((item) => [item.label, item.value, `${item.percentage}%`]),
    columnStyles: { 0: { cellWidth: 160 }, 1: { cellWidth: 35, halign: "center" }, 2: { halign: "center" } },
  });
  const categoryTotal = distribution.reduce((sum, item) => sum + item.value, 0);
  write(`Category total: ${categoryTotal} / ${totalStudents} students`, MARGIN, 150, 9, TEAL, true);
  write(`${RESULT_VIEWS[resultFilter] || resultFilter}  /  ${rows.length} students in this export`, MARGIN, 159, 10, INK, true);
  write("AB = absent; - = no recorded grade. Pending results / review means the category is provisional, not a confirmed failure.", MARGIN, 167, 7.5, MUTED);
  write("Core-subject absences and failures are noted separately in the student schedule.", MARGIN, 174, 7.5, MUTED);
  write("SUBJECT KEY", MARGIN, 182, 8, TEAL, true);
  const electiveColumns = slots.filter((slot) => slot.elective).flatMap((slot) => slot.columns);
  const usedColumns = electiveColumns.filter((column) => rows.some((row) => Object.prototype.hasOwnProperty.call(row.grades, column.key)));
  const guide = usedColumns.map((column) => `${subjectLabel(column)}: ${column.aliases?.[0] || column.label}`).join("   |   ");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.1);
  pdf.setTextColor(...MUTED);
  pdf.text(pdf.splitTextToSize(guide || "No elective subjects in this view.", contentWidth), MARGIN, 188);

  // Nine subject slots preserve every recorded choice while keeping A4 readable.
  pdf.addPage();
  frame("Student schedule");
  heading("02", "Student schedule", `${RESULT_VIEWS[resultFilter] || resultFilter}  |  ${rows.length} students  |  AB = absent; - = no recorded grade or selection`);
  const fixed = { number: 8, class: 12, name: 48, summary: 24, status: 27 };
  const slotBudget = contentWidth - Object.values(fixed).reduce((sum, value) => sum + value, 0);
  const weights = slots.map((slot) => slot.elective ? 1.7 : 1);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const columnStyles = { 0: { cellWidth: fixed.number, textColor: MUTED }, 1: { cellWidth: fixed.class, fontStyle: "bold" }, 2: { cellWidth: fixed.name, halign: "left" } };
  slots.forEach((slot, index) => { columnStyles[index + 3] = { cellWidth: slotBudget * weights[index] / weightTotal, fontSize: slot.elective ? 7.2 : 9, fontStyle: slot.elective ? "normal" : "bold" }; });
  columnStyles[slots.length + 3] = { cellWidth: fixed.summary, fontSize: 7.3 };
  columnStyles[slots.length + 4] = { cellWidth: fixed.status, fontSize: 7.5, fontStyle: "bold" };
  autoTable(pdf, {
    ...tableBase,
    startY: 49,
    styles: { ...tableBase.styles, halign: "center", minCellHeight: 9, cellPadding: { top: 1.5, right: 1.3, bottom: 1.5, left: 1.3 } },
    columnStyles,
    head: [["No.", "Class", "Student name", ...slots.map((slot) => slot.label), "Results", "Category / notes"]],
    body: rows.map((row) => [row.rowNo, resultClassLabel(row, grade), row.studentName, ...slots.map((slot) => slotText(row, slot)), row.summary || "-", resultStatus(row).label]),
    willDrawPage: () => frame("Student schedule"),
    didParseCell: (cell) => {
      if (cell.section === "head") { cell.cell.styles.fontSize = 7.2; return; }
      if (cell.section !== "body") return;
      const row = rows[cell.row.index];
      if (cell.column.index === slots.length + 4) {
        const status = resultStatus(row);
        cell.cell.styles.textColor = status.ink;
        cell.cell.styles.fillColor = status.fill;
      }
      const slot = slots[cell.column.index - 3];
      if (slot && ["TAMIL", "MATHS"].includes(slot.key) && ["W", "AB"].includes(row.grades[slot.key])) {
        cell.cell.styles.textColor = [160, 53, 65];
        cell.cell.styles.fillColor = [253, 238, 240];
      }
    },
  });

  // Put the full-scope follow-up lists after the main schedule, not before it.
  pdf.addPage();
  frame("Student follow-up");
  heading("03", "Student follow-up", "These lists cover all students in the selected class or grade, regardless of the exported result view.");
  let nextY = 51;
  const followUps = [
    { title: "Tamil / Maths below S", detail: "3-credit / 6-pass threshold met", entries: tamilMathsFailureRows, failure: true },
    { title: "Below the credit / pass threshold", detail: "Tamil and Maths at least S", entries: belowThreeCThreeSRows, failure: false },
  ];
  followUps.forEach((list) => {
    if (nextY + 32 > height - 17) { pdf.addPage(); frame("Student follow-up"); nextY = 34; }
    write(`${list.title}  (${list.entries.length})`, MARGIN, nextY, 11, INK, true);
    write(list.detail, MARGIN, nextY + 6, 8, MUTED);
    if (!list.entries.length) {
      write("No students in this group.", MARGIN, nextY + 15, 9, MUTED);
      nextY += 28;
      return;
    }
    autoTable(pdf, {
      ...tableBase, startY: nextY + 10,
      styles: { ...tableBase.styles, cellPadding: 1.6 },
      head: [["No.", "Class", "Student name", list.failure ? "Below S" : "Follow-up", "Results"]],
      body: list.entries.map((row) => [row.rowNo, resultClassLabel(row, grade), row.studentName, list.failure ? failedCoreSubjects(row) : "Credit / pass threshold", row.summary || "-"]),
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 17 }, 2: { cellWidth: 100 }, 3: { cellWidth: 66 }, 4: { cellWidth: contentWidth - 195 } },
      willDrawPage: () => frame("Student follow-up"),
    });
    nextY = pdf.lastAutoTable.finalY + 12;
  });

  if (analytics) {
    pdf.addPage();
    frame("Performance analysis");
    heading("04", "Performance analysis", "Full selected class / grade; independent of the result view. Percentages rounded to one decimal place.");
    analytics.categories.forEach((category, index) => {
      const y = 55 + index * 16;
      write(`${index + 1}. ${category.label}`, MARGIN, y, 9, INK, true);
      pdf.setFillColor(...LINE); pdf.rect(MARGIN + 112, y - 4, 110, 4, "F");
      pdf.setFillColor(...TEAL); pdf.rect(MARGIN + 112, y - 4, 110 * (category.rate || 0) / 100, 4, "F");
      write(`${category.count} / ${analytics.total} (${formatRate(category.rate)})`, width - MARGIN, y, 9, INK, true, { align: "right" });
    });
    write(`Categories 1-3: ${analytics.grouped} / ${analytics.total} = ${formatRate(analytics.groupedRate)}`, MARGIN, 157, 11, INK, true);
    write(`Verified A/L eligibility: ${analytics.verified} / ${analytics.total} = ${formatRate(analytics.verifiedRate)}`, MARGIN, 166, 11, TEAL, true);
    write("4-8 A grades do not guarantee core passes or six total passes. Verified eligibility checks all required conditions.", MARGIN, 177, 8, MUTED);
    write(`Pending / review: ${analytics.pending}. Categories include provisional results; missing marks are not treated as confirmed failures.`, MARGIN, 184, 8, MUTED);
    pdf.addPage(); frame("Subject pass rates");
    heading("05", "Subject pass rates", "Pass rate = passed / sat x 100. Absent and pending marks are excluded from sat. N/A = no recorded sitting.");
    autoTable(pdf, {
      ...tableBase, startY: 49,
      head: [["Subject", "Enrolled", "Sat", "Passed", "Failed", "Absent", "Pending", "Pass rate", "0-100%"]],
      body: analytics.subjects.map((subject) => [subject.label, subject.enrolled, subject.sat, subject.passed, subject.failed, subject.absent, subject.pending, formatRate(subject.rate), ""]),
      styles: { ...tableBase.styles, halign: "right" },
      columnStyles: { 0: { cellWidth: 76, halign: "left" }, 8: { cellWidth: 40 } },
      willDrawPage: () => frame("Subject pass rates"),
      didDrawCell: (cell) => {
        if (cell.section !== "body" || cell.column.index !== 8) return;
        const rate = analytics.subjects[cell.row.index].rate;
        const x = cell.cell.x + 3, y = cell.cell.y + cell.cell.height / 2 - 1.5, barWidth = cell.cell.width - 6;
        pdf.setFillColor(...LINE); pdf.rect(x, y, barWidth, 3, "F");
        if (rate !== null) { pdf.setFillColor(...TEAL); pdf.rect(x, y, barWidth * rate / 100, 3, "F"); }
      },
    });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, height - 12, width - MARGIN, height - 12);
    write(`${reportLabel}  /  ${term} ${year}`, MARGIN, height - 7, 7, MUTED);
    write(`${pageSections.get(page) || "Grade result sheet"}  |  ${page} / ${pageCount}`, width - MARGIN, height - 7, 7, MUTED, false, { align: "right" });
  }
  return pdf;
}
