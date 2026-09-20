import { RESULT_CATEGORIES, formatRate, resultAnalytics } from "./gradeResultLogic";
import { resultClassLabel } from "./gradeResultPresentation";

export const SLIDE_TEXT = {
  en: {
    title: "Parent discussion: term results", school: "KN/Kilinochchi Central College",
    rules: "How to read these results",
    criteria: ["Excellent: A in all nine subjects. Best: four to eight A grades; both groups are listed first.", "Verified A/L eligibility: at least three credits (C or above), six total passes (S or above), including Tamil and Mathematics, with nine recorded results.", "Each student belongs to one of six ordered categories. Pending results are provisional, not confirmed failures.", "An absent student has AB in at least one subject and is counted once. Absence and 9A highlights overlap the eligibility groups."],
    overview: "Overall results", categories: "Six result categories", divisions: "Results by division",
    subjects: "Subject performance", actions: "Next steps: school and family", students: "Students",
    names: "Names are shown as recorded in the school register.", empty: "No students in this category.",
    results: "Results", subject: "Subject", grade: "Grade", marks: "Marks", notes: "Follow-up",
    class: "Class", sat: "Sat", passed: "Passed", absent: "Absent", pending: "Pending", rate: "Pass rate",
    verified: "Verified A/L eligibility", grouped: "Categories 1–3", complete: "No core-subject concern recorded.",
    note: "4–8 A grades do not guarantee core passes or six total passes. Verified eligibility checks every condition.",
    legend: "A/B/C/S = pass; W = below pass; AB = absent; — = pending. Pass rate = passed ÷ sat. Absent and pending excluded from sat.",
    overviewLabels: ["Students", "9A results", "Verified eligible", "Not eligible", "Pending review", "Absent students"],
    categoryLabels: ["Excellent (9A)", "Best (4A–8A)", "A/L Eligible", "At Risk: Core Subject Failure", "At Risk: Below Threshold", "Needs Focused Support"],
    advice: [
      "Celebrate achievement. Agree on subject interests and a balanced study plan.",
      "Recognise strong results. Check Tamil, Mathematics and remaining pass requirements before planning A/L studies.",
      "This group excludes Excellent and Best. Discuss subject choices, strengths and the next academic step.",
      "Focus on the named core subject. Distinguish absence from failure and agree on targeted practice and reassessment.",
      "Core subjects passed. Identify the closest credit/pass opportunities and plan regular subject support.",
      "Agree on a manageable individual support plan. Confirm missing results and attendance before drawing conclusions.",
    ],
    next: ["Celebrate progress and listen to the student’s goals.", "Choose two specific learning targets using the subject results.", "Agree on a weekly home-study routine and school support.", "Confirm absent or pending assessments with the class teacher.", "Agree on a review date and check progress together."],
  },
  ta: {
    title: "பெற்றோர் கலந்துரையாடல்: தவணைப் பெறுபேறுகள்", school: "கிளி/கிளிநொச்சி மத்திய கல்லூரி",
    rules: "பெறுபேறுகளை எவ்வாறு புரிந்துகொள்வது?",
    criteria: ["அதிசிறப்பு: ஒன்பது பாடங்களிலும் A. மிகச் சிறப்பு: நான்கு முதல் எட்டு A தரங்கள். இவ்விரு பிரிவுகளும் முதலில் காட்டப்படுகின்றன.", "உறுதிசெய்யப்பட்ட உயர்தரத் தகுதி: குறைந்தது மூன்று C அல்லது அதற்கு மேற்பட்ட தரங்களும், தமிழ் மற்றும் கணிதம் உட்பட ஆறு S அல்லது அதற்கு மேற்பட்ட சித்திகளும் தேவை. ஒன்பது பெறுபேறுகளும் பதிவாகியிருக்க வேண்டும்.", "ஒவ்வொரு மாணவரும் ஆறு பிரிவுகளில் ஒன்றில் மட்டும் இடம்பெறுவர். நிலுவைப் பெறுபேறுகள் உறுதிப்படுத்தப்பட்ட சித்தியின்மையாகக் கருதப்படுவதில்லை.", "ஏதேனும் ஒரு பாடத்தில் AB உள்ள மாணவர் சமுகமளிக்காதவராக ஒருமுறை கணக்கிடப்படுவார். சமுகமளிக்காமை மற்றும் 9A எண்ணிக்கைகள் தகுதிப் பிரிவுகளுடன் ஒன்றிணையலாம்."],
    overview: "ஒட்டுமொத்தப் பெறுபேறுகள்", categories: "பெறுபேறுகளின் ஆறு பிரிவுகள்", divisions: "வகுப்புப் பிரிவு வாரியான பெறுபேறுகள்",
    subjects: "பாட வாரியான பெறுபேறுகள்", actions: "அடுத்த படிகள்: பாடசாலையும் குடும்பமும்", students: "மாணவர்கள்",
    names: "மாணவர் பெயர்கள் பாடசாலைப் பதிவில் உள்ளவாறே காட்டப்படுகின்றன.", empty: "இப்பிரிவில் மாணவர்கள் இல்லை.",
    results: "பெறுபேறுகள்", subject: "பாடம்", grade: "தரம்", marks: "புள்ளிகள்", notes: "கவனிக்க வேண்டியவை",
    class: "வகுப்பு", sat: "தோற்றியோர்", passed: "சித்தியடைந்தோர்", absent: "சமுகமளிக்காதோர்", pending: "நிலுவை", rate: "சித்தி வீதம்",
    verified: "உறுதிசெய்யப்பட்ட உயர்தரத் தகுதி", grouped: "பிரிவுகள் 1–3", complete: "பிரதான பாடங்களில் குறைபாடு பதிவாகவில்லை.",
    note: "4–8 A தரங்கள் மட்டும் தமிழ், கணிதம் மற்றும் ஆறு பாடச் சித்தியை உறுதிசெய்யாது. உயர்தரத் தகுதிக்கு அனைத்து நிபந்தனைகளும் சரிபார்க்கப்படுகின்றன.",
    legend: "A/B/C/S = சித்தி; W = சித்தியில்லை; AB = சமுகமளிக்கவில்லை; — = நிலுவை. சித்தி வீதம் = சித்தியடைந்தோர் ÷ தோற்றியோர். சமுகமளிக்காதோர் மற்றும் நிலுவைப் பெறுபேறுகள் கணக்கில் சேராது.",
    overviewLabels: ["மாணவர்கள்", "9A பெறுபேறுகள்", "உயர்தரத் தகுதி", "தகுதி பெறாதோர்", "மீளாய்வு நிலுவை", "சமுகமளிக்காதோர்"],
    categoryLabels: ["அதிசிறப்பு (9A)", "மிகச் சிறப்பு (4A–8A)", "உயர்தரத்திற்குத் தகுதி", "கவனம் தேவை: பிரதான பாடச் சித்தியின்மை", "கவனம் தேவை: தேவையான சித்திகள் இல்லை", "தனிப்பட்ட ஆதரவு தேவை"],
    advice: [
      "சாதனையைப் பாராட்டுவோம். பாட ஆர்வங்களையும் சமநிலையான கற்றல் திட்டத்தையும் கலந்துரையாடுவோம்.",
      "சிறந்த பெறுபேறுகளைப் பாராட்டுவோம். உயர்தரத் திட்டமிடலுக்கு முன் தமிழ், கணிதம் மற்றும் ஏனைய சித்தித் தேவைகளைச் சரிபார்ப்போம்.",
      "அதிசிறப்பு மற்றும் மிகச் சிறப்பு மாணவர்கள் இப்பிரிவில் சேர்க்கப்படவில்லை. பாடத் தெரிவுகள், பலங்கள் மற்றும் அடுத்த கல்விப் படியைப் பேசுவோம்.",
      "குறிப்பிடப்பட்ட பிரதான பாடத்தில் கவனம் செலுத்துவோம். சமுகமளிக்காமையையும் சித்தியின்மையையும் வேறுபடுத்தி பயிற்சி மற்றும் மீள்மதிப்பீட்டைத் திட்டமிடுவோம்.",
      "பிரதான பாடங்களில் சித்தி பெற்றுள்ளனர். மேலதிக திறமைச் சித்திகளையும் சாதாரண சித்திகளையும் பெறக்கூடிய பாடங்களுக்கு ஆதரவு வழங்குவோம்.",
      "மாணவருக்கேற்ற எளிய ஆதரவுத் திட்டத்தை வகுப்போம். முடிவெடுக்குமுன் நிலுவைப் பெறுபேறுகளையும் வருகையையும் உறுதிசெய்வோம்.",
    ],
    next: ["முன்னேற்றத்தைப் பாராட்டி மாணவரின் இலக்குகளைக் கேட்போம்.", "பாடப் பெறுபேறுகளின் அடிப்படையில் இரண்டு கற்றல் இலக்குகளைத் தெரிவுசெய்வோம்.", "வீட்டுக் கற்றல் ஒழுங்கையும் பாடசாலை ஆதரவையும் திட்டமிடுவோம்.", "சமுகமளிக்காத அல்லது நிலுவையிலுள்ள மதிப்பீடுகளை வகுப்பாசிரியருடன் உறுதிசெய்வோம்.", "மீளாய்வுத் திகதியைத் தீர்மானித்து முன்னேற்றத்தை இணைந்து பார்ப்போம்."],
  },
};

