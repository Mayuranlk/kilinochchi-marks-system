// src/utils/reportSchemas.js

export const ANALYSIS_BANDS = [
  { key: "0-10", min: 0, max: 10 },
  { key: "11-20", min: 11, max: 20 },
  { key: "21-30", min: 21, max: 30 },
  { key: "31-34", min: 31, max: 34 },
  { key: "35-40", min: 35, max: 40 },
  { key: "41-50", min: 41, max: 50 },
  { key: "51-60", min: 51, max: 60 },
  { key: "61-70", min: 61, max: 70 },
  { key: "71-80", min: 71, max: 80 },
  { key: "81-90", min: 81, max: 90 },
  { key: "91-100", min: 91, max: 100 },
];

export const RELIGION_REPORT_MAP = {
  Hinduism: "REL_SAIVAM",
  Christianity: "REL_NRC",
  Catholicism: "REL_RC",
  Islam: "REL_ISLAM",
};

export const REPORT_SCHEMA_6_TO_9 = {
  id: "6_TO_9",
  title: "Grades 6 to 9",
  groups: [
    {
      key: "religion",
      label: "Religion",
      columns: [
        {
          key: "REL_SAIVAM",
          label: "Saivam",
          aliases: ["Hinduism", "Saivam"],
        },
        {
          key: "REL_NRC",
          label: "NRC",
          aliases: ["Christianity", "NRC"],
        },
        {
          key: "REL_RC",
          label: "RC",
          aliases: ["Catholicism", "Roman Catholicism", "RC"],
        },
        {
          key: "REL_ISLAM",
          label: "Islam",
          aliases: ["Islam", "Muslim"],
        },
      ],
    },
    {
      key: "core",
      label: "",
      columns: [
        {
          key: "TAMIL",
          label: "Tamil",
          aliases: ["Tamil"],
        },
        {
          key: "SINHALA",
          label: "Sinhala",
          aliases: ["Sinhala"],
          includeInOverall: false,
        },
        {
          key: "MATHS",
          label: "Maths",
          aliases: ["Mathematics", "Maths"],
        },
        {
          key: "ENGLISH",
          label: "English",
          aliases: ["English"],
        },
        {
          key: "SCIENCE",
          label: "Science",
          aliases: ["Science"],
        },
        {
          key: "HISTORY",
          label: "History",
          aliases: ["History"],
        },
        {
          key: "GEOGRAPHY",
          label: "Geography",
          aliases: ["Geography"],
        },
        {
          key: "CIVICS",
          label: "CitiEduGove",
          aliases: ["Civics", "Civic Education"],
        },
        {
          key: "HEALTH",
          label: "Health",
          aliases: ["Health & Physical Education", "Health"],
        },
        {
          key: "PTS",
          label: "PTS",
          aliases: ["PTS"],
        },
      ],
    },
    {
      key: "aesthetic",
      label: "Basket - I",
      columns: [
        {
          key: "ART",
          label: "Art",
          aliases: ["Art"],
        },
        {
          key: "DANCE",
          label: "Dance",
          aliases: ["Dancing", "Dance"],
        },
        {
          key: "MUSIC",
          label: "Music",
          aliases: ["Music"],
        },
        {
          key: "DRAMA",
          label: "Drama",
          aliases: ["Drama & Theatre", "Drama and Theatre", "Drama"],
        },
      ],
    },
    {
      key: "other",
      label: "",
      columns: [
        {
          key: "ICT",
          label: "ICT",
          aliases: ["ICT"],
        },
      ],
    },
  ],
};

