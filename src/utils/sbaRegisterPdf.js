import { academicDisplay, academicExport } from "./academicDisplay";
import { orderSbaColumns, sbaSubjectLabel } from "./sbaRegisterPrint";

export async function createSbaRegisterPdf({ register, classLabel, year, termName }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
  pdf.setProperties({ title: `SBA Register - ${classLabel} - ${year} - ${termName}` });
  const columns = orderSbaColumns(register.columns);
  const rowPages = Math.max(1, Math.ceil(register.rows.length / 35));
  const columnPages = Math.max(1, Math.ceil(columns.length / 22));
  let page = 0;
  for (let r = 0; r < rowPages; r++) {
    for (let c = 0; c < columnPages; c++) {
      if (page++) pdf.addPage();
      const visible = columns.slice(c * 22, (c + 1) * 22);
      const students = Array.from({ length: 35 }, (_, i) => register.rows[r * 35 + i]);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
      pdf.text(academicDisplay("Kili / Kilinochchi Central College"), 210, 15, { align: "center" });
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      pdf.text(academicDisplay(`School-Based Assessment Register - ${year}`), 210, 21, { align: "center" });
      pdf.setFontSize(9);
      pdf.text(academicDisplay(`Grade / Class: ${classLabel}`), 12, 27);
      pdf.text(academicDisplay(`${termName} - SBA / 20`), 210, 27, { align: "center" });
      pdf.text(academicDisplay(`Students: ${register.rows.length}`), 408, 27, { align: "right" });
      autoTable(pdf, academicExport({
        startY: 30, margin: { left: 10, right: 10, top: 30, bottom: 25 }, tableWidth: 400,
        theme: "grid", pageBreak: "avoid", showHead: "everyPage", showFoot: "lastPage",
        styles: { font: "helvetica", fontSize: 6.5, textColor: 0, lineColor: 0, lineWidth: 0.15, cellPadding: 0.6, halign: "center", valign: "middle", minCellHeight: 4.8 },
        headStyles: { fillColor: 255, textColor: 0, fontStyle: "normal", minCellHeight: 42 },
        footStyles: { fillColor: 255, textColor: 0, fontStyle: "normal", minCellHeight: 21, valign: "top" },
        columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 67, halign: "left" }, ...Object.fromEntries(visible.map((_, i) => [i + 2, { cellWidth: 324 / visible.length }])) },
        head: [["No.", "Student name", ...visible.map(() => "")]],
        body: students.map((student, i) => [String(r * 35 + i + 1), student?.studentName || "", ...visible.map((column) => String(student?.values[column.id] ?? ""))]),
        foot: [[{ content: "Subject teacher", colSpan: 2 }, ...visible.map((column) => column.teachers || "")]],
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index >= 2) {
            const student = students[data.row.index];
            if (student && !Object.prototype.hasOwnProperty.call(student.values, visible[data.column.index - 2].id)) data.cell.styles.fillColor = [243, 243, 243];
          }
        },
        didDrawCell: (data) => {
          if (data.section === "head" && data.column.index >= 2) {
            pdf.setFontSize(8);
            const lines = pdf.splitTextToSize(academicDisplay(sbaSubjectLabel(visible[data.column.index - 2].name)), 37);
            lines.forEach((line, i) => pdf.text(academicDisplay(line), data.cell.x + data.cell.width / 2 + (i - (lines.length - 1) / 2) * 3, data.cell.y + 39, { angle: 90 }));
          }
        },
      }));
      pdf.setFontSize(8);
      ["Class teacher", "Section head", "Principal"].forEach((label, i) => {
        const x = 27 + i * 135; pdf.line(x, 280, x + 95, 280); pdf.text(academicDisplay(label), x + 47.5, 284, { align: "center" });
      });
      pdf.setFontSize(7);
      pdf.text(academicDisplay("AB = Absent | White blank = Pending | Grey = Not enrolled | Marks out of 20"), 12, 290);
      pdf.text(academicDisplay(`Page ${page} / ${rowPages * columnPages}`), 408, 290, { align: "right" });
    }
  }
  return pdf.output("blob");
}

export function canShareSbaPdf(file) {
  return Boolean(navigator.share && navigator.canShare?.({ files: [file] }));
}
export function downloadSbaPdf(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a"); link.href = url; link.download = file.name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