const TAMIL_SUBJECTS = {
  REL_SAIVAM: "சைவநெறி", REL_NRC: "கிறிஸ்தவம்", REL_RC: "கத்தோலிக்கம்", REL_ISLAM: "இஸ்லாம்",
  TAMIL: "தமிழ்", MATHS: "கணிதம்", ENGLISH: "ஆங்கிலம்", SCIENCE: "விஞ்ஞானம்", HISTORY: "வரலாறு",
  B1_CIV_GOV: "குடியியற் கல்வி", B1_GEO: "புவியியல்", B1_BAS: "வணிகமும் கணக்கீட்டுக் கல்வியும்", B1_ENT: "முயற்சியாண்மைக் கல்வி",
  B2_ART: "சித்திரம்", B2_DANCE: "நடனம்", B2_MUSIC: "சங்கீதம்", B2_DRAMA: "நாடகமும் அரங்கியலும்", B2_TAM_LIT: "தமிழ் இலக்கியம்", B2_ENG_LIT: "ஆங்கில இலக்கியம்",
  B3_AGRI: "விவசாயமும் உணவுத் தொழில்நுட்பமும்", B3_HPE: "சுகாதாரமும் உடற்கல்வியும்", B3_HOME: "மனைப் பொருளியல்", B3_ICT_T: "தகவல் தொடர்பாடல் தொழில்நுட்பம் (தமிழ்)", B3_ICT_E: "தகவல் தொடர்பாடல் தொழில்நுட்பம் (ஆங்கிலம்)", B3_MEDIA: "தொடர்பாடலும் ஊடகக் கற்கையும்", B3_DCT: "வடிவமைப்பும் நிர்மாணத் தொழில்நுட்பமும்", B3_DMT: "வடிவமைப்பும் இயந்திரத் தொழில்நுட்பமும்", B3_DEET: "வடிவமைப்பும் மின் இலத்திரனியல் தொழில்நுட்பமும்",
};

