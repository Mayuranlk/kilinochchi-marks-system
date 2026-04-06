// src/utils/reportSchemas.js

export const MARK_BANDS = [
  { key: "0-10", label: "0-10", min: 0, max: 10 },
  { key: "11-20", label: "11-20", min: 11, max: 20 },
  { key: "21-30", label: "21-30", min: 21, max: 30 },
  { key: "31-34", label: "31-34", min: 31, max: 34 },
  { key: "35-40", label: "35-40", min: 35, max: 40 },
  { key: "41-50", label: "41-50", min: 41, max: 50 },
  { key: "51-60", label: "51-60", min: 51, max: 60 },
  { key: "61-70", label: "61-70", min: 61, max: 70 },
  { key: "71-80", label: "71-80", min: 71, max: 80 },
  { key: "81-90", label: "81-90", min: 81, max: 90 },
  { key: "91-100", label: "91-100", min: 91, max: 100 },
];

export const RELIGION_COLUMN_KEYS = [
  "REL_SAIVAM",
  "REL_NRC",
  "REL_RC",
  "REL_ISLAM",
];

export const SUMMARY_COLUMN_KEYS = ["TOTAL", "AVERAGE", "RANK"];

export const REPORT_SCHEMA_6_TO_9 = {
  key: "6_TO_9",
  gradeMin: 6,
  gradeMax: 9,
  scheduleTitle: "KN/Kilinochchi Central College - Mark Schedule",
  analysisTitle: "KN/Kilinochchi Central College - Mark Analysis",
  analysisRowLabel: "Students's Total",
  fixedColumns: [
    { key: "NO", label: "No", width: 28, type: "meta" },
    { key: "STUDENT_ID", label: "Student ID", width: 58, type: "meta" },
    { key: "INDEX_NO", label: "Index No", width: 48, type: "meta" },
    { key: "STUDENT_NAME", label: "Students Name", width: 130, type: "meta" },
  ],
  reportColumns: [
    {
      key: "REL_SAIVAM",
      label: "Saivam",
      group: "Religion",
      category: "religion",
      subjectIds: ["religion_rel_hind"],
      aliases: ["Hinduism", "Saivam", "Saiva Samayam"],
    },
    {
      key: "REL_NRC",
      label: "NRC",
      group: "Religion",
      category: "religion",
      aliases: ["Christianity", "NRC", "Non Roman Catholic"],
    },
    {
      key: "REL_RC",
      label: "RC",
      group: "Religion",
      category: "religion",
      aliases: ["Catholicism", "Roman Catholicism", "RC", "Roman Catholic"],
    },
    {
      key: "REL_ISLAM",
      label: "Islam",
      group: "Religion",
      category: "religion",
      aliases: ["Islam", "Muslim"],
    },

    {
      key: "TAMIL",
      label: "Tamil",
      group: "Core",
      category: "core",
      subjectIds: ["core_tam"],
      aliases: ["Tamil"],
    },
    {
      key: "MATHS",
      label: "Maths",
      group: "Core",
      category: "core",
      subjectIds: ["core_mat"],
      aliases: ["Mathematics", "Maths", "Math"],
    },
    {
      key: "ENGLISH",
      label: "English",
      group: "Core",
      category: "core",
      subjectIds: ["core_eng"],
      aliases: ["English"],
    },
    {
      key: "SCIENCE",
      label: "Science",
      group: "Core",
      category: "core",
      subjectIds: ["core_sci"],
      aliases: ["Science"],
    },
    {
      key: "HISTORY",
      label: "History",
      group: "Core",
      category: "core",
      subjectIds: ["core_his"],
      aliases: ["History"],
    },
    {
      key: "GEOGRAPHY",
      label: "Geography",
      group: "Core",
      category: "core",
      subjectIds: ["core_geo"],
      aliases: ["Geography"],
    },
    {
      key: "CIVICS",
      label: "CitiEduGove",
      group: "Core",
      category: "core",
      subjectIds: ["core_civ"],
      aliases: ["Civics", "Civic Education", "Citizenship & Gov"],
    },
    {
      key: "HEALTH",
      label: "Health",
      group: "Core",
      category: "core",
      subjectIds: ["core_hpe"],
      aliases: ["Health & Physical Education", "Health", "Health & Phy"],
    },
    {
      key: "PTS",
      label: "PTS",
      group: "Core",
      category: "core",
      subjectIds: ["core_pts"],
      aliases: ["PTS"],
    },

    {
      key: "ART",
      label: "Art",
      group: "Basket - I",
      category: "aesthetic",
      subjectIds: ["aesthetic_aes_art"],
      aliases: ["Art"],
    },
    {
      key: "DANCE",
      label: "Dance",
      group: "Basket - I",
      category: "aesthetic",
      subjectIds: ["aesthetic_aes_dancing"],
      aliases: ["Dancing", "Dance"],
    },
    {
      key: "MUSIC",
      label: "Music",
      group: "Basket - I",
      category: "aesthetic",
      subjectIds: ["aesthetic_aes_music"],
      aliases: ["Music"],
    },
    {
      key: "DRAMA",
      label: "Drama",
      group: "Basket - I",
      category: "aesthetic",
      subjectIds: ["aesthetic_aes_drama"],
      aliases: ["Drama & Theatre", "Drama and Theatre", "Drama"],
    },

    {
      key: "ICT",
      label: "ICT",
      group: "Core",
      category: "core",
      subjectIds: ["core_ict"],
      aliases: ["ICT", "Information & Communication Technology"],
    },
  ],
  summaryColumns: [
    { key: "TOTAL", label: "Total", width: 48, type: "summary" },
    { key: "RANK", label: "Rank", width: 40, type: "summary" },
  ],
};

