import { academicDisplay } from "./academicDisplay";
const SUBJECTS = [
  ["தமிழ்", ["Tamil"]], ["கணிதம்", ["Mathematics", "Maths", "Math"]],
  ["ஆங்கிலம்", ["English"]], ["விஞ்ஞானம்", ["Science"]], ["வரலாறு", ["History"]],
  ["சைவம்", ["Saivanery", "Hinduism", "Saivam"]], ["கத்தோலிக்கம்", ["Catholicism", "Roman Catholicism", "RC"]],
  ["கிறிஸ்தவம்", ["Christianity", "NRC"]], ["சித்திரம்", ["Art"]], ["சங்கீதம்", ["Music", "Carnatic Music"]],
  ["நடனம்", ["Dance", "Dancing"]], ["நாடகம்", ["Drama", "Drama & Theatre", "Drama and Theatre", "Drama and Theatre (Tamil)"]],
  ["தமிழ் இலக்கிய நயம்", ["Tamil Literature", "Appreciation of Tamil Literary Texts"]], ["ஆங்கில இலக்கிய நயம்", ["English Literature", "Eng-Literature", "Appreciation of English Literary Texts"]],
  ["குடியியல்", ["Civics", "Civic Education"]], ["புவியியல்", ["Geography"]],
  ["முயற்சியாண்மை", ["Entrepreneurship", "Entrepreneurship Studies"]],
  ["வர்த்தகம்", ["Business & Accounting Studies", "Business and Accounting Studies", "Commerce"]],
  ["சுகாதாரம்", ["Health", "Health & Physical Education", "Health and Physical Education"]],
  ["ICT", ["ICT", "Information and Communication Technology"]],
  ["மனையியல்", ["Home Economics", "Home Science"]], ["விவசாயம்", ["Agriculture", "Agriculture & Food Technology"]],
  ["இஸ்லாம்", ["Islam"]], ["சிங்களம்", ["Sinhala"]], ["செயன்முறைத் தொழில்நுட்பத் திறன்கள்", ["PTS"]],
];
const normalize = (value) => String(value).toLowerCase().replace(/[^a-z]/g, "");
const subjectIndex = (name) => SUBJECTS.findIndex(([tamil, aliases]) => tamil === name || aliases.some((alias) => normalize(alias) === normalize(name)));
export const sbaSubjectLabel = (name) => SUBJECTS[subjectIndex(name)]?.[1][0] || name;
export const orderSbaColumns = (columns) => [...columns].sort((a, b) => {
  const rank = (name) => subjectIndex(name) < 0 ? 999 : subjectIndex(name);
  return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
});
const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function buildSbaRegisterHtml({ register, classLabel, year, termName, fontUrl }) {
  const columns = orderSbaColumns(register.columns);
  const rowPages = Math.max(1, Math.ceil(register.rows.length / 35));
  const columnPages = Math.max(1, Math.ceil(columns.length / 22));
  const pages = [];
  for (let rowPage = 0; rowPage < rowPages; rowPage++) {
    for (let columnPage = 0; columnPage < columnPages; columnPage++) {
      const visibleColumns = columns.slice(columnPage * 22, (columnPage + 1) * 22);
      const rows = Array.from({ length: 35 }, (_, index) => {
        const student = register.rows[rowPage * 35 + index];
        return `<tr><td>${rowPage * 35 + index + 1}</td><td class="student">${escape(academicDisplay(student?.studentName))}</td>${visibleColumns.map((column) => {
          const enrolled = student && Object.prototype.hasOwnProperty.call(student.values, column.id);
          return `<td class="${student && !enrolled ? "not-enrolled" : ""}">${enrolled ? escape(academicDisplay(student.values[column.id])) : ""}</td>`;
        }).join("")}</tr>`;
      }).join("");
      pages.push(`<section class="sheet"><header><strong>Kili / Kilinochchi Central College</strong><div>School-Based Assessment Register - ${escape(academicDisplay(year))}</div><div class="meta"><span>Grade / Class: ${escape(academicDisplay(classLabel))}</span><span>${escape(academicDisplay(termName))} · SBA / 20</span><span>Students: ${register.rows.length}</span></div></header>
        <table><colgroup><col style="width:9mm"><col style="width:67mm">${visibleColumns.map(() => "<col>").join("")}</colgroup><thead><tr><th>No.</th><th>Student name</th>${visibleColumns.map((column) => `<th class="subject"><div><span>${escape(academicDisplay(sbaSubjectLabel(column.name)))}</span></div></th>`).join("")}</tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="2">Subject teacher</th>${visibleColumns.map((column) => `<td class="teacher">${escape(academicDisplay(column.teachers))}</td>`).join("")}</tr></tfoot></table>
        <div class="signatures"><span>Class teacher</span><span>Section head</span><span>Principal</span></div>
        <footer>AB = Absent · White blank = Pending | Grey = Not enrolled · Marks out of 20 <span>Page ${pages.length + 1} / ${rowPages * columnPages}</span></footer></section>`);
    }
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SBA Register - ${escape(academicDisplay(classLabel))} - ${escape(academicDisplay(year))} - ${escape(academicDisplay(termName))}</title><style>
    @font-face{font-family:SbaTamil;src:url("${escape(academicDisplay(fontUrl))}") format("truetype");font-display:block}
    @page{size:A3 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#e5e7eb;color:#000;font-family:Arial,SbaTamil,sans-serif;font-size:9px}
    .sheet{width:400mm;min-height:277mm;padding:0;margin:8mm auto;background:white;break-after:page}.sheet:last-child{break-after:auto}
    header{text-align:center;height:19mm;font-size:12px;line-height:1.6}.meta{display:flex;justify-content:space-between;font-size:10px;padding:1mm 8mm}
    table{width:100%;table-layout:fixed;border-collapse:collapse}th,td{border:.2mm solid #000;text-align:center;padding:0 1mm;overflow-wrap:anywhere}
    thead th{height:42mm;font-weight:normal}.subject>div{position:relative;height:41mm}.subject span{position:absolute;bottom:2mm;left:50%;transform:rotate(-90deg);transform-origin:left center;white-space:normal;width:38mm;text-align:left;font-size:10px}
    tbody tr{height:4.8mm}tbody td{height:4.8mm;line-height:1.1;font-size:9px}.student{text-align:left;white-space:normal;overflow-wrap:anywhere;font-size:8px}tfoot td,tfoot th{height:21mm;font-size:8px;font-weight:normal}.teacher{vertical-align:top;padding-top:2mm}.not-enrolled{background:#f3f3f3}
    .signatures{display:flex;justify-content:space-between;margin:8mm 8mm 2mm}.signatures span{width:28%;border-top:.2mm dotted #000;text-align:center;padding-top:1mm}footer{display:flex;justify-content:space-between;font-size:8px;margin:0 3mm}
    @media print{body{background:white}.sheet{margin:0;min-height:0}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>${pages.join("")}</body></html>`;
}

export async function printSbaRegister(html) {
  const target = window.open("", "_blank");
  if (!target) throw new Error("Allow pop-ups to print the A3 register.");
  target.document.open();
  target.document.write(academicDisplay(html));
  target.document.close();
  await target.document.fonts.load("12px SbaTamil");
  await target.document.fonts.ready;
  target.focus();
  target.print();
}
