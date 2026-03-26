export const SCHOOL_NAME = "Kilinochchi Central College";
export const SCHOOL_SUBTITLE = "Provincial Department of Education - Northern Province";

export const GRADES = [6, 7, 8, 9, 10, 11, 12, 13];
export const SECTIONS = ["A", "B", "C", "D"];
export const TERMS = ["Term 1", "Term 2", "Term 3"];
export const ACADEMIC_YEARS = ["2024", "2025", "2026", "2027"];

export const SUBJECTS_BY_GRADE = {
  6:  ["Tamil", "English", "Mathematics", "Science", "History", "Religion", "Geography", "Civics", "Art", "Music"],
  7:  ["Tamil", "English", "Mathematics", "Science", "History", "Religion", "Geography", "Civics", "Art", "Music"],
  8:  ["Tamil", "English", "Mathematics", "Science", "History", "Religion", "Geography", "Civics", "Art", "Music"],
  9:  ["Tamil", "English", "Mathematics", "Science", "History", "Religion", "Geography", "Civics", "Art", "Music"],
  10: ["Tamil", "English", "Mathematics", "Science", "History", "Religion", "ICT", "Health & PE", "Art", "Music"],
  11: ["Tamil", "English", "Mathematics", "Science", "History", "Religion", "ICT", "Health & PE", "Art", "Music"],
  12: ["Tamil", "English", "General English", "Subject 1", "Subject 2", "Subject 3"],
  13: ["Tamil", "English", "General English", "Subject 1", "Subject 2", "Subject 3"],
};

export const ASSESSMENT_TYPES = ["Class Test", "Mid-Term Exam", "Final Exam"];

export const getGradeLetter = (marks, grade) => {
  if (grade >= 10) {
    if (marks >= 75) return { letter: "A", desc: "Distinction" };
    if (marks >= 65) return { letter: "B", desc: "Very Good" };
    if (marks >= 55) return { letter: "C", desc: "Credit Pass" };
    if (marks >= 40) return { letter: "S", desc: "Simple Pass" };
    return { letter: "F", desc: "Failure" };
  } else {
    if (marks >= 75) return { letter: "A", desc: "Excellent" };
    if (marks >= 65) return { letter: "B", desc: "Good" };
    if (marks >= 55) return { letter: "C", desc: "Average" };
    if (marks >= 40) return { letter: "D", desc: "Below Average" };
    return { letter: "E", desc: "Fail" };
  }
};