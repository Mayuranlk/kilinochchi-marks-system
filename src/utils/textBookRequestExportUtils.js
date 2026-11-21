import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const SCHOOL_NAME = "KN/Kilinochchi Central College";

function safePart(value) {
  return String(value || "All").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

function scopeLabel(report) {
  if (report.scope === "class") {
    return report.classes.find((row) => row.id === report.classId)?.className || "Class";
  }
  if (report.scope === "grade") return `Grade ${report.grade}`;
  return "Whole School";
}

function filterText(report) {
  return [
    `Academic Year: ${report.academicYear}`,
    `Scope: ${scopeLabel(report)}`,
    report.medium ? `Medium: ${report.medium}` : "Medium: All",
    report.stream ? `Stream: ${report.stream}` : "Stream: All",
  ].join(" | ");
}

function summaryRows(report) {
  return [
    ["Total Students", report.summary.total],
    ["Male", report.summary.male],
    ["Female", report.summary.female],
    ["Unknown / Unspecified", report.summary.unknown],
    ["Subjects", report.subjectRows.length],
  ];
}

function subjectHeadAndBody(report) {
  if (report.scope === "grade" && report.classes.length > 1) {
    return {
      head: [["No", "Subject", ...report.classes.map((row) => row.className), "Total Required"]],
      body: report.subjectRows.map((row, index) => [
        index + 1,
        row.name,
        ...report.classes.map((classroom) => row.byClass[classroom.id] || 0),
        row.booksRequired,
      ]),
    };
  }

  return {
    head: [["No", "Subject", "Students Taking Subject", "Books Required"]],
    body: report.subjectRows.map((row, index) => [index + 1, row.name, row.total, row.booksRequired]),
  };
}

export function createTextBookRequestPdf(report) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(SCHOOL_NAME, 148.5, 12, { align: "center" });
  doc.setFontSize(13);
  doc.text("Text Book Request", 148.5, 19, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(filterText(report), 148.5, 25, { align: "center" });

  autoTable(doc, {
    startY: 30,
    head: [["Summary", "Count"]],
    body: summaryRows(report),
    theme: "grid",
    tableWidth: 75,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 35, 126] },
  });

  let startY = (doc.lastAutoTable?.finalY || 55) + 6;
  const breakdown = report.scope === "school" ? report.gradeBreakdown : report.classBreakdown;
  if (breakdown.length) {
    autoTable(doc, {
      startY,
      head: [[report.scope === "school" ? "Grade" : "Division", "Male", "Female", "Unknown", "Total"]],
      body: breakdown.map((row) => [
        report.scope === "school" ? row.grade : row.className,
        row.male,
        row.female,
        row.unknown,
        row.total,
      ]),
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.2, halign: "center" },
      headStyles: { fillColor: [69, 90, 100] },
    });
    startY = (doc.lastAutoTable?.finalY || startY) + 6;
  }

  const subjectTable = subjectHeadAndBody(report);
  autoTable(doc, {
    startY,
    head: subjectTable.head,
    body: subjectTable.body,
    theme: "grid",
    styles: { fontSize: 7.2, cellPadding: 1.15, halign: "center" },
    columnStyles: { 1: { halign: "left" } },
    headStyles: { fillColor: [46, 125, 50] },
    rowPageBreak: "avoid",
  });

  const fileName = `Text_Book_Request_${report.academicYear}_${safePart(scopeLabel(report))}.pdf`;
  return { doc, fileName };
}

export function exportTextBookRequestPdf(report) {
  const { doc, fileName } = createTextBookRequestPdf(report);
  doc.save(fileName);
}

export function createTextBookRequestWorkbook(report) {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    [SCHOOL_NAME],
    ["Text Book Request"],
    ["Academic Year", report.academicYear],
    ["Scope", scopeLabel(report)],
    ["Medium", report.medium || "All"],
    ["Stream", report.stream || "All"],
    [],
    ...summaryRows(report),
  ]);
  summary["!cols"] = [{ wch: 24 }, { wch: 18 }];

  const requirements = XLSX.utils.aoa_to_sheet([
    ["Subject", "Division", "Student Count", "Books Required"],
    ...report.subjectRows.flatMap((subject) =>
      report.classes.map((classroom) => [
        subject.name,
        classroom.className,
        subject.byClass[classroom.id] || 0,
        subject.byClass[classroom.id] || 0,
      ])
    ),
  ]);
  requirements["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];

  const breakdown = XLSX.utils.aoa_to_sheet([
    ["Grade", "Division", "Male", "Female", "Unknown", "Total"],
    ...report.classBreakdown.map((row) => [row.grade, row.className, row.male, row.female, row.unknown, row.total]),
  ]);
  breakdown["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];

  XLSX.utils.book_append_sheet(workbook, summary, "Summary");
  XLSX.utils.book_append_sheet(workbook, requirements, "Subject Requirements");
  XLSX.utils.book_append_sheet(workbook, breakdown, "Division Breakdown");
  return workbook;
}

export function exportTextBookRequestExcel(report) {
  const workbook = createTextBookRequestWorkbook(report);
  XLSX.writeFile(
    workbook,
    `Text_Book_Request_${report.academicYear}_${safePart(scopeLabel(report))}.xlsx`
  );
}
