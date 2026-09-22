import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString("en", { month: "long" }));

// Read roster blocks only; repeated attendance/meeting rosters are not new students.
export function parseClassWorkbook(workbook) {
  const classes = new Map();
  for (const sheet of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: "" });
    let current = null;
    let columns = null;
    for (const row of rows) {
      const first = String(row[0] || "").trim();
      if (/^(?:G(?:rade)?\s*)?\d{1,2}\s*[- ]?\s*[A-Z]$/i.test(first)) {
        const name = first.toUpperCase().replace(/^GRADE\s*|^G/, "").replace(/[\s-]/g, "");
        if (!classes.has(name)) classes.set(name, { id: name, className: name, students: [], seen: new Set() });
        current = classes.get(name);
        columns = null;
      } else if (row.some((cell) => /^student name$/i.test(String(cell).trim()))) {
        const name = row.findIndex((cell) => /^student name$/i.test(String(cell).trim()));
        const index = row.findIndex((cell) => /^(index no|admission no)$/i.test(String(cell).trim()));
        // Ignore secondary sheets without admission numbers (e.g. tuition forms).
        columns = index >= 0 ? { name, index } : null;
      } else if (current && columns && /^\d+$/.test(first) && String(row[columns.name] || "").trim()) {
        const name = String(row[columns.name]).trim();
        const indexNo = String(row[columns.index] || "").trim();
        const key = indexNo || name;
        if (!current.seen.has(key)) {
          current.seen.add(key);
          current.students.push({ name, indexNo });
        }
      } else if (row.some((cell) => /class teacher/i.test(String(cell)))) columns = null;
    }
  }
  const result = [...classes.values()].filter((room) => room.students.length).map(({ seen, ...room }) => room);
  if (!result.length) throw new Error("No class rosters found. Use class headings such as G11-A and columns No, Index No, Student Name.");
  return result;
}

export function createClassSheetPdf({ classes, year, term, months, meetingDate = "", schoolName = "KN/Kilinochchi Central College" }) {
  if (!classes.length || classes.some((room) => !room.students.length)) throw new Error("Select classes with students.");
  if (!/^[12]\d{3}$/.test(String(year)) || !["I", "II", "III"].includes(term) || !months.length || months.some((m) => !MONTHS.includes(m))) {
    throw new Error("Select a valid year, term and at least one month.");
  }
  if (meetingDate && (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) || !Number.isFinite(Date.parse(meetingDate)) || new Date(meetingDate).toISOString().slice(0, 10) !== meetingDate)) {
    throw new Error("Select a valid parents meeting date.");
  }
  const selectedMonths = MONTHS.filter((month) => months.includes(month));
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const ink = [31, 48, 66];
  const muted = [86, 102, 116];
  const rule = [178, 190, 201];
  function write(value, x, y, size = 9, bold = false, color = ink, options = {}) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(value, x, y, options);
  }
  let page = 0;
  for (const room of classes) {
    // Preserve handwriting space and avoid silently splitting a class into extra pages.
    if (room.students.length > 55) throw new Error(`${room.className} has more than 55 students; three readable A4 pages cannot fit this roster.`);
    const specs = [
      { title: "Cash Collection", columns: ["60/-", "1800/-", "600/-", "Remarks"] },
      { title: "Attendance Sheet", columns: [...selectedMonths, "Total"] },
      { title: "Parents Meeting Sheet", columns: ["Telephone No", "Signature"] },
    ];
    for (const spec of specs) {
      if (page++) pdf.addPage();
      pdf.setFillColor(...ink);
      pdf.rect(10, 11, 1.2, 17, "F");
      write(schoolName, 15, 15, 10, true);
      write(spec.title, 15, 25, 17, true);
      write(String(year), 200, 15, 10, true, muted, { align: "right" });
      pdf.setDrawColor(...rule);
      pdf.setLineWidth(0.2);
      pdf.line(10, 31, 200, 31);
      write(`CLASS ${room.className}`, 10, 38, 10, true);
      write(`${room.students.length} students`, 200, 38, 8, false, muted, { align: "right" });
      if (spec.title === "Attendance Sheet") {
        write(`Term: ${term}`, 10, 45, 9);
        write("Total school days: ........................", 200, 45, 9, false, ink, { align: "right" });
      }
      if (spec.title === "Parents Meeting Sheet") {
        const dateLabel = meetingDate ? meetingDate.split("-").reverse().join(" / ") : "................................";
        write(`Date: ${dateLabel}`, 10, 45, 9);
      }
      const startY = spec.title === "Cash Collection" ? 43 : 50;
      const rowHeight = Math.min(8, (261 - startY - 12) / room.students.length);
      const narrow = spec.columns.length > 7;
      autoTable(pdf, {
        startY, theme: "grid", margin: { left: 10, right: 10, bottom: 22 },
        head: [["No", "Index No", "Student Name", ...spec.columns]],
        body: room.students.map((student, i) => [i + 1, student.indexNo, student.name, ...spec.columns.map(() => "")]),
        styles: { fontSize: room.students.length > 42 ? 6 : 7.5, cellPadding: 0.6, minCellHeight: rowHeight, overflow: "ellipsize", lineColor: rule, lineWidth: 0.15, textColor: ink, valign: "middle", halign: "center" },
        headStyles: { fillColor: [229, 236, 242], textColor: ink, fontStyle: "bold", fontSize: narrow ? 5.5 : 7.5, overflow: "linebreak", minCellHeight: 10, lineColor: rule },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 18 }, 2: { cellWidth: narrow ? 58 : 72, halign: "left" } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index < 3 && data.row.index % 2 === 1) data.cell.styles.fillColor = [246, 248, 250];
          if (data.section === "body" && data.column.index === 2) {
            const available = (narrow ? 58 : 72) - 1.2;
            pdf.setFontSize(data.cell.styles.fontSize);
            const width = pdf.getTextWidth(String(data.cell.raw));
            if (width > available) data.cell.styles.fontSize *= available / width;
          }
        },
        rowPageBreak: "avoid",
      });
      if (pdf.getNumberOfPages() !== page) throw new Error(`The ${room.className} roster does not fit on one page. Reduce the number of selected months.`);
      pdf.setDrawColor(...rule);
      pdf.setLineWidth(0.25);
      pdf.line(10, 276, 85, 276);
      pdf.line(125, 276, 200, 276);
      write("Class teacher signature", 10, 281, 8, false, muted);
      write("Verified by / signature", 125, 281, 8, false, muted);
      write(`${room.className}  /  ${spec.title}`, 10, 290, 7, false, muted);
      write(`Page ${page} / ${classes.length * 3}`, 200, 290, 7, false, muted, { align: "right" });
    }
  }
  return pdf;
}