const TAMIL_NOTES = {
  "Failed both": "தமிழ் மற்றும் கணிதத்தில் சித்தியில்லை", "Failed Math only": "கணிதத்தில் மட்டும் சித்தியில்லை", "Failed Tamil only": "தமிழில் மட்டும் சித்தியில்லை",
  "Maths absent": "கணிதப் பரீட்சைக்குச் சமுகமளிக்கவில்லை", "Tamil absent": "தமிழ்ப் பரீட்சைக்குச் சமுகமளிக்கவில்லை",
  "Pending results / review": "பெறுபேறுகள் நிலுவை / மீளாய்வு தேவை", "A/L conditions not confirmed": "உயர்தரத் தகுதி நிபந்தனைகள் உறுதியாகவில்லை",
};

export const slideSubject = (column, language) => language === "ta" ? TAMIL_SUBJECTS[column.key] || column.label : column.aliases?.[0] || column.label;
const chunks = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));

export function buildGradeResultSlides({ rows, columns, grade, reportLabel, term, year, language = "en" }) {
  const t = SLIDE_TEXT[language];
  if (!t) throw new Error("Unsupported presentation language");
  const analytics = resultAnalytics(rows, columns);
  const context = language === "ta" ? `${reportLabel.replace("Whole Grade", "முழுத் தரம்")} / ${term.replace(/Term\s*(\d)/i, "$1 ஆம் தவணை")} / ${year}` : `${reportLabel} / ${term} / ${year}`;
  const slides = [{ type: "cover", title: t.title, context }, { type: "overview", title: t.overview, analytics }, { type: "rules", title: t.rules }, { type: "categories", title: t.categories, analytics }];
  const divisions = [...new Set(rows.map((row) => resultClassLabel(row, grade)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  chunks(divisions, 8).forEach((group) => slides.push({ type: "divisions", title: t.divisions, entries: group.map((division) => ({ division, ...resultAnalytics(rows.filter((row) => resultClassLabel(row, grade) === division), columns) })) }));
  RESULT_CATEGORIES.forEach((category, index) => {
    const members = rows.filter((row) => row.category.id === category.id).slice().sort((a, b) => (b.gradesSummary?.A || 0) - (a.gradesSummary?.A || 0) || a.studentName.localeCompare(b.studentName));
    slides.push({ type: "category", title: t.categoryLabels[index], count: members.length, rate: analytics.categories[index].rate, advice: t.advice[index] });
    const cards = members.flatMap((row) => {
      const subjects = columns.filter((column) => Object.prototype.hasOwnProperty.call(row.grades, column.key)).map((column) => ({ label: slideSubject(column, language), grade: row.grades[column.key] || "—", mark: row.grades[column.key] === "AB" ? "AB" : row.marksByColumn?.[column.key] ?? "—" }));
      // Other subject absences are explicitly shown as AB in the subject table.
      const notes = language === "en" ? row.category.notes.filter((note) => !note.endsWith(" absent") || ["Maths absent", "Tamil absent"].includes(note)) : [
        ...row.category.notes.filter((note) => TAMIL_NOTES[note]).map((note) => TAMIL_NOTES[note]),
      ];
      return chunks(subjects.length ? subjects : [{ label: "—", grade: "—", mark: "—" }], 9).map((subjectPage, part) => ({ id: row.student.id, name: row.studentName, division: resultClassLabel(row, grade), summary: row.summary, subjects: subjectPage, notes, continuation: part > 0 }));
    });
    chunks(cards, 2).forEach((entries) => slides.push({ type: "students", title: t.categoryLabels[index], entries }));
  });
  chunks(analytics.subjects, 6).forEach((entries) => slides.push({ type: "subjects", title: t.subjects, entries: entries.map((subject) => ({ ...subject, label: slideSubject(columns.find((column) => column.key === subject.key), language) })) }));
  slides.push({ type: "eligibility", title: t.verified, analytics }, { type: "actions", title: t.actions });
  return { slides, t, context, analytics, language, formatRate };
}
