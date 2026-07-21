import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "Kilinochchi Central College Marks System";
const DEFAULT_TITLE = SITE_NAME;
const DEFAULT_DESCRIPTION =
  "Kilinochchi Central College marks management and live marks completion status system for teachers, sectional heads, and school administration.";

const ROUTE_META = [
  {
    match: /^\/marks-status-live\/?$/,
    title: "Live Marks Status | Kilinochchi Central College",
    description:
      "Public live marks completion board showing class and subject status in green, yellow, and red for Kilinochchi Central College.",
  },
  {
    match: /^\/election-live\/?$/,
    title: "Live Election Results | Kilinochchi Central College",
    description:
      "Public live student election results board for Kilinochchi Central College.",
  },
  {
    match: /^\/login\/?$/,
    title: "Staff Login | Kilinochchi Marks System",
    description:
      "Secure staff login for Kilinochchi Central College marks entry, reports, and academic administration.",
  },
  {
    match: /^\/teacher\/marks\/?$/,
    title: "Teacher Marks Entry | Kilinochchi Marks System",
    description:
      "Teacher marks entry workspace for assigned classes and subjects at Kilinochchi Central College.",
  },
  {
    match: /^\/teacher\/sba\/?$/,
    title: "Teacher SBA Entry | Kilinochchi Marks System",
    description:
      "Teacher SBA entry workspace for Kilinochchi Central College assigned subjects and classes.",
  },
  {
    match: /^\/teacher\/class-report\/?$/,
    title: "Class Teacher Report | Kilinochchi Marks System",
    description:
      "Class teacher report view for reviewing class marks and student performance at Kilinochchi Central College.",
  },
  {
    match: /^\/teacher\/?$/,
    title: "Teacher Dashboard | Kilinochchi Marks System",
    description:
      "Teacher dashboard for marks entry progress, assigned subjects, and class teacher responsibilities.",
  },
  {
    match: /^\/sectional-head\/class-completion-report\/?$/,
    title: "Sectional Class Completion | Kilinochchi Marks System",
    description:
      "Sectional head class completion report for tracking marks entry progress by assigned grades.",
  },
  {
    match: /^\/sectional-head\/class-marks-reports\/?$/,
    title: "Sectional Class Marks Reports | Kilinochchi Marks System",
    description:
      "Sectional head class marks report workspace for assigned grades at Kilinochchi Central College.",
  },
  {
    match: /^\/sectional-head\/subject-analysis\/?$/,
    title: "Sectional Subject Analysis | Kilinochchi Marks System",
    description:
      "Sectional head subject analysis for reviewing subject performance and completion trends.",
  },
  {
    match: /^\/sectional-head\/?$/,
    title: "Sectional Head Dashboard | Kilinochchi Marks System",
    description:
      "Sectional head dashboard for tracking assigned grade reports, completion, and class performance.",
  },
  {
    match: /^\/class-completion-report\/?$/,
    title: "Class Completion Report | Kilinochchi Marks System",
    description:
      "Whole-school class completion report showing marks entry readiness, missing marks, and subject progress.",
  },
  {
    match: /^\/class-marks-reports\/?$/,
    title: "Class Marks Reports | Kilinochchi Marks System",
    description:
      "Class marks reports for reviewing, exporting, and sharing student marks by class, term, and year.",
  },
  {
    match: /^\/teacher-mark-sheets\/?$/,
    title: "Teacher Mark Sheets | Kilinochchi Marks System",
    description:
      "Generate printable teacher mark sheets by class, subject, term, and academic year.",
  },
  {
    match: /^\/subject-analysis\/?$/,
    title: "Subject Analysis | Kilinochchi Marks System",
    description:
      "Subject analysis dashboard for reviewing performance, completion, and academic trends.",
  },
  {
    match: /^\/assignments\/?$/,
    title: "Teacher Assignments | Kilinochchi Marks System",
    description:
      "Assign teachers to subjects and classes with quick class search and bulk assignment tools.",
  },
  {
    match: /^\/teachers\/?$/,
    title: "Manage Teachers | Kilinochchi Marks System",
    description:
      "Manage teacher accounts, class teacher roles, transfers, and staff login message sharing.",
  },
  {
    match: /^\/class-teachers\/?$/,
    title: "Class Teacher Assignments | Kilinochchi Marks System",
    description:
      "Assign and manage class teacher responsibilities for Kilinochchi Central College classrooms.",
  },
  {
    match: /^\/students\/?$/,
    title: "Student Management | Kilinochchi Marks System",
    description:
      "Manage student records, class data, and academic details for Kilinochchi Central College.",
  },
  {
    match: /^\/classrooms\/?$/,
    title: "Classroom Management | Kilinochchi Marks System",
    description:
      "Create and manage classrooms, sections, streams, and academic year class records.",
  },
  {
    match: /^\/subjects\/?$/,
    title: "Subject Management | Kilinochchi Marks System",
    description:
      "Manage school subjects, subject numbers, grade applicability, and stream settings.",
  },
  {
    match: /^\/marks\/?$/,
    title: "Admin Marks Entry | Kilinochchi Marks System",
    description:
      "Administrative marks entry workspace for class, subject, term, and year records.",
  },
  {
    match: /^\/sba\/?$/,
    title: "SBA Entry | Kilinochchi Marks System",
    description:
      "School-based assessment entry workspace for Kilinochchi Central College.",
  },
  {
    match: /^\/marks-upload\/?$/,
    title: "Bulk Marks Upload | Kilinochchi Marks System",
    description:
      "Upload marks in bulk and validate imported academic marks records.",
  },
  {
    match: /^\/election-count\/?$/,
    title: "Election Count | Kilinochchi Marks System",
    description:
      "Administrative student election counting workspace for live public result publishing.",
  },
  {
    match: /^\/$/,
    title: "Admin Dashboard | Kilinochchi Marks System",
    description:
      "Administrative dashboard for Kilinochchi Central College marks, students, teachers, and reports.",
  },
];

function setMetaByName(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setMetaByProperty(property, content) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export default function PageMeta() {
  const { pathname } = useLocation();

  const meta = useMemo(
    () =>
      ROUTE_META.find((item) => item.match.test(pathname)) || {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      },
    [pathname]
  );

  useEffect(() => {
    document.title = meta.title;
    setMetaByName("description", meta.description);
    setMetaByName("twitter:title", meta.title);
    setMetaByName("twitter:description", meta.description);
    setMetaByProperty("og:title", meta.title);
    setMetaByProperty("og:description", meta.description);
  }, [meta]);

  return null;
}