export const REPORT_SCHEMA_10_TO_11 = {
  id: "10_TO_11",
  title: "Grades 10 to 11",
  groups: [
    {
      key: "religion",
      label: "Religion",
      columns: [
        {
          key: "REL_SAIVAM",
          label: "Saivam",
          aliases: ["Hinduism", "Saivam"],
        },
        {
          key: "REL_NRC",
          label: "NRC",
          aliases: ["Christianity", "NRC"],
        },
        {
          key: "REL_RC",
          label: "RC",
          aliases: ["Catholicism", "Roman Catholicism", "RC"],
        },
        {
          key: "REL_ISLAM",
          label: "Islam",
          aliases: ["Islam", "Muslim"],
        },
      ],
    },
    {
      key: "core",
      label: "",
      columns: [
        {
          key: "TAMIL",
          label: "Tamil",
          aliases: ["Tamil"],
        },
        {
          key: "MATHS",
          label: "Maths",
          aliases: ["Mathematics", "Maths"],
        },
        {
          key: "ENGLISH",
          label: "English",
          aliases: ["English"],
        },
        {
          key: "SCIENCE",
          label: "Science",
          aliases: ["Science"],
        },
        {
          key: "HISTORY",
          label: "History",
          aliases: ["History"],
        },
      ],
    },
    {
      key: "basket1",
      label: "Basket - I",
      columns: [
        {
          key: "B1_CIV_GOV",
          label: "Citizenship & Gov",
          aliases: [
            "Civic Education",
            "Citizenship & Gov",
            "Citizenship and Governance",
          ],
        },
        {
          key: "B1_GEO",
          label: "Geography",
          aliases: ["Geography"],
        },
        {
          key: "B1_BAS",
          label: "Business& Acc",
          aliases: ["Business & Accounting Studies"],
        },
        {
          key: "B1_ENT",
          label: "Enterpreneurship Stu",
          aliases: ["Entrepreneurship Studies"],
        },
      ],
    },
    {
      key: "basket2",
      label: "Basket - II",
      columns: [
        {
          key: "B2_ART",
          label: "Art",
          aliases: ["Art"],
        },
        {
          key: "B2_DANCE",
          label: "Dance",
          aliases: ["Dancing (Bharata)", "Dancing", "Dance"],
        },
        {
          key: "B2_MUSIC",
          label: "Music",
          aliases: ["Music (Carnatic)", "Music"],
        },
        {
          key: "B2_DRAMA",
          label: "Drama & Theater",
          aliases: ["Drama and Theatre (Tamil)", "Drama & Theater", "Drama"],
        },
        {
          key: "B2_TAM_LIT",
          label: "Tamil Literature",
          aliases: ["Appreciation of Tamil Literary Texts", "Tamil Literature"],
        },
        {
          key: "B2_ENG_LIT",
          label: "Eng-Literature",
          aliases: ["Appreciation of English Literary Texts", "Eng-Literature"],
        },
      ],
    },
    {
      key: "basket3",
      label: "Basket - III",
      columns: [
        {
          key: "B3_AGRI",
          label: "Agriculture & Food Tec",
          aliases: ["Agriculture & Food Technology"],
        },
        {
          key: "B3_HPE",
          label: "Health & Phy",
          aliases: ["Health & Physical Education", "Health & Phy"],
        },
        {
          key: "B3_HOME",
          label: "Home economics",
          aliases: ["Home Economics"],
        },
        {
          key: "B3_ICT",
          label: "ICT",
          aliases: ["Information & Communication Technology", "ICT"],
        },
        {
          key: "B3_MEDIA",
          label: "Com & Media Studies",
          aliases: ["Communication & Media Studies"],
        },
        {
          key: "B3_DCT",
          label: "Design & Const Tec",
          aliases: ["Design & Construction Technology"],
        },
        {
          key: "B3_DMT",
          label: "Design& Mech Tec",
          aliases: ["Design & Mechanical Technology"],
        },
        {
          key: "B3_DEET",
          label: "Design & Elect Tec",
          aliases: ["Design, Electrical & Electronic Technology"],
        },
      ],
    },
  ],
};

export function getReportSchemaByGrade(grade) {
  const numericGrade = Number(grade);

  if (numericGrade >= 6 && numericGrade <= 9) {
    return REPORT_SCHEMA_6_TO_9;
  }

  if (numericGrade >= 10 && numericGrade <= 11) {
    return REPORT_SCHEMA_10_TO_11;
  }

  return null;
}

export function flattenSchemaColumns(schema) {
  if (!schema || !Array.isArray(schema.groups)) return [];
  return schema.groups.flatMap((group) => group.columns || []);
}

export function getColumnsIncludedInOverall(schema) {
  return flattenSchemaColumns(schema).filter((column) => column.includeInOverall !== false);
}

export function getColumnsExcludedFromOverall(schema) {
  return flattenSchemaColumns(schema).filter((column) => column.includeInOverall === false);
}

export function getOverallExclusionNote(schema) {
  const excludedColumns = getColumnsExcludedFromOverall(schema);

  if (excludedColumns.length === 0) return "";

  const labels = excludedColumns.map((column) => column.label).join(", ");
  return excludedColumns.length === 1
    ? `${labels} is not included in Total and Ranking.`
    : `${labels} are not included in Total and Ranking.`;
}