export const REPORT_SCHEMA_10_TO_11 = {
  key: "10_TO_11",
  gradeMin: 10,
  gradeMax: 11,
  scheduleTitle: "KN/Kilinochchi Central College - Mark Schedule",
  analysisTitle: "KN/Kilinochchi Central College - Mark Analysis",
  analysisRowLabel: "Students's Total",
  fixedColumns: [
    { key: "NO", label: "No", width: 28, type: "meta" },
    { key: "STUDENT_ID", label: "Student ID", width: 58, type: "meta" },
    { key: "INDEX_NO", label: "Index No", width: 48, type: "meta" },
    { key: "STUDENT_NAME", label: "Students Name", width: 130, type: "meta" },
  ],
  reportColumns: [
    {
      key: "REL_SAIVAM",
      label: "Saivam",
      group: "Religion",
      category: "religion",
      aliases: ["Hinduism", "Saivam", "Saiva Samayam"],
    },
    {
      key: "REL_NRC",
      label: "NRC",
      group: "Religion",
      category: "religion",
      aliases: ["Christianity", "NRC", "Non Roman Catholic"],
    },
    {
      key: "REL_RC",
      label: "RC",
      group: "Religion",
      category: "religion",
      aliases: ["Catholicism", "Roman Catholicism", "RC", "Roman Catholic"],
    },
    {
      key: "REL_ISLAM",
      label: "Islam",
      group: "Religion",
      category: "religion",
      aliases: ["Islam", "Muslim"],
    },

    {
      key: "TAMIL",
      label: "Tamil",
      group: "Core",
      category: "core",
      subjectIds: ["core_tam"],
      aliases: ["Tamil"],
    },
    {
      key: "MATHS",
      label: "Maths",
      group: "Core",
      category: "core",
      subjectIds: ["core_mat"],
      aliases: ["Mathematics", "Maths", "Math"],
    },
    {
      key: "ENGLISH",
      label: "English",
      group: "Core",
      category: "core",
      subjectIds: ["core_eng"],
      aliases: ["English"],
    },
    {
      key: "SCIENCE",
      label: "Science",
      group: "Core",
      category: "core",
      subjectIds: ["core_sci"],
      aliases: ["Science"],
    },
    {
      key: "HISTORY",
      label: "History",
      group: "Core",
      category: "core",
      subjectIds: ["core_his"],
      aliases: ["History"],
    },

    {
      key: "B1_CIV_GOV",
      label: "Citizenship & Gov",
      group: "Basket - I",
      category: "basket",
      basketLabel: "A",
      subjectIds: ["basket_civ_edu"],
      aliases: ["Civic Education", "Citizenship & Gov", "Citizenship and Governance"],
    },
    {
      key: "B1_GEO",
      label: "Geography",
      group: "Basket - I",
      category: "basket",
      basketLabel: "A",
      subjectIds: ["basket_geo_bkt"],
      aliases: ["Geography"],
    },
    {
      key: "B1_BAS",
      label: "Business& Acc",
      group: "Basket - I",
      category: "basket",
      basketLabel: "A",
      subjectIds: ["basket_bas"],
      aliases: ["Business & Accounting Studies", "Business& Acc"],
    },
    {
      key: "B1_ENT",
      label: "Enterpreneurship Stu",
      group: "Basket - I",
      category: "basket",
      basketLabel: "A",
      subjectIds: ["basket_ent"],
      aliases: ["Entrepreneurship Studies", "Enterpreneurship Stu"],
    },

    {
      key: "B2_ART",
      label: "Art",
      group: "Basket - II",
      category: "basket",
      basketLabel: "B",
      subjectIds: ["basket_art_bkt"],
      aliases: ["Art"],
    },
    {
      key: "B2_DANCE",
      label: "Dance",
      group: "Basket - II",
      category: "basket",
      basketLabel: "B",
      subjectIds: ["basket_dan_bha"],
      aliases: ["Dancing (Bharata)", "Dance", "Dancing"],
    },
    {
      key: "B2_MUSIC",
      label: "Music",
      group: "Basket - II",
      category: "basket",
      basketLabel: "B",
      aliases: ["Music (Carnatic)", "Music (Carnatic) (Carnatic)", "Music"],
    },
    {
      key: "B2_DRAMA",
      label: "Drama & Theater",
      group: "Basket - II",
      category: "basket",
      basketLabel: "B",
      subjectIds: ["basket_drama_tam"],
      aliases: ["Drama and Theatre (Tamil)", "Drama & Theater"],
    },
    {
      key: "B2_TAM_LIT",
      label: "Tamil Literature",
      group: "Basket - II",
      category: "basket",
      basketLabel: "B",
      aliases: ["Appreciation of Tamil Literary Texts", "Tamil Literature"],
    },
    {
      key: "B2_ENG_LIT",
      label: "Eng-Literature",
      group: "Basket - II",
      category: "basket",
      basketLabel: "B",
      subjectIds: ["basket_eng_lit"],
      aliases: ["Appreciation of English Literary Texts", "Eng-Literature"],
    },

    {
      key: "B3_AGRI",
      label: "Agriculture & Food Tec",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_agr_ft"],
      aliases: ["Agriculture & Food Technology"],
    },
    {
      key: "B3_HPE",
      label: "Health & Phy",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_hpe_bkt"],
      aliases: ["Health & Physical Education", "Health & Phy"],
    },
    {
      key: "B3_HOME",
      label: "Home economics",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_home"],
      aliases: ["Home Economics", "Home economics"],
    },
    {
      key: "B3_ICT",
      label: "ICT",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_ict_full"],
      aliases: ["Information & Communication Technology", "ICT"],
    },
    {
      key: "B3_MEDIA",
      label: "Com & Media Studies",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_media"],
      aliases: ["Communication & Media Studies", "Com & Media Studies"],
    },
    {
      key: "B3_DCT",
      label: "Design & Const Tec",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_dct"],
      aliases: ["Design & Construction Technology", "Design & Const Tec"],
    },
    {
      key: "B3_DMT",
      label: "Design& Mech Tec",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_dmt"],
      aliases: ["Design & Mechanical Technology", "Design& Mech Tec"],
    },
    {
      key: "B3_DEET",
      label: "Design & Elect Tec",
      group: "Basket - III",
      category: "basket",
      basketLabel: "C",
      subjectIds: ["basket_deet"],
      aliases: ["Design, Electrical & Electronic Technology", "Design & Elect Tec"],
    },
  ],
  summaryColumns: [
    { key: "TOTAL", label: "Total", width: 48, type: "summary" },
    { key: "AVERAGE", label: "Average", width: 48, type: "summary" },
    { key: "RANK", label: "Rank", width: 40, type: "summary" },
  ],
};

export const getReportSchemaForGrade = (grade) => {
  if (grade >= 6 && grade <= 9) return REPORT_SCHEMA_6_TO_9;
  if (grade >= 10 && grade <= 11) return REPORT_SCHEMA_10_TO_11;
  return null;
};

export const getAllDisplayColumns = (schema) => [
  ...schema.fixedColumns,
  ...schema.reportColumns,
  ...schema.summaryColumns,
];

export const getReportGroups = (schema) => {
  const groups = [];
  let current = null;

  schema.reportColumns.forEach((col) => {
    if (!current || current.label !== col.group) {
      current = {
        label: col.group,
        columns: [col],
      };
      groups.push(current);
    } else {
      current.columns.push(col);
    }
  });

  return groups;
};