import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import * as XLSX from "xlsx";
import {
  RELIGIONS,
  MEDIUM_OPTIONS,
  normalizeText,
  normalizeLower,
  isALGrade,
  buildALClassName,
  buildALDisplayClassName,
  AL_STREAM_OPTIONS,
  AL_STREAM_CODES,
  getALOptionalSubjectsForStream,
  validateALChoices,
  convertALChoiceNumbersToSubjects,
  convertALChoiceNamesToSubjects,
} from "../constants";

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const STUDENT_STATUSES = ["Active", "Left", "Graduated", "Suspended"];
const GENDERS = ["Male", "Female", "Other"];

const emptyForm = {
  name: "",
  admissionNo: "",
  grade: "",
  section: "",
  gender: "",
  dob: "",
  status: "Active",
  joinDate: "",
  religion: "",
  aestheticChoice: "",
  basketAChoice: "",
  basketBChoice: "",
  basketCChoice: "",
  stream: "",
  streamCode: "",
  alClassName: "",
  alSubjectChoiceNumbers: [],
  alSubjectChoices: [],
  medium: "",
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const normalizeGradeValue = (value) => {
  const raw = normalizeText(value);
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const normalizeSectionValue = (value) => {
  const raw = normalizeText(value).toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
};

const sortStudentsClientSide = (list) => {
  return [...list].sort((a, b) => {
    const gradeA = Number(a.grade) || 0;
    const gradeB = Number(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;

    const sectionA = normalizeSectionValue(a.section || a.className);
    const sectionB = normalizeSectionValue(b.section || b.className);
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

    const streamA = normalizeText(a.stream);
    const streamB = normalizeText(b.stream);
    if (streamA !== streamB) return streamA.localeCompare(streamB);

    const nameA = normalizeText(a.name || a.fullName).toLowerCase();
    const nameB = normalizeText(b.name || b.fullName).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return normalizeText(a.admissionNo).localeCompare(normalizeText(b.admissionNo), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
};

const isJuniorGrade = (grade) => {
  const g = Number(grade);
  return g >= 6 && g <= 9;
};

const isOLGrade = (grade) => {
  const g = Number(grade);
  return g >= 10 && g <= 11;
};

const shouldShowReligion = (grade) => {
  const g = Number(grade);
  return g >= 6 && g <= 11;
};

const shouldShowAesthetic = (grade) => isJuniorGrade(grade);
const shouldShowBasketChoices = (grade) => isOLGrade(grade);
const shouldShowALFields = (grade) => isALGrade(grade);

const sectionCardSx = {
  border: "1px solid #e8eaf6",
  borderRadius: 3,
  boxShadow: "none",
  height: "100%",
};

const subjectDisplayName = (subject) =>
  normalizeText(subject.name || subject.subjectName || subject.shortName);

const subjectCategory = (subject) => normalizeLower(subject.category);
const subjectReligion = (subject) => normalizeText(subject.religion);
const subjectBasketGroup = (subject) =>
  normalizeText(subject.basketGroup || "").toUpperCase();

const isActiveSubject = (subject) =>
  normalizeLower(subject.status || "active") === "active";

const subjectSupportsGrade = (subject, grade) => {
  const g = Number(grade);
  if (!g) return false;

  if (Array.isArray(subject.grades) && subject.grades.length > 0) {
    return subject.grades.map(Number).includes(g);
  }

  const minGrade = normalizeGradeValue(subject.minGrade);
  const maxGrade = normalizeGradeValue(subject.maxGrade);

  if (minGrade && maxGrade) {
    return g >= minGrade && g <= maxGrade;
  }
  if (minGrade && !maxGrade) {
    return g >= minGrade;
  }
  if (!minGrade && maxGrade) {
    return g <= maxGrade;
  }

  return true;
};

const statusColor = (status) => {
  if (status === "Active") return "success";
  if (status === "Left") return "error";
  if (status === "Graduated") return "primary";
  return "warning";
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const getStudentName = (student) => student.name || student.fullName || "";

const buildALMetadata = (grade, stream, section) => {
  if (!isALGrade(grade)) {
    return {
      stream: "",
      streamCode: "",
      alClassName: "",
    };
  }

  const cleanStream = normalizeText(stream);
  const cleanSection = normalizeSectionValue(section);

  return {
    stream: cleanStream,
    streamCode: AL_STREAM_CODES[cleanStream] || "",
    alClassName: buildALClassName(grade, cleanStream, cleanSection),
  };
};

const deriveALChoiceNumbersFromNames = (choiceNames = []) => {
  return convertALChoiceNamesToSubjects(choiceNames).map((subject) => subject.subjectNumber);
};

const deriveALChoiceNamesFromNumbers = (choiceNumbers = []) => {
  return convertALChoiceNumbersToSubjects(choiceNumbers).map((subject) => subject.subjectName);
};

const dedupeTextArray = (items = []) =>
  [...new Set((items || []).map(normalizeText).filter(Boolean))];

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function Students() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fileInputRef = useRef();

  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState(null);

  const classroomLookup = useMemo(() => {
    const map = new Set();
    classrooms.forEach((c) => {
      const grade = normalizeGradeValue(c.grade);
      const section = normalizeSectionValue(c.section || c.className);
      const stream = normalizeText(c.stream);

      if (grade && section) {
        map.add(`${grade}__${section}`);
        if (isALGrade(grade) && stream) {
          map.add(`${grade}__${section}__${stream}`);
        }
      }
    });
    return map;
  }, [classrooms]);

  const gradeOptions = useMemo(() => {
    return [...new Set(
      classrooms
        .map((c) => normalizeGradeValue(c.grade))
        .filter(Boolean)
    )].sort((a, b) => a - b);
  }, [classrooms]);

  const sectionOptionsForFilter = useMemo(() => {
    if (filterGrade) {
      return [
        ...new Set(
          classrooms
            .filter((c) => normalizeGradeValue(c.grade) === Number(filterGrade))
            .map((c) => normalizeSectionValue(c.section || c.className))
            .filter(Boolean)
        ),
      ].sort();
    }

    return [
      ...new Set(
        classrooms
          .map((c) => normalizeSectionValue(c.section || c.className))
          .filter(Boolean)
      ),
    ].sort();
  }, [classrooms, filterGrade]);

  const sectionOptionsForForm = useMemo(() => {
    if (!form.grade) return [];
    return [
      ...new Set(
        classrooms
          .filter((c) => normalizeGradeValue(c.grade) === Number(form.grade))
          .map((c) => normalizeSectionValue(c.section || c.className))
          .filter(Boolean)
      ),
    ].sort();
  }, [classrooms, form.grade]);

  const activeSubjects = useMemo(() => {
    return subjects.filter(isActiveSubject);
  }, [subjects]);

  const aestheticOptions = useMemo(() => {
    const grade = Number(form.grade);
    if (!shouldShowAesthetic(grade)) return [];

    return activeSubjects
      .filter(
        (s) =>
          subjectCategory(s) === "aesthetic" &&
          subjectSupportsGrade(s, grade)
      )
      .sort((a, b) => subjectDisplayName(a).localeCompare(subjectDisplayName(b)));
  }, [activeSubjects, form.grade]);

  const religionSubjectOptions = useMemo(() => {
    const grade = Number(form.grade);
    if (!shouldShowReligion(grade)) return RELIGIONS;

    const fromSubjects = activeSubjects
      .filter(
        (s) =>
          subjectCategory(s) === "religion" &&
          subjectSupportsGrade(s, grade) &&
          subjectReligion(s)
      )
      .map((s) => subjectReligion(s));

    const combined = [...new Set([...RELIGIONS, ...fromSubjects].filter(Boolean))];
    return combined;
  }, [activeSubjects, form.grade]);

  const basketOptions = useMemo(() => {
    const grade = Number(form.grade);
    if (!shouldShowBasketChoices(grade)) {
      return { A: [], B: [], C: [] };
    }

    const categoryMap = {
      A: "basket_a",
      B: "basket_b",
      C: "basket_c",
    };

    const sortByName = (list) =>
      [...list].sort((a, b) => subjectDisplayName(a).localeCompare(subjectDisplayName(b)));

    return {
      A: sortByName(
        activeSubjects.filter(
          (s) =>
            subjectSupportsGrade(s, grade) &&
            (subjectCategory(s) === categoryMap.A || subjectBasketGroup(s) === "A")
        )
      ),
      B: sortByName(
        activeSubjects.filter(
          (s) =>
            subjectSupportsGrade(s, grade) &&
            (subjectCategory(s) === categoryMap.B || subjectBasketGroup(s) === "B")
        )
      ),
      C: sortByName(
        activeSubjects.filter(
          (s) =>
            subjectSupportsGrade(s, grade) &&
            (subjectCategory(s) === categoryMap.C || subjectBasketGroup(s) === "C")
        )
      ),
    };
  }, [activeSubjects, form.grade]);

  const alMainSubjectOptions = useMemo(() => {
    const grade = Number(form.grade);
    if (!shouldShowALFields(grade)) return [];

    const stream = normalizeText(form.stream);

    return activeSubjects
      .filter((s) => {
        if (!subjectSupportsGrade(s, grade)) return false;

        const category = subjectCategory(s);
        if (category !== "al_main" && category !== "al") return false;

        if (!stream) return true;

        const primaryStream = normalizeText(s.stream);
        const additionalStreams = Array.isArray(s.streams)
          ? s.streams.map(normalizeText).filter(Boolean)
          : [];

        const allStreams = [...new Set([primaryStream, ...additionalStreams].filter(Boolean))];
        if (allStreams.length === 0) return true;

        return allStreams.includes(stream);
      })
      .sort((a, b) => subjectDisplayName(a).localeCompare(subjectDisplayName(b)));
  }, [activeSubjects, form.grade, form.stream]);

  const alOptionalChoiceOptions = useMemo(() => {
    const grade = Number(form.grade);
    if (!shouldShowALFields(grade) || !normalizeText(form.stream)) return [];

    return getALOptionalSubjectsForStream(form.stream);
  }, [form.grade, form.stream]);

  const enrollmentWarnings = useMemo(() => {
    const grade = Number(form.grade);
    const warnings = [];

    if (shouldShowAesthetic(grade) && aestheticOptions.length === 0) {
      warnings.push("No active aesthetic subjects found for this grade.");
    }

    if (shouldShowBasketChoices(grade)) {
      if (basketOptions.A.length === 0) warnings.push("No Basket A subjects found for this grade.");
      if (basketOptions.B.length === 0) warnings.push("No Basket B subjects found for this grade.");
      if (basketOptions.C.length === 0) warnings.push("No Basket C subjects found for this grade.");
    }

    if (shouldShowALFields(grade)) {
      if (!normalizeText(form.stream)) {
        warnings.push("Select an A/L stream to load the correct subject choices.");
      } else if (alMainSubjectOptions.length === 0) {
        warnings.push("No active A/L subjects found for the selected stream and grade.");
      }
    }

    return warnings;
  }, [form.grade, form.stream, aestheticOptions, basketOptions, alMainSubjectOptions]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilterSection("");
  }, [filterGrade]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studSnap, classSnap, subjectSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classrooms")),
        getDocs(collection(db, "subjects")),
      ]);

      const loadedStudents = studSnap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          name: raw.name || raw.fullName || "",
          fullName: raw.fullName || raw.name || "",
          section: raw.section || raw.className || "",
          className: raw.className || raw.section || "",
          religion: raw.religion || "",
          aestheticChoice: raw.aestheticChoice || raw.aesthetic || "",
          basketAChoice: raw.basketAChoice || raw.basket1 || "",
          basketBChoice: raw.basketBChoice || raw.basket2 || "",
          basketCChoice: raw.basketCChoice || raw.basket3 || "",
          alSubjectChoiceNumbers: Array.isArray(raw.alSubjectChoiceNumbers)
            ? raw.alSubjectChoiceNumbers
            : [],
          alSubjectChoices: Array.isArray(raw.alSubjectChoices)
            ? raw.alSubjectChoices
            : [],
          stream: raw.stream || "",
          streamCode: raw.streamCode || "",
          alClassName: raw.alClassName || "",
          status: raw.status || "Active",
        };
      });

      const loadedSubjects = subjectSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        grades: Array.isArray(d.data().grades)
          ? d.data().grades.map(Number)
          : [],
      }));

      setStudents(sortStudentsClientSide(loadedStudents));
      setClassrooms(classSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSubjects(loadedSubjects);
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isValidClassroom = (grade, section, stream = "") => {
    if (!grade || !section) return false;

    const g = Number(grade);
    const s = normalizeSectionValue(section);
    const st = normalizeText(stream);

    if (isALGrade(g) && st) {
      if (classroomLookup.has(`${g}__${s}__${st}`)) return true;
    }

    return classroomLookup.has(`${g}__${s}`);
  };

  const cleanFormByGrade = (data) => {
    const grade = Number(data.grade);

    const cleaned = {
      ...data,
      religion: shouldShowReligion(grade) ? normalizeText(data.religion) : "",
      aestheticChoice: shouldShowAesthetic(grade) ? normalizeText(data.aestheticChoice) : "",
      basketAChoice: shouldShowBasketChoices(grade) ? normalizeText(data.basketAChoice) : "",
      basketBChoice: shouldShowBasketChoices(grade) ? normalizeText(data.basketBChoice) : "",
      basketCChoice: shouldShowBasketChoices(grade) ? normalizeText(data.basketCChoice) : "",
      stream: shouldShowALFields(grade) ? normalizeText(data.stream) : "",
      medium: normalizeText(data.medium),
    };

    if (shouldShowALFields(grade)) {
      const choiceNumbers = dedupeTextArray(data.alSubjectChoiceNumbers || []);
      const choiceNames = dedupeTextArray(
        choiceNumbers.length > 0
          ? deriveALChoiceNamesFromNumbers(choiceNumbers)
          : data.alSubjectChoices || []
      );

      const alMeta = buildALMetadata(grade, cleaned.stream, data.section);

      return {
        ...cleaned,
        ...alMeta,
        alSubjectChoiceNumbers: choiceNumbers.length > 0 ? choiceNumbers : deriveALChoiceNumbersFromNames(choiceNames),
        alSubjectChoices: choiceNames,
      };
    }

    return {
      ...cleaned,
      stream: "",
      streamCode: "",
      alClassName: "",
      alSubjectChoiceNumbers: [],
      alSubjectChoices: [],
    };
  };

  const buildPayloadFromForm = () => {
    const cleaned = cleanFormByGrade(form);
    const grade = Number(cleaned.grade);
    const section = normalizeSectionValue(cleaned.section);
    const alMeta = buildALMetadata(grade, cleaned.stream, section);

    return {
      name: normalizeText(cleaned.name),
      fullName: normalizeText(cleaned.name),

      admissionNo: normalizeText(cleaned.admissionNo),

      grade,
      section,
      className: section,

      gender: normalizeText(cleaned.gender),
      dob: normalizeText(cleaned.dob),
      status: normalizeText(cleaned.status) || "Active",
      joinDate: normalizeText(cleaned.joinDate),

      religion: normalizeText(cleaned.religion),

      aesthetic: normalizeText(cleaned.aestheticChoice),
      aestheticChoice: normalizeText(cleaned.aestheticChoice),

      basket1: normalizeText(cleaned.basketAChoice),
      basket2: normalizeText(cleaned.basketBChoice),
      basket3: normalizeText(cleaned.basketCChoice),

      basketAChoice: normalizeText(cleaned.basketAChoice),
      basketBChoice: normalizeText(cleaned.basketBChoice),
      basketCChoice: normalizeText(cleaned.basketCChoice),

      stream: alMeta.stream,
      streamCode: alMeta.streamCode,
      alClassName: alMeta.alClassName,

      alSubjectChoiceNumbers: Array.isArray(cleaned.alSubjectChoiceNumbers)
        ? cleaned.alSubjectChoiceNumbers
        : [],
      alSubjectChoices: Array.isArray(cleaned.alSubjectChoices)
        ? cleaned.alSubjectChoices
        : [],

      medium: normalizeText(cleaned.medium),

      updatedAt: new Date().toISOString(),
    };
  };

  const validateAdmissionNoUniqueness = () => {
    const admissionNo = normalizeLower(form.admissionNo);
    if (!admissionNo) return "";

    const duplicate = students.find((s) => {
      if (editId && s.id === editId) return false;
      return normalizeLower(s.admissionNo) === admissionNo;
    });

    if (duplicate) return "Admission number already exists.";
    return "";
  };

  const validateForm = () => {
    if (!normalizeText(form.name)) return "Student name is required.";
    if (!normalizeText(form.admissionNo)) return "Admission number is required.";
    if (!form.grade) return "Grade is required.";
    if (!form.section) return "Section is required.";

    const grade = Number(form.grade);

    if (shouldShowALFields(grade)) {
      if (!normalizeText(form.stream)) return "Stream is required for Grades 12 to 13.";
      if (!isValidClassroom(form.grade, form.section, form.stream)) {
        return "Selected A/L grade, section, and stream do not match an existing classroom.";
      }
    } else {
      if (!isValidClassroom(form.grade, form.section)) {
        return "Selected grade and section do not match an existing classroom.";
      }
    }

    const duplicateAdmission = validateAdmissionNoUniqueness();
    if (duplicateAdmission) return duplicateAdmission;

    if (shouldShowReligion(grade) && !normalizeText(form.religion)) {
      return "Religion is required for Grades 6 to 11.";
    }

    if (shouldShowAesthetic(grade)) {
      if (aestheticOptions.length === 0) {
        return "No aesthetic subjects are defined for this grade.";
      }
      if (!normalizeText(form.aestheticChoice)) {
        return "Aesthetic choice is required for Grades 6 to 9.";
      }
    }

    if (shouldShowBasketChoices(grade)) {
      if (basketOptions.A.length === 0 || basketOptions.B.length === 0 || basketOptions.C.length === 0) {
        return "Basket subject definitions are incomplete for this grade.";
      }
      if (!normalizeText(form.basketAChoice)) return "Basket A choice is required.";
      if (!normalizeText(form.basketBChoice)) return "Basket B choice is required.";
      if (!normalizeText(form.basketCChoice)) return "Basket C choice is required.";
    }

    if (shouldShowALFields(grade)) {
      const cleaned = cleanFormByGrade(form);
      const result = validateALChoices({
        grade,
        stream: cleaned.stream,
        choiceNumbers: cleaned.alSubjectChoiceNumbers,
        choiceNames: cleaned.alSubjectChoices,
      });

      if (!result.valid) {
        return result.reason || "Invalid A/L subject choices.";
      }
    }

    return "";
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const studentName = getStudentName(s).toLowerCase();

    const matchSearch =
      !q ||
      studentName.includes(q) ||
      normalizeText(s.admissionNo).toLowerCase().includes(q) ||
      normalizeText(s.religion).toLowerCase().includes(q) ||
      normalizeText(s.stream).toLowerCase().includes(q) ||
      normalizeText(s.alClassName).toLowerCase().includes(q);

    const matchGrade = !filterGrade || String(s.grade) === String(filterGrade);
    const matchSection =
      !filterSection || normalizeSectionValue(s.section || s.className) === filterSection;
    const matchStatus = !filterStatus || s.status === filterStatus;

    return matchSearch && matchGrade && matchSection && matchStatus;
  });

  const activeCount = students.filter((s) => s.status === "Active").length;
  const leftCount = students.filter((s) => s.status === "Left").length;

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayloadFromForm();

      if (editId) {
        await updateDoc(doc(db, "students", editId), payload);
        setSuccess("Student updated successfully.");
      } else {
        await addDoc(collection(db, "students"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Student added successfully.");
      }

      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await fetchData();
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s) => {
    const choiceNumbers = Array.isArray(s.alSubjectChoiceNumbers) ? s.alSubjectChoiceNumbers : [];
    const choiceNames =
      Array.isArray(s.alSubjectChoices) && s.alSubjectChoices.length > 0
        ? s.alSubjectChoices
        : deriveALChoiceNamesFromNumbers(choiceNumbers);

    setForm({
      name: s.name || s.fullName || "",
      admissionNo: s.admissionNo || "",
      grade: s.grade || "",
      section: s.section || s.className || "",
      gender: s.gender || "",
      dob: s.dob || "",
      status: s.status || "Active",
      joinDate: s.joinDate || "",
      religion: s.religion || "",
      aestheticChoice: s.aestheticChoice || s.aesthetic || "",
      basketAChoice: s.basketAChoice || s.basket1 || "",
      basketBChoice: s.basketBChoice || s.basket2 || "",
      basketCChoice: s.basketCChoice || s.basket3 || "",
      stream: s.stream || "",
      streamCode: s.streamCode || "",
      alClassName: s.alClassName || "",
      alSubjectChoiceNumbers: choiceNumbers,
      alSubjectChoices: choiceNames,
      medium: s.medium || "",
    });

    setEditId(s.id);
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const handleInactivate = async (student) => {
    if (!window.confirm(`Set student "${getStudentName(student)}" as Left?`)) return;

    try {
      await updateDoc(doc(db, "students", student.id), {
        status: "Left",
        updatedAt: new Date().toISOString(),
      });
      setSuccess("Student status updated to Left.");
      await fetchData();
    } catch (err) {
      setError("Status update failed: " + err.message);
    }
  };

  const mapExcelRowToStudent = (row) => {
    const al1Number = normalizeText(row["AL Subject No 1"] || row["A/L Subject No 1"] || row["AL No 1"]);
    const al2Number = normalizeText(row["AL Subject No 2"] || row["A/L Subject No 2"] || row["AL No 2"]);
    const al3Number = normalizeText(row["AL Subject No 3"] || row["A/L Subject No 3"] || row["AL No 3"]);

    const al1 = normalizeText(row["AL Subject 1"] || row["A/L Subject 1"] || row["AL1"]);
    const al2 = normalizeText(row["AL Subject 2"] || row["A/L Subject 2"] || row["AL2"]);
    const al3 = normalizeText(row["AL Subject 3"] || row["A/L Subject 3"] || row["AL3"]);

    const raw = {
      name: normalizeText(row["Name"] || row["name"]),
      admissionNo: normalizeText(row["Admission No"] || row["admissionNo"] || row["AdmissionNo"]),
      grade: normalizeGradeValue(row["Grade"] || row["grade"]),
      section: normalizeSectionValue(row["Section"] || row["section"]),
      gender: normalizeText(row["Gender"] || row["gender"]),
      dob: normalizeText(row["DOB"] || row["dob"]),
      status: normalizeText(row["Status"] || row["status"]) || "Active",
      joinDate: normalizeText(row["Join Date"] || row["joinDate"]),
      religion: normalizeText(row["Religion"] || row["religion"]),
      aestheticChoice: normalizeText(row["Aesthetic Choice"] || row["aestheticChoice"]),
      basketAChoice: normalizeText(row["Basket A Choice"] || row["basketAChoice"] || row["Basket 1"] || row["basket1"]),
      basketBChoice: normalizeText(row["Basket B Choice"] || row["basketBChoice"] || row["Basket 2"] || row["basket2"]),
      basketCChoice: normalizeText(row["Basket C Choice"] || row["basketCChoice"] || row["Basket 3"] || row["basket3"]),
      stream: normalizeText(row["Stream"] || row["stream"]),
      alSubjectChoiceNumbers: [al1Number, al2Number, al3Number].filter(Boolean),
      alSubjectChoices: [al1, al2, al3].filter(Boolean),
      medium: normalizeText(row["Medium"] || row["medium"]),
    };

    return cleanFormByGrade(raw);
  };

  const validateBulkRow = (student, rowNumber, seenAdmissionNos) => {
    if (!student.name) return `Row ${rowNumber}: Student name is required.`;
    if (!student.admissionNo) return `Row ${rowNumber}: Admission number is required.`;

    if (seenAdmissionNos.has(normalizeLower(student.admissionNo))) {
      return `Row ${rowNumber}: Duplicate admission number in upload file.`;
    }

    const existingStudent = students.find(
      (s) => normalizeLower(s.admissionNo) === normalizeLower(student.admissionNo)
    );
    if (existingStudent) {
      return `Row ${rowNumber}: Admission number already exists.`;
    }

    if (!student.grade) return `Row ${rowNumber}: Grade is required.`;
    if (!student.section) return `Row ${rowNumber}: Section is required.`;

    const grade = Number(student.grade);

    if (shouldShowALFields(grade)) {
      if (!normalizeText(student.stream)) {
        return `Row ${rowNumber}: Stream is required for Grades 12 to 13.`;
      }

      if (!isValidClassroom(student.grade, student.section, student.stream)) {
        return `Row ${rowNumber}: Grade ${student.grade}, Section ${student.section}, Stream ${student.stream} does not exist in classrooms.`;
      }

      const validation = validateALChoices({
        grade,
        stream: student.stream,
        choiceNumbers: student.alSubjectChoiceNumbers || [],
        choiceNames: student.alSubjectChoices || [],
      });

      if (!validation.valid) {
        return `Row ${rowNumber}: ${validation.reason}`;
      }
    } else {
      if (!isValidClassroom(student.grade, student.section)) {
        return `Row ${rowNumber}: Grade ${student.grade} Section ${student.section} does not exist in classrooms.`;
      }
    }

    if (shouldShowReligion(grade) && !normalizeText(student.religion)) {
      return `Row ${rowNumber}: Religion is required for Grades 6 to 11.`;
    }

    if (shouldShowAesthetic(grade) && !normalizeText(student.aestheticChoice)) {
      return `Row ${rowNumber}: Aesthetic choice is required for Grades 6 to 9.`;
    }

    if (shouldShowBasketChoices(grade)) {
      if (!normalizeText(student.basketAChoice)) return `Row ${rowNumber}: Basket A choice is required.`;
      if (!normalizeText(student.basketBChoice)) return `Row ${rowNumber}: Basket B choice is required.`;
      if (!normalizeText(student.basketCChoice)) return `Row ${rowNumber}: Basket C choice is required.`;
    }

    return "";
  };

  const buildBulkPayload = (student) => {
    const cleaned = cleanFormByGrade(student);
    const grade = Number(cleaned.grade);
    const section = normalizeSectionValue(cleaned.section);
    const alMeta = buildALMetadata(grade, cleaned.stream, section);

    return {
      name: normalizeText(cleaned.name),
      fullName: normalizeText(cleaned.name),

      admissionNo: normalizeText(cleaned.admissionNo),

      grade,
      section,
      className: section,

      gender: normalizeText(cleaned.gender),
      dob: normalizeText(cleaned.dob),
      status: normalizeText(cleaned.status) || "Active",
      joinDate: normalizeText(cleaned.joinDate),

      religion: normalizeText(cleaned.religion),

      aesthetic: normalizeText(cleaned.aestheticChoice),
      aestheticChoice: normalizeText(cleaned.aestheticChoice),

      basket1: normalizeText(cleaned.basketAChoice),
      basket2: normalizeText(cleaned.basketBChoice),
      basket3: normalizeText(cleaned.basketCChoice),

      basketAChoice: normalizeText(cleaned.basketAChoice),
      basketBChoice: normalizeText(cleaned.basketBChoice),
      basketCChoice: normalizeText(cleaned.basketCChoice),

      stream: alMeta.stream,
      streamCode: alMeta.streamCode,
      alClassName: alMeta.alClassName,

      alSubjectChoiceNumbers: Array.isArray(cleaned.alSubjectChoiceNumbers)
        ? cleaned.alSubjectChoiceNumbers
        : [],
      alSubjectChoices: Array.isArray(cleaned.alSubjectChoices)
        ? cleaned.alSubjectChoices
        : [],

      medium: normalizeText(cleaned.medium),

      updatedAt: new Date().toISOString(),
    };
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkUploading(true);
    setBulkProgress(0);
    setBulkResults(null);
    setError("");
    setSuccess("");

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (!rows.length) {
        throw new Error("The selected Excel file is empty.");
      }

      const seenAdmissionNos = new Set();

      const preparedRows = rows.map((row, idx) => {
        const student = mapExcelRowToStudent(row);
        const rowNumber = idx + 2;
        const validationError = validateBulkRow(student, rowNumber, seenAdmissionNos);

        if (!validationError && student.admissionNo) {
          seenAdmissionNos.add(normalizeLower(student.admissionNo));
        }

        return { student, rowNumber, validationError };
      });

      const validRows = preparedRows.filter((item) => !item.validationError);
      const invalidRows = preparedRows.filter((item) => item.validationError);

      let successCount = 0;
      let failCount = invalidRows.length;
      const errors = invalidRows.map((item) => item.validationError);

      for (let i = 0; i < validRows.length; i += 1) {
        const item = validRows[i];
        try {
          await addDoc(collection(db, "students"), {
            ...buildBulkPayload(item.student),
            createdAt: new Date().toISOString(),
          });
          successCount += 1;
        } catch (err) {
          failCount += 1;
          errors.push(`Row ${item.rowNumber}: ${err.message}`);
        }

        setBulkProgress(
          Math.round(((i + 1) / Math.max(validRows.length, 1)) * 100)
        );
      }

      if (validRows.length === 0) {
        setBulkProgress(100);
      }

      setBulkResults({ successCount, failCount, errors });
      await fetchData();
    } catch (err) {
      setError("Bulk upload failed: " + err.message);
    } finally {
      setBulkUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    const exportData = filtered.map((s) => ({
      "Admission No": s.admissionNo || "",
      Name: getStudentName(s),
      Grade: s.grade || "",
      Section: s.section || s.className || "",
      Gender: s.gender || "",
      DOB: s.dob || "",
      Status: s.status || "",
      "Join Date": s.joinDate || "",
      Religion: s.religion || "",
      "Aesthetic Choice": s.aestheticChoice || s.aesthetic || "",
      "Basket A Choice": s.basketAChoice || s.basket1 || "",
      "Basket B Choice": s.basketBChoice || s.basket2 || "",
      "Basket C Choice": s.basketCChoice || s.basket3 || "",
      Stream: s.stream || "",
      "Stream Code": s.streamCode || "",
      "A/L Class Name": s.alClassName || "",
      "AL Subject No 1": Array.isArray(s.alSubjectChoiceNumbers) ? s.alSubjectChoiceNumbers[0] || "" : "",
      "AL Subject No 2": Array.isArray(s.alSubjectChoiceNumbers) ? s.alSubjectChoiceNumbers[1] || "" : "",
      "AL Subject No 3": Array.isArray(s.alSubjectChoiceNumbers) ? s.alSubjectChoiceNumbers[2] || "" : "",
      "AL Subject 1": Array.isArray(s.alSubjectChoices) ? s.alSubjectChoices[0] || "" : "",
      "AL Subject 2": Array.isArray(s.alSubjectChoices) ? s.alSubjectChoices[1] || "" : "",
      "AL Subject 3": Array.isArray(s.alSubjectChoices) ? s.alSubjectChoices[2] || "" : "",
      Medium: s.medium || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `students_export_${Date.now()}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        "Admission No": "ADM001",
        Name: "Junior Student",
        Grade: 8,
        Section: "A",
        Gender: "Male",
        DOB: "2012-01-15",
        Status: "Active",
        "Join Date": "2026-01-01",
        Religion: "Hinduism",
        "Aesthetic Choice": "Art",
        "Basket A Choice": "",
        "Basket B Choice": "",
        "Basket C Choice": "",
        Stream: "",
        "Stream Code": "",
        "A/L Class Name": "",
        "AL Subject No 1": "",
        "AL Subject No 2": "",
        "AL Subject No 3": "",
        "AL Subject 1": "",
        "AL Subject 2": "",
        "AL Subject 3": "",
        Medium: "Tamil",
      },
      {
        "Admission No": "ADM010",
        Name: "OL Student",
        Grade: 11,
        Section: "B",
        Gender: "Female",
        DOB: "2010-05-12",
        Status: "Active",
        "Join Date": "2026-01-01",
        Religion: "Catholicism",
        "Aesthetic Choice": "",
        "Basket A Choice": "Geography",
        "Basket B Choice": "Art",
        "Basket C Choice": "Information & Communication Technology",
        Stream: "",
        "Stream Code": "",
        "A/L Class Name": "",
        "AL Subject No 1": "",
        "AL Subject No 2": "",
        "AL Subject No 3": "",
        "AL Subject 1": "",
        "AL Subject 2": "",
        "AL Subject 3": "",
        Medium: "Tamil",
      },
      {
        "Admission No": "ADM100",
        Name: "AL Student",
        Grade: 12,
        Section: "A",
        Gender: "Male",
        DOB: "2008-07-04",
        Status: "Active",
        "Join Date": "2026-01-01",
        Religion: "",
        "Aesthetic Choice": "",
        "Basket A Choice": "",
        "Basket B Choice": "",
        "Basket C Choice": "",
        Stream: "Physical Science",
        "Stream Code": "MATHS",
        "A/L Class Name": "12 Physical Science A",
        "AL Subject No 1": "02",
        "AL Subject No 2": "",
        "AL Subject No 3": "",
        "AL Subject 1": "Chemistry",
        "AL Subject 2": "",
        "AL Subject 3": "",
        Medium: "English",
      },
      {
        "Admission No": "ADM101",
        Name: "AL Arts Student",
        Grade: 12,
        Section: "B",
        Gender: "Female",
        DOB: "2008-06-10",
        Status: "Active",
        "Join Date": "2026-01-01",
        Religion: "",
        "Aesthetic Choice": "",
        "Basket A Choice": "",
        "Basket B Choice": "",
        "Basket C Choice": "",
        Stream: "Arts",
        "Stream Code": "ARTS",
        "A/L Class Name": "12 Arts B",
        "AL Subject No 1": "22",
        "AL Subject No 2": "58",
        "AL Subject No 3": "",
        "AL Subject 1": "Geography",
        "AL Subject 2": "Drama and Theatre (Tamil)",
        "AL Subject 3": "",
        Medium: "Tamil",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_upload_template.xlsx");
  };

  const alValidationPreview = useMemo(() => {
    const grade = Number(form.grade);
    if (!shouldShowALFields(grade) || !normalizeText(form.stream)) return null;

    const cleaned = cleanFormByGrade(form);
    const validation = validateALChoices({
      grade,
      stream: cleaned.stream,
      choiceNumbers: cleaned.alSubjectChoiceNumbers,
      choiceNames: cleaned.alSubjectChoices,
    });

    return validation;
  }, [form]);

  return (
    <Box>
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 3,
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          boxShadow: "0 2px 8px rgba(26,35,126,0.08)",
          border: "1px solid #e8eaf6",
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1.5}
        >
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800} color="#1a237e">
              Students
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.4}>
              Student master with enrollment-driving fields only.
            </Typography>
            <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
              <Chip label={`Active: ${activeCount}`} size="small" color="success" sx={{ fontWeight: 700 }} />
              <Chip label={`Left: ${leftCount}`} size="small" color="error" sx={{ fontWeight: 700 }} />
              <Chip label={`Total: ${students.length}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
            </Box>
          </Box>

          <Box display="flex" gap={1} flexWrap="wrap">
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleBulkUpload}
            />

            <Tooltip title="Download Upload Template">
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ borderColor: "#1a237e", color: "#1a237e" }}
              >
                {isMobile ? "" : "Template"}
              </Button>
            </Tooltip>

            <Tooltip title="Bulk Upload Excel">
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current.click()}
                disabled={bulkUploading}
                sx={{ borderColor: "#43a047", color: "#43a047" }}
              >
                {isMobile ? "" : "Bulk Upload"}
              </Button>
            </Tooltip>

            <Tooltip title="Export to Excel">
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                sx={{ borderColor: "#0288d1", color: "#0288d1" }}
              >
                {isMobile ? "" : "Export"}
              </Button>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size={isMobile ? "small" : "medium"}
              onClick={() => {
                setForm(emptyForm);
                setEditId(null);
                setError("");
                setSuccess("");
                setOpen(true);
              }}
              sx={{ bgcolor: "#1a237e", fontWeight: 700, borderRadius: 2 }}
            >
              {isMobile ? "Add" : "Add Student"}
            </Button>
          </Box>
        </Box>

        {bulkUploading && (
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              Uploading... {bulkProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={bulkProgress} sx={{ mt: 0.5, borderRadius: 2 }} />
          </Box>
        )}

        {bulkResults && (
          <Alert
            severity={bulkResults.failCount > 0 ? "warning" : "success"}
            sx={{ mt: 1.5, borderRadius: 2 }}
            onClose={() => setBulkResults(null)}
          >
            Uploaded {bulkResults.successCount} students
            {bulkResults.failCount > 0 && `, ${bulkResults.failCount} failed`}
            {bulkResults.errors.length > 0 && (
              <Box mt={0.5}>
                {bulkResults.errors.slice(0, 5).map((err, i) => (
                  <Typography key={i} variant="caption" display="block">
                    {err}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}

        <Box display="flex" flexWrap="wrap" gap={1.5} mt={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search name, adm no, religion, stream"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
            InputProps={{
              startAdornment: (
                <SearchIcon fontSize="small" sx={{ mr: 0.5, color: "text.secondary" }} />
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Grade</InputLabel>
            <Select
              value={filterGrade}
              label="Grade"
              onChange={(e) => setFilterGrade(e.target.value)}
            >
              <MenuItem value="">All Grades</MenuItem>
              {gradeOptions.map((g) => (
                <MenuItem key={g} value={g}>
                  Grade {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filterSection}
              label="Section"
              onChange={(e) => setFilterSection(e.target.value)}
            >
              <MenuItem value="">All Sections</MenuItem>
              {sectionOptionsForFilter.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STUDENT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSearch("");
              setFilterGrade("");
              setFilterSection("");
              setFilterStatus("");
            }}
            sx={{ borderColor: "#e8eaf6", color: "text.secondary" }}
          >
            Clear
          </Button>

          <Typography variant="caption" color="text.secondary">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          textAlign="center"
          py={8}
          sx={{
            bgcolor: "white",
            borderRadius: 3,
            border: "1px solid #e8eaf6",
          }}
        >
          <PersonIcon sx={{ fontSize: 72, color: "#e8eaf6" }} />
          <Typography variant="h6" color="text.secondary" mt={1} fontWeight={600}>
            No students found
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {students.length === 0 ? 'Click "Add Student" to get started' : "Try adjusting your filters"}
          </Typography>
        </Box>
      ) : isMobile ? (
        <Box>
          {filtered.map((s) => (
            <Card
              key={s.id}
              sx={{
                mb: 1.5,
                borderRadius: 3,
                border: "1px solid #e8eaf6",
                boxShadow: "0 2px 8px rgba(26,35,126,0.07)",
              }}
            >
              <CardContent sx={{ pb: 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Avatar
                      sx={{
                        bgcolor: "#1a237e",
                        width: 38,
                        height: 38,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {initials(getStudentName(s))}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {getStudentName(s)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.admissionNo || "No Adm#"} • Grade {s.grade}-{s.section || s.className}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={s.status || "Unknown"}
                    size="small"
                    color={statusColor(s.status)}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                <Box mt={0.8}>
                  {s.religion && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Religion: {s.religion}
                    </Typography>
                  )}
                  {s.stream && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Stream: {s.stream}
                    </Typography>
                  )}
                  {s.alClassName && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Class: {s.alClassName}
                    </Typography>
                  )}
                </Box>
              </CardContent>

              <CardActions sx={{ pt: 0.5, pb: 1, px: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(s)}
                  sx={{ borderColor: "#1a237e", color: "#1a237e" }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<BlockIcon />}
                  onClick={() => handleInactivate(s)}
                  disabled={s.status === "Left"}
                >
                  Leave
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <Paper
          sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(26,35,126,0.08)",
            border: "1px solid #e8eaf6",
            overflow: "hidden",
          }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1a237e" }}>
              <TableRow>
                {[
                  "#",
                  "Student",
                  "Adm No",
                  "Grade/Sec",
                  "Status",
                  "Religion / Stream",
                  "Enrollment Fields",
                  "Actions",
                ].map((h) => (
                  <TableCell key={h} sx={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s, idx) => (
                <TableRow key={s.id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" } }}>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar
                        sx={{
                          width: 30,
                          height: 30,
                          bgcolor: "#1a237e",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {initials(getStudentName(s))}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {getStudentName(s)}
                        </Typography>
                        {s.gender && (
                          <Typography variant="caption" color="text.secondary">
                            {s.gender}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={700} color="#1a237e">
                      {s.admissionNo || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`G${s.grade}-${s.section || s.className}`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700, fontSize: 12 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.status || "Unknown"}
                      size="small"
                      color={statusColor(s.status)}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {s.religion || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {s.stream || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {s.alClassName || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {(s.aestheticChoice || s.aesthetic) && (
                        <Chip size="small" label={`Aesthetic: ${s.aestheticChoice || s.aesthetic}`} />
                      )}
                      {(s.basketAChoice || s.basket1) && (
                        <Chip size="small" label={`A: ${s.basketAChoice || s.basket1}`} color="warning" />
                      )}
                      {(s.basketBChoice || s.basket2) && (
                        <Chip size="small" label={`B: ${s.basketBChoice || s.basket2}`} color="warning" />
                      )}
                      {(s.basketCChoice || s.basket3) && (
                        <Chip size="small" label={`C: ${s.basketCChoice || s.basket3}`} color="warning" />
                      )}
                      {Array.isArray(s.alSubjectChoices) &&
                        s.alSubjectChoices.map((item, itemIdx) => (
                          <Chip
                            key={`${s.id}-al-${itemIdx}`}
                            size="small"
                            label={item}
                            color="success"
                          />
                        ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => handleEdit(s)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Mark as Left">
                      <span>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleInactivate(s)}
                          disabled={s.status === "Left"}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ bgcolor: "#1a237e", color: "white", fontWeight: 700 }}>
          {editId ? "Edit Student" : "Add Student"}
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={sectionCardSx}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={800} mb={2}>
                    Basic Details
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        label="Full Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        label="Admission No."
                        value={form.admissionNo}
                        onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
                      />
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth required>
                        <InputLabel>Grade</InputLabel>
                        <Select
                          value={form.grade}
                          label="Grade"
                          onChange={(e) =>
                            setForm(
                              cleanFormByGrade({
                                ...form,
                                grade: e.target.value,
                                section: "",
                                stream: "",
                                streamCode: "",
                                alClassName: "",
                                alSubjectChoiceNumbers: [],
                                alSubjectChoices: [],
                              })
                            )
                          }
                        >
                          <MenuItem value="">
                            <em>Select Grade</em>
                          </MenuItem>
                          {gradeOptions.map((g) => (
                            <MenuItem key={g} value={g}>
                              Grade {g}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth required disabled={!form.grade}>
                        <InputLabel>Section</InputLabel>
                        <Select
                          value={form.section}
                          label="Section"
                          onChange={(e) =>
                            setForm((prev) => {
                              const nextSection = e.target.value;
                              const alMeta = buildALMetadata(prev.grade, prev.stream, nextSection);
                              return {
                                ...prev,
                                section: nextSection,
                                streamCode: alMeta.streamCode,
                                alClassName: alMeta.alClassName,
                              };
                            })
                          }
                        >
                          <MenuItem value="">
                            <em>Select Section</em>
                          </MenuItem>
                          {sectionOptionsForForm.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </Select>
                        {form.grade && sectionOptionsForForm.length === 0 && (
                          <FormHelperText error>No sections found for this grade.</FormHelperText>
                        )}
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={form.status}
                          label="Status"
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                          {STUDENT_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={sectionCardSx}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={800} mb={2}>
                    Personal
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Gender</InputLabel>
                        <Select
                          value={form.gender}
                          label="Gender"
                          onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        >
                          <MenuItem value="">—</MenuItem>
                          {GENDERS.map((g) => (
                            <MenuItem key={g} value={g}>
                              {g}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Date of Birth"
                        type="date"
                        value={form.dob}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Join Date"
                        type="date"
                        value={form.joinDate}
                        onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Medium</InputLabel>
                        <Select
                          value={form.medium}
                          label="Medium"
                          onChange={(e) => setForm({ ...form, medium: e.target.value })}
                        >
                          <MenuItem value="">—</MenuItem>
                          {MEDIUM_OPTIONS.map((item) => (
                            <MenuItem key={item} value={item}>
                              {item}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          height: "100%",
                          border: "1px dashed #c5cae9",
                          borderRadius: 2,
                          px: 2,
                          py: 1.5,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Grade band controls which enrollment-driving fields appear.
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={sectionCardSx}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={800} mb={2}>
                    Enrollment-Driving Fields
                  </Typography>

                  {!form.grade ? (
                    <Alert severity="info">
                      Select the student grade first to load the correct enrollment fields.
                    </Alert>
                  ) : (
                    <>
                      {enrollmentWarnings.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          {enrollmentWarnings.map((warning, idx) => (
                            <Typography key={idx} variant="body2">
                              {warning}
                            </Typography>
                          ))}
                        </Alert>
                      )}

                      <Grid container spacing={2}>
                        {shouldShowReligion(form.grade) && (
                          <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth required>
                              <InputLabel>Religion</InputLabel>
                              <Select
                                value={form.religion}
                                label="Religion"
                                onChange={(e) => setForm({ ...form, religion: e.target.value })}
                              >
                                {religionSubjectOptions.map((item) => (
                                  <MenuItem key={item} value={item}>
                                    {item}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        )}

                        {shouldShowAesthetic(form.grade) && (
                          <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth required disabled={aestheticOptions.length === 0}>
                              <InputLabel>Aesthetic Choice</InputLabel>
                              <Select
                                value={form.aestheticChoice}
                                label="Aesthetic Choice"
                                onChange={(e) =>
                                  setForm({ ...form, aestheticChoice: e.target.value })
                                }
                              >
                                {aestheticOptions.map((subject) => (
                                  <MenuItem key={subject.id} value={subjectDisplayName(subject)}>
                                    {subjectDisplayName(subject)}
                                  </MenuItem>
                                ))}
                              </Select>
                              {aestheticOptions.length === 0 && (
                                <FormHelperText error>
                                  No active aesthetic subjects found for this grade.
                                </FormHelperText>
                              )}
                            </FormControl>
                          </Grid>
                        )}

                        {shouldShowBasketChoices(form.grade) && (
                          <>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth required disabled={basketOptions.A.length === 0}>
                                <InputLabel>Basket A Choice</InputLabel>
                                <Select
                                  value={form.basketAChoice}
                                  label="Basket A Choice"
                                  onChange={(e) =>
                                    setForm({ ...form, basketAChoice: e.target.value })
                                  }
                                >
                                  {basketOptions.A.map((subject) => (
                                    <MenuItem key={subject.id} value={subjectDisplayName(subject)}>
                                      {subjectDisplayName(subject)}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {basketOptions.A.length === 0 && (
                                  <FormHelperText error>No Basket A subjects found.</FormHelperText>
                                )}
                              </FormControl>
                            </Grid>

                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth required disabled={basketOptions.B.length === 0}>
                                <InputLabel>Basket B Choice</InputLabel>
                                <Select
                                  value={form.basketBChoice}
                                  label="Basket B Choice"
                                  onChange={(e) =>
                                    setForm({ ...form, basketBChoice: e.target.value })
                                  }
                                >
                                  {basketOptions.B.map((subject) => (
                                    <MenuItem key={subject.id} value={subjectDisplayName(subject)}>
                                      {subjectDisplayName(subject)}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {basketOptions.B.length === 0 && (
                                  <FormHelperText error>No Basket B subjects found.</FormHelperText>
                                )}
                              </FormControl>
                            </Grid>

                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth required disabled={basketOptions.C.length === 0}>
                                <InputLabel>Basket C Choice</InputLabel>
                                <Select
                                  value={form.basketCChoice}
                                  label="Basket C Choice"
                                  onChange={(e) =>
                                    setForm({ ...form, basketCChoice: e.target.value })
                                  }
                                >
                                  {basketOptions.C.map((subject) => (
                                    <MenuItem key={subject.id} value={subjectDisplayName(subject)}>
                                      {subjectDisplayName(subject)}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {basketOptions.C.length === 0 && (
                                  <FormHelperText error>No Basket C subjects found.</FormHelperText>
                                )}
                              </FormControl>
                            </Grid>
                          </>
                        )}

                        {shouldShowALFields(form.grade) && (
                          <>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth required>
                                <InputLabel>Stream</InputLabel>
                                <Select
                                  value={form.stream}
                                  label="Stream"
                                  onChange={(e) =>
                                    setForm((prev) => {
                                      const nextStream = e.target.value;
                                      const alMeta = buildALMetadata(prev.grade, nextStream, prev.section);
                                      return {
                                        ...prev,
                                        stream: nextStream,
                                        streamCode: alMeta.streamCode,
                                        alClassName: alMeta.alClassName,
                                        alSubjectChoiceNumbers: [],
                                        alSubjectChoices: [],
                                      };
                                    })
                                  }
                                >
                                  {AL_STREAM_OPTIONS.map((item) => (
                                    <MenuItem key={item} value={item}>
                                      {item}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>

                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                label="Stream Code"
                                value={form.streamCode}
                                InputProps={{ readOnly: true }}
                              />
                            </Grid>

                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                label="A/L Class Name"
                                value={
                                  form.alClassName ||
                                  buildALClassName(form.grade, form.stream, form.section)
                                }
                                InputProps={{ readOnly: true }}
                              />
                            </Grid>

                            <Grid item xs={12}>
                              <FormControl
                                fullWidth
                                required
                                disabled={!form.stream || alOptionalChoiceOptions.length === 0}
                              >
                                <InputLabel>A/L Optional Subject Choice(s)</InputLabel>
                                <Select
                                  multiple
                                  value={form.alSubjectChoiceNumbers}
                                  onChange={(e) => {
                                    const selectedNumbers =
                                      typeof e.target.value === "string"
                                        ? e.target.value.split(",")
                                        : e.target.value;

                                    const selectedSubjects =
                                      convertALChoiceNumbersToSubjects(selectedNumbers);

                                    setForm({
                                      ...form,
                                      alSubjectChoiceNumbers: selectedSubjects.map((subject) => subject.subjectNumber),
                                      alSubjectChoices: selectedSubjects.map((subject) => subject.subjectName),
                                    });
                                  }}
                                  input={<OutlinedInput label="A/L Optional Subject Choice(s)" />}
                                  renderValue={(selected) => {
                                    const names = deriveALChoiceNamesFromNumbers(selected);
                                    return names.join(", ");
                                  }}
                                >
                                  {alOptionalChoiceOptions.map((subject) => (
                                    <MenuItem key={subject.subjectNumber} value={subject.subjectNumber}>
                                      <Checkbox
                                        checked={
                                          form.alSubjectChoiceNumbers.indexOf(subject.subjectNumber) > -1
                                        }
                                      />
                                      <ListItemText
                                        primary={`${subject.subjectNumber} - ${subject.subjectName}`}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                                {!form.stream ? (
                                  <FormHelperText>Select stream first.</FormHelperText>
                                ) : alOptionalChoiceOptions.length === 0 ? (
                                  <FormHelperText error>
                                    No active A/L optional subjects found for this stream.
                                  </FormHelperText>
                                ) : (
                                  <FormHelperText>
                                    Choose the optional subject(s) required for the selected stream.
                                  </FormHelperText>
                                )}
                              </FormControl>
                            </Grid>

                            <Grid item xs={12}>
                              {alValidationPreview && (
                                <Alert severity={alValidationPreview.valid ? "success" : "warning"}>
                                  {alValidationPreview.valid ? (
                                    <>
                                      <Typography variant="body2" fontWeight={700}>
                                        A/L choices valid
                                      </Typography>
                                      <Typography variant="caption" display="block">
                                        Main subjects will be generated from stream compulsory subjects + selected optional subject(s).
                                      </Typography>
                                      <Typography variant="caption" display="block">
                                        Display class: {buildALDisplayClassName(form.grade, form.stream, form.section) || "—"}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography variant="body2">
                                      {alValidationPreview.reason}
                                    </Typography>
                                  )}
                                </Alert>
                              )}
                            </Grid>
                          </>
                        )}
                      </Grid>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ bgcolor: "#1a237e", fontWeight: 700 }}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : editId ? (
              "Update Student"
            ) : (
              "Save Student"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}